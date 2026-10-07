// ---------------------------------------------------------------------------
// RISHIHOOD UNIVERSITY — INGREDIENT MASTER
// ---------------------------------------------------------------------------
// This is the single source of truth for every ingredient used anywhere in any
// recipe. The same ingredient is referenced by many dishes (one "Tomato" row,
// never "Tomato for Rajma"), so inventory requirements aggregate correctly
// across a whole meal.
//
// Quantities in recipes are expressed in the unit declared here:
//   kg  — bulk solids      L — liquids        piece — countables
//
// None of these are placeholders ("spices", "seasoning", "etc." are banned).
// Every recipe lists its ingredients explicitly.

export type IngredientCategory =
  | "GRAIN"
  | "PULSE"
  | "DAIRY"
  | "VEGETABLE"
  | "FRUIT"
  | "SPICE"
  | "OIL"
  | "CONDIMENT"
  | "BAKERY"
  | "BEVERAGE"
  | "SWEET"
  | "OTHER";

export type IngredientSeed = {
  name: string;
  category: IngredientCategory;
  /** kg | L | piece */
  unit: "kg" | "L" | "piece";
  minStock: number;
  maxStock: number;
  shelfLifeDays: number;
  costPerUnit: number;
  /** supplier name from SUPPLIERS */
  supplier: string;
};

