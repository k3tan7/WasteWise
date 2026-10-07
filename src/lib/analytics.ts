import { prisma } from "@/lib/db";
import { addDays, mean, startOfDay, toISODate } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Attendance                                                                  */
/* -------------------------------------------------------------------------- */
export async function getAttendanceSummary(date: Date) {
  const day = startOfDay(date);
  const [enrolled, present, hostel, dayScholar, lunch, dinner, breakfast, snacks] = await Promise.all([
    prisma.student.count({ where: { active: true } }),
    prisma.attendance.count({ where: { date: day, present: true } }),
    prisma.attendance.count({ where: { date: day, present: true, student: { residence: "HOSTEL" } } }),
    prisma.attendance.count({ where: { date: day, present: true, student: { residence: "DAY_SCHOLAR" } } }),
    prisma.attendance.count({ where: { date: day, lunch: true } }),
    prisma.attendance.count({ where: { date: day, dinner: true } }),
    prisma.attendance.count({ where: { date: day, breakfast: true } }),
    prisma.attendance.count({ where: { date: day, snacks: true } }),
  ]);
  return {
    enrolled,
    present,
    absent: Math.max(0, enrolled - present),
    hostel,
    dayScholar,
    participants: { BREAKFAST: breakfast, LUNCH: lunch, SNACKS: snacks, DINNER: dinner },
  };
}

/* -------------------------------------------------------------------------- */
/* Meals                                                                       */
/* -------------------------------------------------------------------------- */
export async function getMealsForDate(date: Date) {
  return prisma.meal.findMany({
    where: { date: startOfDay(date) },
    orderBy: { mealType: "asc" },
    include: { menu: { include: { items: { include: { dish: true } } } } },
  });
}

/* -------------------------------------------------------------------------- */
/* Waste series                                                                */
/* -------------------------------------------------------------------------- */
export type WasteFilters = {
  from?: Date;
  to?: Date;
  mealType?: string;
  category?: string;
  location?: string;
};

export function buildWasteWhere(f: WasteFilters) {
  const where: Record<string, unknown> = {};
  if (f.from || f.to) {
    where.date = {
      ...(f.from ? { gte: startOfDay(f.from) } : {}),
      ...(f.to ? { lte: startOfDay(f.to) } : {}),
    };
  }
  if (f.mealType && f.mealType !== "ALL") where.mealType = f.mealType;
  if (f.category && f.category !== "ALL") where.category = f.category;
  if (f.location && f.location !== "ALL") where.location = f.location;
  return where;
}

export async function getWasteRecords(f: WasteFilters, take = 500) {
  return prisma.wasteRecord.findMany({
    where: buildWasteWhere(f),
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
    include: { dish: true, reason: true },
  });
}

/**
 * Daily totals (food + recyclable + reject) for a window.
 * Optional meal/location filters keep this series consistent with whatever
 * filters the caller's UI applies to the other metrics on the same screen.
 */
export async function getDailyWasteSeries(days: number, end: Date = new Date(), f: Omit<WasteFilters, "from" | "to"> = {}) {
  const to = startOfDay(end);
  const from = addDays(to, -(days - 1));
  const rows = await prisma.wasteRecord.findMany({
    where: { ...buildWasteWhere(f), date: { gte: from, lte: to } },
    select: { date: true, category: true, weightKg: true },
  });
  const byDay = new Map<string, { date: string; food: number; recyclable: number; reject: number; total: number }>();
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    byDay.set(toISODate(d), { date: toISODate(d), food: 0, recyclable: 0, reject: 0, total: 0 });
  }
  for (const r of rows) {
    const key = toISODate(r.date);
    const entry = byDay.get(key);
    if (!entry) continue;
    const w = r.weightKg;
    if (r.category === "FOOD") entry.food += w;
    else if (r.category === "RECYCLABLE") entry.recyclable += w;
    else entry.reject += w;
    entry.total += w;
  }
  return Array.from(byDay.values()).map((e) => ({
    ...e,
    food: Math.round(e.food * 10) / 10,
    recyclable: Math.round(e.recyclable * 10) / 10,
    reject: Math.round(e.reject * 10) / 10,
    total: Math.round(e.total * 10) / 10,
  }));
}

export async function getWasteBreakdown(f: WasteFilters) {
  const rows = await prisma.wasteRecord.findMany({
    where: buildWasteWhere(f),
    select: { category: true, subCategory: true, weightKg: true, mealType: true, location: true },
  });
  const byCategory: Record<string, number> = { FOOD: 0, RECYCLABLE: 0, REJECT: 0 };
  const byMeal: Record<string, number> = {};
  const byLocation: Record<string, number> = {};
  const bySub: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + r.weightKg;
    byMeal[r.mealType ?? "Unassigned"] = (byMeal[r.mealType ?? "Unassigned"] ?? 0) + r.weightKg;
    byLocation[r.location] = (byLocation[r.location] ?? 0) + r.weightKg;
    bySub[r.subCategory ?? "Other"] = (bySub[r.subCategory ?? "Other"] ?? 0) + r.weightKg;
    total += r.weightKg;
  }
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    total: round1(total),
    byCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, round1(v)])),
    byMeal: Object.fromEntries(Object.entries(byMeal).map(([k, v]) => [k, round1(v)])),
    byLocation: Object.fromEntries(Object.entries(byLocation).map(([k, v]) => [k, round1(v)])),
    bySub: Object.fromEntries(Object.entries(bySub).map(([k, v]) => [k, round1(v)])),
  };
}

