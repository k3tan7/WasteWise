"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fail, success, redirectTarget } from "@/lib/flash";
import { toNumber } from "@/lib/csv";
import { startOfDay, round } from "@/lib/utils";
import { forecastMeal } from "@/lib/services/forecast";
import { scoreMlPrediction } from "@/lib/services/ml-forecast";

const ALLOWED = ["ADMIN", "MESS_MANAGER"] as const;

function str(fd: FormData, key: string, fallback = "") {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : fallback;
}

function refresh() {
  revalidatePath("/meals");
  revalidatePath("/dashboard");
  revalidatePath("/predictions");
  revalidatePath("/waste");
  revalidatePath("/inventory");
  revalidatePath("/purchases");
}

export async function createMeal(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/meals");
  const dateRaw = str(fd, "date");
  const date = dateRaw ? startOfDay(new Date(dateRaw)) : null;
  const mealType = str(fd, "mealType", "LUNCH");
  if (!date || Number.isNaN(date.getTime())) fail(path, "A valid date is required.");

  const expectedStudents = toNumber(str(fd, "expectedStudents"), 0);
  const menuId = str(fd, "menuId") || null;

  try {
    await prisma.meal.upsert({
      where: { date_mealType: { date: date!, mealType } },
      update: { expectedStudents, menuId },
      create: { date: date!, mealType, expectedStudents, menuId, status: "PLANNED" },
    });
  } catch {
    fail(path, "Could not create meal.");
  }
  refresh();
  success(path, `Meal created for ${dateRaw} · ${mealType}.`);
}

/** Run the demand engine for this meal and persist the prediction. */
export async function generateMealPrediction(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/meals");
  const mealId = str(fd, "mealId");
  const meal = await prisma.meal.findUnique({ where: { id: mealId } });
  if (!meal) fail(path, "Meal not found.");

  const fc = await forecastMeal(meal!.date, meal!.mealType, { force: true });
  await prisma.mealPrediction.upsert({
    where: { date_mealType: { date: startOfDay(meal!.date), mealType: meal!.mealType } },
    update: {
      predictedConsumption: fc.predicted,
      recommendedPrep: fc.recommendedPrep,
      rangeLow: fc.rangeLow,
      rangeHigh: fc.rangeHigh,
      confidence: fc.confidence,
      model: fc.model,
    },
    create: {
      date: startOfDay(meal!.date),
      mealType: meal!.mealType,
      predictedConsumption: fc.predicted,
      recommendedPrep: fc.recommendedPrep,
      rangeLow: fc.rangeLow,
      rangeHigh: fc.rangeHigh,
      confidence: fc.confidence,
      model: fc.model,
      inputs: JSON.stringify({ attendance: fc.attendance, mealType: meal!.mealType }),
    },
  });
  await prisma.meal.update({
    where: { id: mealId },
    data: { predictedConsumption: fc.predicted, recommendedPrep: fc.recommendedPrep },
  });
  refresh();
  success(path, `Forecast generated: ${fc.predicted} diners (prep ${fc.recommendedPrep}, confidence ${(fc.confidence * 100).toFixed(0)}%).`);
}

/** Generate (and persist) forecasts for every meal on a date. */
export async function generateAllPredictions(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/predictions");
  const date = startOfDay(new Date(str(fd, "date") || Date.now()));
  const meals = await prisma.meal.findMany({ where: { date } });
  if (!meals.length) fail(path, "No meals exist for that date yet. Create the meals first.");

  let count = 0;
  for (const meal of meals) {
    const fc = await forecastMeal(meal.date, meal.mealType, { force: true });
    await prisma.mealPrediction.upsert({
      where: { date_mealType: { date, mealType: meal.mealType } },
      update: {
        predictedConsumption: fc.predicted,
        recommendedPrep: fc.recommendedPrep,
        rangeLow: fc.rangeLow,
        rangeHigh: fc.rangeHigh,
        confidence: fc.confidence,
        model: fc.model,
      },
      create: {
        date,
        mealType: meal.mealType,
        predictedConsumption: fc.predicted,
        recommendedPrep: fc.recommendedPrep,
        rangeLow: fc.rangeLow,
        rangeHigh: fc.rangeHigh,
        confidence: fc.confidence,
        model: fc.model,
        inputs: JSON.stringify({ attendance: fc.attendance, mealType: meal.mealType }),
      },
    });
    await prisma.meal.update({
      where: { id: meal.id },
      data: { predictedConsumption: fc.predicted, recommendedPrep: fc.recommendedPrep },
    });
    count++;
  }
  refresh();
  success(path, `Generated forecasts for ${count} meal(s).`);
}

