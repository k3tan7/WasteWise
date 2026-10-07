import { prisma } from "@/lib/db";
import { startOfDay, toISODate } from "@/lib/utils";
import { predictDemand, type DemandHistoryRow } from "@/lib/prediction/demand";
import { getSettings, prepBufferPct, participationBaseline } from "@/lib/settings";
import { mlDemandPredict, recordDemandPrediction } from "@/lib/services/ml-forecast";
import { estimateHeadsOnCampus } from "@/lib/services/attendance";
import type { RegressionMetrics } from "@/lib/ml/metrics";

export type ForecastFactor = { name: string; value: number; note: string };

export type MealForecast = {
  date: string;
  mealType: string;
  predicted: number;
  recommendedPrep: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: number;
  /** human-readable model identity, e.g. "ml-random_forest-v3" or "weighted-history-v1" */
  model: string;
  modelVersion?: string;
  algorithm?: string;
  /** "ml" when a trained regression model produced the value, else "statistical" */
  method: "ml" | "statistical";
  metrics?: RegressionMetrics;
  factors: ForecastFactor[];
  contributions: ForecastFactor[];
  attendance: number;
  stored: boolean;
};

/**
 * Produce a demand forecast for a date + meal.
 * Preference order: stored prediction → trained ML model → statistical baseline.
 */
export async function forecastMeal(
  date: Date,
  mealType: string,
  opts: { force?: boolean } = {}
): Promise<MealForecast> {
  const day = startOfDay(date);

  if (!opts.force) {
    const stored = await prisma.mealPrediction.findUnique({
      where: { date_mealType: { date: day, mealType } },
    });
    if (stored) {
      const inputs = JSON.parse(stored.inputs) as Record<string, number>;
      const isMl = stored.model.startsWith("ml-");
      return {
        date: toISODate(day),
        mealType,
        predicted: stored.predictedConsumption,
        recommendedPrep: stored.recommendedPrep,
        rangeLow: stored.rangeLow,
        rangeHigh: stored.rangeHigh,
        confidence: stored.confidence,
        model: stored.model,
        method: isMl ? "ml" : "statistical",
        factors: [],
        contributions: [],
        attendance: inputs.attendance ?? 0,
        stored: true,
      };
    }
  }

  const [settings, enrolled, present, history, meal] = await Promise.all([
    getSettings(),
    prisma.student.count({ where: { active: true } }),
    prisma.attendance.count({ where: { date: day, present: true } }),
    prisma.meal.findMany({
      where: { date: { lt: day }, actualConsumption: { not: null } },
      select: { date: true, mealType: true, actualConsumption: true, expectedStudents: true },
      orderBy: { date: "asc" },
    }),
    prisma.meal.findUnique({ where: { date_mealType: { date: day, mealType } } }),
  ]);

  const demandHistory: DemandHistoryRow[] = history.map((h) => ({
    date: h.date,
    mealType: h.mealType,
    consumed: h.actualConsumption ?? 0,
    present: Math.max(1, h.expectedStudents),
  }));

  // Attendance for a future date is usually not entered yet, so estimate it from
  // campus history rather than assuming zero people are on campus.
  const attendanceEstimate = await estimateHeadsOnCampus(day, mealType);

  const stat = predictDemand({
    date: day,
    mealType,
    attendance: attendanceEstimate.heads,
    enrolled,
    history: demandHistory,
    baselineParticipationPct: participationBaseline(settings, mealType),
    prepBufferPct: prepBufferPct(settings),
  });

  // -- Trained ML model takes precedence when available -------------------
  const ml = await mlDemandPredict(day, mealType);
  if (ml) {
    await recordDemandPrediction(ml, day, mealType, meal?.actualConsumption ?? null);
    const factors: ForecastFactor[] = [
      {
        name: "Attendance",
        value: stat.factors[0]?.value ?? attendanceEstimate.heads,
        note: attendanceEstimate.actual ? "Attendance recorded for this date" : `Projected heads on campus (${attendanceEstimate.source})`,
      },
      ...ml.contributions.slice(0, 6).map((c) => ({
        name: c.name.replace(/_/g, " "),
        value: c.value,
        note: `${(c.weight * 100).toFixed(0)}% model importance`,
      })),
    ];
    return {
      date: toISODate(day),
      mealType,
      predicted: ml.predicted,
      recommendedPrep: Math.max(ml.predicted, Math.ceil(ml.predicted * (1 + prepBufferPct(settings) / 100))),
      rangeLow: ml.rangeLow,
      rangeHigh: ml.rangeHigh,
      confidence: ml.confidence,
      model: `ml-${ml.algorithm.toLowerCase()}-${ml.modelVersion}`,
      modelVersion: ml.modelVersion,
      algorithm: ml.algorithm,
      method: "ml",
      metrics: ml.metrics,
      factors,
      contributions: ml.contributions.map((c) => ({
        name: c.name.replace(/_/g, " "),
        value: c.value,
        note: `${(c.weight * 100).toFixed(0)}% model importance`,
      })),
      attendance: present,
      stored: false,
    };
  }

  // -- Statistical fallback ------------------------------------------------
  return {
    date: toISODate(day),
    mealType,
    predicted: stat.predicted,
    recommendedPrep: Math.max(stat.predicted, Math.ceil(stat.predicted * (1 + prepBufferPct(settings) / 100))),
    rangeLow: stat.rangeLow,
    rangeHigh: stat.rangeHigh,
    confidence: stat.confidence,
    model: stat.model,
    method: "statistical",
    factors: stat.factors,
    contributions: stat.factors.map((f) => ({ name: f.name, value: f.value, note: f.note })),
    attendance: present,
    stored: false,
  };
}

/** Backtest accuracy summary for the last N days (from persisted errors). */
export async function accuracySummary(days: number, end: Date = new Date()) {
  const to = startOfDay(end);
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  const rows = await prisma.mealPrediction.findMany({
    where: { date: { gte: from, lte: to }, actualConsumption: { not: null } },
  });
  const errs = rows.map((r) => ({
    abs: Math.abs(r.error ?? 0),
    pct: r.predictedConsumption ? Math.abs((r.error ?? 0) / r.predictedConsumption) * 100 : 0,
  }));
  const mape = errs.length ? errs.reduce((a, e) => a + e.pct, 0) / errs.length : 0;
  const mae = errs.length ? errs.reduce((a, e) => a + e.abs, 0) / errs.length : 0;
  return { count: errs.length, mape, mae, accuracy: Math.max(0, 100 - mape) };
}
