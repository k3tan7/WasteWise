// Domain vocabulary + display metadata. Kept in one place so the database
// (which stores plain strings) and the UI never drift apart.

export const ROLES = {
  ADMIN: "ADMIN",
  MESS_MANAGER: "MESS_MANAGER",
  WASTE_MANAGER: "WASTE_MANAGER",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Campus Admin",
  MESS_MANAGER: "Mess Manager",
  WASTE_MANAGER: "Sustainability Manager",
};

export const MEAL_TYPES = ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const RESIDENCES = ["HOSTEL", "DAY_SCHOLAR"] as const;

// Dish categories used by the Rishihood menu. The classification is assigned
// when a dish is created and remains editable by the admin.
export const DISH_CATEGORIES = [
  "MAIN",
  "RICE",
  "BREAD",
  "SALAD",
  "RAITA",
  "SIDE",
  "BREAKFAST",
  "SNACKS",
  "DESSERT",
  "BEVERAGE",
  "CONDIMENT",
  "FRUIT",
] as const;

export const DISH_CATEGORY_LABELS: Record<string, string> = {
  MAIN: "Main dish",
  RICE: "Rice",
  BREAD: "Bread / roti",
  SALAD: "Salad",
  RAITA: "Raita / curd",
  SIDE: "Side dish",
  BREAKFAST: "Breakfast item",
  SNACKS: "Snack",
  DESSERT: "Dessert",
  BEVERAGE: "Beverage",
  CONDIMENT: "Condiment / chutney",
  FRUIT: "Fruit",
};

export const INGREDIENT_CATEGORIES = [
  "GRAIN",
  "VEGETABLE",
  "FRUIT",
  "DAIRY",
  "PULSE",
  "MEAT",
  "SPICE",
  "OIL",
  "OTHER",
] as const;

export const WASTE_CATEGORIES = ["FOOD", "RECYCLABLE", "REJECT"] as const;
export const WASTE_SUBCATEGORIES: Record<string, string[]> = {
  FOOD: ["PLATE", "UNSERVED", "KITCHEN"],
  RECYCLABLE: ["PLASTIC", "PAPER", "CARDBOARD", "METAL"],
  REJECT: ["CONTAMINATED", "OTHER"],
};

export const TREATMENT_METHODS = ["COMPOSTING", "ANAEROBIC_DIGESTION", "RECYCLING"] as const;
export const TREATMENT_STATUS = ["PLANNED", "ACTIVE", "COMPLETED"] as const;
export const OUTPUT_TYPES = ["COMPOST", "BIOGAS", "DIGESTATE"] as const;

// Organisation-level reuse destinations (kept as free text in the DB, but these
// power the dropdowns so data stays consistent).
export const COMPOST_DESTINATIONS = [
  "Campus Garden",
  "Landscaping",
  "Nursery",
  "Agriculture Dept. Farm",
];
export const BIOGAS_DESTINATIONS = ["Kitchen Fuel", "Water Heating", "Power Generation"];

export const WASTE_CAUSES = [
  { code: "LOW_ATTENDANCE", label: "Low attendance" },
  { code: "OVERPRODUCTION", label: "Overproduction" },
  { code: "MENU_ISSUE", label: "Menu issue" },
  { code: "EVENT_CANCELLED", label: "Event cancelled" },
  { code: "POOR_QUALITY", label: "Poor quality" },
  { code: "PORTION_SIZE", label: "Portion size" },
  { code: "COOKING_ISSUE", label: "Cooking issue" },
  { code: "WEATHER", label: "Unexpected weather" },
  { code: "OTHER", label: "Other" },
] as const;

export const TREATMENT_DESTINATIONS = [
  "PENDING",
  "COMPOST",
  "BIOGAS",
  "RECYCLE",
  "DISPOSAL",
] as const;

export const LOCATIONS = ["Main Mess", "Hostel Mess A", "Hostel Mess B", "Food Court", "Kitchen"];

