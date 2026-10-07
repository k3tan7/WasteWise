"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fail, success, redirectTarget } from "@/lib/flash";
import { parseCsv, toDate, toNumber } from "@/lib/csv";
import { addDays, round, startOfDay, toISODate } from "@/lib/utils";
import { predictWaste } from "@/lib/prediction/waste";
import { detectWasteAnomaly } from "@/lib/prediction/anomaly";
import { getSettings, dailyBaselineKg, anomalyThresholdPct } from "@/lib/settings";
import { mlWastePredict, recordWastePrediction } from "@/lib/services/ml-forecast";

const ALLOWED = ["ADMIN", "MESS_MANAGER", "WASTE_MANAGER"] as const;

function str(fd: FormData, key: string, fallback = "") {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : fallback;
}

function refresh() {
  revalidatePath("/waste");
  revalidatePath("/waste/analytics");
  revalidatePath("/dashboard");
  revalidatePath("/station");
  revalidatePath("/treatment");
}

/** Daily food-waste totals (kg) for the N days before `before`. */
async function dailyFoodWasteHistory(before: Date, days = 30) {
  const from = addDays(before, -days);
  const rows = await prisma.wasteRecord.findMany({
    where: { date: { gte: from, lt: before }, category: "FOOD" },
    select: { date: true, weightKg: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = toISODate(r.date);
    map.set(k, (map.get(k) ?? 0) + r.weightKg);
  }
  return Array.from(map.entries()).map(([k, v]) => ({ date: new Date(k), weightKg: v }));
}

export async function createWasteRecord(fd: FormData) {
  const user = await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/waste");
  const date = toDate(str(fd, "date")) ?? new Date();
  const category = str(fd, "category", "FOOD");
  const weightKg = toNumber(str(fd, "weightKg"), 0);
  if (weightKg <= 0) fail(path, "Weight must be greater than zero.");
  if (!["FOOD", "RECYCLABLE", "REJECT"].includes(category)) fail(path, "Invalid waste category.");

  const mealType = str(fd, "mealType") || null;
  const meal = mealType
    ? await prisma.meal.findUnique({ where: { date_mealType: { date: startOfDay(date), mealType } } })
    : null;

  try {
    await prisma.wasteRecord.create({
      data: {
        date: startOfDay(date),
        mealType,
        mealId: meal?.id ?? null,
        location: str(fd, "location", "Main Mess"),
        dishId: str(fd, "dishId") || null,
        category,
        subCategory: str(fd, "subCategory") || null,
        source: str(fd, "source", "OTHER"),
        weightKg,
        reasonId: str(fd, "reasonId") || null,
        treatmentDestination: str(fd, "treatmentDestination", "PENDING"),
        notes: str(fd, "notes") || null,
        recordedBy: user.name,
      },
    });
  } catch {
    fail(path, "Could not save the waste record.");
  }
  refresh();
  success(path, `Recorded ${weightKg} kg of ${category.toLowerCase()} waste.`);
}

export async function updateWasteRecord(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/waste");
  const id = str(fd, "id");
  const weightKg = toNumber(str(fd, "weightKg"), 0);
  if (!id) fail(path, "Missing record id.");
  if (weightKg <= 0) fail(path, "Weight must be greater than zero.");
  await prisma.wasteRecord
    .update({
      where: { id },
      data: {
        weightKg,
        category: str(fd, "category"),
        subCategory: str(fd, "subCategory") || null,
        source: str(fd, "source", "OTHER"),
        location: str(fd, "location", "Main Mess"),
        treatmentDestination: str(fd, "treatmentDestination", "PENDING"),
        reasonId: str(fd, "reasonId") || null,
        notes: str(fd, "notes") || null,
      },
    })
    .catch(() => fail(path, "Could not update the record."));
  refresh();
  success(path, "Waste record updated.");
}

export async function deleteWasteRecord(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/waste");
  await prisma.wasteRecord.delete({ where: { id: str(fd, "id") } }).catch(() => fail(path, "Could not delete."));
  refresh();
  success(path, "Waste record deleted.");
}

export async function importWasteCsv(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/waste");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) fail(path, "Please choose a CSV file.");
  const { rows } = parseCsv<Record<string, string>>(await (file as File).text());
  if (!rows.length) fail(path, "No rows found in the file.");

  let count = 0;
  const errors: string[] = [];
  for (const [i, r] of rows.entries()) {
    const date = toDate(r.date);
    const weightKg = toNumber(r.weightKg ?? r.weight, 0);
    if (!date || weightKg <= 0) {
      errors.push(`Row ${i + 2}: invalid date or weight`);
      continue;
    }
    const category = (r.category ?? "FOOD").toUpperCase().replace(/[^A-Z]/g, "");
    await prisma.wasteRecord.create({
      data: {
        date: startOfDay(date),
        mealType: (r.mealType ?? "").toUpperCase() || null,
        location: (r.location ?? "Main Mess").trim() || "Main Mess",
        category: ["FOOD", "RECYCLABLE", "REJECT"].includes(category) ? category : "FOOD",
        subCategory: (r.subCategory ?? "").toUpperCase() || null,
        source: (r.source ?? "OTHER").toUpperCase() || "OTHER",
        weightKg,
        treatmentDestination: (r.treatmentDestination ?? "PENDING").toUpperCase() || "PENDING",
        notes: (r.notes ?? "").trim() || null,
      },
    });
    count++;
  }
  refresh();
  if (!count) fail(path, `No rows imported. ${errors.slice(0, 3).join(" · ")}`);
  success(path, `Imported ${count} waste records${errors.length ? `, ${errors.length} skipped` : ""}.`);
}

/** Recompute the expected waste baseline for every meal on a date. */
export async function generateWastePredictions(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/waste");
  const date = startOfDay(toDate(str(fd, "date")) ?? new Date());
  const settings = await getSettings();

  const meals = await prisma.meal.findMany({
    where: { date },
    include: { menu: { include: { items: { include: { dish: true } } } } },
  });
  if (!meals.length) fail(path, "No meals recorded for that date yet.");

  const dailyHistory = await dailyFoodWasteHistory(date);
  const ingredientWasteAvg = 6;

  for (const meal of meals) {
    const history = await prisma.wasteRecord.findMany({
      where: { category: "FOOD", mealType: meal.mealType, date: { lt: date } },
      select: { date: true, weightKg: true, mealType: true },
    });
    const res = predictWaste({
      date,
      mealType: meal.mealType,
      history,
      dailyHistory,
      dailyBaselineKg: dailyBaselineKg(settings),
      recommendedPrep: meal.recommendedPrep ?? meal.actualPrep ?? 0,
      actualPrep: meal.actualPrep ?? 0,
      menuWastePcts: (meal.menu?.items ?? []).map((i) => i.dish.historicalWastePct),
      overallDishWastePct: ingredientWasteAvg,
    });
    // Prefer the trained ML waste model when one is active.
    const ml = await mlWastePredict(date, meal.mealType, {
      predictedDemand: meal.predictedConsumption ?? meal.actualConsumption ?? 0,
      recommendedPrep: meal.recommendedPrep ?? 0,
      actualPrep: meal.actualPrep ?? 0,
      actualConsumption: meal.actualConsumption ?? 0,
      attendance: meal.expectedStudents,
    });
    const expectedKg = ml ? ml.predicted : res.expectedKg;
    const rangeLow = ml ? ml.rangeLow : res.rangeLow;
    const rangeHigh = ml ? ml.rangeHigh : res.rangeHigh;
    const modelName = ml ? `ml-${ml.algorithm.toLowerCase()}-${ml.modelVersion}` : res.model;
    const actualKg = meal.totalWasteKg ?? null;
    if (ml) await recordWastePrediction(ml, date, meal.mealType, actualKg);
    const variancePct =
      actualKg != null && expectedKg > 0 ? round(((actualKg - expectedKg) / expectedKg) * 100, 1) : null;

    await prisma.wastePrediction.upsert({
      where: { date_mealType: { date, mealType: meal.mealType } },
      update: { expectedKg, rangeLow, rangeHigh, actualKg, variancePct, model: modelName },
      create: { date, mealType: meal.mealType, expectedKg, rangeLow, rangeHigh, actualKg, variancePct, model: modelName },
    });
  }
  refresh();
  success(path, `Updated expected waste for ${meals.length} meal(s).`);
}

/** Run robust anomaly detection and open an anomaly record when one is found. */
export async function runAnomalyDetection(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/waste");
  const date = startOfDay(toDate(str(fd, "date")) ?? new Date());
  const settings = await getSettings();
  const threshold = anomalyThresholdPct(settings);

  const meals = await prisma.meal.findMany({
    where: { date },
    include: { menu: { include: { items: { include: { dish: true } } } } },
  });
  if (!meals.length) fail(path, "No meals recorded for that date.");

  let opened = 0;
  for (const meal of meals) {
    if (meal.totalWasteKg == null) continue;
    const [history, prediction] = await Promise.all([
      prisma.wasteRecord.findMany({
        where: { category: "FOOD", mealType: meal.mealType, date: { lt: date } },
        select: { date: true, weightKg: true },
      }),
      prisma.wastePrediction.findUnique({ where: { date_mealType: { date, mealType: meal.mealType } } }),
    ]);
    const expectedKg = prediction?.expectedKg ?? 0;
    if (expectedKg <= 0) continue;

    const res = detectWasteAnomaly({
      actualKg: meal.totalWasteKg,
      expectedKg,
      history,
      actualPrep: meal.actualPrep ?? undefined,
      recommendedPrep: meal.recommendedPrep ?? undefined,
      menuHighWasteDishes: (meal.menu?.items ?? []).map((i) => ({
        name: i.dish.name,
        wastePct: i.dish.historicalWastePct,
        baselinePct: 6,
      })),
      thresholdPct: threshold,
    });
    if (!res.isAnomaly) continue;

    const existing = await prisma.wasteAnomaly.findFirst({ where: { date, mealType: meal.mealType } });
    if (existing) continue;
    await prisma.wasteAnomaly.create({
      data: {
        date,
        mealType: meal.mealType,
        expectedKg,
        actualKg: meal.totalWasteKg,
        variancePct: res.variancePct,
        severity: res.severity,
        status: "OPEN",
        contributors: JSON.stringify(res.contributors),
        summary: res.summary,
      },
    });
    await prisma.alert.create({
      data: {
        type: "WASTE_ANOMALY",
        severity: res.severity === "HIGH" ? "CRITICAL" : "WARNING",
        title: `${meal.mealType} waste anomaly (+${res.variancePct.toFixed(0)}%)`,
        message: res.summary,
        entityType: "WasteAnomaly",
      },
    });
    opened++;
  }
  refresh();
  success(path, opened ? `Detected ${opened} waste anomaly(ies).` : "No anomalies detected for that date.");
}

export async function recordCause(fd: FormData) {
  const user = await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/waste");
  const anomalyId = str(fd, "anomalyId");
  const causeCode = str(fd, "causeCode");
  const action = str(fd, "action");
  if (!anomalyId || !causeCode) fail(path, "Select a confirmed cause.");
  if (!action) fail(path, "Describe the corrective action.");

  const anomaly = await prisma.wasteAnomaly.findUnique({ where: { id: anomalyId } });
  if (!anomaly) fail(path, "Anomaly not found.");

  await prisma.correctiveAction.create({
    data: { anomalyId, causeCode, action, notes: str(fd, "notes") || null, createdBy: user.name },
  });
  await prisma.wasteAnomaly.update({ where: { id: anomalyId }, data: { status: "RESOLVED" } });
  // Tag the meal's food-waste records with the confirmed reason for learning.
  const reason = await prisma.wasteReason.findUnique({ where: { code: causeCode } });
  if (reason) {
    await prisma.wasteRecord.updateMany({
      where: { date: anomaly.date, mealType: anomaly.mealType, category: "FOOD", source: "PLATE" },
      data: { reasonId: reason.id },
    });
  }
  refresh();
  success(path, "Root cause and corrective action recorded.");
}

export async function setAnomalyStatus(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/waste");
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!["OPEN", "INVESTIGATING", "RESOLVED", "IGNORED"].includes(status)) fail(path, "Invalid status.");
  await prisma.wasteAnomaly.update({ where: { id }, data: { status } });
  refresh();
  success(path, `Anomaly marked ${status.toLowerCase()}.`);
}
