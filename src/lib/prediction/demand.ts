// ---------------------------------------------------------------------------
// DEMAND PREDICTION ENGINE  (deterministic, reproducible, no randomness)
// ---------------------------------------------------------------------------
// Model: weighted historical participation ratio.
//
//   participation_i = consumed_i / present_i          (per historical meal)
//   w_i             = 0.9 ^ ageInDays                  (recency decay)
//   p_observed      = Σ(w_i · participation_i) / Σ(w_i)
//   p_blend         = (n·p_observed + k·p_baseline) / (n + k)   (k = 3 prior weight)
//   dayFactor       = same-weekday mean(p) / overall mean(p)     (needs >=2 samples)
//   trendFactor     = 1 + clamp((recent7 - prior7) / prior7, -0.1, 0.1) · 0.5
//   menuFactor      = 1 + (menuPopularity - 1) · 0.15            (optional, damped)
//   predicted       = attendance · p_blend · dayFactor · trendFactor · menuFactor
//   recommendedPrep = ceil(predicted · (1 + buffer))
//   range           = predicted ± 1.28 · σ(participation) · attendance   (~80% band)
//   confidence      = clamp(1 - CV(participation) - historyPenalty, 0.4, 0.97)
//
// The engine is intentionally swappable: `model` is persisted with each
// prediction so a trained ML model can replace this implementation later.
// ---------------------------------------------------------------------------

import { clamp, mean, stddev, startOfDay, toISODate } from "@/lib/utils";

export type DemandHistoryRow = {
  date: Date;
  mealType: string;
  consumed: number;
  present: number;
};

export type DemandEvent = {
  dateISO: string;
  mealType?: string;
  /** multiplicative effect, e.g. 1.15 for an event boost, 0.6 for a holiday */
  impact: number;
  label: string;
};

export type DemandInput = {
  date: Date;
  mealType: string;
  /** students physically present today (0 => fall back to enrolment) */
  attendance: number;
  enrolled: number;
  history: DemandHistoryRow[];
  baselineParticipationPct: number;
  prepBufferPct: number;
  holidays?: string[];
  events?: DemandEvent[];
};

export type DemandFactor = { name: string; value: number; note: string };

export type DemandResult = {
  predicted: number;
  recommendedPrep: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: number;
  model: string;
  factors: DemandFactor[];
  inputs: Record<string, unknown>;
};

const MODEL = "weighted-history-v1";
const PRIOR_WEIGHT = 3;
const MIN_SAMPLES = 3;

// Local calendar date — `toISOString()` would report the previous day for any
// campus east of UTC that starts its day at local midnight.
function iso(d: Date) {
  return toISODate(d);
}

