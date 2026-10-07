import type { DishCategory } from "./recipes";
import { WEEK_MENU } from "./menu";

// ---------------------------------------------------------------------------
// SIMULATED KITCHEN BEHAVIOUR MODEL  (demo dataset generator)
// ---------------------------------------------------------------------------
// The demo campus needs realistic *observations* so the regression models have
// something genuine to learn from. It deliberately does NOT hardcode a waste
// percentage per dish ("salad = 15%") because that would rig the results.
//
// Instead, every dish's expected plate-waste rate is derived from operational
// factors that are true of mess cooking in general:
//
//   wastePct = categoryFactor          // salads/fruit > staples > beverages
//            × portionFactor           // bigger plated portions leave more
//            × frequencyFactor         // rarely served "speciality" dishes waste more
//            × dayFactor               // weekend menus, exam days, holidays
//            × attendanceFactor        // when fewer students turn up, more is left
//            × (1 + noise)             // unexplained variation, seeded
//
// The constants below are global assumptions about campus catering, not
// per-dish tuning. The resulting per-dish observations are what the ML
// regression models train on, and the app recomputes dish baselines from the
// stored history rather than reading any of this back.

/** Baseline plate-waste tendency by dish category — documented global assumptions. */
const CATEGORY_FACTOR: Record<DishCategory, number> = {
  SALAD: 1.55,
  FRUIT: 1.35,
  SIDE: 1.2,
  RAITA: 1.1,
  MAIN: 1.0,
  BREAKFAST: 1.05,
  RICE: 0.85,
  BREAD: 0.8,
  SNACKS: 0.9,
  DESSERT: 1.15,
  CONDIMENT: 0.5,
  BEVERAGE: 0.45,
};

/**
 * Base plate-waste rate before factors, in percent of the portion served.
 * Calibrated so a typical diner leaves roughly 40–50 g of food per meal, which
 * is the range reported for Indian institutional mess catering.
 */
const BASE_WASTE_PCT = 4.6;

/**
 * Uptake: the share of diners who take a portion of a dish from the counter.
 * Not every student takes a salad or a dessert, and almost everyone takes rice
 * or chapati. Documented catering assumptions, not per-dish tuning.
 */
export const DISH_UPTAKE: Record<string, number> = {
  RICE: 0.92,
  BREAD: 0.88,
  MAIN: 0.8,
  SIDE: 0.7,
  BREAKFAST: 0.75,
  SNACKS: 0.7,
  SALAD: 0.5,
  RAITA: 0.55,
  DESSERT: 0.72,
  BEVERAGE: 0.55,
  CONDIMENT: 0.65,
  FRUIT: 0.7,
};

/** How many times a dish appears in the weekly menu — a proxy for familiarity. */
function servingFrequency(dishName: string): number {
  let n = 0;
  for (const meals of Object.values(WEEK_MENU)) {
    for (const dishes of Object.values(meals)) {
      if (dishes.includes(dishName)) n++;
    }
  }
  return n;
}

export type WasteContext = {
  date: Date;
  mealType: string;
  dishName: string;
  category: DishCategory;
  portionSizeG: number;
  /** students actually present vs predicted for the meal */
  attendanceRatio: number;
  /** 0..1 extra waste pressure for the day (holidays, cancelled events) */
  dayFactor?: number;
  /** deterministic uniform RNG in [0,1) */
  rng: () => number;
};

/**
 * Expected plate-waste percentage for one dish on one day.
 * Deterministic given the same rng sequence — the demo dataset is reproducible.
 */
export function expectedDishWastePct(ctx: WasteContext): number {
  const categoryFactor = CATEGORY_FACTOR[ctx.category] ?? 1;
  // 150 g is the reference portion; portion influence is deliberately sub-linear.
  const portionFactor = Math.pow(Math.max(0.5, ctx.portionSizeG / 150), 0.35);
  const freq = servingFrequency(ctx.dishName);
  // A dish served once a week is unfamiliar; one served daily is a staple.
  const frequencyFactor = freq >= 4 ? 0.9 : freq >= 2 ? 1.0 : 1.12;
  const weekday = ctx.date.getDay();
  const dayFactor = (weekday === 0 || weekday === 6 ? 1.08 : 1.0) * (ctx.dayFactor ?? 1);
  // Fewer students than expected means whatever is cooked gets left over.
  const attendanceFactor = 1 + Math.max(0, 1 - ctx.attendanceRatio) * 0.9;
  const noise = 0.8 + ctx.rng() * 0.4;

  return (
    BASE_WASTE_PCT *
    categoryFactor *
    portionFactor *
    frequencyFactor *
    dayFactor *
    attendanceFactor *
    noise
  );
}

/** Distinct dish names used by any day of the weekly menu. */
export function menuDishNames(weekday: number, mealType: string): string[] {
  return WEEK_MENU[weekday]?.[mealType] ?? [];
}
