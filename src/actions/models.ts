"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { fail, success, redirectTarget } from "@/lib/flash";
import { trainModels, type ModelKind } from "@/lib/ml/registry";
import { forecastMeal } from "@/lib/services/forecast";
import { mlWastePredict, recordWastePrediction } from "@/lib/services/ml-forecast";
import { prisma } from "@/lib/db";
import { addDays, startOfDay, toISODate } from "@/lib/utils";

function str(fd: FormData, key: string, fallback = "") {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : fallback;
}

function refresh() {
  revalidatePath("/models");
  revalidatePath("/predictions");
  revalidatePath("/waste");
  revalidatePath("/dashboard");
}

/** Retrain one or both regression models and activate the best performer. */
export async function trainModelsAction(fd: FormData) {
  await requireRole(["ADMIN"]);
  const path = redirectTarget(fd, "/models");
  const kind = str(fd, "kind", "BOTH");
  const kinds: ModelKind[] = kind === "BOTH" ? ["DEMAND", "WASTE"] : [kind as ModelKind];

  try {
    const summaries = await trainModels(kinds);
    const skipped = summaries.filter((s) => s.version === "n/a");
    if (skipped.length === summaries.length) {
      fail(path, "Not enough completed meals to train yet. Complete more meals and try again.");
    }
    const best = summaries.filter((s) => s.isActive);
    const text = best
      .map((s) => `${s.kind}: ${s.algorithm} R²=${s.metrics.r2} RMSE=${s.metrics.rmse} (n=${s.trainN}/${s.testN})`)
      .join(" · ");
    refresh();
    success(path, `Retrained. Active models → ${text}`);
  } catch {
    fail(path, "Training failed. Check the server logs.");
  }
}

/** Re-score upcoming/recent meal forecasts and waste expectations using the active models. */
export async function backfillPredictionsAction(fd: FormData) {
  await requireRole(["ADMIN"]);
  const path = redirectTarget(fd, "/models");
  const days = Math.max(1, Math.min(30, Number(str(fd, "days", "7")) || 7));
  const end = startOfDay(new Date());

  let demandCount = 0;
  let wasteCount = 0;
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(end, -i);
    const meals = await prisma.meal.findMany({ where: { date } });
    for (const meal of meals) {
      // Regenerate the stored demand prediction using the active model.
      const fc = await forecastMeal(date, meal.mealType, { force: true });
      await prisma.mealPrediction.upsert({
        where: { date_mealType: { date, mealType: meal.mealType } },
        update: {
          predictedConsumption: fc.predicted,
          recommendedPrep: fc.recommendedPrep,
          rangeLow: fc.rangeLow,
          rangeHigh: fc.rangeHigh,
          confidence: fc.confidence,
          model: fc.model,
          actualConsumption: meal.actualConsumption ?? null,
          error: meal.actualConsumption != null ? meal.actualConsumption - fc.predicted : null,
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
          actualConsumption: meal.actualConsumption ?? null,
          error: meal.actualConsumption != null ? meal.actualConsumption - fc.predicted : null,
          inputs: JSON.stringify({ attendance: fc.attendance, method: fc.method }),
        },
      });
      demandCount++;

      const ml = await mlWastePredict(date, meal.mealType, {
        predictedDemand: meal.predictedConsumption ?? fc.predicted,
        recommendedPrep: meal.recommendedPrep ?? fc.recommendedPrep,
        actualPrep: meal.actualPrep ?? 0,
        actualConsumption: meal.actualConsumption ?? 0,
        attendance: meal.expectedStudents,
      });
      if (ml) {
        await recordWastePrediction(ml, date, meal.mealType, meal.totalWasteKg ?? null);
        if (meal.totalWasteKg != null) {
          await prisma.wastePrediction.upsert({
            where: { date_mealType: { date, mealType: meal.mealType } },
            update: {
              expectedKg: ml.predicted,
              rangeLow: ml.rangeLow,
              rangeHigh: ml.rangeHigh,
              actualKg: meal.totalWasteKg,
              variancePct: ml.predicted > 0 ? Math.round(((meal.totalWasteKg - ml.predicted) / ml.predicted) * 1000) / 10 : null,
              model: `ml-${ml.algorithm.toLowerCase()}-${ml.modelVersion}`,
            },
            create: {
              date,
              mealType: meal.mealType,
              expectedKg: ml.predicted,
              rangeLow: ml.rangeLow,
              rangeHigh: ml.rangeHigh,
              actualKg: meal.totalWasteKg,
              variancePct: ml.predicted > 0 ? Math.round(((meal.totalWasteKg - ml.predicted) / ml.predicted) * 1000) / 10 : null,
              model: `ml-${ml.algorithm.toLowerCase()}-${ml.modelVersion}`,
            },
          });
        }
        wasteCount++;
      }
    }
  }

  refresh();
  success(path, `Re-scored ${demandCount} demand and ${wasteCount} waste predictions over the last ${days} day(s) ending ${toISODate(end)}.`);
}
