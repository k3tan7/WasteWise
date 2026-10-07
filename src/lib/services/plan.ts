import { prisma } from "@/lib/db";
import { addDays, startOfDay, toISODate } from "@/lib/utils";
import { DISH_UPTAKE } from "@/lib/demo/rishihood/waste-model";
import { planPurchases, type InventoryPlan, type PlannedMealInput, type StockInput } from "@/lib/prediction/inventory";
import { forecastMeal } from "@/lib/services/forecast";

/**
 * Build the ingredient requirement + purchase plan for the next `horizonDays`
 * starting at `date`, using the upcoming *planned menus* and their forecasts.
 */
export async function buildPurchasePlan(date: Date, horizonDays = 4): Promise<{
  plan: InventoryPlan;
  meals: PlannedMealInput[];
  forecastSource: Record<string, { predicted: number; source: string }>;
}> {
  const from = startOfDay(date);
  const to = addDays(from, horizonDays - 1);

  const menus = await prisma.menu.findMany({
    where: { date: { gte: from, lte: to } },
    include: {
      items: { include: { dish: { include: { recipe: { include: { items: true } } } } } },
    },
    orderBy: [{ date: "asc" }, { mealType: "asc" }],
  });

  const plannedMeals: PlannedMealInput[] = [];
  const forecastSource: Record<string, { predicted: number; source: string }> = {};

  for (const menu of menus) {
    const key = `${toISODate(menu.date)}|${menu.mealType}`;
    let consumers = 0;
    let source = "forecast-engine";

    // Prefer a stored prediction / actual consumption when present.
    const meal = await prisma.meal.findUnique({
      where: { date_mealType: { date: startOfDay(menu.date), mealType: menu.mealType } },
    });
    if (meal?.actualConsumption) {
      consumers = meal.actualConsumption;
      source = "actual consumption";
    } else {
      const fc = await forecastMeal(menu.date, menu.mealType);
      consumers = fc.predicted;
      source = fc.stored ? "stored forecast" : "forecast engine";
    }
    forecastSource[key] = { predicted: consumers, source };

    // Ingredient requirement = Σ over dishes of (qty per serving × yield factor).
    // The yield factor grosses up for preparation loss (trimming, peeling) and
    // cooking loss (moisture/absorption) so the purchased quantity covers what
    // actually has to be bought — not just what lands on the plate. Usage is
    // aggregated per ingredient across the whole meal, so an ingredient used by
    // several dishes (e.g. tomato in rajma, mix veg and salad) is totalled once.
    const usage: Record<string, number> = {};
    for (const mi of menu.items) {
      const recipe = mi.dish.recipe;
      const prep = Math.min(0.5, Math.max(0, (recipe?.prepLossPct ?? 0) / 100));
      const cook = Math.min(0.6, Math.max(0, (recipe?.cookLossPct ?? 0) / 100));
      const yieldFactor = 1 / ((1 - prep) * (1 - cook));
      // Not every diner takes every dish (fewer take salad than rice), so the
      // batch the kitchen cooks for a dish is scaled by its expected uptake.
      // Without this the requirement engine would systematically over-buy.
      const uptake = DISH_UPTAKE[mi.dish.category] ?? 0.8;
      for (const ri of recipe?.items ?? []) {
        usage[ri.ingredientId] =
          (usage[ri.ingredientId] ?? 0) + ri.quantityPerServing * yieldFactor * uptake;
      }
    }
    plannedMeals.push({ mealType: menu.mealType, dateISO: toISODate(menu.date), consumers, ingredientUsage: usage });
  }

  // Stock snapshot. Water is tracked so no recipe is implicit, but it is not a
  // procured item — it never appears in a purchase plan.
  const ingredients = (await prisma.ingredient.findMany({ include: { inventory: true } })).filter(
    (i) => i.name !== "Water" && i.costPerUnit > 0,
  );

  const stocks: StockInput[] = ingredients.map((i) => {
    const onHand = i.inventory?.quantity ?? 0;
    // Perishables held for ~their full shelf life are treated as at-risk stock.
    let expiringSoon = 0;
    if (i.inventory?.lastRestockedAt) {
      const daysHeld = Math.floor((Date.now() - i.inventory.lastRestockedAt.getTime()) / 86400000);
      if (i.shelfLifeDays > 0 && daysHeld >= i.shelfLifeDays - 1) expiringSoon = Math.round(onHand * 0.5);
    }
    return {
      ingredientId: i.id,
      name: i.name,
      unit: i.unit,
      minStock: i.minStock,
      maxStock: i.maxStock,
      onHand,
      costPerUnit: i.costPerUnit,
      expiringSoon,
    };
  });

  // Incoming quantities from open purchase orders.
  const openPOs = await prisma.purchaseOrder.findMany({ where: { status: "ORDERED" } });
  const incoming: Record<string, number> = {};
  for (const po of openPOs) incoming[po.ingredientId] = (incoming[po.ingredientId] ?? 0) + po.quantity;

  const plan = planPurchases(plannedMeals, stocks, incoming, horizonDays);
  return { plan, meals: plannedMeals, forecastSource };
}

/** Rolling average daily ingredient usage derived from recent meals (informational). */
export async function getAverageDailyUsage(days = 14): Promise<Record<string, number>> {
  const from = addDays(startOfDay(new Date()), -(days - 1));
  const consumptions = await prisma.mealConsumption.findMany({
    where: { meal: { date: { gte: from } } },
    include: { dish: { include: { recipe: { include: { items: true } } } } },
  });
  const totals: Record<string, number> = {};
  for (const c of consumptions) {
    for (const ri of c.dish.recipe?.items ?? []) {
      totals[ri.ingredientId] = (totals[ri.ingredientId] ?? 0) + ri.quantityPerServing * c.servingsConsumed;
    }
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(totals)) out[k] = Math.round((v / days) * 100) / 100;
  return out;
}