/* -------------------------------------------------------------------------- */
/* Prediction accuracy (learning loop)                                         */
/* -------------------------------------------------------------------------- */
export async function getDemandAccuracy(days: number, end: Date = new Date(), mealType?: string) {
  const to = startOfDay(end);
  const from = addDays(to, -(days - 1));
  const rows = await prisma.mealPrediction.findMany({
    where: {
      date: { gte: from, lte: to },
      actualConsumption: { not: null },
      ...(mealType && mealType !== "ALL" ? { mealType } : {}),
    },
    orderBy: { date: "asc" },
  });
  const withActual = rows.map((r) => ({
    date: toISODate(r.date),
    mealType: r.mealType,
    predicted: r.predictedConsumption,
    actual: r.actualConsumption ?? 0,
    error: r.error ?? 0,
    absErrorPct:
      r.predictedConsumption > 0
        ? Math.abs(((r.actualConsumption ?? 0) - r.predictedConsumption) / r.predictedConsumption) * 100
        : 0,
    confidence: r.confidence,
  }));
  const mape = withActual.length ? mean(withActual.map((r) => r.absErrorPct)) : 0;
  const mae = withActual.length ? mean(withActual.map((r) => Math.abs(r.error))) : 0;
  const bias = withActual.length ? mean(withActual.map((r) => r.error)) : 0;
  return { rows: withActual, mape, mae, bias, accuracy: Math.max(0, 100 - mape), count: withActual.length };
}

export async function getWastePredictionAccuracy(days: number, end: Date = new Date()) {
  const to = startOfDay(end);
  const from = addDays(to, -(days - 1));
  const rows = await prisma.wastePrediction.findMany({
    where: { date: { gte: from, lte: to }, actualKg: { not: null } },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({
    date: toISODate(r.date),
    mealType: r.mealType,
    expected: r.expectedKg,
    actual: r.actualKg ?? 0,
    variancePct: r.variancePct ?? 0,
  }));
}

/* -------------------------------------------------------------------------- */
/* Dish-level waste                                                            */
/* -------------------------------------------------------------------------- */
export type DishWasteStat = {
  dishId: string;
  name: string;
  category: string;
  occurrences: number;
  exceedances: number;
  avgWastePct: number;
  baselinePct: number;
  totalLeftoverKg: number;
  exceedanceRate: number;
};

/**
 * A dish is "problematic" only when it repeatedly exceeds its baseline — never
 * from a single isolated occurrence.
 */
export async function getDishWasteStats(days = 30, end: Date = new Date()): Promise<DishWasteStat[]> {
  const to = startOfDay(end);
  const from = addDays(to, -(days - 1));
  const rows = await prisma.mealConsumption.findMany({
    where: { meal: { date: { gte: from, lte: to } } },
    include: { dish: true, meal: true },
  });
  const map = new Map<string, DishWasteStat>();
  for (const r of rows) {
    const baseline = r.dish.historicalWastePct || 6;
    const e =
      map.get(r.dishId) ??
      ({
        dishId: r.dishId,
        name: r.dish.name,
        category: r.dish.category,
        occurrences: 0,
        exceedances: 0,
        avgWastePct: 0,
        baselinePct: baseline,
        totalLeftoverKg: 0,
        exceedanceRate: 0,
      } as DishWasteStat);
    e.occurrences += 1;
    e.avgWastePct += r.wastePct;
    e.totalLeftoverKg += r.leftoverKg;
    if (r.wastePct > baseline * 1.15) e.exceedances += 1;
    map.set(r.dishId, e);
  }
  return Array.from(map.values())
    .map((e) => ({
      ...e,
      avgWastePct: Math.round((e.avgWastePct / Math.max(1, e.occurrences)) * 10) / 10,
      totalLeftoverKg: Math.round(e.totalLeftoverKg * 10) / 10,
      exceedanceRate: e.exceedances / Math.max(1, e.occurrences),
    }))
    .sort((a, b) => b.exceedanceRate - a.exceedanceRate || b.totalLeftoverKg - a.totalLeftoverKg);
}

/* -------------------------------------------------------------------------- */
/* Waste reduction vs baseline                                                 */
/* -------------------------------------------------------------------------- */
/**
 * Compare recorded food waste against the pre-platform daily baseline.
 *
 * `dailyFoodWasteKg` must be FOOD waste only — the baseline setting is defined
 * as food waste per day, so passing total waste (which includes recyclable and
 * reject streams) would overstate the reduction.
 */
export function reductionVsBaseline(dailyFoodWasteKg: number[], baselinePerDay: number, days: number) {
  const expected = baselinePerDay * days;
  const actual = dailyFoodWasteKg.reduce((a, v) => a + v, 0);
  const reductionPct = expected > 0 ? ((expected - actual) / expected) * 100 : 0;
  return { expected: Math.round(expected), actual: Math.round(actual), reductionPct: Math.round(reductionPct * 10) / 10 };
}
