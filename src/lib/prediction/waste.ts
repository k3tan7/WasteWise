// ---------------------------------------------------------------------------
// WASTE PREDICTION ENGINE (deterministic)
// ---------------------------------------------------------------------------
// Expected waste is modelled as a baseline (per meal type / weekday) scaled by
// operational deviations that are known *before* the meal:
//
//   baseline_meal   = weighted mean(historical waste for this mealType)
//   dayFactor       = same-weekday mean / overall mean                (>=2 samples)
//   overPrepFactor  = 1 + 0.4 · (prep − recommendedPrep) / recommendedPrep
//   menuFactor      = 1 + Σ (dishWastePct − avgDishWastePct) · 0.01   (damped)
//   expected        = max(0, baseline_meal · dayFactor · overPrepFactor · menuFactor)
//   range           = expected ± 1.28 · MAD(historical waste)
//
// This is a transparent statistical baseline, not a trained model. Actual vs
// expected results are persisted so the baseline improves as history accrues.
// ---------------------------------------------------------------------------

import { clamp, mad, mean, startOfDay } from "@/lib/utils";

export type WasteHistoryRow = { date: Date; mealType?: string | null; weightKg: number };

export type WasteInput = {
  date: Date;
  mealType: string;
  /** food waste rows attributed to this meal type historically */
  history: WasteHistoryRow[];
  /** all-meal daily waste, used as the fallback baseline */
  dailyHistory: { date: Date; weightKg: number }[];
  dailyBaselineKg: number;
  recommendedPrep: number;
  actualPrep: number;
  menuWastePcts: number[];
  overallDishWastePct: number;
};

export type WasteResult = {
  expectedKg: number;
  rangeLow: number;
  rangeHigh: number;
  factors: { name: string; value: number; note: string }[];
  model: string;
};

const MODEL = "waste-baseline-v1";

export function predictWaste(input: WasteInput): WasteResult {
  const today = startOfDay(input.date);

  const relevant = input.history
    .filter((h) => (h.mealType ?? "") === input.mealType)
    .map((h) => ({
      weight: Math.max(0, h.weightKg),
      daysAgo: Math.max(0, Math.round((today.getTime() - startOfDay(h.date).getTime()) / 86400000)),
      weekday: startOfDay(h.date).getDay(),
    }));

  let baseline: number;
  let note: string;
  if (relevant.length >= 3) {
    const w = relevant.map((r) => Math.pow(0.9, r.daysAgo));
    const ws = w.reduce((a, b) => a + b, 0);
    baseline = relevant.reduce((a, r, i) => a + r.weight * w[i], 0) / ws;
    note = `${relevant.length} prior ${input.mealType.toLowerCase()} records`;
  } else {
    // Fall back to a share of the daily baseline (~3 meals worth of waste).
    baseline = input.dailyBaselineKg / 3;
    note = "Insufficient meal history — using daily baseline share";
  }

  const weekday = today.getDay();
  const sameWeekday = relevant.filter((r) => r.weekday === weekday);
  const overallMean = relevant.length ? mean(relevant.map((r) => r.weight)) : baseline;
  const dayFactor = sameWeekday.length >= 2 && overallMean > 0
    ? clamp(mean(sameWeekday.map((r) => r.weight)) / overallMean, 0.7, 1.4)
    : 1;

  const overPrepFactor =
    input.recommendedPrep > 0
      ? clamp(1 + 0.4 * ((input.actualPrep - input.recommendedPrep) / input.recommendedPrep), 0.8, 1.6)
      : 1;

  const menuFactor = input.menuWastePcts.length
    ? clamp(
        1 + input.menuWastePcts.reduce((a, p) => a + (p - input.overallDishWastePct), 0) * 0.01,
        0.85,
        1.5
      )
    : 1;

  const expected = Math.max(0, baseline * dayFactor * overPrepFactor * menuFactor);
  const spread = relevant.length >= 3 ? Math.max(2, mad(relevant.map((r) => r.weight))) : Math.max(3, expected * 0.2);
  const band = 1.28 * spread;

  return {
    expectedKg: Math.round(expected * 10) / 10,
    rangeLow: Math.max(0, Math.round((expected - band) * 10) / 10),
    rangeHigh: Math.round((expected + band) * 10) / 10,
    factors: [
      { name: "Meal baseline", value: Number(baseline.toFixed(1)), note },
      { name: "Day-of-week factor", value: Number(dayFactor.toFixed(3)), note: `${sameWeekday.length} same-weekday sample(s)` },
      { name: "Over-preparation factor", value: Number(overPrepFactor.toFixed(3)), note: `prepared ${input.actualPrep} vs recommended ${input.recommendedPrep}` },
      { name: "Menu waste factor", value: Number(menuFactor.toFixed(3)), note: `${input.menuWastePcts.length} dish profile(s)` },
    ],
    model: MODEL,
  };
}