export function predictDemand(input: DemandInput): DemandResult {
  const today = startOfDay(input.date);
  const sameMeal = input.history
    .filter((h) => h.mealType === input.mealType && h.present > 0 && h.consumed >= 0)
    .map((h) => ({
      ...h,
      daysAgo: Math.max(0, Math.round((today.getTime() - startOfDay(h.date).getTime()) / 86400000)),
    }))
    .sort((a, b) => a.daysAgo - b.daysAgo);

  const ratios = sameMeal.map((h) => h.consumed / h.present);
  const weights = sameMeal.map((h) => Math.pow(0.9, h.daysAgo));
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const observed = weightSum > 0 ? ratios.reduce((acc, r, i) => acc + r * weights[i], 0) / weightSum : 0;
  const n = sameMeal.length;
  const baseline = input.baselineParticipationPct / 100;

  // Shrink the observed ratio toward the configured baseline when history is thin.
  const pBlend = n > 0 ? (n * observed + PRIOR_WEIGHT * baseline) / (n + PRIOR_WEIGHT) : baseline;

  // Day-of-week factor: only applied once we have a few samples for the weekday.
  const weekday = today.getDay();
  const sameWeekday = sameMeal.filter((h) => startOfDay(h.date).getDay() === weekday && h.present > 0);
  const overallMean = ratios.length ? mean(ratios) : pBlend;
  const dayFactor =
    sameWeekday.length >= 2 && overallMean > 0
      ? clamp(mean(sameWeekday.map((h) => h.consumed / h.present)) / overallMean, 0.85, 1.15)
      : 1;

  // Recent trend (last 7 days vs prior 7) damped by 0.5 to avoid overreaction.
  const recent = sameMeal.filter((h) => h.daysAgo <= 7).map((h) => h.consumed / h.present);
  const prior = sameMeal.filter((h) => h.daysAgo > 7 && h.daysAgo <= 14).map((h) => h.consumed / h.present);
  const trendFactor =
    recent.length >= 2 && prior.length >= 2 && mean(prior) > 0
      ? 1 + clamp((mean(recent) - mean(prior)) / Math.abs(mean(prior)), -0.1, 0.1) * 0.5
      : 1;

  // Event / holiday adjustments.
  const dayKey = iso(today);
  let eventFactor = 1;
  let eventNote = "No event or holiday adjustment";
  const matchingEvents = (input.events ?? []).filter(
    (e) => e.dateISO === dayKey && (!e.mealType || e.mealType === input.mealType)
  );
  if (input.holidays?.includes(dayKey)) {
    eventFactor *= 0.75;
    eventNote = "Holiday — participation dampened";
  }
  for (const e of matchingEvents) {
    eventFactor *= e.impact;
    eventNote = e.label;
  }

  const attendance = input.attendance > 0 ? input.attendance : input.enrolled * pBlend;
  const base = attendance * pBlend * dayFactor * trendFactor * eventFactor;
  const predicted = Math.max(0, Math.round(base));

  const buffer = input.prepBufferPct / 100;
  const recommendedPrep = Math.max(predicted, Math.ceil(predicted * (1 + buffer)));

  // Prediction band from the dispersion of historical participation ratios.
  const dispersion = ratios.length >= 2 ? stddev(ratios) : pBlend * 0.08;
  const band = Math.max(predicted * 0.02, 1.28 * dispersion * attendance);
  const rangeLow = Math.max(0, Math.round(predicted - band));
  const rangeHigh = Math.round(predicted + band);

  // Confidence: penalise high dispersion and short history.
  const cv = mean(ratios) > 0 ? (ratios.length >= 2 ? stddev(ratios) / mean(ratios) : 0.15) : 0.15;
  const historyPenalty = n >= 14 ? 0 : (14 - n) * 0.012;
  const confidence = clamp(1 - cv - historyPenalty, 0.4, 0.97);

  const factors: DemandFactor[] = [
    { name: "Attendance", value: Math.round(attendance), note: input.attendance > 0 ? "Students present today" : "Estimated from enrolment" },
    { name: "Participation (blended)", value: Number((pBlend * 100).toFixed(1)), note: `${(observed * 100).toFixed(1)}% observed · ${(baseline * 100).toFixed(0)}% baseline` },
    { name: "Day-of-week factor", value: Number(dayFactor.toFixed(3)), note: `${sameWeekday.length} prior ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][weekday]} sample(s)` },
    { name: "Trend factor", value: Number(trendFactor.toFixed(3)), note: "14-day participation trend" },
    { name: "Event/holiday factor", value: Number(eventFactor.toFixed(3)), note: eventNote },
    { name: "Historical samples", value: n, note: n < MIN_SAMPLES ? "Thin history — leaning on baseline" : `${n} comparable meals` },
  ];

  return {
    predicted,
    recommendedPrep,
    rangeLow,
    rangeHigh,
    confidence,
    model: MODEL,
    factors,
    inputs: {
      attendance: Math.round(attendance),
      enrolled: input.enrolled,
      mealType: input.mealType,
      dateISO: dayKey,
      historySamples: n,
      observedParticipation: Number(observed.toFixed(4)),
      dayFactor: Number(dayFactor.toFixed(4)),
      trendFactor: Number(trendFactor.toFixed(4)),
      eventFactor: Number(eventFactor.toFixed(4)),
    },
  };
}
