import { prisma } from "@/lib/db";
import { clamp, round, startOfDay, toISODate } from "@/lib/utils";
import { getActiveModel, predictWith, type ModelKind } from "@/lib/ml/registry";
import { demandFeatureRow, wasteFeatureRow } from "@/lib/ml/dataset";
import type { RegressionMetrics } from "@/lib/ml/metrics";

export type MlPredictionResult = {
  predicted: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: number;
  modelId: string;
  modelVersion: string;
  algorithm: string;
  featureNames: string[];
  features: number[];
  contributions: { name: string; value: number; weight: number }[];
  metrics: RegressionMetrics;
  trainedAt: Date;
};

function confidenceFrom(metrics: RegressionMetrics, predicted: number, spread: number): number {
  const r2 = clamp(metrics.r2, 0, 0.99);
  const rel = spread / Math.max(1, Math.abs(predicted));
  return round(clamp(0.35 + r2 * (1 - Math.min(0.6, rel)) * 0.6, 0.35, 0.95), 3);
}

function band(predicted: number, spread: number) {
  const b = Math.max(Math.abs(predicted) * 0.02, 1.28 * spread);
  return { low: Math.max(0, predicted - b), high: predicted + b };
}

function contributions(featureNames: string[], features: number[], weights: { name: string; weight: number }[]) {
  const wMap = new Map(weights.map((w) => [w.name, w.weight]));
  return featureNames
    .map((name, i) => ({ name, value: round(features[i] ?? 0, 3), weight: wMap.get(name) ?? 0 }))
    .sort((a, b) => b.weight - a.weight);
}

async function record(
  kind: ModelKind,
  r: MlPredictionResult,
  date: Date,
  mealType: string,
  actual?: number | null
) {
  const day = startOfDay(date);
  const featuresJson = JSON.stringify(
    Object.fromEntries(r.featureNames.map((n, i) => [n, round(r.features[i] ?? 0, 4)]))
  );
  const data = {
    modelId: r.modelId,
    features: featuresJson,
    predicted: round(r.predicted, 3),
    rangeLow: round(r.rangeLow, 3),
    rangeHigh: round(r.rangeHigh, 3),
    confidence: r.confidence,
    ...(actual != null ? { actual, error: round(actual - r.predicted, 3), scoredAt: new Date() } : {}),
  };
  await prisma.mlPrediction.upsert({
    where: { kind_date_mealType: { kind, date: day, mealType } },
    update: data,
    create: { kind, date: day, mealType, ...data },
  });
}

/** Score a meal's demand with the active demand model (if any). */
export async function mlDemandPredict(date: Date, mealType: string): Promise<MlPredictionResult | null> {
  const active = await getActiveModel("DEMAND");
  if (!active) return null;
  const features = await demandFeatureRow(date, mealType);
  if (!features) return null;

  const { value, spread } = predictWith(active.model, features);
  const predicted = Math.max(0, Math.round(value));
  const b = band(predicted, spread);

  const result: MlPredictionResult = {
    predicted,
    rangeLow: Math.max(0, Math.round(b.low)),
    rangeHigh: Math.round(b.high),
    confidence: confidenceFrom(active.metrics, predicted, spread),
    modelId: active.row.id,
    modelVersion: active.row.version,
    algorithm: active.row.algorithm,
    featureNames: JSON.parse(active.row.featureNames) as string[],
    features,
    contributions: contributions(JSON.parse(active.row.featureNames) as string[], features, flattenImportance(active.row)),
    metrics: active.metrics,
    trainedAt: active.row.trainedAt,
  };
  return result;
}

function flattenImportance(row: { algorithm: string; artifact: string }): { name: string; weight: number }[] {
  const model = JSON.parse(row.artifact) as { algorithm: string; importance?: { name: string; weight: number }[] };
  return model.importance ?? [];
}

/** Score a meal's expected food waste with the active waste model (if any). */
export async function mlWastePredict(
  date: Date,
  mealType: string,
  values: { predictedDemand: number; recommendedPrep: number; actualPrep: number; actualConsumption: number; attendance?: number }
): Promise<MlPredictionResult | null> {
  const active = await getActiveModel("WASTE");
  if (!active) return null;
  const features = await wasteFeatureRow(date, mealType, values);
  if (!features) return null;

  const { value, spread } = predictWith(active.model, features);
  const predicted = Math.max(0, round(value, 2));
  const b = band(predicted, spread);
  const names = JSON.parse(active.row.featureNames) as string[];

  return {
    predicted,
    rangeLow: Math.max(0, round(b.low, 2)),
    rangeHigh: round(b.high, 2),
    confidence: confidenceFrom(active.metrics, predicted, spread),
    modelId: active.row.id,
    modelVersion: active.row.version,
    algorithm: active.row.algorithm,
    featureNames: names,
    features,
    contributions: contributions(names, features, flattenImportance(active.row)),
    metrics: active.metrics,
    trainedAt: active.row.trainedAt,
  };
}

export async function recordDemandPrediction(r: MlPredictionResult, date: Date, mealType: string, actual?: number | null) {
  await record("DEMAND", r, date, mealType, actual);
}

export async function recordWastePrediction(r: MlPredictionResult, date: Date, mealType: string, actual?: number | null) {
  await record("WASTE", r, date, mealType, actual);
}

/** Close the learning loop: attach actuals to stored ML predictions. */
export async function scoreMlPrediction(
  kind: ModelKind,
  date: Date,
  mealType: string,
  actual: number
): Promise<void> {
  const day = startOfDay(date);
  const existing = await prisma.mlPrediction.findUnique({
    where: { kind_date_mealType: { kind, date: day, mealType } },
  });
  if (!existing) return;
  await prisma.mlPrediction.update({
    where: { id: existing.id },
    data: { actual, error: round(actual - existing.predicted, 3), scoredAt: new Date() },
  });
}

export { toISODate };
