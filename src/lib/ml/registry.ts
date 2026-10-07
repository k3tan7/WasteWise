import { prisma } from "@/lib/db";
import { evaluateForest, fitForest, forestSpread, predictForest, type ForestModel } from "@/lib/ml/forest";
import { evaluateLinear, fitLinear, linearImportance, predictLinear, type LinearModel } from "@/lib/ml/linear";
import type { RegressionMetrics } from "@/lib/ml/metrics";
import { buildDemandDataset, buildWasteDataset, type Dataset } from "@/lib/ml/dataset";

export type ModelKind = "DEMAND" | "WASTE";
export type Algorithm = "LINEAR" | "RANDOM_FOREST";
export type AnyModel = LinearModel | ForestModel;

export type TrainSummary = {
  kind: ModelKind;
  algorithm: Algorithm;
  version: string;
  isActive: boolean;
  trainN: number;
  testN: number;
  metrics: RegressionMetrics;
  importance: { name: string; weight: number }[];
};

const MIN_TRAIN = 16;
const TEST_FRACTION = 0.25;
const MIN_TEST = 6;

export function importanceOf(model: AnyModel): { name: string; weight: number }[] {
  return model.algorithm === "LINEAR" ? linearImportance(model) : model.importance;
}

export function predictWith(model: AnyModel, x: number[]): { value: number; spread: number } {
  if (model.algorithm === "LINEAR") {
    return { value: predictLinear(model, x), spread: model.residualStd };
  }
  return { value: predictForest(model, x), spread: forestSpread(model, x) };
}

function datasetFor(kind: ModelKind): Promise<Dataset> {
  return kind === "DEMAND" ? buildDemandDataset() : buildWasteDataset();
}

/**
 * Train Linear and Random Forest regressors for each kind, evaluate them on a
 * held-out *time-ordered* test split (never random — this is time series data),
 * and activate the better model as the newest version.
 */
export async function trainModels(kinds: ModelKind[] = ["DEMAND", "WASTE"]): Promise<TrainSummary[]> {
  const summaries: TrainSummary[] = [];

  for (const kind of kinds) {
    const ds = await datasetFor(kind);
    const n = ds.X.length;
    if (n < MIN_TRAIN) {
      summaries.push({
        kind,
        algorithm: "LINEAR",
        version: "n/a",
        isActive: false,
        trainN: n,
        testN: 0,
        metrics: { mae: 0, rmse: 0, r2: 0, mape: 0, n: 0 },
        importance: [],
      });
      continue;
    }

    const testN = Math.max(MIN_TEST, Math.round(n * TEST_FRACTION));
    const split = n - testN;
    const Xtr = ds.X.slice(0, split);
    const ytr = ds.y.slice(0, split);
    const Xte = ds.X.slice(split);
    const yte = ds.y.slice(split);

    const linear = fitLinear(Xtr, ytr, ds.featureNames, 1e-2);
    const forest = fitForest(Xtr, ytr, ds.featureNames, {
      nTrees: 14,
      maxDepth: 6,
      minSamplesLeaf: Math.max(2, Math.floor(split / 30)),
      seed: 20261005,
    });

    const linearMetrics = evaluateLinear(linear, Xte, yte);
    const forestMetrics = evaluateForest(forest, Xte, yte);

    const bestIsForest = forestMetrics.rmse <= linearMetrics.rmse;

    const existing = await prisma.mlModel.count({ where: { kind } });
    const version = `v${existing + 1}`;

    await prisma.mlModel.updateMany({ where: { kind }, data: { isActive: false } });

    // Persist both algorithms; the better one becomes active.
    const create = async (algorithm: Algorithm, model: AnyModel, metrics: RegressionMetrics, isActive: boolean) => {
      return prisma.mlModel.create({
        data: {
          kind,
          algorithm,
          version,
          featureNames: JSON.stringify(ds.featureNames),
          artifact: JSON.stringify(model),
          metrics: JSON.stringify(metrics),
          trainN: split,
          testN,
          dataSource: "demo",
          isActive,
          notes: `Trained on ${split} meals, tested on the most recent ${testN}.`,
        },
      });
    };

    await create("LINEAR", linear, linearMetrics, !bestIsForest);
    await create("RANDOM_FOREST", forest, forestMetrics, bestIsForest);

    summaries.push(
      {
        kind,
        algorithm: "LINEAR",
        version,
        isActive: !bestIsForest,
        trainN: split,
        testN,
        metrics: linearMetrics,
        importance: importanceOf(linear),
      },
      {
        kind,
        algorithm: "RANDOM_FOREST",
        version,
        isActive: bestIsForest,
        trainN: split,
        testN,
        metrics: forestMetrics,
        importance: importanceOf(forest),
      }
    );
  }

  return summaries;
}

export async function getActiveModel(kind: ModelKind) {
  const row = await prisma.mlModel.findFirst({ where: { kind, isActive: true }, orderBy: { trainedAt: "desc" } });
  if (!row) return null;
  const model = JSON.parse(row.artifact) as AnyModel;
  const metrics = JSON.parse(row.metrics) as RegressionMetrics;
  return { row, model, metrics };
}

export async function hasModel(kind: ModelKind): Promise<boolean> {
  return (await prisma.mlModel.count({ where: { kind, isActive: true } })) > 0;
}
