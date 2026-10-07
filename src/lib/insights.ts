// Insights are derived entirely from persisted data — each one explains
// WHAT happened, WHY (from the underlying figures), and WHAT to do next.

import type { DishWasteStat } from "@/lib/analytics";

export type Insight = {
  id: string;
  severity: "critical" | "warning" | "positive" | "info";
  title: string;
  what: string;
  why: string;
  action: string;
  href?: string;
};

export type InsightContext = {
  meals: {
    mealType: string;
    predictedConsumption: number | null;
    recommendedPrep: number | null;
    actualPrep: number | null;
    actualConsumption: number | null;
    totalWasteKg: number | null;
  }[];
  wastePred: { mealType: string; expectedKg: number; actualKg: number; variancePct: number }[];
  attendance: { present: number; enrolled: number };
  predictedPresent?: number;
  dishStats: DishWasteStat[];
  inventory: {
    name: string;
    onHand: number;
    unit: string;
    minStock: number;
    required?: number;
    daysCover?: number;
  }[];
  weekly: { recent: number; prior: number; days: number };
  demandAccuracy: number;
  topAnomaly?: { mealType: string; variancePct: number; summary: string };
};

const MEAL_LABEL: Record<string, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  SNACKS: "Snacks",
  DINNER: "Dinner",
};

