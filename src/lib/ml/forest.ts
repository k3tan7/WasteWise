// Random Forest regression: an ensemble of CART trees trained on bootstrap
// samples with random feature subsampling. Seeded for reproducibility.

import { buildTree, predictTree, treeImportance, type TreeNode } from "@/lib/ml/tree";
import { regressionMetrics, round, type RegressionMetrics } from "@/lib/ml/metrics";
import { seededRandom } from "@/lib/utils";

export type ForestModel = {
  algorithm: "RANDOM_FOREST";
  featureNames: string[];
  trees: TreeNode[];
  nTrees: number;
  maxDepth: number;
  trainN: number;
  importance: { name: string; weight: number }[];
};

export type ForestOptions = {
  nTrees?: number;
  maxDepth?: number;
  minSamplesLeaf?: number;
  seed?: number;
};

export function fitForest(
  X: number[][],
  y: number[],
  featureNames: string[],
  opts: ForestOptions = {}
): ForestModel {
  const n = X.length;
  const p = featureNames.length;
  const nTrees = opts.nTrees ?? 12;
  const maxDepth = opts.maxDepth ?? 6;
  const minSamplesLeaf = opts.minSamplesLeaf ?? Math.max(2, Math.floor(n / 40));
  const rng = seededRandom(opts.seed ?? 42);
  const mtry = Math.max(1, Math.round(Math.sqrt(p)));

  const trees: TreeNode[] = [];
  for (let t = 0; t < nTrees; t++) {
    // Bootstrap sample.
    const idx = Array.from({ length: n }, () => Math.floor(rng() * n));
    const Xb = idx.map((i) => X[i]);
    const yb = idx.map((i) => y[i]);
    // Random feature subset for this tree.
    const featureIndices: number[] = [];
    const pool = Array.from({ length: p }, (_, i) => i);
    for (let k = 0; k < mtry && pool.length; k++) {
      const pick = Math.floor(rng() * pool.length);
      featureIndices.push(pool.splice(pick, 1)[0]);
    }
    trees.push(buildTree(Xb, yb, p, { maxDepth, minSamplesLeaf, featureIndices, candidates: 10 }));
  }

  // Feature importance from split frequency weighted by node size.
  const acc = new Array(p).fill(0);
  for (const tr of trees) treeImportance(tr, p, acc);
  const total = acc.reduce((a, b) => a + b, 0) || 1;
  const importance = featureNames
    .map((name, j) => ({ name, weight: round(acc[j] / total, 4) }))
    .sort((a, b) => b.weight - a.weight);

  return {
    algorithm: "RANDOM_FOREST",
    featureNames,
    trees,
    nTrees,
    maxDepth,
    trainN: n,
    importance,
  };
}

/** Individual tree predictions — their spread drives the uncertainty band. */
export function treePredictions(m: ForestModel, x: number[]): number[] {
  return m.trees.map((t) => predictTree(t, x));
}

export function predictForest(m: ForestModel, x: number[]): number {
  const preds = treePredictions(m, x);
  return preds.length ? preds.reduce((a, b) => a + b, 0) / preds.length : 0;
}

export function forestSpread(m: ForestModel, x: number[]): number {
  const preds = treePredictions(m, x);
  if (preds.length < 2) return 0;
  const mean = preds.reduce((a, b) => a + b, 0) / preds.length;
  return Math.sqrt(preds.reduce((a, v) => a + (v - mean) ** 2, 0) / (preds.length - 1));
}

export function evaluateForest(m: ForestModel, X: number[][], y: number[]): RegressionMetrics {
  return regressionMetrics(y, X.map((x) => predictForest(m, x)));
}
