// ---------------------------------------------------------------------------
// RISHIHOOD UNIVERSITY — RECIPE TYPES
// ---------------------------------------------------------------------------
// Every menu item in the Rishihood mess is modelled as a real recipe with a
// complete, explicit ingredient breakdown. Quantities are per single serving
// in the ingredient's own unit (kg / L / piece) — see ingredients.ts.
//
// Loss factors are operational facts about cooking, not decoration:
//   prepLossPct  — trimming, peeling, washing loss before cooking
//   cookLossPct  — moisture loss / absorption during cooking
// They are applied by the requirement engine so a purchase quantity covers
// what must actually be bought, not just what ends up on the plate.

export type DishCategory =
  | "BREAKFAST"
  | "MAIN"
  | "RICE"
  | "BREAD"
  | "SALAD"
  | "RAITA"
  | "SIDE"
  | "SNACKS"
  | "DESSERT"
  | "BEVERAGE"
  | "CONDIMENT"
  | "FRUIT";

export type RecipeSeed = {
  name: string;
  category: DishCategory;
  /** plated portion in grams (or ml for beverages) */
  portionSizeG: number;
  /** servings produced by the standard batch the ingredient list is written for */
  standardYield: number;
  prepLossPct: number;
  cookLossPct: number;
  /** [ingredient name, quantity per serving in the ingredient's own unit] */
  items: [string, number][];
  /** marker that a real Rishihood recipe was unavailable and a standardized demo recipe is used */
  demoAssumption?: string;
  instructions?: string;
};

/** Convenience builder so the recipe tables stay readable. */
export function dish(
  name: string,
  category: DishCategory,
  portionSizeG: number,
  items: [string, number][],
  opts: { prepLossPct?: number; cookLossPct?: number; standardYield?: number; demoAssumption?: string; instructions?: string } = {},
): RecipeSeed {
  return {
    name,
    category,
    portionSizeG,
    standardYield: opts.standardYield ?? 100,
    prepLossPct: opts.prepLossPct ?? 0,
    cookLossPct: opts.cookLossPct ?? 0,
    items,
    demoAssumption: opts.demoAssumption,
    instructions: opts.instructions,
  };
}
