import { dish, type RecipeSeed } from "./recipes";

// ---------------------------------------------------------------------------
// FRIDAY / SATURDAY / SUNDAY dishes — deliberately different from Mon–Thu.
// Weekends lean into chaat counters, pav bhaji, Indo-Chinese dinners and a
// heavier Sunday lunch, which matches how residential campuses actually run.
// ---------------------------------------------------------------------------

export const WEEKEND_DISHES: RecipeSeed[] = [
  // ---- Friday & weekend breakfast rotation -------------------------------
  dish("Kadhai Paneer", "MAIN", 190, [
    ["Paneer", 0.07], ["Capsicum", 0.03], ["Onion", 0.03], ["Tomato", 0.035], ["Ginger", 0.002],
    ["Garlic", 0.003], ["Coriander Powder", 0.002], ["Red Chilli Powder", 0.001], ["Turmeric Powder", 0.0003],
    ["Garam Masala", 0.001], ["Kasuri Methi", 0.0005], ["Salt", 0.001], ["Cooking Oil", 0.007],
    ["Water", 0.05], ["Coriander Leaves", 0.003],
  ], { prepLossPct: 6, cookLossPct: 10 }),
  dish("Dal Panchmel", "MAIN", 180, [
    ["Toor Dal", 0.02], ["Moong Dal", 0.015], ["Chana Dal", 0.012], ["Masoor Dal", 0.012], ["Urad Dal", 0.008],
    ["Tomato", 0.02], ["Ginger", 0.001], ["Garlic", 0.002], ["Turmeric Powder", 0.0004],
    ["Red Chilli Powder", 0.0006], ["Coriander Powder", 0.0015], ["Garam Masala", 0.0008],
    ["Cumin Seeds", 0.0006], ["Salt", 0.001], ["Ghee", 0.002], ["Cooking Oil", 0.003],
    ["Water", 0.14], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 3, cookLossPct: 20, instructions: "Five-lentil dal, a Gujarati/Rajasthani staple." }),
  dish("Bagara Rice", "RICE", 190, [
    ["Basmati Rice", 0.08], ["Onion", 0.025], ["Tomato", 0.02], ["Ginger", 0.002], ["Garlic", 0.002],
    ["Bay Leaf", 0.0002], ["Cinnamon", 0.0002], ["Cloves", 0.0001], ["Green Cardamom", 0.0001],
    ["Mint Leaves", 0.003], ["Coriander Leaves", 0.003], ["Turmeric Powder", 0.0002], ["Salt", 0.001],
    ["Ghee", 0.004], ["Water", 0.18],
  ], { cookLossPct: 8, demoAssumption: "standardized demo recipe" }),
  dish("Kachumber Salad", "SALAD", 100, [
    ["Cucumber", 0.045], ["Tomato", 0.03], ["Onion", 0.02], ["Carrot", 0.015], ["Lemon", 0.15],
    ["Salt", 0.0008], ["Black Pepper", 0.0002], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 15 }),
  dish("Moong Dal Halwa", "DESSERT", 110, [
    ["Moong Dal", 0.04], ["Ghee", 0.02], ["Sugar", 0.04], ["Milk", 0.05], ["Cashew Nuts", 0.004],
    ["Raisins", 0.003], ["Green Cardamom", 0.0003], ["Water", 0.05],
  ], { prepLossPct: 4, cookLossPct: 14, instructions: "Slow-roasted moong dal halwa — a weekend treat." }),
  dish("Paneer Butter Masala", "MAIN", 190, [
    ["Paneer", 0.07], ["Tomato", 0.06], ["Onion", 0.02], ["Cashew Nuts", 0.005], ["Butter", 0.008],
    ["Fresh Cream", 0.012], ["Ginger", 0.002], ["Garlic", 0.003], ["Red Chilli Powder", 0.0008],
    ["Turmeric Powder", 0.0003], ["Coriander Powder", 0.002], ["Garam Masala", 0.001],
    ["Kasuri Methi", 0.0005], ["Sugar", 0.002], ["Salt", 0.001], ["Cooking Oil", 0.004], ["Water", 0.05],
  ], { prepLossPct: 5, cookLossPct: 10 }),
  dish("Dal Bukhara", "MAIN", 180, [
    ["Urad Dal", 0.045], ["Rajma", 0.01], ["Tomato", 0.04], ["Ginger", 0.003], ["Garlic", 0.004],
    ["Butter", 0.008], ["Fresh Cream", 0.01], ["Red Chilli Powder", 0.001], ["Turmeric Powder", 0.0003],
    ["Garam Masala", 0.001], ["Salt", 0.001], ["Water", 0.15], ["Coriander Leaves", 0.002],
  ], { prepLossPct: 3, cookLossPct: 22, demoAssumption: "standardized demo recipe" }),
  dish("Veg Pulao", "RICE", 190, [
    ["Basmati Rice", 0.08], ["Carrot", 0.02], ["Green Peas", 0.02], ["Potato", 0.02], ["Onion", 0.02],
    ["Bay Leaf", 0.0002], ["Cinnamon", 0.0002], ["Cloves", 0.0001], ["Cumin Seeds", 0.0006],
    ["Turmeric Powder", 0.0002], ["Salt", 0.001], ["Ghee", 0.004], ["Water", 0.18], ["Coriander Leaves", 0.002],
  ], { cookLossPct: 8 }),
  dish("Rasgulla", "DESSERT", 110, [
    ["Milk", 0.2], ["Lemon", 0.5], ["Sugar", 0.05], ["Green Cardamom", 0.0003], ["Water", 0.1],
  ], { cookLossPct: 20, demoAssumption: "standardized demo recipe" }),
  dish("Veg Manchurian", "MAIN", 190, [
    ["Cabbage", 0.05], ["Carrot", 0.03], ["Maida", 0.02], ["Corn Flour", 0.012], ["Onion", 0.02],
    ["Capsicum", 0.02], ["Spring Onion", 0.012], ["Garlic", 0.004], ["Ginger", 0.002], ["Soy Sauce", 0.007],
    ["Vinegar", 0.003], ["Tomato Ketchup", 0.008], ["Red Chilli Powder", 0.0005], ["Salt", 0.001],
    ["Cooking Oil", 0.012], ["Water", 0.05],
  ], { prepLossPct: 14, cookLossPct: 10 }),
  dish("Sweet Corn Soup", "SIDE", 250, [
    ["Sweet Corn", 0.06], ["Carrot", 0.015], ["Cabbage", 0.015], ["Spring Onion", 0.008], ["Corn Flour", 0.008],
    ["Black Pepper", 0.0004], ["Salt", 0.0008], ["Butter", 0.002], ["Water", 0.2],
  ], { prepLossPct: 12, cookLossPct: 12 }),
  dish("Shahi Paneer", "MAIN", 190, [
    ["Paneer", 0.07], ["Tomato", 0.05], ["Onion", 0.025], ["Cashew Nuts", 0.006], ["Fresh Cream", 0.012],
    ["Milk", 0.04], ["Ginger", 0.002], ["Garlic", 0.002], ["Kitchen King Masala", 0.002],
    ["Red Chilli Powder", 0.0006], ["Turmeric Powder", 0.0003], ["Garam Masala", 0.001], ["Sugar", 0.002],
    ["Salt", 0.001], ["Ghee", 0.004], ["Water", 0.05], ["Coriander Leaves", 0.003],
  ], { prepLossPct: 5, cookLossPct: 10 }),
  dish("Dal Makhani", "MAIN", 180, [
    ["Urad Dal", 0.03], ["Rajma", 0.015], ["Tomato", 0.04], ["Onion", 0.02], ["Ginger", 0.002],
    ["Garlic", 0.004], ["Butter", 0.008], ["Fresh Cream", 0.012], ["Red Chilli Powder", 0.001],
    ["Turmeric Powder", 0.0003], ["Garam Masala", 0.001], ["Salt", 0.001], ["Water", 0.15],
    ["Coriander Leaves", 0.002],
  ], { prepLossPct: 3, cookLossPct: 22 }),
  dish("Veg Biryani", "RICE", 220, [
    ["Basmati Rice", 0.08], ["Carrot", 0.02], ["Green Peas", 0.02], ["Potato", 0.02], ["Cauliflower", 0.02],
    ["Onion", 0.03], ["Curd", 0.02], ["Mint Leaves", 0.004], ["Coriander Leaves", 0.004], ["Ginger", 0.002],
    ["Garlic", 0.003], ["Bay Leaf", 0.0002], ["Cinnamon", 0.0002], ["Cloves", 0.0001],
    ["Green Cardamom", 0.0001], ["Red Chilli Powder", 0.0006], ["Turmeric Powder", 0.0003],
    ["Garam Masala", 0.001], ["Salt", 0.001], ["Ghee", 0.005], ["Cooking Oil", 0.004], ["Water", 0.15],
  ], { prepLossPct: 12, cookLossPct: 8, instructions: "Layered dum-style vegetable biryani." }),
  dish("Aloo Matar", "MAIN", 180, [
    ["Potato", 0.12], ["Green Peas", 0.04], ["Tomato", 0.03], ["Onion", 0.02], ["Ginger", 0.002],
    ["Garlic", 0.002], ["Turmeric Powder", 0.0004], ["Red Chilli Powder", 0.0008],
    ["Coriander Powder", 0.002], ["Garam Masala", 0.001], ["Cumin Seeds", 0.0008], ["Salt", 0.001],
    ["Cooking Oil", 0.006], ["Water", 0.06], ["Coriander Leaves", 0.003],
  ], { prepLossPct: 12, cookLossPct: 10 }),
  dish("Sewai Kheer", "DESSERT", 160, [
    ["Sewai", 0.03], ["Milk", 0.15], ["Sugar", 0.02], ["Cashew Nuts", 0.003], ["Raisins", 0.002],
    ["Green Cardamom", 0.0003], ["Ghee", 0.002],
  ], { cookLossPct: 12, instructions: "Vermicelli simmered in sweetened milk." }),
];