// One row per ingredient. Ordered by category for readability.
export const RISHIHOOD_INGREDIENTS: IngredientSeed[] = [
  // ---- Grains, cereals & flours -------------------------------------------
  { name: "Rice", category: "GRAIN", unit: "kg", minStock: 200, maxStock: 900, shelfLifeDays: 180, costPerUnit: 52, supplier: "AgroFresh Provisions" },
  { name: "Basmati Rice", category: "GRAIN", unit: "kg", minStock: 80, maxStock: 350, shelfLifeDays: 180, costPerUnit: 95, supplier: "AgroFresh Provisions" },
  { name: "Wheat Flour", category: "GRAIN", unit: "kg", minStock: 200, maxStock: 800, shelfLifeDays: 120, costPerUnit: 42, supplier: "AgroFresh Provisions" },
  { name: "Maida", category: "GRAIN", unit: "kg", minStock: 30, maxStock: 140, shelfLifeDays: 150, costPerUnit: 48, supplier: "AgroFresh Provisions" },
  { name: "Semolina", category: "GRAIN", unit: "kg", minStock: 30, maxStock: 130, shelfLifeDays: 120, costPerUnit: 45, supplier: "AgroFresh Provisions" },
  { name: "Poha", category: "GRAIN", unit: "kg", minStock: 25, maxStock: 120, shelfLifeDays: 90, costPerUnit: 48, supplier: "AgroFresh Provisions" },
  { name: "Rolled Oats", category: "GRAIN", unit: "kg", minStock: 20, maxStock: 90, shelfLifeDays: 180, costPerUnit: 120, supplier: "AgroFresh Provisions" },
  { name: "Dalia", category: "GRAIN", unit: "kg", minStock: 20, maxStock: 90, shelfLifeDays: 150, costPerUnit: 55, supplier: "AgroFresh Provisions" },
  { name: "Cornflakes", category: "GRAIN", unit: "kg", minStock: 15, maxStock: 70, shelfLifeDays: 240, costPerUnit: 210, supplier: "Metro Wholesale Depot" },
  { name: "Chocos", category: "GRAIN", unit: "kg", minStock: 15, maxStock: 70, shelfLifeDays: 240, costPerUnit: 240, supplier: "Metro Wholesale Depot" },
  { name: "Muesli", category: "GRAIN", unit: "kg", minStock: 12, maxStock: 60, shelfLifeDays: 240, costPerUnit: 280, supplier: "Metro Wholesale Depot" },
  { name: "Macaroni", category: "GRAIN", unit: "kg", minStock: 15, maxStock: 70, shelfLifeDays: 240, costPerUnit: 95, supplier: "Metro Wholesale Depot" },
  { name: "Hakka Noodles", category: "GRAIN", unit: "kg", minStock: 15, maxStock: 70, shelfLifeDays: 180, costPerUnit: 110, supplier: "Metro Wholesale Depot" },

  // ---- Pulses, legumes & plant proteins -----------------------------------
  { name: "Toor Dal", category: "PULSE", unit: "kg", minStock: 100, maxStock: 400, shelfLifeDays: 240, costPerUnit: 120, supplier: "AgroFresh Provisions" },
  { name: "Moong Dal", category: "PULSE", unit: "kg", minStock: 60, maxStock: 250, shelfLifeDays: 240, costPerUnit: 115, supplier: "AgroFresh Provisions" },
  { name: "Masoor Dal", category: "PULSE", unit: "kg", minStock: 40, maxStock: 180, shelfLifeDays: 240, costPerUnit: 105, supplier: "AgroFresh Provisions" },
  { name: "Chana Dal", category: "PULSE", unit: "kg", minStock: 40, maxStock: 180, shelfLifeDays: 240, costPerUnit: 98, supplier: "AgroFresh Provisions" },
  { name: "Urad Dal", category: "PULSE", unit: "kg", minStock: 30, maxStock: 140, shelfLifeDays: 240, costPerUnit: 130, supplier: "AgroFresh Provisions" },
  { name: "Rajma", category: "PULSE", unit: "kg", minStock: 40, maxStock: 200, shelfLifeDays: 240, costPerUnit: 145, supplier: "AgroFresh Provisions" },
  { name: "Chickpeas", category: "PULSE", unit: "kg", minStock: 50, maxStock: 220, shelfLifeDays: 240, costPerUnit: 95, supplier: "AgroFresh Provisions" },
  { name: "Brown Chana", category: "PULSE", unit: "kg", minStock: 30, maxStock: 140, shelfLifeDays: 240, costPerUnit: 88, supplier: "AgroFresh Provisions" },
  { name: "Green Moong", category: "PULSE", unit: "kg", minStock: 25, maxStock: 120, shelfLifeDays: 240, costPerUnit: 110, supplier: "AgroFresh Provisions" },
  { name: "Peanuts", category: "PULSE", unit: "kg", minStock: 25, maxStock: 110, shelfLifeDays: 180, costPerUnit: 140, supplier: "AgroFresh Provisions" },
  { name: "Moong Sprouts", category: "PULSE", unit: "kg", minStock: 15, maxStock: 80, shelfLifeDays: 4, costPerUnit: 90, supplier: "GreenLeaf Farm Supply" },
  { name: "Gram Flour", category: "PULSE", unit: "kg", minStock: 25, maxStock: 120, shelfLifeDays: 180, costPerUnit: 95, supplier: "AgroFresh Provisions" },
  { name: "Soya Chunks", category: "PULSE", unit: "kg", minStock: 30, maxStock: 140, shelfLifeDays: 240, costPerUnit: 130, supplier: "Metro Wholesale Depot" },
  { name: "Soya Chaap", category: "PULSE", unit: "kg", minStock: 25, maxStock: 120, shelfLifeDays: 5, costPerUnit: 220, supplier: "Metro Wholesale Depot" },
  { name: "Tofu", category: "PULSE", unit: "kg", minStock: 20, maxStock: 90, shelfLifeDays: 6, costPerUnit: 260, supplier: "Nandini Dairy" },

  // ---- Dairy ---------------------------------------------------------------
  { name: "Milk", category: "DAIRY", unit: "L", minStock: 200, maxStock: 700, shelfLifeDays: 3, costPerUnit: 58, supplier: "Nandini Dairy" },
  { name: "Curd", category: "DAIRY", unit: "kg", minStock: 50, maxStock: 220, shelfLifeDays: 5, costPerUnit: 70, supplier: "Nandini Dairy" },
  { name: "Paneer", category: "DAIRY", unit: "kg", minStock: 40, maxStock: 160, shelfLifeDays: 7, costPerUnit: 340, supplier: "Nandini Dairy" },
  { name: "Butter", category: "DAIRY", unit: "kg", minStock: 15, maxStock: 70, shelfLifeDays: 60, costPerUnit: 520, supplier: "Nandini Dairy" },
  { name: "Ghee", category: "DAIRY", unit: "kg", minStock: 15, maxStock: 70, shelfLifeDays: 180, costPerUnit: 640, supplier: "Nandini Dairy" },
  { name: "Fresh Cream", category: "DAIRY", unit: "L", minStock: 10, maxStock: 50, shelfLifeDays: 7, costPerUnit: 320, supplier: "Nandini Dairy" },
  { name: "Khoya", category: "DAIRY", unit: "kg", minStock: 10, maxStock: 50, shelfLifeDays: 6, costPerUnit: 380, supplier: "Nandini Dairy" },
  { name: "Ice Cream", category: "DAIRY", unit: "L", minStock: 20, maxStock: 90, shelfLifeDays: 90, costPerUnit: 220, supplier: "Nandini Dairy" },

  // ---- Vegetables ----------------------------------------------------------
  { name: "Tomato", category: "VEGETABLE", unit: "kg", minStock: 80, maxStock: 320, shelfLifeDays: 6, costPerUnit: 32, supplier: "GreenLeaf Farm Supply" },
  { name: "Onion", category: "VEGETABLE", unit: "kg", minStock: 100, maxStock: 400, shelfLifeDays: 30, costPerUnit: 28, supplier: "GreenLeaf Farm Supply" },
  { name: "Potato", category: "VEGETABLE", unit: "kg", minStock: 120, maxStock: 450, shelfLifeDays: 45, costPerUnit: 26, supplier: "GreenLeaf Farm Supply" },
  { name: "Brinjal", category: "VEGETABLE", unit: "kg", minStock: 20, maxStock: 90, shelfLifeDays: 6, costPerUnit: 38, supplier: "GreenLeaf Farm Supply" },
  { name: "Cucumber", category: "VEGETABLE", unit: "kg", minStock: 25, maxStock: 120, shelfLifeDays: 7, costPerUnit: 30, supplier: "GreenLeaf Farm Supply" },
  { name: "Carrot", category: "VEGETABLE", unit: "kg", minStock: 30, maxStock: 140, shelfLifeDays: 12, costPerUnit: 38, supplier: "GreenLeaf Farm Supply" },
  { name: "Green Peas", category: "VEGETABLE", unit: "kg", minStock: 25, maxStock: 120, shelfLifeDays: 8, costPerUnit: 60, supplier: "GreenLeaf Farm Supply" },
  { name: "Cauliflower", category: "VEGETABLE", unit: "kg", minStock: 30, maxStock: 140, shelfLifeDays: 6, costPerUnit: 40, supplier: "GreenLeaf Farm Supply" },
  { name: "Cabbage", category: "VEGETABLE", unit: "kg", minStock: 25, maxStock: 110, shelfLifeDays: 10, costPerUnit: 26, supplier: "GreenLeaf Farm Supply" },
  { name: "Capsicum", category: "VEGETABLE", unit: "kg", minStock: 20, maxStock: 90, shelfLifeDays: 8, costPerUnit: 55, supplier: "GreenLeaf Farm Supply" },
  { name: "Green Chilli", category: "VEGETABLE", unit: "kg", minStock: 8, maxStock: 40, shelfLifeDays: 8, costPerUnit: 60, supplier: "GreenLeaf Farm Supply" },
  { name: "Ginger", category: "VEGETABLE", unit: "kg", minStock: 10, maxStock: 45, shelfLifeDays: 20, costPerUnit: 120, supplier: "GreenLeaf Farm Supply" },
  { name: "Garlic", category: "VEGETABLE", unit: "kg", minStock: 10, maxStock: 45, shelfLifeDays: 30, costPerUnit: 140, supplier: "GreenLeaf Farm Supply" },
  { name: "Coriander Leaves", category: "VEGETABLE", unit: "kg", minStock: 6, maxStock: 30, shelfLifeDays: 4, costPerUnit: 80, supplier: "GreenLeaf Farm Supply" },
  { name: "Curry Leaves", category: "VEGETABLE", unit: "kg", minStock: 4, maxStock: 20, shelfLifeDays: 5, costPerUnit: 90, supplier: "GreenLeaf Farm Supply" },
  { name: "Mint Leaves", category: "VEGETABLE", unit: "kg", minStock: 5, maxStock: 25, shelfLifeDays: 4, costPerUnit: 85, supplier: "GreenLeaf Farm Supply" },
  { name: "Spinach", category: "VEGETABLE", unit: "kg", minStock: 15, maxStock: 70, shelfLifeDays: 4, costPerUnit: 30, supplier: "GreenLeaf Farm Supply" },
  { name: "Fenugreek Leaves", category: "VEGETABLE", unit: "kg", minStock: 10, maxStock: 45, shelfLifeDays: 3, costPerUnit: 45, supplier: "GreenLeaf Farm Supply" },
  { name: "Bottle Gourd", category: "VEGETABLE", unit: "kg", minStock: 15, maxStock: 70, shelfLifeDays: 12, costPerUnit: 28, supplier: "GreenLeaf Farm Supply" },
  { name: "Lady Finger", category: "VEGETABLE", unit: "kg", minStock: 15, maxStock: 70, shelfLifeDays: 5, costPerUnit: 42, supplier: "GreenLeaf Farm Supply" },
  { name: "Sweet Corn", category: "VEGETABLE", unit: "kg", minStock: 15, maxStock: 70, shelfLifeDays: 7, costPerUnit: 55, supplier: "GreenLeaf Farm Supply" },
  { name: "Mushroom", category: "VEGETABLE", unit: "kg", minStock: 10, maxStock: 50, shelfLifeDays: 4, costPerUnit: 160, supplier: "GreenLeaf Farm Supply" },
  { name: "Spring Onion", category: "VEGETABLE", unit: "kg", minStock: 8, maxStock: 40, shelfLifeDays: 5, costPerUnit: 60, supplier: "GreenLeaf Farm Supply" },
  { name: "Beetroot", category: "VEGETABLE", unit: "kg", minStock: 15, maxStock: 70, shelfLifeDays: 25, costPerUnit: 35, supplier: "GreenLeaf Farm Supply" },
  { name: "Drumstick", category: "VEGETABLE", unit: "kg", minStock: 10, maxStock: 50, shelfLifeDays: 6, costPerUnit: 50, supplier: "GreenLeaf Farm Supply" },

  // ---- Fruits --------------------------------------------------------------
  { name: "Banana", category: "FRUIT", unit: "piece", minStock: 200, maxStock: 1200, shelfLifeDays: 5, costPerUnit: 6, supplier: "GreenLeaf Farm Supply" },
  { name: "Watermelon", category: "FRUIT", unit: "kg", minStock: 60, maxStock: 260, shelfLifeDays: 6, costPerUnit: 24, supplier: "GreenLeaf Farm Supply" },
  { name: "Papaya", category: "FRUIT", unit: "kg", minStock: 40, maxStock: 180, shelfLifeDays: 5, costPerUnit: 30, supplier: "GreenLeaf Farm Supply" },
  { name: "Apple", category: "FRUIT", unit: "kg", minStock: 25, maxStock: 110, shelfLifeDays: 14, costPerUnit: 140, supplier: "GreenLeaf Farm Supply" },
  { name: "Orange", category: "FRUIT", unit: "kg", minStock: 25, maxStock: 110, shelfLifeDays: 10, costPerUnit: 70, supplier: "GreenLeaf Farm Supply" },
  { name: "Grapes", category: "FRUIT", unit: "kg", minStock: 20, maxStock: 90, shelfLifeDays: 6, costPerUnit: 90, supplier: "GreenLeaf Farm Supply" },
  { name: "Pomegranate", category: "FRUIT", unit: "kg", minStock: 20, maxStock: 90, shelfLifeDays: 15, costPerUnit: 160, supplier: "GreenLeaf Farm Supply" },
  { name: "Mixed Fruit", category: "FRUIT", unit: "kg", minStock: 20, maxStock: 90, shelfLifeDays: 6, costPerUnit: 85, supplier: "GreenLeaf Farm Supply" },

  // ---- Spices & seasonings (explicit — never "masala mix") -----------------
  { name: "Salt", category: "SPICE", unit: "kg", minStock: 25, maxStock: 110, shelfLifeDays: 730, costPerUnit: 20, supplier: "SunHarvest Oils" },
  { name: "Turmeric Powder", category: "SPICE", unit: "kg", minStock: 8, maxStock: 40, shelfLifeDays: 365, costPerUnit: 220, supplier: "SunHarvest Oils" },
  { name: "Red Chilli Powder", category: "SPICE", unit: "kg", minStock: 10, maxStock: 45, shelfLifeDays: 365, costPerUnit: 320, supplier: "SunHarvest Oils" },
  { name: "Coriander Powder", category: "SPICE", unit: "kg", minStock: 10, maxStock: 45, shelfLifeDays: 365, costPerUnit: 240, supplier: "SunHarvest Oils" },
  { name: "Cumin Seeds", category: "SPICE", unit: "kg", minStock: 8, maxStock: 35, shelfLifeDays: 365, costPerUnit: 380, supplier: "SunHarvest Oils" },
  { name: "Roasted Cumin Powder", category: "SPICE", unit: "kg", minStock: 4, maxStock: 20, shelfLifeDays: 365, costPerUnit: 420, supplier: "SunHarvest Oils" },
  { name: "Mustard Seeds", category: "SPICE", unit: "kg", minStock: 6, maxStock: 30, shelfLifeDays: 365, costPerUnit: 190, supplier: "SunHarvest Oils" },
  { name: "Garam Masala", category: "SPICE", unit: "kg", minStock: 8, maxStock: 35, shelfLifeDays: 365, costPerUnit: 520, supplier: "SunHarvest Oils" },
  { name: "Sambar Powder", category: "SPICE", unit: "kg", minStock: 6, maxStock: 30, shelfLifeDays: 365, costPerUnit: 380, supplier: "SunHarvest Oils" },
  { name: "Rasam Powder", category: "SPICE", unit: "kg", minStock: 6, maxStock: 30, shelfLifeDays: 365, costPerUnit: 360, supplier: "SunHarvest Oils" },
  { name: "Chaat Masala", category: "SPICE", unit: "kg", minStock: 4, maxStock: 20, shelfLifeDays: 365, costPerUnit: 480, supplier: "SunHarvest Oils" },
  { name: "Pav Bhaji Masala", category: "SPICE", unit: "kg", minStock: 4, maxStock: 20, shelfLifeDays: 365, costPerUnit: 460, supplier: "SunHarvest Oils" },
  { name: "Kitchen King Masala", category: "SPICE", unit: "kg", minStock: 5, maxStock: 25, shelfLifeDays: 365, costPerUnit: 480, supplier: "SunHarvest Oils" },
  { name: "Chole Masala", category: "SPICE", unit: "kg", minStock: 5, maxStock: 25, shelfLifeDays: 365, costPerUnit: 420, supplier: "SunHarvest Oils" },
  { name: "Kasuri Methi", category: "SPICE", unit: "kg", minStock: 4, maxStock: 20, shelfLifeDays: 365, costPerUnit: 380, supplier: "SunHarvest Oils" },
  { name: "Asafoetida", category: "SPICE", unit: "kg", minStock: 2, maxStock: 10, shelfLifeDays: 730, costPerUnit: 900, supplier: "SunHarvest Oils" },
  { name: "Bay Leaf", category: "SPICE", unit: "kg", minStock: 2, maxStock: 10, shelfLifeDays: 500, costPerUnit: 260, supplier: "SunHarvest Oils" },
  { name: "Cinnamon", category: "SPICE", unit: "kg", minStock: 2, maxStock: 10, shelfLifeDays: 500, costPerUnit: 480, supplier: "SunHarvest Oils" },
  { name: "Cloves", category: "SPICE", unit: "kg", minStock: 2, maxStock: 8, shelfLifeDays: 500, costPerUnit: 900, supplier: "SunHarvest Oils" },
  { name: "Green Cardamom", category: "SPICE", unit: "kg", minStock: 2, maxStock: 10, shelfLifeDays: 500, costPerUnit: 2200, supplier: "SunHarvest Oils" },
  { name: "Black Pepper", category: "SPICE", unit: "kg", minStock: 2, maxStock: 10, shelfLifeDays: 500, costPerUnit: 700, supplier: "SunHarvest Oils" },
  { name: "Fenugreek Seeds", category: "SPICE", unit: "kg", minStock: 4, maxStock: 20, shelfLifeDays: 365, costPerUnit: 200, supplier: "SunHarvest Oils" },
  { name: "Tamarind", category: "SPICE", unit: "kg", minStock: 8, maxStock: 35, shelfLifeDays: 240, costPerUnit: 180, supplier: "SunHarvest Oils" },
  { name: "Dry Red Chilli", category: "SPICE", unit: "kg", minStock: 5, maxStock: 25, shelfLifeDays: 365, costPerUnit: 300, supplier: "SunHarvest Oils" },
  { name: "Dry Coconut", category: "SPICE", unit: "kg", minStock: 8, maxStock: 35, shelfLifeDays: 120, costPerUnit: 260, supplier: "SunHarvest Oils" },
  { name: "Carom Seeds", category: "SPICE", unit: "kg", minStock: 3, maxStock: 15, shelfLifeDays: 365, costPerUnit: 300, supplier: "SunHarvest Oils" },

  // ---- Oils ----------------------------------------------------------------
  { name: "Cooking Oil", category: "OIL", unit: "L", minStock: 60, maxStock: 260, shelfLifeDays: 300, costPerUnit: 140, supplier: "SunHarvest Oils" },

  // ---- Condiments, chutneys & snack components -----------------------------
  { name: "Jam", category: "CONDIMENT", unit: "kg", minStock: 10, maxStock: 50, shelfLifeDays: 240, costPerUnit: 180, supplier: "Metro Wholesale Depot" },
  { name: "Tomato Ketchup", category: "CONDIMENT", unit: "kg", minStock: 10, maxStock: 50, shelfLifeDays: 270, costPerUnit: 140, supplier: "Metro Wholesale Depot" },
  { name: "Mixed Pickle", category: "CONDIMENT", unit: "kg", minStock: 8, maxStock: 35, shelfLifeDays: 365, costPerUnit: 160, supplier: "Metro Wholesale Depot" },
  { name: "Tamarind Chutney", category: "CONDIMENT", unit: "kg", minStock: 5, maxStock: 25, shelfLifeDays: 20, costPerUnit: 180, supplier: "Metro Wholesale Depot" },
  { name: "Sev", category: "CONDIMENT", unit: "kg", minStock: 8, maxStock: 40, shelfLifeDays: 90, costPerUnit: 220, supplier: "Metro Wholesale Depot" },
  { name: "Papdi", category: "CONDIMENT", unit: "kg", minStock: 8, maxStock: 40, shelfLifeDays: 90, costPerUnit: 190, supplier: "Metro Wholesale Depot" },
  { name: "Boondi", category: "CONDIMENT", unit: "kg", minStock: 8, maxStock: 40, shelfLifeDays: 90, costPerUnit: 200, supplier: "Metro Wholesale Depot" },
  { name: "Gol Gappe Puri", category: "CONDIMENT", unit: "kg", minStock: 6, maxStock: 30, shelfLifeDays: 90, costPerUnit: 240, supplier: "Metro Wholesale Depot" },
  { name: "Pani Puri Masala", category: "CONDIMENT", unit: "kg", minStock: 3, maxStock: 15, shelfLifeDays: 365, costPerUnit: 380, supplier: "Metro Wholesale Depot" },
  { name: "Puff Pastry Sheet", category: "CONDIMENT", unit: "kg", minStock: 8, maxStock: 40, shelfLifeDays: 90, costPerUnit: 260, supplier: "Metro Wholesale Depot" },
  { name: "Cashew Nuts", category: "CONDIMENT", unit: "kg", minStock: 5, maxStock: 25, shelfLifeDays: 180, costPerUnit: 900, supplier: "Metro Wholesale Depot" },
  { name: "Raisins", category: "CONDIMENT", unit: "kg", minStock: 4, maxStock: 20, shelfLifeDays: 240, costPerUnit: 320, supplier: "Metro Wholesale Depot" },
  { name: "Sewai", category: "CONDIMENT", unit: "kg", minStock: 5, maxStock: 25, shelfLifeDays: 180, costPerUnit: 160, supplier: "Metro Wholesale Depot" },

  // ---- Bakery --------------------------------------------------------------
  { name: "Bread", category: "BAKERY", unit: "piece", minStock: 200, maxStock: 1000, shelfLifeDays: 4, costPerUnit: 6, supplier: "Metro Wholesale Depot" },
  { name: "Pav Bun", category: "BAKERY", unit: "piece", minStock: 150, maxStock: 700, shelfLifeDays: 4, costPerUnit: 8, supplier: "Metro Wholesale Depot" },
  { name: "Pie Base", category: "BAKERY", unit: "piece", minStock: 20, maxStock: 100, shelfLifeDays: 30, costPerUnit: 45, supplier: "Metro Wholesale Depot" },

  // ---- Beverages & sweeteners ---------------------------------------------
  { name: "Tea Leaves", category: "BEVERAGE", unit: "kg", minStock: 8, maxStock: 35, shelfLifeDays: 300, costPerUnit: 480, supplier: "SunHarvest Oils" },
  { name: "Coffee Powder", category: "BEVERAGE", unit: "kg", minStock: 6, maxStock: 30, shelfLifeDays: 240, costPerUnit: 620, supplier: "SunHarvest Oils" },
  { name: "Sugar", category: "SWEET", unit: "kg", minStock: 60, maxStock: 250, shelfLifeDays: 500, costPerUnit: 45, supplier: "AgroFresh Provisions" },
  { name: "Jaggery", category: "SWEET", unit: "kg", minStock: 10, maxStock: 50, shelfLifeDays: 240, costPerUnit: 70, supplier: "AgroFresh Provisions" },
  { name: "Rooh Afza Syrup", category: "BEVERAGE", unit: "L", minStock: 10, maxStock: 50, shelfLifeDays: 300, costPerUnit: 220, supplier: "Metro Wholesale Depot" },
  { name: "Jal Jeera Powder", category: "BEVERAGE", unit: "kg", minStock: 3, maxStock: 15, shelfLifeDays: 300, costPerUnit: 340, supplier: "Metro Wholesale Depot" },
  { name: "Custard Powder", category: "SWEET", unit: "kg", minStock: 4, maxStock: 20, shelfLifeDays: 300, costPerUnit: 260, supplier: "Metro Wholesale Depot" },
  { name: "Cocoa Powder", category: "BEVERAGE", unit: "kg", minStock: 3, maxStock: 15, shelfLifeDays: 300, costPerUnit: 520, supplier: "Metro Wholesale Depot" },
  { name: "Vanilla Essence", category: "OTHER", unit: "L", minStock: 1, maxStock: 5, shelfLifeDays: 500, costPerUnit: 600, supplier: "Metro Wholesale Depot" },
  { name: "Baking Powder", category: "OTHER", unit: "kg", minStock: 2, maxStock: 10, shelfLifeDays: 400, costPerUnit: 260, supplier: "Metro Wholesale Depot" },
  { name: "Corn Flour", category: "OTHER", unit: "kg", minStock: 6, maxStock: 30, shelfLifeDays: 300, costPerUnit: 120, supplier: "Metro Wholesale Depot" },
  { name: "Soy Sauce", category: "CONDIMENT", unit: "L", minStock: 3, maxStock: 15, shelfLifeDays: 400, costPerUnit: 280, supplier: "Metro Wholesale Depot" },
  { name: "Vinegar", category: "CONDIMENT", unit: "L", minStock: 3, maxStock: 15, shelfLifeDays: 400, costPerUnit: 90, supplier: "Metro Wholesale Depot" },
  { name: "Lemon", category: "FRUIT", unit: "piece", minStock: 100, maxStock: 500, shelfLifeDays: 12, costPerUnit: 3, supplier: "GreenLeaf Farm Supply" },

  // Water is listed explicitly in the source recipes (dal, rice, beverages).
  // It is tracked as a zero-cost ingredient so nothing in a recipe is implicit.
  { name: "Water", category: "OTHER", unit: "L", minStock: 0, maxStock: 0, shelfLifeDays: 3650, costPerUnit: 0, supplier: "AgroFresh Provisions" },
];

export const RISHIHOOD_SUPPLIERS = [
  { name: "AgroFresh Provisions", contactName: "Ramesh Nair", phone: "+91 98450 11223", email: "sales@agrofresh.example", leadTimeDays: 2, rating: 4.5 },
  { name: "GreenLeaf Farm Supply", contactName: "Sunita Rao", phone: "+91 98860 44556", email: "orders@greenleaf.example", leadTimeDays: 1, rating: 4.7 },
  { name: "Nandini Dairy", contactName: "Vijay Kumar", phone: "+91 90080 77889", email: "b2b@nandini.example", leadTimeDays: 1, rating: 4.8 },
  { name: "SunHarvest Oils", contactName: "Farhan Ali", phone: "+91 99870 33221", email: "supply@sunharvest.example", leadTimeDays: 4, rating: 4.1 },
  { name: "Metro Wholesale Depot", contactName: "Deepa Menon", phone: "+91 96320 99001", email: "bulk@metro.example", leadTimeDays: 3, rating: 4.0 },
];