// Conversion assumptions are explicitly configurable via CampusSetting; these
// are only the default seeds. The UI must not present them as guaranteed.
export const DEFAULT_SETTINGS = {
  campus_name: { value: "Rishihood University", label: "Campus name", type: "TEXT", category: "general" },
  enrolled_students: { value: "2500", label: "Enrolled students (all residential)", type: "NUMBER", category: "general" },
  staff_count: { value: "200", label: "Campus staff (eat breakfast & lunch)", type: "NUMBER", category: "general" },
  day_scholars: { value: "0", label: "Day scholars", type: "NUMBER", category: "general" },
  currency: { value: "INR", label: "Currency", type: "TEXT", category: "general" },
  baseline_waste_kg_per_day: {
    value: "720",
    label: "Pre-platform baseline food waste (kg/day)",
    type: "NUMBER",
    category: "sustainability",
  },
  avoidable_definition: {
    value: "Plate waste + unserved food + kitchen overproduction",
    label: "Definition of avoidable waste",
    type: "TEXT",
    category: "sustainability",
  },
  compost_yield_min_pct: { value: "20", label: "Compost yield — low estimate (%)", type: "NUMBER", category: "treatment" },
  compost_yield_max_pct: { value: "30", label: "Compost yield — high estimate (%)", type: "NUMBER", category: "treatment" },
  biogas_yield_m3_per_kg: { value: "0.06", label: "Biogas yield (m³ per kg organic)", type: "NUMBER", category: "treatment" },
  digestate_yield_pct: { value: "65", label: "Digestate yield (% of input)", type: "NUMBER", category: "treatment" },
  prep_buffer_pct: { value: "2", label: "Default preparation buffer (%)", type: "NUMBER", category: "operations" },
  anomaly_threshold_pct: { value: "25", label: "Waste anomaly threshold (% above expected)", type: "NUMBER", category: "operations" },
  lunch_participation_baseline: { value: "91", label: "Historical lunch participation (%)", type: "NUMBER", category: "operations" },
  dinner_participation_baseline: { value: "78", label: "Historical dinner participation (%)", type: "NUMBER", category: "operations" },
  breakfast_participation_baseline: { value: "52", label: "Historical breakfast participation (%)", type: "NUMBER", category: "operations" },
  snacks_participation_baseline: { value: "45", label: "Historical snacks participation (%)", type: "NUMBER", category: "operations" },
  demo_mode: { value: "true", label: "Demo campus dataset enabled", type: "BOOLEAN", category: "general" },
} as const;

export type SettingKey = keyof typeof DEFAULT_SETTINGS;

// Routing / RBAC: which roles may reach which nav section.
export const NAV_ITEMS: {
  href: string;
  label: string;
  icon: string;
  roles: Role[];
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", roles: ["ADMIN", "MESS_MANAGER", "WASTE_MANAGER"] },
  { href: "/students", label: "Students & Attendance", icon: "Users", roles: ["ADMIN", "MESS_MANAGER"] },
  { href: "/menu", label: "Menu", icon: "ChefHat", roles: ["ADMIN", "MESS_MANAGER"] },
  { href: "/menu/analytics", label: "Menu Analytics", icon: "BarChart3", roles: ["ADMIN", "MESS_MANAGER"] },
  { href: "/meals", label: "Meals", icon: "UtensilsCrossed", roles: ["ADMIN", "MESS_MANAGER"] },
  { href: "/predictions", label: "Demand Prediction", icon: "TrendingUp", roles: ["ADMIN", "MESS_MANAGER"] },
  { href: "/models", label: "Model Performance", icon: "Brain", roles: ["ADMIN", "MESS_MANAGER"] },
  { href: "/inventory", label: "Inventory", icon: "Package", roles: ["ADMIN", "MESS_MANAGER"] },
  { href: "/purchases", label: "Purchases", icon: "ShoppingCart", roles: ["ADMIN", "MESS_MANAGER"] },
  { href: "/waste", label: "Waste Management", icon: "Trash2", roles: ["ADMIN", "MESS_MANAGER", "WASTE_MANAGER"] },
  { href: "/waste/analytics", label: "Waste Analytics", icon: "BarChart3", roles: ["ADMIN", "MESS_MANAGER", "WASTE_MANAGER"] },
  { href: "/treatment", label: "Treatment & Outputs", icon: "Recycle", roles: ["ADMIN", "WASTE_MANAGER"] },
  { href: "/station", label: "WasteWise Station", icon: "Cpu", roles: ["ADMIN", "WASTE_MANAGER", "MESS_MANAGER"] },
  { href: "/reports", label: "Reports", icon: "FileText", roles: ["ADMIN", "MESS_MANAGER", "WASTE_MANAGER"] },
  { href: "/settings", label: "Settings", icon: "Settings", roles: ["ADMIN"] },
];

export const MEAL_TYPE_LABELS: Record<string, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  SNACKS: "Snacks",
  DINNER: "Dinner",
};

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
