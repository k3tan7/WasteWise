// CART regression tree. Splits are chosen to maximise variance reduction using
// quantile candidate thresholds (deterministic, no randomness in the split
// search). Randomness for the forest comes from bagging + feature subsampling,
// driven by a seeded RNG.

export type TreeNode =
  | { leaf: true; value: number; n: number }
  | { leaf: false; feature: number; threshold: number; left: TreeNode; right: TreeNode; n: number };

export type TreeOptions = {
  maxDepth: number;
  minSamplesLeaf: number;
  /** indices of features available at this node (feature subsampling) */
  featureIndices?: number[];
  /** quantile candidate count for split search */
  candidates?: number;
};

function mean(a: number[]) {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
}

function variance(a: number[]) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return a.reduce((acc, v) => acc + (v - m) ** 2, 0) / a.length;
}

function quantiles(values: number[], count: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (let q = 1; q <= count; q++) {
    const idx = Math.floor((q / (count + 1)) * sorted.length);
    out.push(sorted[Math.min(sorted.length - 1, Math.max(0, idx))]);
  }
  return Array.from(new Set(out));
}

export function buildTree(
  X: number[][],
  y: number[],
  featureCount: number,
  opts: TreeOptions,
  depth = 0
): TreeNode {
  const n = y.length;
  if (depth >= opts.maxDepth || n < 2 * opts.minSamplesLeaf) {
    return { leaf: true, value: mean(y), n };
  }

  const parentVar = variance(y);
  if (parentVar <= 1e-9) return { leaf: true, value: mean(y), n };

  const features = opts.featureIndices ?? Array.from({ length: featureCount }, (_, i) => i);
  const candidates = opts.candidates ?? 12;

  let best: { feature: number; threshold: number; gain: number; leftIdx: number[]; rightIdx: number[] } | null = null;

  for (const f of features) {
    const col = X.map((row) => row[f] ?? 0);
    const uniq = new Set(col);
    if (uniq.size < 2) continue;
    for (const t of quantiles(col, candidates)) {
      const leftIdx: number[] = [];
      const rightIdx: number[] = [];
      for (let i = 0; i < n; i++) (col[i] <= t ? leftIdx : rightIdx).push(i);
      if (leftIdx.length < opts.minSamplesLeaf || rightIdx.length < opts.minSamplesLeaf) continue;

      const ly = leftIdx.map((i) => y[i]);
      const ry = rightIdx.map((i) => y[i]);
      const weighted =
        (ly.length * variance(ly) + ry.length * variance(ry)) / n;
      const gain = parentVar - weighted;
      if (!best || gain > best.gain) best = { feature: f, threshold: t, gain, leftIdx, rightIdx };
    }
  }

  if (!best || best.gain <= 1e-9) return { leaf: true, value: mean(y), n };

  const left = buildTree(
    best.leftIdx.map((i) => X[i]),
    best.leftIdx.map((i) => y[i]),
    featureCount,
    opts,
    depth + 1
  );
  const right = buildTree(
    best.rightIdx.map((i) => X[i]),
    best.rightIdx.map((i) => y[i]),
    featureCount,
    opts,
    depth + 1
  );

  return { leaf: false, feature: best.feature, threshold: best.threshold, left, right, n };
}

export function predictTree(node: TreeNode, x: number[]): number {
  let cur = node;
  while (!cur.leaf) {
    cur = (x[cur.feature] ?? 0) <= cur.threshold ? cur.left : cur.right;
  }
  return cur.value;
}

/** Aggregate split gain per feature — used for feature importance. */
export function treeImportance(node: TreeNode, featureCount: number, acc: number[]): void {
  if (node.leaf) return;
  const weighted = node.n;
  acc[node.feature] = (acc[node.feature] ?? 0) + weighted;
  treeImportance(node.left, featureCount, acc);
  treeImportance(node.right, featureCount, acc);
}
