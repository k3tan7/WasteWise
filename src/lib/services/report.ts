import { prisma } from "@/lib/db";
import { getSettings, dailyBaselineKg, settingNumber } from "@/lib/settings";
import { addDays, mean, round, startOfDay, toISODate } from "@/lib/utils";

export type MonthlyReport = {
  month: string;
  monthLabel: string;
  from: string;
  to: string;
  totalStudents: number;
  days: number;
  /** days inside the period that actually carry records (partial months) */
  recordedDays: number;
  mealsServed: number;
  mealsPrepared: number;
  foodWasteKg: number;
  recyclableKg: number;
  rejectKg: number;
  totalWasteKg: number;
  baselineExpectedKg: number;
  wasteReductionPct: number;
  wastePerMealG: number;
  purchaseValue: number;
  purchaseOrders: number;
  /** null until receipts exist in the period — it cannot be measured yet */
  inventoryEfficiencyPct: number | null;
  compostKg: number;
  biogasM3: number;
  digestateKg: number;
  compostReusedKg: number;
  wasteDivertedKg: number;
  diversionRatePct: number;
  treatmentRecoveryPct: number;
  highWasteMeals: { date: string; mealType: string; wasteKg: number; expectedKg: number | null; variancePct: number | null }[];
  anomalies: { date: string; mealType: string; variancePct: number; severity: string; status: string; cause: string | null }[];
  topWasteDishes: { name: string; leftoverKg: number; avgWastePct: number }[];
  suggestedImprovements: string[];
};

