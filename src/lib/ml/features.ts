// Feature engineering for the two regression tasks. The same functions are used
// to build the training dataset and to score a single live prediction, so the
// training/serving feature definitions can never drift apart.

import { clamp, mean, startOfDay, toISODate } from "@/lib/utils";

export type DishInfo = { historicalConsumption: number; historicalWastePct: number };
export type MealHistoryRow = { date: Date; mealType: string; consumed: number; present: number; wasteKg: number };

export const MEAL_ORDER = ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"] as const;

export const DEMAND_FEATURES = [
  "attendance",
  "attendance_ratio",
  "day_of_week",
  "is_weekend",
  "is_breakfast",
  "is_lunch",
  "is_snacks",
  "is_dinner",
  "participation_7",
  "participation_14",
  "consumed_mean_7",
  "participation_trend",
  "menu_dish_count",
  "menu_avg_waste_pct",
  "dish_popularity",
] as const;

export const WASTE_FEATURES = [
  "predicted_demand",
  "recommended_prep",
  "actual_prep",
  "actual_consumption",
  "attendance",
  "prep_gap",
  "prep_ratio",
  "consumption_ratio",
  "hist_waste_7",
  "hist_waste_14",
  "daily_waste_7",
  "waste_per_meal",
  "menu_avg_waste_pct",
  "day_of_week",
  "is_weekend",
  "is_breakfast",
  "is_lunch",
  "is_snacks",
  "is_dinner",
] as const;

const MEAL_ONEHOT = ["is_breakfast", "is_lunch", "is_snacks", "is_dinner"];
function oneHotMeal(mealType: string): number[] {
  return MEAL_ONEHOT.map((n) => (n === `is_${mealType.toLowerCase()}` ? 1 : 0));
}

function daysAgo(from: Date, to: Date) {
  return Math.max(0, Math.round((startOfDay(from).getTime() - startOfDay(to).getTime()) / 86400000));
}

function sameMeal(history: MealHistoryRow[], mealType: string) {
  return history.filter((h) => h.mealType === mealType);
}

/* -------------------------------------------------------------------------- */
/* Demand                                                                      */
/* -------------------------------------------------------------------------- */
export type DemandFeatureContext = {
  date: Date;
  mealType: string;
  attendance: number;
  enrolled: number;
  menuDishes: DishInfo[];
  /** meals strictly before `date` */
  history: MealHistoryRow[];
};

export function computeDemandFeatures(ctx: DemandFeatureContext): number[] {
  const rows = sameMeal(ctx.history, ctx.mealType);
  const last7 = rows.slice(-7);
  const last14 = rows.slice(-14);

  const ratios = (rs: MealHistoryRow[]) =>
    rs.filter((r) => r.present > 0).map((r) => r.consumed / r.present);

  const p7 = mean(ratios(last7));
  const p14 = mean(ratios(last14));
  const consumedMean7 = mean(last7.map((r) => r.consumed));

  // Trend: last 7 vs the 7 before that, damped.
  const prior7 = rows.slice(-14, -7);
  const priorMean = mean(ratios(prior7));
  const trend = priorMean > 0 && last7.length >= 2 ? clamp((p7 - priorMean) / priorMean, -0.5, 0.5) : 0;

  const dow = ctx.date.getDay();
  const mealOneHot = oneHotMeal(ctx.mealType);
  const dishPopularity =
    ctx.menuDishes.length && ctx.enrolled > 0
      ? mean(ctx.menuDishes.map((d) => d.historicalConsumption)) / ctx.enrolled
      : 0;
  const menuWaste = ctx.menuDishes.length ? mean(ctx.menuDishes.map((d) => d.historicalWastePct)) : 0;

  return [
    ctx.attendance,
    ctx.enrolled > 0 ? ctx.attendance / ctx.enrolled : 0,
    dow,
    dow === 0 || dow === 6 ? 1 : 0,
    ...mealOneHot,
    p7,
    p14,
    consumedMean7,
    trend,
    ctx.menuDishes.length,
    menuWaste,
    dishPopularity,
  ];
}

/* -------------------------------------------------------------------------- */
/* Waste                                                                       */
/* -------------------------------------------------------------------------- */
export type WasteFeatureContext = {
  date: Date;
  mealType: string;
  predictedDemand: number;
  recommendedPrep: number;
  actualPrep: number;
  actualConsumption: number;
  attendance: number;
  menuDishes: DishInfo[];
  history: MealHistoryRow[];
};

export function computeWasteFeatures(ctx: WasteFeatureContext): number[] {
  const rows = sameMeal(ctx.history, ctx.mealType);
  const waste = (rs: MealHistoryRow[]) => rs.map((r) => r.wasteKg);
  const hist7 = mean(waste(rows.slice(-7)));
  const hist14 = mean(waste(rows.slice(-14)));

  const cutoff = startOfDay(ctx.date);
  const daily = new Map<string, number>();
  for (const r of ctx.history) {
    if (daysAgo(cutoff, r.date) > 7) continue;
    const k = toISODate(r.date);
    daily.set(k, (daily.get(k) ?? 0) + r.wasteKg);
  }
  const dailyMean = daily.size ? mean([...daily.values()]) : 0;

  const dow = ctx.date.getDay();
  const mealOneHot = oneHotMeal(ctx.mealType);

  return [
    ctx.predictedDemand,
    ctx.recommendedPrep,
    ctx.actualPrep,
    ctx.actualConsumption,
    ctx.attendance,
    ctx.actualPrep - ctx.recommendedPrep,
    ctx.recommendedPrep > 0 ? ctx.actualPrep / ctx.recommendedPrep : 1,
    ctx.actualPrep > 0 ? ctx.actualConsumption / ctx.actualPrep : 0,
    hist7,
    hist14,
    dailyMean,
    hist7 / Math.max(1, ctx.predictedDemand),
    ctx.menuDishes.length ? mean(ctx.menuDishes.map((d) => d.historicalWastePct)) : 0,
    dow,
    dow === 0 || dow === 6 ? 1 : 0,
    ...mealOneHot,
  ];
}