export function buildInsights(ctx: InsightContext): Insight[] {
  const out: Insight[] = [];

  // 1. Waste variance per meal.
  //    Several meals usually spike together (a cancelled event ruins the whole
  //    day), so the offenders are reported as one ranked insight instead of one
  //    near-identical card per meal.
  const overExpected = ctx.wastePred
    .filter((wp) => wp.expectedKg > 0 && wp.variancePct >= 25)
    .sort((a, b) => b.variancePct - a.variancePct);
  if (overExpected.length) {
    const worst = overExpected[0];
    const worstLabel = MEAL_LABEL[worst.mealType] ?? worst.mealType;
    const others = overExpected.slice(1).map((w) => MEAL_LABEL[w.mealType] ?? w.mealType);
    const totalActual = overExpected.reduce((a, w) => a + w.actualKg, 0);
    const totalExpected = overExpected.reduce((a, w) => a + w.expectedKg, 0);
    out.push({
      id: "waste-variance",
      severity: worst.variancePct >= 60 ? "critical" : "warning",
      title:
        overExpected.length === 1
          ? `${worstLabel} waste is ${worst.variancePct.toFixed(0)}% above expected`
          : `${overExpected.length} meals exceeded expected waste — worst ${worstLabel} at +${worst.variancePct.toFixed(0)}%`,
      what:
        overExpected.length === 1
          ? `Recorded ${worst.actualKg.toFixed(1)} kg of food waste against an expected ${worst.expectedKg.toFixed(1)} kg.`
          : `Recorded ${totalActual.toFixed(1)} kg across those meals against ${totalExpected.toFixed(1)} kg expected. ${worstLabel} alone was ${worst.actualKg.toFixed(1)} kg vs ${worst.expectedKg.toFixed(1)} kg.`,
      why: `The waste model (meal baseline, adjusted for day-of-week, over-preparation and menu composition) projected the expected figures.`,
      action: others.length
        ? `Review the preparation buffer for ${[worstLabel, ...others].map((m) => m.toLowerCase()).join(", ")} and confirm attendance before the next occurrence.`
        : `Review the preparation buffer for ${worstLabel.toLowerCase()} and confirm attendance before the next occurrence.`,
      href: "/waste/analytics",
    });
  }

  // 2. Attendance vs prediction
  if (ctx.predictedPresent && ctx.predictedPresent > 0) {
    const dev = ((ctx.attendance.present - ctx.predictedPresent) / ctx.predictedPresent) * 100;
    if (Math.abs(dev) >= 5) {
      out.push({
        id: "attendance-dev",
        severity: Math.abs(dev) >= 10 ? "warning" : "info",
        title: `Attendance is ${Math.abs(dev).toFixed(0)}% ${dev < 0 ? "lower" : "higher"} than expected`,
        what: `${ctx.attendance.present.toLocaleString()} students present vs ${ctx.predictedPresent.toLocaleString()} projected.`,
        why: `Historical day-of-week participation suggests ${ctx.predictedPresent.toLocaleString()} for today.`,
        action: dev < 0 ? "Reduce today's preparation or re-allocate surplus to the later meal." : "Ensure preparation covers the higher-than-expected turnout.",
        href: "/students",
      });
    }
  }

  // 3. Repeated high-waste dishes
  for (const d of ctx.dishStats.filter((d) => d.occurrences >= 5 && d.exceedances >= 4).slice(0, 2)) {
    out.push({
      id: `dish-${d.dishId}`,
      severity: "warning",
      title: `${d.name} has consistently high plate waste`,
      what: `${d.name} exceeded its historical waste baseline in ${d.exceedances} of the last ${d.occurrences} occurrences (${d.avgWastePct.toFixed(1)}% avg waste).`,
      why: `Its baseline is ${d.baselinePct.toFixed(1)}%. Repeated exceedance indicates a systematic issue rather than a one-off.`,
      action: `Review portion size or recipe for ${d.name}, collect student feedback, or reduce its menu frequency.`,
      href: "/waste/analytics",
    });
  }

  // 4. Inventory shortfalls
  for (const i of ctx.inventory.filter((i) => i.required != null && i.onHand < (i.required ?? 0)).slice(0, 2)) {
    out.push({
      id: `inv-${i.name}`,
      severity: "warning",
      title: `${i.name} inventory will be insufficient`,
      what: `Current stock is ${i.onHand} ${i.unit} against a projected requirement of ${Math.round(i.required ?? 0)} ${i.unit}.`,
      why: `Upcoming menu items require ${Math.round(i.required ?? 0)} ${i.unit} over the planning horizon.`,
      action: `Approve a purchase of about ${Math.max(0, Math.round((i.required ?? 0) - i.onHand))} ${i.unit} of ${i.name}.`,
      href: "/purchases",
    });
  }

  // 5. Preparation within range (positive reinforcement)
  const withinRange = ctx.meals.filter(
    (m) =>
      m.actualPrep != null &&
      m.recommendedPrep != null &&
      m.actualPrep >= m.recommendedPrep &&
      m.actualPrep <= Math.ceil(m.recommendedPrep * 1.05)
  );
  if (withinRange.length) {
    out.push({
      id: "prep-ok",
      severity: "positive",
      title: `${withinRange.map((m) => MEAL_LABEL[m.mealType] ?? m.mealType).join(" & ")} preparation stayed within the recommended range`,
      what: `Preparation matched the forecast buffer for ${withinRange.length} meal(s) today.`,
      why: `Recommended preparation was derived from the demand engine with a small safety buffer.`,
      action: "No action needed — keep preparing using the recommended quantities.",
    });
  }

  // 6. Weekly waste trend
  if (ctx.weekly.prior > 0) {
    const dev = ((ctx.weekly.recent - ctx.weekly.prior) / ctx.weekly.prior) * 100;
    if (Math.abs(dev) >= 8) {
      out.push({
        id: "weekly-trend",
        severity: dev > 0 ? "warning" : "positive",
        title: `Total waste ${dev > 0 ? "increased" : "decreased"} ${Math.abs(dev).toFixed(0)}% week over week`,
        what: `Last ${ctx.weekly.days} days totalled ${ctx.weekly.recent.toFixed(0)} kg vs ${ctx.weekly.prior.toFixed(0)} kg the ${ctx.weekly.days} days before.`,
        why: dev > 0 ? "Higher waste was driven by preparation and menu mix." : "Tighter preparation control reduced waste.",
        action: dev > 0 ? "Investigate the highest-variance meals in Waste Analytics." : "Continue the current preparation discipline.",
        href: "/waste/analytics",
      });
    }
  }

  // 7. Forecast accuracy
  out.push({
    id: "accuracy",
    severity: ctx.demandAccuracy >= 90 ? "positive" : "info",
    title: `Demand forecast accuracy is ${ctx.demandAccuracy.toFixed(1)}%`,
    what: `Across recent meals the predictions were within ${(100 - ctx.demandAccuracy).toFixed(1)}% of actual consumption on average.`,
    why: "Accuracy is the mean absolute percentage error between predicted and actual consumption.",
    action: ctx.demandAccuracy < 90 ? "More attendance history will improve the accuracy of the demand engine." : "Forecasts are reliable enough to drive preparation planning.",
    href: "/predictions",
  });

  // 8. Active anomaly
  if (ctx.topAnomaly) {
    out.unshift({
      id: "anomaly",
      severity: "critical",
      title: `${MEAL_LABEL[ctx.topAnomaly.mealType] ?? ctx.topAnomaly.mealType} waste anomaly (+${ctx.topAnomaly.variancePct.toFixed(0)}%)`,
      what: ctx.topAnomaly.summary,
      why: "A robust statistical test (median ± MAD) flagged this as unusual for the meal.",
      action: "Open the anomaly to confirm the root cause and record a corrective action.",
      href: "/waste",
    });
  }

  return out;
}