export async function buildMonthlyReport(monthStart: Date): Promise<MonthlyReport> {
  const from = startOfDay(new Date(monthStart.getFullYear(), monthStart.getMonth(), 1));
  const to = startOfDay(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0));
  const month = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = from.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;

  // Treatment output is produced when a batch finishes, so a batch belongs to the
  // period in which it completed. Selecting on startDate as well would count one
  // batch in two months; selecting on startDate alone would count output whose
  // input lives outside the period, which is how "recovery %" exceeded 100%.
  const batches = await prisma.treatmentBatch.findMany({
    where: { status: "COMPLETED", endDate: { gte: from, lte: to } },
  });

  const [settings, totalStudents, meals, wasteAgg, wastePreds, orders, txns, outputs, anomalies, dishAgg] =
    await Promise.all([
      getSettings(),
      prisma.student.count({ where: { active: true } }),
      prisma.meal.findMany({ where: { date: { gte: from, lte: to } } }),
      prisma.wasteRecord.groupBy({ by: ["category"], where: { date: { gte: from, lte: to } }, _sum: { weightKg: true } }),
      prisma.wastePrediction.findMany({ where: { date: { gte: from, lte: to } } }),
      prisma.purchaseOrder.findMany({ where: { orderedAt: { gte: from, lte: to } } }),
      prisma.inventoryTransaction.findMany({ where: { createdAt: { gte: from, lte: addDays(to, 1) } } }),
      prisma.treatmentOutput.findMany({ where: { batchId: { in: batches.map((b) => b.id) } } }),
      prisma.wasteAnomaly.findMany({ where: { date: { gte: from, lte: to } }, include: { correctiveActions: true } }),
      prisma.mealConsumption.groupBy({
        by: ["dishId"],
        where: { meal: { date: { gte: from, lte: to } } },
        _sum: { leftoverKg: true },
        _avg: { wastePct: true },
      }),
    ]);

  const dishes = await prisma.dish.findMany({ where: { id: { in: dishAgg.map((d) => d.dishId) } }, select: { id: true, name: true } });
  const dishName = new Map(dishes.map((d) => [d.id, d.name]));

  const byCat = Object.fromEntries(wasteAgg.map((a) => [a.category, a._sum.weightKg ?? 0]));
  const foodWasteKg = round(byCat.FOOD ?? 0, 1);
  const recyclableKg = round(byCat.RECYCLABLE ?? 0, 1);
  const rejectKg = round(byCat.REJECT ?? 0, 1);
  const totalWasteKg = round(foodWasteKg + recyclableKg + rejectKg, 1);

  const mealsServed = meals.reduce((a, m) => a + (m.actualConsumption ?? 0), 0);
  const mealsPrepared = meals.reduce((a, m) => a + (m.actualPrep ?? 0), 0);

  // Only days that actually carry records can be compared with the baseline. A
  // partial month (or a month with no data yet) must not be measured against a
  // full month of expectation, or the reduction reads as a fake 80-100%.
  const recordedDays = new Set(meals.map((m) => startOfDay(m.date).getTime())).size;
  const baselineExpectedKg = round(dailyBaselineKg(settings) * recordedDays, 0);
  const wasteReductionPct = baselineExpectedKg > 0 ? round(((baselineExpectedKg - foodWasteKg) / baselineExpectedKg) * 100, 1) : 0;

  const purchaseValue = round(orders.reduce((a, o) => a + o.totalCost, 0), 2);
  const receipts = txns.filter((t) => t.type === "RECEIPT").reduce((a, t) => a + Math.abs(t.quantity), 0);
  const consumed = txns.filter((t) => t.type === "CONSUMPTION").reduce((a, t) => a + Math.abs(t.quantity), 0);
  // Consumption ÷ receipts is undefined with no receipts in the period — report
  // that as "not measurable" rather than as a 0% efficiency reading.
  const inventoryEfficiencyPct = receipts > 0 ? round((consumed / receipts) * 100, 1) : null;

  const compostKg = round(outputs.filter((o) => o.type === "COMPOST").reduce((a, o) => a + o.quantity, 0), 0);
  const biogasM3 = round(outputs.filter((o) => o.type === "BIOGAS").reduce((a, o) => a + o.quantity, 0), 0);
  const digestateKg = round(outputs.filter((o) => o.type === "DIGESTATE").reduce((a, o) => a + o.quantity, 0), 0);
  const compostReusedKg = round(outputs.filter((o) => o.type === "COMPOST").reduce((a, o) => a + o.reusedQuantity, 0), 0);

  const totalInput = batches.reduce((a, b) => a + b.inputKg, 0);
  const usefulOutput = compostKg + digestateKg;
  const treatmentRecoveryPct = totalInput > 0 ? round((usefulOutput / totalInput) * 100, 1) : 0;

  const wasteDivertedKg = round(Math.max(0, totalWasteKg - rejectKg), 1);
  const diversionRatePct = totalWasteKg > 0 ? round((wasteDivertedKg / totalWasteKg) * 100, 1) : 0;

  const predByMeal = new Map(wastePreds.map((w) => [`${toISODate(w.date)}|${w.mealType}`, w]));
  const highWasteMeals = meals
    .filter((m) => m.totalWasteKg != null)
    .sort((a, b) => (b.totalWasteKg ?? 0) - (a.totalWasteKg ?? 0))
    .slice(0, 5)
    .map((m) => {
      const p = predByMeal.get(`${toISODate(m.date)}|${m.mealType}`);
      return {
        date: toISODate(m.date),
        mealType: m.mealType,
        wasteKg: round(m.totalWasteKg ?? 0, 1),
        expectedKg: p ? round(p.expectedKg, 1) : null,
        variancePct: p?.variancePct ?? null,
      };
    });

  const topWasteDishes = dishAgg
    .map((d) => ({
      name: dishName.get(d.dishId) ?? d.dishId,
      leftoverKg: round(d._sum.leftoverKg ?? 0, 1),
      avgWastePct: round(d._avg.wastePct ?? 0, 1),
    }))
    .sort((a, b) => b.leftoverKg - a.leftoverKg)
    .slice(0, 5);

  const avgVariance = wastePreds.length ? mean(wastePreds.map((w) => w.variancePct ?? 0)) : 0;

  const suggestedImprovements: string[] = [];
  if (wasteReductionPct < 0) suggestedImprovements.push(`Food waste is ${Math.abs(wasteReductionPct)}% above the baseline — tighten the preparation buffer.`);
  else suggestedImprovements.push(`Food waste is ${wasteReductionPct}% below the baseline; maintain the current preparation discipline.`);
  if (avgVariance > 20) suggestedImprovements.push(`Actual waste averaged ${avgVariance.toFixed(0)}% above expectations — review the highest-variance meals.`);
  if (topWasteDishes[0]) suggestedImprovements.push(`Review portion size or menu frequency for ${topWasteDishes[0].name} (highest leftover).`);
  if (inventoryEfficiencyPct != null && inventoryEfficiencyPct < 70) suggestedImprovements.push("Inventory efficiency is low — reconcile receipts against recipe consumption and check for spoilage.");
  if (rejectKg > 0) suggestedImprovements.push(`Segregate ${rejectKg} kg of rejects more carefully to increase the diversion rate.`);
  if (compostReusedKg < compostKg) suggestedImprovements.push(`${round(compostKg - compostReusedKg, 0)} kg of compost is unused — allocate it to landscaping or the nursery.`);
  if (!suggestedImprovements.length) suggestedImprovements.push("No material issues identified this month.");

  return {
    month,
    monthLabel,
    from: toISODate(from),
    to: toISODate(to),
    totalStudents,
    days,
    recordedDays,
    mealsServed,
    mealsPrepared,
    foodWasteKg,
    recyclableKg,
    rejectKg,
    totalWasteKg,
    baselineExpectedKg,
    wasteReductionPct,
    wastePerMealG: mealsServed > 0 ? round((foodWasteKg / mealsServed) * 1000, 1) : 0,
    purchaseValue,
    purchaseOrders: orders.length,
    inventoryEfficiencyPct,
    compostKg,
    biogasM3,
    digestateKg,
    compostReusedKg,
    wasteDivertedKg,
    diversionRatePct,
    treatmentRecoveryPct,
    highWasteMeals,
    anomalies: anomalies.map((a) => ({
      date: toISODate(a.date),
      mealType: a.mealType,
      variancePct: a.variancePct,
      severity: a.severity,
      status: a.status,
      cause: a.correctiveActions[0]?.causeCode ?? null,
    })),
    topWasteDishes,
    suggestedImprovements,
  };
}

