// Regression evaluation metrics (MAE, RMSE, R², MAPE).

export type RegressionMetrics = {
  mae: number;
  rmse: number;
  r2: number;
  mape: number;
  n: number;
};

export function regressionMetrics(yTrue: number[], yPred: number[]): RegressionMetrics {
  const n = Math.min(yTrue.length, yPred.length);
  if (n === 0) return { mae: 0, rmse: 0, r2: 0, mape: 0, n: 0 };

  let absSum = 0;
  let sqSum = 0;
  let mapeSum = 0;
  let mapeCount = 0;
  for (let i = 0; i < n; i++) {
    const e = yPred[i] - yTrue[i];
    absSum += Math.abs(e);
    sqSum += e * e;
    if (yTrue[i] !== 0) {
      mapeSum += Math.abs(e / yTrue[i]);
      mapeCount++;
    }
  }
  const mean = yTrue.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let ssTot = 0;
  for (let i = 0; i < n; i++) ssTot += (yTrue[i] - mean) ** 2;

  const mae = absSum / n;
  const rmse = Math.sqrt(sqSum / n);
  const r2 = ssTot > 0 ? 1 - sqSum / ssTot : 0;
  const mape = mapeCount > 0 ? (mapeSum / mapeCount) * 100 : 0;

  return {
    mae: round(mae, 3),
    rmse: round(rmse, 3),
    r2: round(r2, 4),
    mape: round(mape, 2),
    n,
  };
}

export function round(n: number, digits = 3): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