/**
 * Complete a meal: record what was actually prepared/consumed, replace its
 * plate/unserved waste entries, and close the prediction learning loop.
 */
export async function completeMeal(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/meals");
  const mealId = str(fd, "mealId");
  const meal = await prisma.meal.findUnique({ where: { id: mealId } });
  if (!meal) fail(path, "Meal not found.");

  const actualPrep = toNumber(str(fd, "actualPrep"), 0);
  const actualConsumption = toNumber(str(fd, "actualConsumption"), 0);
  const unservedKg = toNumber(str(fd, "unservedKg"), 0);
  const plateWasteKg = toNumber(str(fd, "plateWasteKg"), 0);

  if (actualConsumption > actualPrep && actualPrep > 0)
    fail(path, "Consumption cannot exceed the quantity prepared. Check the numbers and try again.");

  const totalWasteKg = round(unservedKg + plateWasteKg, 2);

  await prisma.meal.update({
    where: { id: mealId },
    data: {
      actualPrep,
      actualConsumption,
      unservedKg,
      plateWasteKg,
      totalWasteKg,
      status: "COMPLETED",
      notes: str(fd, "notes") || null,
    },
  });

  // Replace this meal's plate / unserved food-waste records so totals stay truthful.
  await prisma.wasteRecord.deleteMany({
    where: { mealId, category: "FOOD", source: { in: ["PLATE", "UNSERVED"] } },
  });
  const rows = [] as { category: string; subCategory: string; source: string; weightKg: number }[];
  if (plateWasteKg > 0)
    rows.push({ category: "FOOD", subCategory: "PLATE", source: "PLATE", weightKg: plateWasteKg });
  if (unservedKg > 0)
    rows.push({ category: "FOOD", subCategory: "UNSERVED", source: "UNSERVED", weightKg: unservedKg });
  if (rows.length) {
    await prisma.wasteRecord.createMany({
      data: rows.map((r) => ({
        date: startOfDay(meal!.date),
        mealType: meal!.mealType,
        mealId: meal!.id,
        location: "Main Mess",
        treatmentDestination: "COMPOST",
        ...r,
      })),
    });
  }

  // Learning loop: close the prediction error for this meal.
  const prediction = await prisma.mealPrediction.findUnique({
    where: { date_mealType: { date: startOfDay(meal!.date), mealType: meal!.mealType } },
  });
  if (prediction) {
    await prisma.mealPrediction.update({
      where: { id: prediction.id },
      data: { actualConsumption, error: actualConsumption - prediction.predictedConsumption },
    });
  }

  // Close the ML learning loop too: attach actuals to stored ML predictions.
  await scoreMlPrediction("DEMAND", meal!.date, meal!.mealType, actualConsumption);
  if (totalWasteKg > 0) await scoreMlPrediction("WASTE", meal!.date, meal!.mealType, totalWasteKg);

  refresh();
  success(path, `${meal!.mealType} completed — ${actualConsumption} diners, ${totalWasteKg} kg food waste recorded.`);
}

export async function deleteMeal(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/meals");
  const id = str(fd, "id");
  await prisma.meal.delete({ where: { id } }).catch(() => fail(path, "Could not delete meal."));
  refresh();
  success(path, "Meal deleted.");
}
