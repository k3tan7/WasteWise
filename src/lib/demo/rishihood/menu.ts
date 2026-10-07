import { WEEKDAY_DISHES } from "./dishes-weekday";
import { WEEKEND_DISHES } from "./dishes-weekend";
import type { RecipeSeed } from "./recipes";

// ---------------------------------------------------------------------------
// RISHIHOOD UNIVERSITY — CAMPUS COMPOSITION
// ---------------------------------------------------------------------------
// Residential campus: ~2,500 students in hostels, no day scholars, plus ~200
// staff who eat breakfast and lunch in the mess.
export const RISHIHOOD = {
  name: "Rishihood University",
  /** students on roll (all residential) */
  enrolledStudents: 2500,
  staff: 200,
  /** non-teaching + teaching staff eat these meals */
  staffMeals: ["BREAKFAST", "LUNCH"] as const,
  hostels: ["Vedanta Boys Hostel", "Yamuna Girls Hostel", "Saraswati Hostel"],
  departments: ["SDS", "SOM", "SOL", "SAHE", "SES"],
};

// ---------------------------------------------------------------------------
// ALL RECIPES (weekday + weekend), de-duplicated by dish name.
// ---------------------------------------------------------------------------
const byName = new Map<string, RecipeSeed>();
for (const d of [...WEEKDAY_DISHES, ...WEEKEND_DISHES]) {
  if (byName.has(d.name)) throw new Error(`Duplicate dish definition: ${d.name}`);
  byName.set(d.name, d);
}
export const ALL_RECIPES: RecipeSeed[] = [...byName.values()];
export const RECIPE_BY_NAME = byName;

/**
 * Menu composition by day of week, meal type and dish.
 * Days 1–5 are Mon–Fri, 0 and 6 are Sunday/Saturday (JS getDay()).
 * Source listings from the Rishihood mess are reproduced verbatim for
 * Mon–Thu; Fri–Sun are realistic variations in the same style.
 */
export const WEEK_MENU: Record<number, Record<string, string[]>> = {
  // ---- MONDAY ------------------------------------------------------------
  1: {
    BREAKFAST: [
      "Banana", "Masala Oats", "Chocos", "Idli", "Sambar", "Peanut Chutney",
      "Hot Milk", "Cold Milk", "Tea", "Coffee", "Bread", "Butter", "Jam",
    ],
    LUNCH: ["Chaas", "Rajma Masala", "Mix Veg", "Andhra Pappu", "Gulab Jamun", "Green Salad", "Steamed Rice", "Chapati"],
    SNACKS: ["Gol Gappe", "Coffee", "Tea"],
    DINNER: ["Mix Yellow Dal", "Soya Keema Matar", "Brinjal Curry", "Cucumber Salad", "Rice", "Chapati"],
  },

  // ---- TUESDAY -----------------------------------------------------------
  2: {
    BREAKFAST: [
      "Watermelon", "Dalia", "Muesli", "Ajwaini Poori", "Bhandara Aloo",
      "Hot Milk", "Cold Milk", "Tea", "Coffee", "Bread", "Butter", "Jam",
    ],
    LUNCH: ["Pickle", "Onion", "Chole Masala", "Jeera Aloo", "Curd", "Onion-Garlic Rasam", "Ghee Rice", "Chapati"],
    SNACKS: ["Veg Puff", "Tomato Ketchup", "Hot Milk", "Tea", "Coffee"],
    DINNER: ["Soya Chaap", "Moong Masoor Tarka", "Ice Cream", "Green Salad", "Tomato Sambar", "Jeera Rice", "Chapati"],
  },

  // ---- WEDNESDAY ---------------------------------------------------------
  3: {
    BREAKFAST: [
      "Banana", "Macaroni in Concasse Sauce", "Cornflakes", "Moong Dal Chila", "Peanut Spicy Chutney",
      "Hot Milk", "Cold Milk", "Tea", "Coffee", "Bread", "Butter", "Jam",
    ],
    LUNCH: ["Rooh-Afza", "Paneer Handi", "Rajasthani Dal", "Fruit Custard", "Green Salad", "Jeera Rice", "Chapati"],
    SNACKS: ["Bread Pakora", "Sonth Chutney", "Cold Coffee", "Tea"],
    DINNER: ["Sabzi Begum Bahar", "Dal Falknuma", "Tomato Curry", "Cucumber-Carrot Salad", "Ghee Rice", "Chapati"],
  },

  // ---- THURSDAY ----------------------------------------------------------
  4: {
    BREAKFAST: [
      "Watermelon", "Boiled Chana, Moong & Peanut", "Chocos", "Kanda Poha", "Sev", "Coriander Chutney",
      "Hot Milk", "Cold Milk", "Tea", "Coffee", "Bread", "Butter", "Jam",
    ],
    LUNCH: ["Boondi Raita", "Veg Tahiri", "Mirch Ka Salan", "Dhaba Dal", "Cucumber Salad", "Rajasthani Garlic Chutney", "Chapati"],
    SNACKS: ["Papri Chaat", "Coriander Chutney", "Hot Milk", "Tea", "Coffee"],
    DINNER: ["Tofu Manchurian", "Chole Masala", "Apple Pie", "Sprout Salad", "Plain Rice", "Chapati"],
  },

  // ---- FRIDAY ------------------------------------------------------------
  5: {
    BREAKFAST: [
      "Watermelon", "Cornflakes", "Aloo Paratha", "Vegetable Upma", "Curd", "Hot Milk", "Cold Milk",
      "Tea", "Coffee", "Bread", "Butter", "Jam",
    ],
    LUNCH: ["Chaas", "Kadhai Paneer", "Dal Panchmel", "Bagara Rice", "Chapati", "Kachumber Salad", "Beetroot Salad", "Moong Dal Halwa"],
    SNACKS: ["Samosa", "Tamarind Chutney", "Coffee", "Tea", "Cold Coffee"],
    DINNER: ["Palak Paneer", "Dal Makhani", "Mushroom Matar", "Sweet Corn Soup", "Plain Rice", "Chapati", "Fruit Custard"],
  },

  // ---- SATURDAY (weekend: chaat counter + Indo-Chinese dinner) -----------
  6: {
    BREAKFAST: [
      "Papaya", "Fruit Bowl", "Muesli", "Uthappam", "Coconut Chutney", "Hot Milk", "Cold Milk",
      "Tea", "Coffee", "Bread", "Butter", "Jam",
    ],
    LUNCH: ["Jal Jeera", "Paneer Butter Masala", "Dal Bukhara", "Methi Aloo", "Veg Pulao", "Chapati", "Green Salad", "Gulab Jamun"],
    SNACKS: ["Pav Bhaji", "Butter", "Coffee", "Tea"],
    DINNER: ["Veg Manchurian", "Chinese Bhel", "Hakka Noodles", "Sweet Corn Soup", "Spring Roll"],
  },

  // ---- SUNDAY (special weekend menu) ------------------------------------
  0: {
    BREAKFAST: [
      "Banana", "Chocos", "Dosa", "Sambar", "Coconut Chutney", "Hot Milk", "Cold Milk",
      "Tea", "Coffee", "Bread", "Butter", "Jam",
    ],
    LUNCH: ["Rooh-Afza", "Shahi Paneer", "Dal Makhani", "Veg Biryani", "Boondi Raita", "Chapati", "Green Salad", "Ice Cream"],
    SNACKS: ["Bhel Puri", "Vada Pav", "Coffee", "Tea", "Cold Coffee"],
    DINNER: ["Aloo Matar", "Bhindi Masala", "Mix Yellow Dal", "Jeera Rice", "Chapati", "Cucumber Salad", "Sewai Kheer"],
  },
};

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ---------------------------------------------------------------------------
// VALIDATION — nothing gets into the dataset without a complete recipe.
// ---------------------------------------------------------------------------
export type RecipeIssue = {
  dish: string;
  problem: string;
};

