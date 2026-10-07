// Multiple linear regression with L2 (ridge) regularisation, fit via the normal
// equations. Features are standardised internally so coefficients are comparable
// and the solve is well-conditioned; coefficients are returned in the original
// feature space so they remain interpretable.
//
//   ŷ = b0 + Σ bj·xj
//   [XᵀX + λI] β = Xᵀy   (solved in standardised space)

import { regressionMetrics, round, type RegressionMetrics } from "@/lib/ml/metrics";

export type LinearModel = {
  algorithm: "LINEAR";
  featureNames: string[];
  means: number[];
  stds: number[];
  coefs: number[]; // original feature space
  intercept: number;
  residualStd: number;
  trainN: number;
  lambda: number;
};

/** Gaussian elimination with partial pivoting (small, dense systems only). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) continue;
    [M[col], M[piv]] = [M[piv], M[col]];
    const pv = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

export function fitLinear(
  X: number[][],
  y: number[],
  featureNames: string[],
  lambda = 1e-3
): LinearModel {
  const n = X.length;
  const p = featureNames.length;

  const means = new Array(p).fill(0);
  const stds = new Array(p).fill(1);
  for (let j = 0; j < p; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += X[i][j];
    means[j] = s / Math.max(1, n);
    let v = 0;
    for (let i = 0; i < n; i++) v += (X[i][j] - means[j]) ** 2;
    stds[j] = Math.sqrt(v / Math.max(1, n - 1)) || 1;
  }

  // Standardised design matrix.
  const Z = X.map((row) => row.map((v, j) => (v - means[j]) / stds[j]));
  const yMean = y.reduce((a, b) => a + b, 0) / Math.max(1, n);
  const yc = y.map((v) => v - yMean);

  // XtX + lambda I ; Xty
  const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += Z[i][a] * yc[i];
      for (let b = 0; b < p; b++) XtX[a][b] += Z[i][a] * Z[i][b];
    }
  }
  for (let a = 0; a < p; a++) XtX[a][a] += lambda;

  const betaStd = solve(XtX, Xty);

  // Convert to original feature space.
  const coefs = betaStd.map((b, j) => b / stds[j]);
  const intercept = yMean - coefs.reduce((a, c, j) => a + c * means[j], 0);

  const preds = X.map((row) => intercept + row.reduce((a, v, j) => a + v * coefs[j], 0));
  const resid = y.map((v, i) => v - preds[i]);
  const residualStd =
    Math.sqrt(resid.reduce((a, r) => a + r * r, 0) / Math.max(1, n - p - 1)) || 0;

  void regressionMetrics; // metrics are computed by the caller on held-out data

  return {
    algorithm: "LINEAR",
    featureNames,
    means,
    stds,
    coefs: coefs.map((c) => round(c, 6)),
    intercept: round(intercept, 6),
    residualStd: round(residualStd, 4),
    trainN: n,
    lambda,
  };
}

export function predictLinear(m: LinearModel, x: number[]): number {
  return m.intercept + x.reduce((a, v, j) => a + v * (m.coefs[j] ?? 0), 0);
}

export function evaluateLinear(m: LinearModel, X: number[][], y: number[]): RegressionMetrics {
  return regressionMetrics(y, X.map((x) => predictLinear(m, x)));
}

/** Relative importance: |standardised coefficient| normalised to sum to 1. */
export function linearImportance(m: LinearModel): { name: string; weight: number }[] {
  const raw = m.coefs.map((c, j) => Math.abs(c) * (m.stds[j] || 1));
  const total = raw.reduce((a, b) => a + b, 0) || 1;
  return m.featureNames
    .map((name, j) => ({ name, weight: round(raw[j] / total, 4) }))
    .sort((a, b) => b.weight - a.weight);
}
