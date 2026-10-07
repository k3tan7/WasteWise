// ---------------------------------------------------------------------------
// INVENTORY REQUIREMENT + PURCHASE RECOMMENDATION ENGINE (deterministic)
// ---------------------------------------------------------------------------
// Required quantity is derived from the *upcoming planned menu*, not a flat
// historical average:
//
//   required(ingredient) = Σ_meals Σ_dishes  predictedConsumers(meal)
//                                            · quantityPerServing(dish, ingredient)
//
//   usableStock   = onHand − reservedExpiringSoon        (shelf-life aware)
//   safetyTarget  = minStock
//   incoming      = Σ pending purchase orders (ORDERED) not yet received
//   recommended   = max(0, required + safetyTarget − usableStock − incoming)
//
// A purchase is only recommended when stock cannot cover requirement + safety.
// ---------------------------------------------------------------------------

export type PlannedMealInput = {
  mealType: string;
  dateISO: string;
  /** predicted number of diners for this meal */
  consumers: number;
  /** ingredientId -> quantity per single serving */
  ingredientUsage: Record<string, number>;
};

export type StockInput = {
  ingredientId: string;
  name: string;
  unit: string;
  minStock: number;
  maxStock: number;
  onHand: number;
  costPerUnit: number;
  /** quantity that will expire before it can be used */
  expiringSoon?: number;
};

export type PurchaseRecommendationRow = {
  ingredientId: string;
  name: string;
  unit: string;
  requiredQty: number;
  currentStock: number;
  safetyStock: number;
  incoming: number;
  recommendedQty: number;
  reason: string;
  breaching: boolean; // required > usable stock
};

export type InventoryPlan = {
  rows: PurchaseRecommendationRow[];
  byIngredient: Record<string, number>; // required quantities
};

export function computeRequirements(
  meals: PlannedMealInput[]
): Record<string, number> {
  const required: Record<string, number> = {};
  for (const meal of meals) {
    for (const [ingredientId, perServing] of Object.entries(meal.ingredientUsage)) {
      required[ingredientId] = (required[ingredientId] ?? 0) + perServing * meal.consumers;
    }
  }
  return required;
}

export function planPurchases(
  meals: PlannedMealInput[],
  stocks: StockInput[],
  incomingByIngredient: Record<string, number> = {},
  horizonDays = 4
): InventoryPlan {
  const required = computeRequirements(meals);

  const rows: PurchaseRecommendationRow[] = stocks.map((s) => {
    const requiredQty = Math.round(required[s.ingredientId] ?? 0);
    const usable = Math.max(0, s.onHand - (s.expiringSoon ?? 0));
    const incoming = incomingByIngredient[s.ingredientId] ?? 0;
    const safetyStock = s.minStock;
    const raw = requiredQty + safetyStock - usable - incoming;
    const recommendedQty = raw > 0 ? Math.ceil(raw) : 0;

    const breaching = requiredQty > usable;

    let reason: string;
    if (recommendedQty === 0) {
      if (!breaching) {
        reason = `Sufficient: ${Math.round(usable)} ${s.unit} usable covers the ${requiredQty} ${s.unit} required over the next ${horizonDays} days.`;
      } else if (incoming > 0) {
        reason = `Requirement (${requiredQty} ${s.unit}) exceeds usable stock (${Math.round(usable)} ${s.unit}), but ${incoming} ${s.unit} is already on order.`;
      } else {
        reason = `No purchase needed — stock is steady.`;
      }
    } else {
      const parts = [
        `Projected consumption over the next ${horizonDays} days requires ${requiredQty} ${s.unit}`,
        `usable stock is ${Math.round(usable)} ${s.unit}`,
      ];
      if (safetyStock > 0) parts.push(`a ${safetyStock} ${s.unit} safety buffer is held`);
      if (incoming > 0) parts.push(`${incoming} ${s.unit} is already on order`);
      reason = `${parts.join(", ")} — buying ${recommendedQty} ${s.unit} closes the gap.`;
    }

    return {
      ingredientId: s.ingredientId,
      name: s.name,
      unit: s.unit,
      requiredQty,
      currentStock: Math.round(s.onHand),
      safetyStock,
      incoming,
      recommendedQty,
      reason,
      breaching,
    };
  });

  // Most urgent first: largest gap.
  rows.sort((a, b) => b.recommendedQty - a.recommendedQty || a.name.localeCompare(b.name));

  return { rows, byIngredient: required };
}

export function totalRecommended(rows: PurchaseRecommendationRow[]): number {
  return rows.reduce((a, r) => a + r.recommendedQty, 0);
}

export function stockStatus(
  onHand: number,
  minStock: number,
  maxStock: number
): "OUT" | "LOW" | "OK" | "OVERSTOCK" {
  if (onHand <= 0) return "OUT";
  if (onHand < minStock) return "LOW";
  if (maxStock > 0 && onHand > maxStock) return "OVERSTOCK";
  return "OK";
}