export type ValidationReport = {
  ok: boolean;
  dishCount: number;
  ingredientCount: number;
  recipeRows: number;
  /** ingredients referenced by recipes but missing from the master */
  unknownIngredients: string[];
  /** dishes with no ingredient rows, or rows with a bad quantity/unit */
  issues: RecipeIssue[];
  /** menu entries that reference a dish with no recipe */
  missingDishes: string[];
  /** ingredients in the master that no recipe uses */
  unusedIngredients: string[];
};

export function validateMenuDataset(
  ingredients: { name: string; unit: string }[],
  recipes: RecipeSeed[] = ALL_RECIPES,
): ValidationReport {
  const ingredientNames = new Set(ingredients.map((i) => i.name));
  const usedIngredients = new Set<string>();
  const issues: RecipeIssue[] = [];
  let recipeRows = 0;

  for (const r of recipes) {
    if (!r.items.length) issues.push({ dish: r.name, problem: "Recipe has no ingredients." });
    if (!r.standardYield || r.standardYield <= 0) issues.push({ dish: r.name, problem: "Recipe yield is not defined." });
    if (!r.portionSizeG || r.portionSizeG <= 0) issues.push({ dish: r.name, problem: "Portion size is not defined." });
    const seen = new Set<string>();
    for (const [name, qty] of r.items) {
      recipeRows++;
      usedIngredients.add(name);
      if (!ingredientNames.has(name)) issues.push({ dish: r.name, problem: `Ingredient "${name}" is not in the Ingredient Master.` });
      if (!(qty > 0)) issues.push({ dish: r.name, problem: `Ingredient "${name}" has no usable quantity (${qty}).` });
      if (seen.has(name)) issues.push({ dish: r.name, problem: `Ingredient "${name}" is listed twice.` });
      seen.add(name);
    }
  }

  const known = new Set(recipes.map((r) => r.name));
  const missingDishes: string[] = [];
  for (const day of Object.values(WEEK_MENU)) {
    for (const dishes of Object.values(day)) {
      for (const name of dishes) if (!known.has(name)) missingDishes.push(name);
    }
  }

  const unusedIngredients = [...ingredientNames].filter((n) => !usedIngredients.has(n) && n !== "Water");
  const unknownIngredients = issues
    .filter((i) => i.problem.includes("not in the Ingredient Master"))
    .map((i) => i.dish + " → " + i.problem);

  return {
    ok: issues.length === 0 && missingDishes.length === 0,
    dishCount: recipes.length,
    ingredientCount: ingredients.length,
    recipeRows,
    unknownIngredients,
    issues,
    missingDishes: [...new Set(missingDishes)],
    unusedIngredients,
  };
}
