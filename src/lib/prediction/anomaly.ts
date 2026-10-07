// ---------------------------------------------------------------------------
// WASTE ANOMALY DETECTION (robust statistics)
// ---------------------------------------------------------------------------
// Uses median + median-absolute-deviation instead of mean/stddev so a few past
// spikes don't inflate the threshold.
//
//   median     = median(historicalWeight)
//   MAD        = median(|x − median|)
//   robustZ    = 0.6745 · (actual − median) / MAD      (0.6745 scales MAD to σ)
//   thresholdPct = configured (default 25% above expected)
//
//   anomaly  if  (actual − expected)/expected · 100 ≥ thresholdPct
//           AND robustZ ≥ 3.0  (or actual ≥ median + 3·MAD when history is short)
//
// When MAD is 0 (very stable history) we fall back to a percentage-only test.
// ---------------------------------------------------------------------------

import { median, mad, clamp, startOfDay } from "@/lib/utils";

export type AnomalyFactor = { factor: string; detail: string; weight: number };

export type AnomalyContext = {
  actualKg: number;
  expectedKg: number;
  history: { date: Date; weightKg: number }[];
  actualAttendance?: number;
  predictedAttendance?: number;
  actualPrep?: number;
  recommendedPrep?: number;
  menuHighWasteDishes?: { name: string; wastePct: number; baselinePct: number }[];
  thresholdPct: number;
};

export type AnomalyResult = {
  isAnomaly: boolean;
  variancePct: number;
  robustZ: number;
  medianKg: number;
  madKg: number;
  severity: "LOW" | "MEDIUM" | "HIGH";
  contributors: AnomalyFactor[];
  summary: string;
};

export function detectWasteAnomaly(ctx: AnomalyContext): AnomalyResult {
  const values = ctx.history.map((h) => Math.max(0, h.weightKg));
  const med = median(values);
  const madKg = mad(values, med);
  const variancePct = ctx.expectedKg > 0 ? ((ctx.actualKg - ctx.expectedKg) / ctx.expectedKg) * 100 : 0;

  const robustZ = madKg > 0 ? (0.6745 * (ctx.actualKg - med)) / madKg : 0;
  const scaleFallback = madKg === 0 ? ctx.actualKg - med > Math.max(5, med * 0.2) : false;

  const aboveThreshold = variancePct >= ctx.thresholdPct;
  const statisticallyOdd = madKg > 0 ? robustZ >= 3 : scaleFallback;
  const isAnomaly = aboveThreshold && statisticallyOdd && ctx.actualKg > 0;

  const contributors: AnomalyFactor[] = [];

  if (ctx.actualAttendance != null && ctx.predictedAttendance != null && ctx.predictedAttendance > 0) {
    const dev = ((ctx.actualAttendance - ctx.predictedAttendance) / ctx.predictedAttendance) * 100;
    if (Math.abs(dev) >= 5) {
      contributors.push({
        factor: "Attendance deviation",
        detail: `Attendance was ${Math.abs(dev).toFixed(0)}% ${dev < 0 ? "lower" : "higher"} than predicted (${ctx.actualAttendance} vs ${ctx.predictedAttendance}).`,
        weight: clamp(Math.abs(dev) / 20, 0.2, 1),
      });
    }
  }

  if (ctx.actualPrep != null && ctx.recommendedPrep != null && ctx.recommendedPrep > 0) {
    const dev = ((ctx.actualPrep - ctx.recommendedPrep) / ctx.recommendedPrep) * 100;
    if (dev >= 3) {
      contributors.push({
        factor: "Over-production",
        detail: `Preparation was ${dev.toFixed(0)}% higher than recommended (${ctx.actualPrep} vs ${ctx.recommendedPrep} meals).`,
        weight: clamp(dev / 20, 0.2, 1),
      });
    }
  }

  const highWaste = (ctx.menuHighWasteDishes ?? []).filter(
    (d) => d.baselinePct > 0 && d.wastePct > d.baselinePct * 1.25
  );
  if (highWaste.length) {
    contributors.push({
      factor: "Menu composition",
      detail: `Today's menu included ${highWaste.length} dish(es) above their waste baseline: ${highWaste
        .map((d) => d.name)
        .join(", ")}.`,
      weight: clamp(highWaste.length / 3, 0.2, 1),
    });
  }

  const spread = values.length >= 3 ? madKg : Math.max(3, med * 0.15);
  if (spread > 0 && Math.abs(ctx.actualKg - med) > 2 * spread && ctx.actualKg > med) {
    contributors.push({
      factor: "Unusual vs. baseline",
      detail: `Waste (${ctx.actualKg} kg) was well above the typical ${med.toFixed(1)} kg for this meal.`,
      weight: clamp((ctx.actualKg - med) / Math.max(med, 1), 0.2, 1),
    });
  }

  // Severity from how far above expected we are.
  let severity: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  if (variancePct >= 75) severity = "HIGH";
  else if (variancePct >= 40) severity = "MEDIUM";

  const summary = isAnomaly
    ? `Waste was ${variancePct.toFixed(0)}% above the expected level (${ctx.actualKg.toFixed(1)} kg vs ${ctx.expectedKg.toFixed(1)} kg expected).`
    : `Waste was within the expected range (${variancePct.toFixed(0)}% vs expected).`;

  return {
    isAnomaly,
    variancePct: Math.round(variancePct * 10) / 10,
    robustZ: Math.round(robustZ * 100) / 100,
    medianKg: Math.round(med * 10) / 10,
    madKg: Math.round(madKg * 10) / 10,
    severity,
    contributors,
    summary,
  };
}

/** Suggest a concrete next step from the contributors found. */
export function recommendAction(res: AnomalyResult, opts?: { mealType?: string }): string {
  const names = res.contributors.map((c) => c.factor);
  const meal = opts?.mealType ? opts.mealType.toLowerCase() : "the next occurrence";
  const parts: string[] = [];
  if (names.includes("Over-production")) parts.push(`reduce the preparation buffer for ${meal}`);
  if (names.includes("Attendance deviation")) parts.push("re-check attendance before the next preparation");
  if (names.includes("Menu composition")) parts.push("review the flagged high-waste dishes (portion size or frequency)");
  if (!parts.length) parts.push("verify the waste log entries and monitor the next occurrence");
  return parts.join("; ") + ".";
}

export { startOfDay };
