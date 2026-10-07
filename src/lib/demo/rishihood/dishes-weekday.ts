import { dish, type RecipeSeed } from "./recipes";

// ---------------------------------------------------------------------------
// MONDAY–THURSDAY dishes, exactly as published by the Rishihood University mess.
// Compound menu lines from the source ("Bread/Butter/Jam", "Sev & Chutney",
// "Idli + Sambar + Peanut Chutney") are stored as separate recipes, each with
// its own complete ingredient list, as are all beverages.
// ---------------------------------------------------------------------------

export const WEEKDAY_DISHES: RecipeSeed[] = [
  // ===== Breakfast — fruits, cereals & milk ===============================
  dish("Banana", "FRUIT", 110, [["Banana", 1]], { prepLossPct: 30, instructions: "Whole fruit, washed and served." }),
  dish("Watermelon", "FRUIT", 250, [["Watermelon", 0.25]], { prepLossPct: 35, instructions: "Cut into wedges; rind and seeds removed." }),
  dish("Papaya", "FRUIT", 220, [["Papaya", 0.22]], { prepLossPct: 30, instructions: "Peeled, deseeded and cubed." }),
  dish("Chocos", "BREAKFAST", 200, [["Chocos", 0.04], ["Milk", 0.15], ["Sugar", 0.003]], {
    instructions: "Cereal served with chilled milk and sugar on the side.",
  }),
  dish("Cornflakes", "BREAKFAST", 200, [["Cornflakes", 0.035], ["Milk", 0.15], ["Sugar", 0.003]]),
  dish("Muesli", "BREAKFAST", 200, [["Muesli", 0.05], ["Milk", 0.15], ["Banana", 0.3], ["Sugar", 0.002]]),
  dish("Dalia", "BREAKFAST", 220, [["Dalia", 0.05], ["Milk", 0.1], ["Sugar", 0.004], ["Cashew Nuts", 0.002], ["Raisins", 0.002], ["Ghee", 0.002], ["Green Cardamom", 0.0002]], {
    prepLossPct: 2,
    cookLossPct: 18,
    instructions: "Roast dalia in ghee, simmer in milk, finish with nuts and cardamom.",
  }),
  dish("Masala Oats", "BREAKFAST", 220, [
    ["Rolled Oats", 0.05], ["Milk", 0.08], ["Onion", 0.01], ["Tomato", 0.012], ["Green Peas", 0.005],
    ["Carrot", 0.005], ["Green Chilli", 0.001], ["Curry Leaves", 0.0008], ["Mustard Seeds", 0.0005],
    ["Turmeric Powder", 0.0004], ["Salt", 0.001], ["Cooking Oil", 0.003], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 5, cookLossPct: 15, instructions: "Sauté aromatics, add oats and simmer to a savoury porridge." }),
  dish("Macaroni in Concasse Sauce", "MAIN", 200, [
    ["Macaroni", 0.07], ["Tomato", 0.06], ["Onion", 0.02], ["Garlic", 0.003], ["Capsicum", 0.01],
    ["Green Chilli", 0.001], ["Red Chilli Powder", 0.0005], ["Black Pepper", 0.0003], ["Salt", 0.001],
    ["Cooking Oil", 0.005], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 5, cookLossPct: 10, instructions: "Boil macaroni; toss in a fresh tomato concasse." }),

  // ===== Breakfast — cooked items ========================================
  dish("Idli", "BREAKFAST", 120, [["Rice", 0.05], ["Urad Dal", 0.02], ["Fenugreek Seeds", 0.0003], ["Salt", 0.001], ["Cooking Oil", 0.001]], {
    prepLossPct: 3,
    cookLossPct: 8,
    instructions: "Soak rice and urad dal, grind and ferment overnight, steam into idli.",
  }),
  dish("Dosa", "BREAKFAST", 150, [["Rice", 0.05], ["Urad Dal", 0.02], ["Fenugreek Seeds", 0.0003], ["Salt", 0.0008], ["Cooking Oil", 0.005]], {
    prepLossPct: 3,
    cookLossPct: 8,
  }),
  dish("Uthappam", "BREAKFAST", 170, [
    ["Rice", 0.05], ["Urad Dal", 0.02], ["Onion", 0.015], ["Tomato", 0.015], ["Capsicum", 0.01],
    ["Green Chilli", 0.001], ["Salt", 0.0008], ["Cooking Oil", 0.005], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 3, cookLossPct: 8, instructions: "Thick fermented batter griddled with onion, tomato and capsicum." }),
  dish("Kanda Poha", "BREAKFAST", 160, [
    ["Poha", 0.07], ["Onion", 0.03], ["Potato", 0.02], ["Peanuts", 0.008], ["Curry Leaves", 0.001],
    ["Mustard Seeds", 0.0006], ["Turmeric Powder", 0.0005], ["Green Chilli", 0.002], ["Salt", 0.001],
    ["Cooking Oil", 0.005], ["Lemon", 0.2], ["Coriander Leaves", 0.003], ["Sev", 0.005],
  ], { prepLossPct: 4, instructions: "Rinse and drain poha; temper with onion, potato and peanuts." }),
  dish("Moong Dal Chila", "BREAKFAST", 160, [
    ["Moong Dal", 0.06], ["Green Chilli", 0.002], ["Ginger", 0.002], ["Onion", 0.01],
    ["Coriander Leaves", 0.003], ["Salt", 0.001], ["Cooking Oil", 0.004], ["Asafoetida", 0.0002],
  ], { prepLossPct: 3, cookLossPct: 6, instructions: "Soaked moong dal ground to a batter, cooked as thin pancakes." }),
  dish("Ajwaini Poori", "BREAKFAST", 150, [["Wheat Flour", 0.06], ["Carom Seeds", 0.0005], ["Salt", 0.0005], ["Cooking Oil", 0.012]], {
    prepLossPct: 2,
    cookLossPct: 8,
    instructions: "Knead dough with ajwain, roll and deep-fry.",
  }),
  dish("Puri Bhaji", "BREAKFAST", 250, [
    ["Wheat Flour", 0.06], ["Potato", 0.09], ["Onion", 0.02], ["Green Chilli", 0.002],
    ["Turmeric Powder", 0.0005], ["Mustard Seeds", 0.0005], ["Curry Leaves", 0.001], ["Salt", 0.001],
    ["Cooking Oil", 0.014], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 6, cookLossPct: 8, instructions: "Poori served with a lightly spiced potato bhaji." }),
  dish("Aloo Paratha", "BREAKFAST", 230, [
    ["Wheat Flour", 0.06], ["Potato", 0.08], ["Onion", 0.01], ["Green Chilli", 0.001],
    ["Coriander Leaves", 0.002], ["Turmeric Powder", 0.0003], ["Red Chilli Powder", 0.0004],
    ["Garam Masala", 0.0005], ["Salt", 0.0008], ["Butter", 0.006], ["Cooking Oil", 0.004],
  ], { prepLossPct: 8, cookLossPct: 6, instructions: "Potato-stuffed paratha griddled with butter." }),

  // ===== Breakfast — accompaniments (compound menu lines split out) ======
  dish("Boiled Chana, Moong & Peanut", "BREAKFAST", 180, [
    ["Brown Chana", 0.04], ["Green Moong", 0.02], ["Peanuts", 0.01], ["Onion", 0.02], ["Tomato", 0.02],
    ["Green Chilli", 0.001], ["Lemon", 0.2], ["Coriander Leaves", 0.002], ["Salt", 0.001], ["Chaat Masala", 0.001],
  ], { prepLossPct: 5, cookLossPct: 20, instructions: "Soaked legumes boiled and tossed as a protein salad." }),
  dish("Bread", "BREAD", 60, [["Bread", 2]], { prepLossPct: 4 }),
  dish("Butter", "CONDIMENT", 10, [["Butter", 0.01]]),
  dish("Jam", "CONDIMENT", 12, [["Jam", 0.012]]),
  dish("Peanut Chutney", "CONDIMENT", 40, [
    ["Peanuts", 0.02], ["Dry Coconut", 0.005], ["Green Chilli", 0.002], ["Ginger", 0.001],
    ["Garlic", 0.001], ["Salt", 0.001], ["Lemon", 0.1], ["Cooking Oil", 0.002],
    ["Mustard Seeds", 0.0004], ["Curry Leaves", 0.0005],
  ], { prepLossPct: 4, cookLossPct: 5, instructions: "Roast peanuts, grind with coconut and chilli, temper with mustard." }),
  dish("Peanut Spicy Chutney", "CONDIMENT", 40, [
    ["Peanuts", 0.02], ["Dry Red Chilli", 0.002], ["Garlic", 0.002], ["Salt", 0.001],
    ["Tamarind", 0.002], ["Cooking Oil", 0.002], ["Curry Leaves", 0.0005],
  ], { prepLossPct: 4, instructions: "Dry-roasted peanut and red chilli chutney." }),
  dish("Coconut Chutney", "CONDIMENT", 45, [
    ["Dry Coconut", 0.02], ["Green Chilli", 0.002], ["Ginger", 0.001], ["Salt", 0.001],
    ["Cooking Oil", 0.002], ["Mustard Seeds", 0.0004], ["Curry Leaves", 0.0005], ["Lemon", 0.15], ["Water", 0.03],
  ], { prepLossPct: 3, instructions: "Ground coconut chutney finished with a mustard-curry leaf tempering." }),
  dish("Coriander Chutney", "CONDIMENT", 35, [
    ["Coriander Leaves", 0.03], ["Mint Leaves", 0.01], ["Green Chilli", 0.003], ["Ginger", 0.002],
    ["Garlic", 0.002], ["Salt", 0.001], ["Lemon", 0.3], ["Cumin Seeds", 0.0005],
  ], { prepLossPct: 12, instructions: "Fresh green chutney served with sev and chaat." }),
  dish("Rajasthani Garlic Chutney", "CONDIMENT", 30, [
    ["Garlic", 0.02], ["Dry Red Chilli", 0.004], ["Coriander Powder", 0.001], ["Salt", 0.0008],
    ["Cooking Oil", 0.003], ["Lemon", 0.15], ["Water", 0.01],
  ], { prepLossPct: 5, instructions: "Pounded garlic and red chilli chutney." }),
  dish("Sonth Chutney", "CONDIMENT", 35, [
    ["Tamarind", 0.015], ["Jaggery", 0.012], ["Ginger", 0.003], ["Roasted Cumin Powder", 0.0005],
    ["Red Chilli Powder", 0.0005], ["Salt", 0.0008], ["Water", 0.03],
  ], { prepLossPct: 4, cookLossPct: 12, instructions: "Sweet-sour tamarind and ginger chutney." }),
  dish("Sev", "CONDIMENT", 30, [["Gram Flour", 0.03], ["Cooking Oil", 0.01], ["Salt", 0.0005], ["Turmeric Powder", 0.0002], ["Red Chilli Powder", 0.0003]], {
    prepLossPct: 2,
    cookLossPct: 10,
    instructions: "Besan sev pressed through a sieve into hot oil.",
  }),

  // ===== Beverages (all with full recipes) ===============================
  dish("Hot Milk", "BEVERAGE", 200, [["Milk", 0.2], ["Sugar", 0.004]], { cookLossPct: 6, instructions: "Milk boiled and served hot." }),
  dish("Cold Milk", "BEVERAGE", 200, [["Milk", 0.2], ["Sugar", 0.004]], { instructions: "Chilled milk with sugar." }),
  dish("Tea", "BEVERAGE", 150, [["Tea Leaves", 0.003], ["Milk", 0.05], ["Sugar", 0.006], ["Water", 0.12]], {
    cookLossPct: 10,
    instructions: "Boil tea leaves, add milk and sugar, strain.",
  }),
  dish("Coffee", "BEVERAGE", 150, [["Coffee Powder", 0.004], ["Milk", 0.05], ["Sugar", 0.006], ["Water", 0.12]], {
    cookLossPct: 10,
    instructions: "Hot coffee — the source menu lists this as \"Coffee Powder\".",
  }),
  dish("Cold Coffee", "BEVERAGE", 200, [["Coffee Powder", 0.006], ["Milk", 0.15], ["Sugar", 0.008], ["Ice Cream", 0.02], ["Cocoa Powder", 0.001]], {
    instructions: "Blended chilled coffee with a scoop of ice cream.",
  }),
  dish("Chaas", "BEVERAGE", 250, [
    ["Curd", 0.08], ["Water", 0.15], ["Salt", 0.001], ["Roasted Cumin Powder", 0.0004],
    ["Coriander Leaves", 0.001], ["Curry Leaves", 0.0003], ["Ginger", 0.001], ["Green Chilli", 0.0005],
  ], { prepLossPct: 2, instructions: "Whisked buttermilk with roasted cumin and ginger." }),
  dish("Rooh-Afza", "BEVERAGE", 250, [["Rooh Afza Syrup", 0.03], ["Milk", 0.08], ["Water", 0.12], ["Sugar", 0.004], ["Lemon", 0.15]], {
    instructions: "Rose syrup drink made with milk and water.",
  }),
  dish("Jal Jeera", "BEVERAGE", 250, [
    ["Jal Jeera Powder", 0.004], ["Lemon", 0.4], ["Mint Leaves", 0.005], ["Roasted Cumin Powder", 0.0004],
    ["Salt", 0.0008], ["Sugar", 0.004], ["Water", 0.25],
  ], { prepLossPct: 5, instructions: "Cumin-mint cooler with lemon." }),

  // ===== South Indian accompaniments =====================================
  dish("Sambar", "SIDE", 150, [
    ["Toor Dal", 0.025], ["Tomato", 0.02], ["Onion", 0.015], ["Drumstick", 0.01], ["Bottle Gourd", 0.008],
    ["Tamarind", 0.004], ["Sambar Powder", 0.004], ["Turmeric Powder", 0.0003], ["Mustard Seeds", 0.0005],
    ["Curry Leaves", 0.001], ["Dry Red Chilli", 0.0005], ["Asafoetida", 0.0002], ["Salt", 0.001],
    ["Cooking Oil", 0.003], ["Water", 0.13], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 14, cookLossPct: 18, instructions: "Lentil and vegetable sambar with tamarind and sambar powder." }),
  dish("Tomato Sambar", "SIDE", 150, [
    ["Toor Dal", 0.02], ["Tomato", 0.05], ["Onion", 0.02], ["Tamarind", 0.005], ["Sambar Powder", 0.004],
    ["Turmeric Powder", 0.0003], ["Mustard Seeds", 0.0005], ["Curry Leaves", 0.001], ["Dry Red Chilli", 0.0005],
    ["Asafoetida", 0.0002], ["Salt", 0.001], ["Cooking Oil", 0.003], ["Water", 0.15], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 8, cookLossPct: 18, instructions: "Tamarind-tomato sambar, tangier than the vegetable version." }),
  dish("Onion-Garlic Rasam", "SIDE", 180, [
    ["Toor Dal", 0.015], ["Tamarind", 0.006], ["Tomato", 0.03], ["Garlic", 0.006], ["Onion", 0.02],
    ["Rasam Powder", 0.004], ["Turmeric Powder", 0.0003], ["Mustard Seeds", 0.0006], ["Cumin Seeds", 0.0006],
    ["Curry Leaves", 0.001], ["Dry Red Chilli", 0.0006], ["Asafoetida", 0.0002], ["Salt", 0.001],
    ["Cooking Oil", 0.004], ["Water", 0.15], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 6, cookLossPct: 20, instructions: "Peppery rasam built on onion and garlic." }),

  // ===== Condiments served on the menu line ===============================
  dish("Tamarind Chutney", "CONDIMENT", 30, [
    ["Tamarind", 0.015], ["Jaggery", 0.01], ["Roasted Cumin Powder", 0.0005], ["Red Chilli Powder", 0.0005],
    ["Salt", 0.0008], ["Water", 0.03],
  ], { prepLossPct: 4, cookLossPct: 12, instructions: "Sweet-sour imli chutney served with snacks." }),

  // ===== Lunch & dinner — dals, legumes and curries ======================
  dish("Rajma Masala", "MAIN", 180, [
    ["Rajma", 0.045], ["Onion", 0.025], ["Tomato", 0.035], ["Ginger", 0.002], ["Garlic", 0.003],
    ["Green Chilli", 0.002], ["Cooking Oil", 0.006], ["Cumin Seeds", 0.0008], ["Turmeric Powder", 0.0004],
    ["Red Chilli Powder", 0.0008], ["Coriander Powder", 0.002], ["Garam Masala", 0.001], ["Salt", 0.001],
    ["Water", 0.12], ["Coriander Leaves", 0.003],
  ], { prepLossPct: 3, cookLossPct: 22, instructions: "Soaked rajma pressure-cooked in an onion-tomato masala." }),
  dish("Mix Veg", "MAIN", 180, [
    ["Potato", 0.04], ["Cauliflower", 0.03], ["Carrot", 0.025], ["Green Peas", 0.02], ["Capsicum", 0.015],
    ["Onion", 0.02], ["Tomato", 0.02], ["Ginger", 0.001], ["Green Chilli", 0.001], ["Turmeric Powder", 0.0004],
    ["Red Chilli Powder", 0.0006], ["Coriander Powder", 0.0015], ["Garam Masala", 0.0008], ["Salt", 0.001],
    ["Cooking Oil", 0.006], ["Water", 0.06], ["Coriander Leaves", 0.003],
  ], { prepLossPct: 18, cookLossPct: 10 }),
  dish("Andhra Pappu", "MAIN", 180, [
    ["Toor Dal", 0.05], ["Tomato", 0.03], ["Garlic", 0.004], ["Green Chilli", 0.003], ["Tamarind", 0.003],
    ["Turmeric Powder", 0.0004], ["Dry Red Chilli", 0.001], ["Mustard Seeds", 0.0006], ["Cumin Seeds", 0.0006],
    ["Curry Leaves", 0.001], ["Asafoetida", 0.0002], ["Salt", 0.001], ["Cooking Oil", 0.005], ["Water", 0.12],
  ], { prepLossPct: 3, cookLossPct: 20, instructions: "Toor dal cooked with tomato and garlic, finished with a chilli tempering." }),
  dish("Mix Yellow Dal", "MAIN", 180, [
    ["Toor Dal", 0.03], ["Moong Dal", 0.02], ["Tomato", 0.02], ["Onion", 0.015], ["Ginger", 0.001],
    ["Garlic", 0.002], ["Green Chilli", 0.001], ["Turmeric Powder", 0.0004], ["Cumin Seeds", 0.0008],
    ["Red Chilli Powder", 0.0006], ["Garam Masala", 0.0008], ["Salt", 0.001], ["Cooking Oil", 0.004],
    ["Water", 0.12], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 3, cookLossPct: 20 }),
  dish("Dhaba Dal", "MAIN", 180, [
    ["Toor Dal", 0.03], ["Chana Dal", 0.02], ["Onion", 0.02], ["Tomato", 0.025], ["Ginger", 0.002],
    ["Garlic", 0.004], ["Green Chilli", 0.002], ["Cumin Seeds", 0.001], ["Turmeric Powder", 0.0004],
    ["Red Chilli Powder", 0.001], ["Coriander Powder", 0.002], ["Garam Masala", 0.001], ["Kasuri Methi", 0.0006],
    ["Salt", 0.001], ["Butter", 0.004], ["Cooking Oil", 0.004], ["Water", 0.13], ["Coriander Leaves", 0.003],
  ], { prepLossPct: 3, cookLossPct: 20, instructions: "Highway-style dal finished with butter and kasuri methi." }),
  dish("Rajasthani Dal", "MAIN", 180, [
    ["Moong Dal", 0.035], ["Chana Dal", 0.02], ["Tomato", 0.02], ["Ginger", 0.001], ["Garlic", 0.003],
    ["Dry Red Chilli", 0.001], ["Cumin Seeds", 0.0008], ["Turmeric Powder", 0.0004], ["Red Chilli Powder", 0.0008],
    ["Coriander Powder", 0.0015], ["Garam Masala", 0.0008], ["Salt", 0.001], ["Ghee", 0.002],
    ["Cooking Oil", 0.003], ["Water", 0.13], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 3, cookLossPct: 20 }),
  dish("Dal Falknuma", "MAIN", 180, [
    ["Toor Dal", 0.03], ["Moong Dal", 0.02], ["Tomato", 0.025], ["Onion", 0.02], ["Ginger", 0.002],
    ["Garlic", 0.003], ["Cashew Nuts", 0.003], ["Fresh Cream", 0.008], ["Turmeric Powder", 0.0003],
    ["Red Chilli Powder", 0.0006], ["Coriander Powder", 0.002], ["Garam Masala", 0.001], ["Salt", 0.001],
    ["Cooking Oil", 0.005], ["Ghee", 0.002], ["Water", 0.13], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 3, cookLossPct: 20, demoAssumption: "standardized demo recipe for this Rishihood specialty" }),
  dish("Moong Masoor Tarka", "MAIN", 180, [
    ["Moong Dal", 0.03], ["Masoor Dal", 0.025], ["Onion", 0.015], ["Tomato", 0.02], ["Garlic", 0.003],
    ["Ginger", 0.001], ["Cumin Seeds", 0.0008], ["Dry Red Chilli", 0.0008], ["Turmeric Powder", 0.0004],
    ["Red Chilli Powder", 0.0006], ["Garam Masala", 0.0008], ["Salt", 0.001], ["Cooking Oil", 0.005],
    ["Ghee", 0.001], ["Water", 0.13], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 3, cookLossPct: 20 }),
  dish("Soya Keema Matar", "MAIN", 180, [
    ["Soya Chunks", 0.05], ["Green Peas", 0.03], ["Onion", 0.025], ["Tomato", 0.03], ["Ginger", 0.002],
    ["Garlic", 0.003], ["Green Chilli", 0.002], ["Turmeric Powder", 0.0004], ["Red Chilli Powder", 0.001],
    ["Coriander Powder", 0.002], ["Garam Masala", 0.001], ["Salt", 0.001], ["Cooking Oil", 0.007],
    ["Water", 0.08], ["Coriander Leaves", 0.003],
  ], { prepLossPct: 4, cookLossPct: 14, instructions: "Rehydrated soya granules cooked with peas in a masala base." }),
  dish("Brinjal Curry", "MAIN", 180, [
    ["Brinjal", 0.14], ["Onion", 0.02], ["Tomato", 0.03], ["Ginger", 0.002], ["Garlic", 0.003],
    ["Green Chilli", 0.002], ["Turmeric Powder", 0.0004], ["Red Chilli Powder", 0.001],
    ["Coriander Powder", 0.002], ["Garam Masala", 0.001], ["Mustard Seeds", 0.0005],
    ["Curry Leaves", 0.001], ["Salt", 0.001], ["Cooking Oil", 0.008], ["Water", 0.05],
    ["Coriander Leaves", 0.003],
  ], { prepLossPct: 12, cookLossPct: 12 }),
  dish("Chole Masala", "MAIN", 180, [
    ["Chickpeas", 0.06], ["Onion", 0.025], ["Tomato", 0.03], ["Ginger", 0.002], ["Garlic", 0.003],
    ["Chole Masala", 0.004], ["Turmeric Powder", 0.0004], ["Red Chilli Powder", 0.0008],
    ["Coriander Powder", 0.002], ["Garam Masala", 0.0008], ["Salt", 0.001], ["Cooking Oil", 0.007],
    ["Water", 0.1], ["Coriander Leaves", 0.003],
  ], { prepLossPct: 3, cookLossPct: 22 }),
  dish("Jeera Aloo", "MAIN", 180, [
    ["Potato", 0.16], ["Cumin Seeds", 0.0015], ["Green Chilli", 0.002], ["Ginger", 0.001],
    ["Turmeric Powder", 0.0005], ["Red Chilli Powder", 0.0008], ["Salt", 0.001], ["Cooking Oil", 0.007],
    ["Coriander Leaves", 0.003], ["Lemon", 0.1],
  ], { prepLossPct: 12, cookLossPct: 8 }),
  dish("Soya Chaap", "MAIN", 190, [
    ["Soya Chaap", 0.09], ["Curd", 0.03], ["Ginger", 0.002], ["Garlic", 0.003], ["Red Chilli Powder", 0.001],
    ["Turmeric Powder", 0.0004], ["Coriander Powder", 0.002], ["Garam Masala", 0.001], ["Cooking Oil", 0.008],
    ["Salt", 0.001], ["Tomato", 0.03], ["Onion", 0.02], ["Water", 0.05], ["Coriander Leaves", 0.003],
  ], { prepLossPct: 4, cookLossPct: 10, demoAssumption: "standardized demo recipe for this Rishihood specialty" }),
  dish("Tofu Manchurian", "MAIN", 190, [
    ["Tofu", 0.08], ["Maida", 0.02], ["Corn Flour", 0.01], ["Onion", 0.02], ["Capsicum", 0.02],
    ["Spring Onion", 0.01], ["Garlic", 0.004], ["Ginger", 0.002], ["Green Chilli", 0.002], ["Soy Sauce", 0.006],
    ["Vinegar", 0.003], ["Tomato Ketchup", 0.008], ["Red Chilli Powder", 0.0005], ["Salt", 0.001],
    ["Cooking Oil", 0.01], ["Water", 0.05],
  ], { prepLossPct: 6, cookLossPct: 12, instructions: "Battered tofu tossed in a Manchurian sauce." }),
  dish("Paneer Handi", "MAIN", 190, [
    ["Paneer", 0.07], ["Tomato", 0.04], ["Onion", 0.03], ["Capsicum", 0.02], ["Ginger", 0.002],
    ["Garlic", 0.003], ["Cashew Nuts", 0.004], ["Fresh Cream", 0.01], ["Kitchen King Masala", 0.002],
    ["Turmeric Powder", 0.0003], ["Red Chilli Powder", 0.0008], ["Coriander Powder", 0.002],
    ["Garam Masala", 0.001], ["Kasuri Methi", 0.0005], ["Salt", 0.001], ["Cooking Oil", 0.007],
    ["Water", 0.06], ["Coriander Leaves", 0.003],
  ], { prepLossPct: 5, cookLossPct: 10, demoAssumption: "standardized demo recipe for this Rishihood specialty" }),
  dish("Sabzi Begum Bahar", "MAIN", 190, [
    ["Cauliflower", 0.04], ["Potato", 0.03], ["Carrot", 0.02], ["Green Peas", 0.02], ["Paneer", 0.02],
    ["Tomato", 0.03], ["Onion", 0.025], ["Ginger", 0.002], ["Garlic", 0.003], ["Cashew Nuts", 0.004],
    ["Kitchen King Masala", 0.002], ["Turmeric Powder", 0.0003], ["Red Chilli Powder", 0.0008],
    ["Coriander Powder", 0.002], ["Garam Masala", 0.001], ["Salt", 0.001], ["Cooking Oil", 0.007],
    ["Water", 0.07], ["Coriander Leaves", 0.003],
  ], { prepLossPct: 16, cookLossPct: 10, demoAssumption: "standardized demo recipe for this Rishihood specialty" }),
  dish("Tomato Curry", "MAIN", 180, [
    ["Tomato", 0.16], ["Onion", 0.02], ["Ginger", 0.002], ["Garlic", 0.003], ["Green Chilli", 0.002],
    ["Turmeric Powder", 0.0004], ["Red Chilli Powder", 0.001], ["Coriander Powder", 0.002],
    ["Garam Masala", 0.001], ["Mustard Seeds", 0.0005], ["Curry Leaves", 0.001], ["Salt", 0.001],
    ["Cooking Oil", 0.007], ["Water", 0.05], ["Coriander Leaves", 0.003],
  ], { prepLossPct: 8, cookLossPct: 14 }),
  dish("Bhandara Aloo", "MAIN", 180, [
    ["Potato", 0.16], ["Tomato", 0.03], ["Onion", 0.02], ["Ginger", 0.002], ["Garlic", 0.002],
    ["Green Chilli", 0.002], ["Turmeric Powder", 0.0005], ["Red Chilli Powder", 0.001],
    ["Coriander Powder", 0.002], ["Garam Masala", 0.001], ["Cumin Seeds", 0.001], ["Salt", 0.001],
    ["Cooking Oil", 0.008], ["Coriander Leaves", 0.003],
  ], { prepLossPct: 12, cookLossPct: 10, demoAssumption: "standardized demo recipe for this Rishihood specialty" }),
  dish("Veg Tahiri", "RICE", 200, [
    ["Basmati Rice", 0.08], ["Carrot", 0.025], ["Green Peas", 0.025], ["Potato", 0.025], ["Cauliflower", 0.02],
    ["Onion", 0.02], ["Tomato", 0.02], ["Ginger", 0.001], ["Garlic", 0.002], ["Bay Leaf", 0.0002],
    ["Cinnamon", 0.0002], ["Cloves", 0.0001], ["Green Cardamom", 0.0001], ["Turmeric Powder", 0.0003],
    ["Red Chilli Powder", 0.0005], ["Garam Masala", 0.0008], ["Salt", 0.001], ["Ghee", 0.004],
    ["Cooking Oil", 0.004], ["Water", 0.16], ["Coriander Leaves", 0.003],
  ], { prepLossPct: 12, cookLossPct: 8, instructions: "One-pot spiced rice with mixed vegetables." }),
  dish("Mirch Ka Salan", "MAIN", 170, [
    ["Green Chilli", 0.05], ["Peanuts", 0.012], ["Dry Coconut", 0.008], ["Tamarind", 0.008],
    ["Onion", 0.02], ["Ginger", 0.002], ["Garlic", 0.003], ["Turmeric Powder", 0.0004],
    ["Red Chilli Powder", 0.0008], ["Coriander Powder", 0.002], ["Cumin Seeds", 0.0006],
    ["Mustard Seeds", 0.0005], ["Curry Leaves", 0.001], ["Salt", 0.001], ["Cooking Oil", 0.008], ["Water", 0.06],
  ], { prepLossPct: 8, cookLossPct: 12, demoAssumption: "standardized demo recipe for this Rishihood specialty" }),

  // ===== Rice, bread, salad, raita, condiments ===========================
  dish("Steamed Rice", "RICE", 180, [["Rice", 0.09], ["Salt", 0.0005], ["Water", 0.2]], { cookLossPct: 55, instructions: "Rice boiled and drained." }),
  dish("Rice", "RICE", 180, [["Rice", 0.09], ["Salt", 0.0005], ["Water", 0.2]], { cookLossPct: 55 }),
  dish("Plain Rice", "RICE", 180, [["Rice", 0.09], ["Salt", 0.0005], ["Water", 0.2]], { cookLossPct: 55 }),
  dish("Jeera Rice", "RICE", 180, [
    ["Basmati Rice", 0.08], ["Cumin Seeds", 0.0012], ["Onion", 0.015], ["Ghee", 0.004],
    ["Bay Leaf", 0.0002], ["Salt", 0.001], ["Water", 0.18], ["Coriander Leaves", 0.002],
  ], { cookLossPct: 8 }),
  dish("Ghee Rice", "RICE", 180, [
    ["Basmati Rice", 0.08], ["Ghee", 0.006], ["Onion", 0.02], ["Cashew Nuts", 0.004], ["Raisins", 0.002],
    ["Bay Leaf", 0.0002], ["Cinnamon", 0.0002], ["Cloves", 0.0001], ["Green Cardamom", 0.0001],
    ["Salt", 0.001], ["Water", 0.18],
  ], { cookLossPct: 8 }),
  dish("Chapati", "BREAD", 60, [["Wheat Flour", 0.055], ["Water", 0.03], ["Salt", 0.0005], ["Cooking Oil", 0.002]], {
    prepLossPct: 2,
    cookLossPct: 12,
    instructions: "Whole-wheat dough rolled thin and griddled.",
  }),
  dish("Green Salad", "SALAD", 100, [
    ["Cucumber", 0.04], ["Tomato", 0.03], ["Carrot", 0.02], ["Onion", 0.015], ["Lemon", 0.15],
    ["Salt", 0.0008], ["Black Pepper", 0.0002], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 15, instructions: "Fresh cut salad, lemon and pepper on the side." }),
  dish("Cucumber Salad", "SALAD", 100, [
    ["Cucumber", 0.06], ["Onion", 0.015], ["Tomato", 0.015], ["Lemon", 0.15], ["Salt", 0.0008],
    ["Black Pepper", 0.0002], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 18 }),
  dish("Cucumber-Carrot Salad", "SALAD", 100, [
    ["Cucumber", 0.05], ["Carrot", 0.04], ["Lemon", 0.15], ["Salt", 0.0008], ["Black Pepper", 0.0002],
    ["Coriander Leaves", 0.002],
  ], { prepLossPct: 16 }),
  dish("Sprout Salad", "SALAD", 110, [
    ["Moong Sprouts", 0.06], ["Onion", 0.015], ["Tomato", 0.02], ["Cucumber", 0.02], ["Lemon", 0.15],
    ["Salt", 0.0008], ["Chaat Masala", 0.001], ["Green Chilli", 0.001], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 10, instructions: "Steamed moong sprouts tossed with onion, tomato and lemon." }),
  dish("Curd", "RAITA", 100, [["Curd", 0.1], ["Sugar", 0.001], ["Salt", 0.0003]], { instructions: "Fresh set curd served plain." }),
  dish("Boondi Raita", "RAITA", 110, [
    ["Curd", 0.1], ["Boondi", 0.015], ["Roasted Cumin Powder", 0.0004], ["Salt", 0.0004],
    ["Red Chilli Powder", 0.0002], ["Coriander Leaves", 0.001],
  ]),
  dish("Pickle", "CONDIMENT", 15, [["Mixed Pickle", 0.015]]),
  dish("Onion", "CONDIMENT", 40, [["Onion", 0.03], ["Lemon", 0.1], ["Salt", 0.0003], ["Chaat Masala", 0.0003]], { prepLossPct: 10 }),
  dish("Tomato Ketchup", "CONDIMENT", 20, [["Tomato Ketchup", 0.02]]),

  // ===== Snacks ==========================================================
  dish("Gol Gappe", "SNACKS", 150, [
    ["Gol Gappe Puri", 0.03], ["Potato", 0.05], ["Chickpeas", 0.02], ["Pani Puri Masala", 0.002],
    ["Mint Leaves", 0.005], ["Coriander Leaves", 0.005], ["Tamarind", 0.005], ["Green Chilli", 0.002],
    ["Salt", 0.001], ["Water", 0.15], ["Chaat Masala", 0.001],
  ], { prepLossPct: 10, instructions: "Pani puri with spiced water and a potato-chana filling." }),
  dish("Veg Puff", "SNACKS", 110, [
    ["Puff Pastry Sheet", 0.05], ["Potato", 0.05], ["Green Peas", 0.015], ["Carrot", 0.01], ["Onion", 0.015],
    ["Green Chilli", 0.001], ["Turmeric Powder", 0.0003], ["Red Chilli Powder", 0.0004], ["Garam Masala", 0.0006],
    ["Salt", 0.0008], ["Cooking Oil", 0.003], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 8, cookLossPct: 10, instructions: "Spiced vegetable filling in puff pastry, baked." }),
  dish("Bread Pakora", "SNACKS", 160, [
    ["Bread", 1.5], ["Gram Flour", 0.04], ["Potato", 0.04], ["Green Chilli", 0.001], ["Ginger", 0.001],
    ["Turmeric Powder", 0.0003], ["Red Chilli Powder", 0.0004], ["Asafoetida", 0.0002], ["Salt", 0.0008],
    ["Cooking Oil", 0.012], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 6, cookLossPct: 10, instructions: "Potato-stuffed bread slices dipped in besan batter and fried." }),
  dish("Papri Chaat", "SNACKS", 180, [
    ["Papdi", 0.04], ["Potato", 0.05], ["Chickpeas", 0.02], ["Curd", 0.03], ["Tamarind", 0.008],
    ["Jaggery", 0.005], ["Coriander Leaves", 0.008], ["Mint Leaves", 0.003], ["Green Chilli", 0.002],
    ["Chaat Masala", 0.0015], ["Roasted Cumin Powder", 0.0005], ["Salt", 0.0005], ["Sev", 0.008],
    ["Onion", 0.01], ["Lemon", 0.1],
  ], { prepLossPct: 10, instructions: "Papdi layered with potato, chana, curd and freshly made chutneys." }),
  dish("Samosa", "SNACKS", 130, [
    ["Maida", 0.04], ["Potato", 0.06], ["Green Peas", 0.015], ["Green Chilli", 0.001], ["Ginger", 0.001],
    ["Cumin Seeds", 0.0006], ["Coriander Powder", 0.001], ["Garam Masala", 0.0006], ["Salt", 0.0008],
    ["Cooking Oil", 0.012], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 6, cookLossPct: 10 }),
  dish("Pav Bhaji", "SNACKS", 260, [
    ["Pav Bun", 2], ["Potato", 0.09], ["Green Peas", 0.02], ["Cauliflower", 0.02], ["Capsicum", 0.02],
    ["Tomato", 0.05], ["Onion", 0.03], ["Butter", 0.01], ["Pav Bhaji Masala", 0.003], ["Red Chilli Powder", 0.0008],
    ["Turmeric Powder", 0.0003], ["Ginger", 0.002], ["Garlic", 0.003], ["Salt", 0.001], ["Cooking Oil", 0.004],
    ["Coriander Leaves", 0.003], ["Lemon", 0.15],
  ], { prepLossPct: 14, cookLossPct: 12 }),
  dish("Bhel Puri", "SNACKS", 170, [
    ["Poha", 0.03], ["Sev", 0.02], ["Papdi", 0.015], ["Onion", 0.015], ["Tomato", 0.02],
    ["Tamarind", 0.006], ["Jaggery", 0.004], ["Coriander Leaves", 0.006], ["Mint Leaves", 0.003],
    ["Green Chilli", 0.001], ["Chaat Masala", 0.0015], ["Salt", 0.0005], ["Lemon", 0.15],
  ], { prepLossPct: 10 }),
  dish("Vada Pav", "SNACKS", 190, [
    ["Pav Bun", 1], ["Potato", 0.07], ["Gram Flour", 0.03], ["Green Chilli", 0.002], ["Ginger", 0.001],
    ["Garlic", 0.002], ["Turmeric Powder", 0.0003], ["Mustard Seeds", 0.0005], ["Curry Leaves", 0.0008],
    ["Salt", 0.001], ["Cooking Oil", 0.012], ["Coriander Leaves", 0.002], ["Tamarind", 0.005],
    ["Jaggery", 0.003], ["Roasted Cumin Powder", 0.0003],
  ], { prepLossPct: 8, cookLossPct: 10 }),
  dish("Spring Roll", "SNACKS", 150, [
    ["Maida", 0.04], ["Cabbage", 0.04], ["Carrot", 0.03], ["Capsicum", 0.02], ["Spring Onion", 0.01],
    ["Soy Sauce", 0.004], ["Salt", 0.0006], ["Cooking Oil", 0.012], ["Black Pepper", 0.0003],
  ], { prepLossPct: 12, cookLossPct: 10 }),
  dish("Chinese Bhel", "SNACKS", 160, [
    ["Hakka Noodles", 0.05], ["Cabbage", 0.03], ["Carrot", 0.02], ["Capsicum", 0.02], ["Spring Onion", 0.01],
    ["Tomato Ketchup", 0.01], ["Soy Sauce", 0.005], ["Vinegar", 0.003], ["Garlic", 0.002],
    ["Green Chilli", 0.001], ["Salt", 0.0006], ["Cooking Oil", 0.006],
  ], { prepLossPct: 10, cookLossPct: 8, demoAssumption: "standardized demo recipe" }),

  dish("Hakka Noodles", "MAIN", 220, [
    ["Hakka Noodles", 0.09], ["Cabbage", 0.03], ["Carrot", 0.025], ["Capsicum", 0.025], ["Spring Onion", 0.012],
    ["Onion", 0.02], ["Garlic", 0.004], ["Ginger", 0.002], ["Soy Sauce", 0.007], ["Vinegar", 0.003],
    ["Red Chilli Powder", 0.0005], ["Salt", 0.001], ["Cooking Oil", 0.008],
  ], { prepLossPct: 12, cookLossPct: 8, instructions: "Wok-tossed noodles with shredded vegetables." }),
  dish("Vegetable Upma", "BREAKFAST", 180, [
    ["Semolina", 0.07], ["Onion", 0.02], ["Carrot", 0.015], ["Green Peas", 0.015], ["Green Chilli", 0.002],
    ["Ginger", 0.002], ["Mustard Seeds", 0.0006], ["Curry Leaves", 0.001], ["Turmeric Powder", 0.0003],
    ["Salt", 0.001], ["Cooking Oil", 0.005], ["Water", 0.12], ["Coriander Leaves", 0.002], ["Lemon", 0.15],
  ], { prepLossPct: 6, cookLossPct: 14 }),
  dish("Palak Paneer", "MAIN", 190, [
    ["Spinach", 0.12], ["Paneer", 0.06], ["Onion", 0.02], ["Tomato", 0.025], ["Ginger", 0.002],
    ["Garlic", 0.003], ["Green Chilli", 0.002], ["Fresh Cream", 0.008], ["Cumin Seeds", 0.0006],
    ["Turmeric Powder", 0.0003], ["Red Chilli Powder", 0.0006], ["Garam Masala", 0.0008],
    ["Salt", 0.001], ["Cooking Oil", 0.005], ["Water", 0.05],
  ], { prepLossPct: 20, cookLossPct: 14, instructions: "Pureed spinach curry with paneer cubes." }),
  dish("Methi Aloo", "MAIN", 180, [
    ["Fenugreek Leaves", 0.06], ["Potato", 0.1], ["Onion", 0.02], ["Tomato", 0.02], ["Garlic", 0.003],
    ["Green Chilli", 0.002], ["Turmeric Powder", 0.0004], ["Red Chilli Powder", 0.0008],
    ["Coriander Powder", 0.002], ["Garam Masala", 0.0008], ["Salt", 0.001], ["Cooking Oil", 0.006],
    ["Water", 0.05], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 22, cookLossPct: 10 }),
  dish("Bhindi Masala", "MAIN", 180, [
    ["Lady Finger", 0.14], ["Onion", 0.025], ["Tomato", 0.03], ["Ginger", 0.002], ["Garlic", 0.003],
    ["Turmeric Powder", 0.0004], ["Red Chilli Powder", 0.0008], ["Coriander Powder", 0.002],
    ["Garam Masala", 0.0008], ["Salt", 0.001], ["Cooking Oil", 0.007], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 12, cookLossPct: 10 }),
  dish("Mushroom Matar", "MAIN", 180, [
    ["Mushroom", 0.09], ["Green Peas", 0.03], ["Onion", 0.025], ["Tomato", 0.03], ["Ginger", 0.002],
    ["Garlic", 0.003], ["Turmeric Powder", 0.0004], ["Red Chilli Powder", 0.0008],
    ["Coriander Powder", 0.002], ["Garam Masala", 0.001], ["Salt", 0.001], ["Cooking Oil", 0.006],
    ["Water", 0.05], ["Coriander Leaves", 0.003],
  ], { prepLossPct: 10, cookLossPct: 12 }),
  dish("Beetroot Salad", "SALAD", 100, [
    ["Beetroot", 0.08], ["Onion", 0.015], ["Lemon", 0.15], ["Salt", 0.0008], ["Black Pepper", 0.0002],
    ["Coriander Leaves", 0.002],
  ], { prepLossPct: 18, instructions: "Steamed beetroot salad." }),
  dish("Fruit Bowl", "FRUIT", 200, [
    ["Orange", 0.08], ["Grapes", 0.06], ["Pomegranate", 0.05], ["Apple", 0.05], ["Banana", 0.4],
  ], { prepLossPct: 20, instructions: "Mixed seasonal fruit bowl." }),

  // ===== Desserts ========================================================
  dish("Gulab Jamun", "DESSERT", 90, [
    ["Khoya", 0.03], ["Maida", 0.008], ["Sugar", 0.04], ["Green Cardamom", 0.0003], ["Ghee", 0.003],
    ["Water", 0.06], ["Baking Powder", 0.0002],
  ], { prepLossPct: 4, cookLossPct: 12, instructions: "Khoya dumplings simmered in cardamom syrup." }),
  dish("Ice Cream", "DESSERT", 120, [["Ice Cream", 0.12]], { instructions: "Served scooped from the freezer." }),
  dish("Fruit Custard", "DESSERT", 180, [
    ["Mixed Fruit", 0.1], ["Milk", 0.12], ["Custard Powder", 0.008], ["Sugar", 0.01], ["Green Cardamom", 0.0002],
  ], { prepLossPct: 12, cookLossPct: 8, instructions: "Vanilla custard folded with diced seasonal fruit." }),
  dish("Apple Pie", "DESSERT", 130, [
    ["Pie Base", 0.25], ["Apple", 0.09], ["Sugar", 0.02], ["Butter", 0.008], ["Cinnamon", 0.0004],
    ["Corn Flour", 0.003], ["Lemon", 0.1], ["Vanilla Essence", 0.0005],
  ], { prepLossPct: 14, cookLossPct: 12, demoAssumption: "standardized demo recipe" }),
];
