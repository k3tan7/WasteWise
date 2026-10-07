import { prisma } from "@/lib/db";
import { addDays, mean, round, startOfDay, toISODate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// MENU & DISH ANALYTICS
// ---------------------------------------------------------------------------
// Everything here is computed from stored observations (MealConsumption rows
// written when a meal completes) — no dish statistics are hardcoded. Repeated
// observation is required before a dish is labelled a problem: a single bad
// service is never enough.

export type DishStat = {
  dishId: string;
  name: string;
  category: string;
  occurrences: number;
  servingsConsumed: number;
  servingsServed: number;
  leftoverKg: number;
  avgWastePct: number;
  /** rolling baseline: the dish's own mean waste rate across the window */
  baselinePct: number;
  /** occurrences in the last 8 where waste exceeded the baseline */
  aboveBaselineLast8: number;
  last8: { date: string; mealType: string; wastePct: number; servings: number }[];
  costPerServing: number;
};

export type MenuAnalytics = {
  from: string;
  to: string;
  dishCount: number;
  observations: number;
  mostConsumed: DishStat[];
  leastConsumed: DishStat[];
  highestWaste: DishStat[];
  lowestWaste: DishStat[];
  mostFrequent: { name: string; category: string; occurrences: number; meals: number }[];
  wasteByMealType: { mealType: string; plateKg: number; unservedKg: number; kitchenKg: number; totalKg: number; meals: number }[];
  wasteByDish: DishStat[];
  demandAccuracy: { mealType: string; predicted: number; actual: number; mae: number; biasPct: number; samples: number }[];
  wasteAccuracy: { mealType: string; predicted: number; actual: number; mae: number; biasPct: number; samples: number }[];
  weeklyTrend: { date: string; plateKg: number; meals: number }[];
  insights: { tone: "warning" | "success" | "info"; title: string; detail: string; action?: string }[];
  dayOfWeekPatterns: { dish: string; day: string; avgServings: number; overall: number; ratio: number; occurrences: number }[];
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function buildMenuAnalytics(days = 30): Promise<MenuAnalytics> {
  const to = startOfDay(new Date());
  const from = addDays(to, -(days - 1));

  const [rows, meals, dishes, demandPreds, wastePreds] = await Promise.all([
    prisma.mealConsumption.findMany({
      where: { meal: { date: { gte: from, lte: to } } },
      include: { dish: { select: { id: true, name: true, category: true, estCostPerServing: true } }, meal: { select: { date: true, mealType: true } } },
      orderBy: { meal: { date: "asc" } },
    }),
    prisma.meal.findMany({ where: { date: { gte: from, lte: to } } }),
    prisma.dish.count({ where: { active: true } }),
    prisma.mealPrediction.findMany({ where: { date: { gte: from, lte: to } } }),
    prisma.wastePrediction.findMany({ where: { date: { gte: from, lte: to } } }),
  ]);

  // ---- Per-dish aggregation ----------------------------------------------
  const byDish = new Map<string, DishStat & { _series: { date: Date; mealType: string; wastePct: number; servings: number }[] }>();
  for (const r of rows) {
    let s = byDish.get(r.dishId);
    if (!s) {
      s = {
        dishId: r.dishId,
        name: r.dish.name,
        category: r.dish.category,
        occurrences: 0,
        servingsConsumed: 0,
        servingsServed: 0,
        leftoverKg: 0,
        avgWastePct: 0,
        baselinePct: 0,
        aboveBaselineLast8: 0,
        last8: [],
        costPerServing: r.dish.estCostPerServing,
        _series: [],
      };
      byDish.set(r.dishId, s);
    }
    s.occurrences++;
    s.servingsConsumed += r.servingsConsumed;
    s.servingsServed += r.servingsServed;
    s.leftoverKg = round(s.leftoverKg + r.leftoverKg, 2);
    s._series.push({ date: r.meal.date, mealType: r.meal.mealType, wastePct: r.wastePct, servings: r.servingsConsumed });
  }

  const dishStats: DishStat[] = [];
  for (const s of byDish.values()) {
    const { _series, ...rest } = s;
    const baselinePct = round(mean(_series.map((x) => x.wastePct)), 1);
    // Dish-level baseline for "is this occurrence unusual?": the dish's own mean.
    const recent = _series.slice(-8);
    // "Above baseline" needs both a relative and an absolute margin, so a dish
    // with a tiny baseline (hot milk) doesn't get flagged for 0.2 pp of noise.
    const above = recent.filter((x) => x.wastePct > baselinePct * 1.08 && x.wastePct > baselinePct + 1.5).length;
    dishStats.push({
      ...rest,
      avgWastePct: baselinePct,
      baselinePct,
      aboveBaselineLast8: above,
      last8: recent.map((x) => ({
        date: toISODate(x.date),
        mealType: x.mealType,
        wastePct: x.wastePct,
        servings: x.servings,
      })),
      leftoverKg: rest.leftoverKg,
    });
  }

  const meaningful = dishStats.filter((d) => d.occurrences >= 2);

  // ---- Waste by meal type ------------------------------------------------
  const wasteByMealType = (["BREAKFAST", "LUNCH", "SNACKS", "DINNER"] as const).map((mealType) => {
    const ms = meals.filter((m) => m.mealType === mealType);
    return {
      mealType,
      plateKg: round(ms.reduce((a, m) => a + (m.plateWasteKg ?? 0), 0), 1),
      unservedKg: round(ms.reduce((a, m) => a + (m.unservedKg ?? 0), 0), 1),
      kitchenKg: round(ms.reduce((a, m) => a + ((m.totalWasteKg ?? 0) - (m.plateWasteKg ?? 0) - (m.unservedKg ?? 0)), 0), 1),
      totalKg: round(ms.reduce((a, m) => a + (m.totalWasteKg ?? 0), 0), 1),
      meals: ms.length,
    };
  });

  // ---- Predicted vs actual ----------------------------------------------
  const demandAccuracy = (["BREAKFAST", "LUNCH", "SNACKS", "DINNER"] as const).map((mealType) => {
    const ps = demandPreds.filter((p) => p.mealType === mealType && p.actualConsumption != null);
    const predicted = round(mean(ps.map((p) => p.predictedConsumption)), 0);
    const actual = round(mean(ps.map((p) => p.actualConsumption ?? 0)), 0);
    return {
      mealType,
      predicted,
      actual,
      mae: round(mean(ps.map((p) => Math.abs(p.error ?? 0))), 1),
      biasPct: predicted > 0 ? round(((actual - predicted) / predicted) * 100, 1) : 0,
      samples: ps.length,
    };
  });

  const wasteAccuracy = (["BREAKFAST", "LUNCH", "SNACKS", "DINNER"] as const).map((mealType) => {
    const ps = wastePreds.filter((p) => p.mealType === mealType);
    const predicted = round(mean(ps.map((p) => p.expectedKg)), 1);
    const actual = round(mean(ps.map((p) => p.actualKg ?? 0)), 1);
    return {
      mealType,
      predicted,
      actual,
      mae: round(mean(ps.map((p) => Math.abs((p.actualKg ?? 0) - p.expectedKg))), 1),
      biasPct: predicted > 0 ? round(((actual - predicted) / predicted) * 100, 1) : 0,
      samples: ps.length,
    };
  });

  // ---- Weekly plate-waste trend -----------------------------------------
  const trendMap = new Map<string, { plateKg: number; meals: number }>();
  for (const m of meals) {
    const k = toISODate(m.date);
    const t = trendMap.get(k) ?? { plateKg: 0, meals: 0 };
    // "plateKg" here is total food waste for the day, split shown in the table.
    t.plateKg = round(t.plateKg + (m.totalWasteKg ?? 0), 1);
    t.meals++;
    trendMap.set(k, t);
  }
  const weeklyTrend = [...trendMap.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ---- Day-of-week consumption patterns ---------------------------------
  const dow = new Map<string, { total: number; n: number }>(); // `${dishId}|${dow}`
  const dishOverall = new Map<string, number>();
  for (const r of rows) {
    const d = r.meal.date.getDay();
    const key = `${r.dishId}|${d}`;
    const cur = dow.get(key) ?? { total: 0, n: 0 };
    cur.total += r.servingsConsumed;
    cur.n++;
    dow.set(key, cur);
    dishOverall.set(r.dishId, (dishOverall.get(r.dishId) ?? 0) + r.servingsConsumed / Math.max(1, r.servingsServed) * 0);
  }
  const consumptionByDish = new Map<string, { total: number; n: number }>();
  for (const r of rows) {
    const cur = consumptionByDish.get(r.dishId) ?? { total: 0, n: 0 };
    cur.total += r.servingsConsumed;
    cur.n++;
    consumptionByDish.set(r.dishId, cur);
  }
  const dayOfWeekPatterns: MenuAnalytics["dayOfWeekPatterns"] = [];
  for (const [key, v] of dow) {
    const [dishId, dayStr] = key.split("|");
    if (v.n < 3) continue;
    const overall = consumptionByDish.get(dishId);
    if (!overall) continue;
    const avgHere = v.total / v.n;
    const avgAll = overall.total / overall.n;
    const ratio = avgAll > 0 ? avgHere / avgAll : 0;
    if (ratio >= 1.15) {
      dayOfWeekPatterns.push({
        dish: byDish.get(dishId)?.name ?? dishId,
        day: DAY_NAMES[Number(dayStr)],
        avgServings: round(avgHere, 0),
        overall: round(avgAll, 0),
        ratio: round(ratio, 2),
        occurrences: v.n,
      });
    }
  }
  dayOfWeekPatterns.sort((a, b) => b.ratio - a.ratio);

  // ---- Narrative insights (repeated observation required) ----------------
  const insights: MenuAnalytics["insights"] = [];

  for (const d of dishStats) {
    const last8 = d.last8.length;
    if (last8 >= 5 && d.aboveBaselineLast8 / last8 >= 0.6 && d.baselinePct >= 3) {
      insights.push({
        tone: "warning",
        title: `${d.name} has generated above-baseline waste in ${d.aboveBaselineLast8} of its last ${last8} occurrences`,
        detail: `Its own rolling baseline is ${d.baselinePct}% plate waste; it exceeded that in ${d.aboveBaselineLast8} of the last ${last8} times it was served (${round(d.leftoverKg, 1)} kg of leftover in the period).`,
        action: "Reduce the preparation quantity, review portion size, or review the recipe and quality before changing the menu frequency.",
      });
    }
  }

  const efficient = dishStats
    .filter((d) => d.occurrences >= 5 && d.baselinePct <= 3.5)
    .slice(0, 2);
  for (const d of efficient) {
    insights.push({
      tone: "success",
      title: `${d.name} has a consistently low waste rate`,
      detail: `${d.baselinePct}% average plate waste across ${d.occurrences} servings — well below the kitchen average.`,
      action: "Safe to keep on the rotation at current quantities.",
    });
  }

  for (const p of dayOfWeekPatterns.slice(0, 2)) {
    insights.push({
      tone: "info",
      title: `${p.dish} consumption is consistently high on ${p.day}s`,
      detail: `Averaging ${p.avgServings} servings on ${p.day} versus ${p.overall} overall (${p.ratio}× its usual draw), from ${p.occurrences} observations.`,
      action: `Plan a larger batch for ${p.day} and trim the buffer on other days.`,
    });
  }

  const worstMeal = wasteByMealType.slice().sort((a, b) => b.totalKg / Math.max(1, b.meals) - a.totalKg / Math.max(1, a.meals))[0];
  if (worstMeal) {
    const perMeal = round(worstMeal.totalKg / Math.max(1, worstMeal.meals), 1);
    insights.push({
      tone: "warning",
      title: `${worstMeal.mealType.toLowerCase()} has the highest waste per service`,
      detail: `${perMeal} kg of food waste per ${worstMeal.mealType.toLowerCase()} on average, of which ${round(worstMeal.unservedKg / Math.max(1, worstMeal.meals), 1)} kg is cooked-but-unserved food.`,
      action: "Tighten the preparation buffer for this meal and check the attendance forecast it was planned against.",
    });
  }

  return {
    from: toISODate(from),
    to: toISODate(to),
    dishCount: dishes,
    observations: rows.length,
    mostConsumed: meaningful.slice().sort((a, b) => b.servingsConsumed - a.servingsConsumed).slice(0, 10),
    leastConsumed: meaningful.slice().sort((a, b) => a.servingsConsumed - b.servingsConsumed).slice(0, 10),
    highestWaste: meaningful.slice().sort((a, b) => b.avgWastePct - a.avgWastePct).slice(0, 10),
    lowestWaste: meaningful.slice().sort((a, b) => a.avgWastePct - b.avgWastePct).slice(0, 10),
    mostFrequent: [...byDish.values()]
      .map((d) => ({ name: d.name, category: d.category, occurrences: d.occurrences, meals: 0 }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10),
    wasteByMealType,
    wasteByDish: meaningful.slice().sort((a, b) => b.leftoverKg - a.leftoverKg).slice(0, 15),
    demandAccuracy,
    wasteAccuracy,
    weeklyTrend,
    insights,
    dayOfWeekPatterns: dayOfWeekPatterns.slice(0, 8),
  };
}

/** Recipes missing ingredients or other completeness requirements. */
export async function incompleteRecipes() {
  const dishes = await prisma.dish.findMany({
    include: { recipe: { include: { items: { include: { ingredient: { include: { inventory: true } } } } } } },
    orderBy: { name: "asc" },
  });
  return dishes
    .map((d) => {
      const problems: string[] = [];
      if (!d.recipe) problems.push("No recipe defined");
      else {
        if (!d.recipe.items.length) problems.push("Recipe has no ingredients");
        if (!d.recipe.standardYield || d.recipe.standardYield <= 0) problems.push("Recipe yield not defined");
        for (const it of d.recipe.items) {
          if (!(it.quantityPerServing > 0)) problems.push(`${it.ingredient.name} has no quantity`);
          if (!it.unit) problems.push(`${it.ingredient.name} has no unit`);
          if (!it.ingredient.inventory) problems.push(`${it.ingredient.name} is not linked to inventory`);
        }
      }
      return { id: d.id, name: d.name, category: d.category, problems, ingredientCount: d.recipe?.items.length ?? 0 };
    })
    .filter((d) => d.problems.length > 0);
}