/** Flat key/value rows for CSV export. */
export function reportToCsvRows(r: MonthlyReport): Record<string, string | number>[] {
  const headline: Record<string, string | number> = {
    metric: "Overall",
    total_students: r.totalStudents,
    meals_served: r.mealsServed,
    meals_prepared: r.mealsPrepared,
    food_waste_kg: r.foodWasteKg,
    recyclable_kg: r.recyclableKg,
    reject_kg: r.rejectKg,
    total_waste_kg: r.totalWasteKg,
    waste_reduction_pct: r.wasteReductionPct,
    waste_per_meal_g: r.wastePerMealG,
    purchase_value: r.purchaseValue,
    purchase_orders: r.purchaseOrders,
    inventory_efficiency_pct: r.inventoryEfficiencyPct ?? "",
    compost_kg: r.compostKg,
    biogas_m3: r.biogasM3,
    digestate_kg: r.digestateKg,
    waste_diverted_kg: r.wasteDivertedKg,
    diversion_rate_pct: r.diversionRatePct,
    treatment_recovery_pct: r.treatmentRecoveryPct,
    anomalies: r.anomalies.length,
  };
  const rows = [headline];
  for (const m of r.highWasteMeals) {
    rows.push({ metric: `High-waste meal ${m.date} ${m.mealType}`, food_waste_kg: m.wasteKg, waste_reduction_pct: m.variancePct ?? "" });
  }
  for (const s of r.suggestedImprovements) rows.push({ metric: "Suggested improvement", value: s });
  return rows;
}

export { settingNumber };
