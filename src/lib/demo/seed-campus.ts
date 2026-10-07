// WasteWise demo seed — deterministic and reproducible.
//
// Rather than hardcoding dashboard numbers, this script simulates 30 days of
// campus operations *in chronological order* and runs the real prediction
// engines as it goes. Predictions therefore improve with history exactly as
// they do in production, and every chart/insight reflects genuine records.

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_SETTINGS, WASTE_CAUSES } from "@/lib/constants";
import { addDays, clamp, round, seededRandom, startOfDay } from "@/lib/utils";
import { getDishWasteStats } from "@/lib/analytics";
import { predictDemand, type DemandHistoryRow } from "@/lib/prediction/demand";
import { predictWaste } from "@/lib/prediction/waste";
import { detectWasteAnomaly, recommendAction } from "@/lib/prediction/anomaly";
import { RISHIHOOD_INGREDIENTS, RISHIHOOD_SUPPLIERS } from "@/lib/demo/rishihood/ingredients";
import { ALL_RECIPES, DAY_NAMES, WEEK_MENU, validateMenuDataset } from "@/lib/demo/rishihood/menu";
import { DISH_UPTAKE, expectedDishWastePct } from "@/lib/demo/rishihood/waste-model";
import type { DishCategory } from "@/lib/demo/rishihood/recipes";

// Rishihood University is a residential campus: ~2,500 students, no day
// scholars, plus ~200 staff who eat breakfast and lunch in the mess.
const CAMPUS = {
  name: "Rishihood University",
  enrolled: 2500,
  staff: 200,
  staffMeals: ["BREAKFAST", "LUNCH"],
};
const ENROLLED = CAMPUS.enrolled;
const DAYS = 30;
// Pre-platform food-waste baseline, read from the same configured default the
// reporting layer uses. Predicting waste needs a fallback for the very first
// services of each meal, before any history exists; if that fallback disagrees
// with the real volumes the campus produces, day-one records look like massive
// anomalies and consume the demo's anomaly budget. One source of truth fixes it.
const DAILY_BASELINE_KG = Number(DEFAULT_SETTINGS.baseline_waste_kg_per_day.value);
// Historical anomalies are capped so the demo is not flooded, but the most
// recent service is always evaluated independently — the open anomaly is the
// entry point to the root-cause workflow and must never be crowded out.
const MAX_HISTORICAL_ANOMALIES = 4;
const rand = seededRandom(20261005);

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------
const DEPARTMENTS = ["SDS", "SOM", "SOL", "SAHE", "SES"];
const YEARS = [1, 2, 3, 4];
const HOSTELS = ["Vedanta Boys Hostel", "Yamuna Girls Hostel", "Saraswati Hostel"];
const FIRST = ["Aarav", "Vivaan", "Aditya", "Rohan", "Ishaan", "Kabir", "Ananya", "Diya", "Saanvi", "Aadhya", "Riya", "Meera", "Arjun", "Karthik", "Neha", "Pooja", "Rahul", "Sneha", "Vikram", "Zara", "Aryan", "Isha", "Nikhil", "Tanvi", "Dev", "Kavya", "Manav", "Priya", "Sanjay", "Nisha"];
const LAST = ["Sharma", "Verma", "Iyer", "Nair", "Reddy", "Gupta", "Menon", "Patel", "Singh", "Rao", "Joshi", "Das", "Bose", "Chopra", "Kulkarni", "Mishra", "Pillai", "Sethi"];

const INGREDIENTS = RISHIHOOD_INGREDIENTS;
const SUPPLIERS = RISHIHOOD_SUPPLIERS;
const DISHES = ALL_RECIPES;

// Per-meal participation rates: how many of the students on campus actually eat
// that meal. Staff are added on top for breakfast and lunch.
const MEAL_CONFIG: Record<string, { participation: number }> = {
  BREAKFAST: { participation: 0.62 },
  LUNCH: { participation: 0.93 },
  SNACKS: { participation: 0.48 },
  DINNER: { participation: 0.84 },
};

// ---- Campus calendar events -----------------------------------------------
// Operational reality on a residential campus: holidays, exam weeks, fest days
// and cancelled events. These drive the attendance swings the prediction and
// anomaly engines have to cope with.
type CampusEvent = {
  /** day index within the generated window */
  day: number;
  type: "HOLIDAY" | "EXAM_PERIOD" | "UNIVERSITY_EVENT" | "EVENT_CANCELLED" | "FESTIVAL" | "SPORTS_DAY";
  label: string;
  /** attendance multiplier applied to students */
  attendanceFactor: number;
  /** extra expected guests the kitchen plans for (may not materialise) */
  expectedGuests?: number;
  /** did those guests actually turn up? */
  guestsArrived?: boolean;
  /** extra waste pressure multiplier for the day */
  wasteFactor?: number;
  /** an extra dish pushed onto one meal (special menu) */
  specialMenu?: { meal: string; dish: string };
};

/** Seed (or reset) the full demo campus. Safe to call repeatedly. */
export async function seedDemoCampus() {
  console.log("🌱 Seeding WasteWise demo campus…");

  // Reset (order respects FKs).
  await prisma.mlPrediction.deleteMany();
  await prisma.mlModel.deleteMany();
  await prisma.reuseRecord.deleteMany();
  await prisma.treatmentOutput.deleteMany();
  await prisma.treatmentBatch.deleteMany();
  await prisma.correctiveAction.deleteMany();
  await prisma.wasteAnomaly.deleteMany();
  await prisma.wastePrediction.deleteMany();
  await prisma.wasteRecord.deleteMany();
  await prisma.wasteReason.deleteMany();
  await prisma.mealConsumption.deleteMany();
  await prisma.mealPrediction.deleteMany();
  await prisma.meal.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menu.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.purchaseRecommendation.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.student.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.station.deleteMany();
  await prisma.campusSetting.deleteMany();
  await prisma.user.deleteMany();

  // ---- Users ------------------------------------------------------------
  const [adminHash, managerHash, wasteHash] = await Promise.all([
    bcrypt.hash("admin123", 10),
    bcrypt.hash("mess123", 10),
    bcrypt.hash("waste123", 10),
  ]);
  await prisma.user.createMany({
    data: [
      { email: "admin@wastewise.demo", passwordHash: adminHash, name: "Dr. Ananya Rao", role: "ADMIN" },
      { email: "mess@wastewise.demo", passwordHash: managerHash, name: "Suresh Iyer", role: "MESS_MANAGER" },
      { email: "waste@wastewise.demo", passwordHash: wasteHash, name: "Lakshmi Menon", role: "WASTE_MANAGER" },
    ],
  });

  // ---- Settings ---------------------------------------------------------
  await prisma.campusSetting.createMany({
    data: Object.entries(DEFAULT_SETTINGS).map(([key, v]) => ({
      key,
      value: v.value,
      label: v.label,
      type: v.type,
      category: v.category,
    })),
  });

  // ---- Waste reasons ----------------------------------------------------
  await prisma.wasteReason.createMany({
    data: WASTE_CAUSES.map((c) => ({ code: c.code, label: c.label, category: "CAUSE" })),
  });
  const reasonMap = Object.fromEntries((await prisma.wasteReason.findMany()).map((r) => [r.code, r.id]));

  // ---- Suppliers & ingredients -----------------------------------------
  await prisma.supplier.createMany({ data: SUPPLIERS });
  const suppliers = await prisma.supplier.findMany();
  const supplierId = Object.fromEntries(suppliers.map((s) => [s.name, s.id]));

  await prisma.ingredient.createMany({
    data: INGREDIENTS.map((i) => ({
      name: i.name,
      category: i.category,
      unit: i.unit,
      minStock: i.minStock,
      maxStock: i.maxStock,
      shelfLifeDays: i.shelfLifeDays,
      costPerUnit: i.costPerUnit,
      avgDailyUsage: 0,
      supplierId: supplierId[i.supplier],
    })),
  });
  const ingredients = await prisma.ingredient.findMany();
  const ingId = Object.fromEntries(ingredients.map((i) => [i.name, i.id]));

  // On-hand stock. Most items sit mid-band; the perishable staples the kitchen
  // works through fastest (tomato, paneer, milk, curd) are deliberately tight so
  // the purchase-recommendation engine has genuine shortfalls to surface.
  const TIGHT: Record<string, number> = {
    Tomato: 0.22, Paneer: 0.18, Milk: 0.2, Curd: 0.25, "Green Peas": 0.3, Cauliflower: 0.28,
    "Coriander Leaves": 0.3, "Mint Leaves": 0.3, "Fresh Cream": 0.25, "Moong Sprouts": 0.2, Tofu: 0.25,
    "Soya Chaap": 0.3, Mushroom: 0.25, Apple: 0.3,
  };
  const now = new Date();
  for (const i of ingredients) {
    if (i.name === "Water") {
      // Water is tracked for recipe completeness, not purchased.
      await prisma.inventoryItem.create({ data: { ingredientId: i.id, quantity: 0 } });
      continue;
    }
    const isPerishableStaple = TIGHT[i.name] != null;
    const ratio = TIGHT[i.name] ?? 0.35 + rand() * 0.45;
    const span = Math.max(0, i.maxStock - i.minStock);
    const qty = round(i.minStock + span * ratio, 1);
    // The fast-moving perishables are restocked later in their shelf life so the
    // expiry-risk alert reflects a genuine condition instead of a caption.
    const heldDays = isPerishableStaple
      ? Math.round(i.shelfLifeDays * 0.7)
      : Math.round(i.shelfLifeDays / 3);
    await prisma.inventoryItem.create({
      data: {
        ingredientId: i.id,
        quantity: qty,
        lastRestockedAt: addDays(now, -Math.max(1, heldDays)),
      },
    });
  }

  // ---- Dishes + complete recipes ----------------------------------------
  // Every menu item gets its full ingredient breakdown. Cost per serving is
  // computed from the recipe itself (quantity × supplier cost, grossed up for
  // preparation and cooking loss) rather than being invented per dish.
  for (const d of DISHES) {
    const prep = d.prepLossPct / 100;
    const cook = d.cookLossPct / 100;
    const yieldFactor = 1 / Math.max(0.1, (1 - prep) * (1 - cook));
    const cost = d.items.reduce((sum, [ingName, qty]) => {
      const ing = INGREDIENTS.find((x) => x.name === ingName);
      return sum + qty * (ing?.costPerUnit ?? 0) * yieldFactor;
    }, 0);

    const dish = await prisma.dish.create({
      data: {
        name: d.name,
        category: d.category,
        description: d.demoAssumption
          ? `Standardized demo recipe — ${d.demoAssumption}. Editable by the admin.`
          : null,
        portionSizeG: d.portionSizeG,
        estCostPerServing: round(cost, 2),
        historicalWastePct: 0,
        historicalConsumption: 0,
      },
    });
    const recipe = await prisma.recipe.create({
      data: {
        dishId: dish.id,
        standardYield: d.standardYield,
        prepLossPct: d.prepLossPct,
        cookLossPct: d.cookLossPct,
        demoAssumption: d.demoAssumption ?? null,
        instructions: d.instructions ?? `Standard mess preparation for ${d.name}.`,
      },
    });
    await prisma.recipeIngredient.createMany({
      data: d.items.map(([ingName, qty]) => ({
        recipeId: recipe.id,
        ingredientId: ingId[ingName],
        quantityPerServing: qty,
        unit: INGREDIENTS.find((x) => x.name === ingName)!.unit,
      })),
    });
  }
  const dishes = await prisma.dish.findMany();
  const dishByName = Object.fromEntries(dishes.map((d) => [d.name, d]));

  // Fail loudly rather than seeding an incomplete dataset.
  const validation = validateMenuDataset(
    INGREDIENTS.map((i) => ({ name: i.name, unit: i.unit })),
  );
  if (!validation.ok) {
    throw new Error(
      `Menu dataset validation failed: ${validation.issues.length} recipe issue(s), ${validation.missingDishes.length} menu item(s) without a recipe.`,
    );
  }
  console.log(
    `  • ${validation.dishCount} dishes, ${validation.ingredientCount} ingredients, ${validation.recipeRows} recipe rows — all recipes complete`,
  );

  // ---- Students ---------------------------------------------------------
  // Rishihood is fully residential: every student lives in a hostel, so there
  // is no day-scholar population and weekend attendance stays high.
  console.log(`  • generating ${ENROLLED.toLocaleString()} residential students…`);
  const studentRows = Array.from({ length: ENROLLED }, (_, i) => {
    const dept = DEPARTMENTS[Math.floor(rand() * DEPARTMENTS.length)];
    const year = YEARS[Math.floor(rand() * YEARS.length)];
    const first = FIRST[Math.floor(rand() * FIRST.length)];
    const last = LAST[Math.floor(rand() * LAST.length)];
    return {
      studentId: `RU${2026 - year}${dept}${String(i + 1).padStart(4, "0")}`,
      name: `${first} ${last}`,
      department: dept,
      year,
      residence: "HOSTEL",
      hostel: HOSTELS[Math.floor(rand() * HOSTELS.length)],
      email: `student${i + 1}@rishihood.example`,
      active: true,
    };
  });
  await prisma.student.createMany({ data: studentRows });
  const students = await prisma.student.findMany({ select: { id: true, residence: true, hostel: true } });

  // ---- Stations ---------------------------------------------------------
  await prisma.station.createMany({
    data: [
      { name: "Station A — Main Mess", location: "Main Mess", status: "ONLINE", capacityKg: 250, currentWeightKg: 0, organicKg: 0, recyclableKg: 0, rejectKg: 0, deviceId: "esp32-ww-a001" },
      { name: "Station B — Hostel Mess A", location: "Hostel Mess A", status: "ONLINE", capacityKg: 150, currentWeightKg: 0, organicKg: 0, recyclableKg: 0, rejectKg: 0, deviceId: "esp32-ww-b002" },
      { name: "Station C — Food Court", location: "Food Court", status: "MAINTENANCE", capacityKg: 120, currentWeightKg: 0, organicKg: 0, recyclableKg: 0, rejectKg: 0, deviceId: "esp32-ww-c003" },
    ],
  });

  // ---- Time series ------------------------------------------------------
  const today = startOfDay(now);
  const firstDay = addDays(today, -(DAYS - 1));

  // ---- Campus calendar ---------------------------------------------------
  // Real operational events, not decoration: each one changes attendance and/or
  // preparation, and the kitchen has to react to the consequences.
  const CAMPUS_EVENTS: CampusEvent[] = [
    { day: 4, type: "HOLIDAY", label: "Regional holiday — campus closed", attendanceFactor: 0.62 },
    { day: 9, type: "EXAM_PERIOD", label: "Mid-semester examinations (day 1)", attendanceFactor: 0.9 },
    { day: 10, type: "EXAM_PERIOD", label: "Mid-semester examinations (day 2)", attendanceFactor: 0.88 },
    { day: 11, type: "EXAM_PERIOD", label: "Mid-semester examinations (day 3)", attendanceFactor: 0.89 },
    { day: 14, type: "UNIVERSITY_EVENT", label: "Rishihood Convocation — 300 guests expected", attendanceFactor: 1.0, expectedGuests: 300, guestsArrived: true, specialMenu: { meal: "LUNCH", dish: "Shahi Paneer" } },
    { day: 18, type: "SPORTS_DAY", label: "Inter-university sports meet", attendanceFactor: 0.94, expectedGuests: 120, guestsArrived: true },
    { day: 21, type: "FESTIVAL", label: "Diwali celebration dinner — special menu", attendanceFactor: 1.0, expectedGuests: 150, guestsArrived: true, wasteFactor: 1.15, specialMenu: { meal: "DINNER", dish: "Gulab Jamun" } },
    { day: 24, type: "EVENT_CANCELLED", label: "Startup summit cancelled at short notice", attendanceFactor: 0.9, expectedGuests: 300, guestsArrived: false, wasteFactor: 1.6 },
    { day: DAYS - 1, type: "EVENT_CANCELLED", label: "Alumni meet cancelled after preparation began", attendanceFactor: 0.92, expectedGuests: 300, guestsArrived: false, wasteFactor: 1.75 },
  ];
  const eventByDay = new Map(CAMPUS_EVENTS.map((e) => [e.day, e]));

  // Additional waste spikes with a recorded operational cause, so the anomaly
  // detector and root-cause workflow have history to learn from.
  const ANOMALY_DAYS: Record<number, { meal: string; multiplier: number; prep: number; cause: string }> = {
    [DAYS - 1]: { meal: "DINNER", multiplier: 2.2, prep: 0.09, cause: "EVENT_CANCELLED" },
    [DAYS - 8]: { meal: "LUNCH", multiplier: 1.9, prep: 0.06, cause: "OVERPRODUCTION" },
    [DAYS - 16]: { meal: "BREAKFAST", multiplier: 2.0, prep: 0.05, cause: "MENU_ISSUE" },
    [24]: { meal: "LUNCH", multiplier: 1.85, prep: 0.05, cause: "EVENT_CANCELLED" },
  };
  const LOW_ATTENDANCE_DAYS = new Set([4, 9, 10, 11, 24, DAYS - 1, DAYS - 8]);

  // Documented demo scenarios: a slow quality/portion drift on specific dishes
  // in the recent period. The dish's waste therefore rises in the observations
  // themselves — the "repeated over-waste" insight is triggered by the data, not
  // by a hardcoded verdict about the dish.
  const DISH_DRIFT: Record<string, { fromDay: number; toMultiplier: number; reason: string }> = {
    "Green Salad": { fromDay: DAYS - 11, toMultiplier: 2.0, reason: "portion size increased and the dressing changed" },
    "Sprout Salad": { fromDay: DAYS - 7, toMultiplier: 1.7, reason: "served later in the service, after the sprouts dried out" },
  };

  const runningDishWaste = new Map<string, number>();
  const recipePrepLoss = new Map<string, number>(
    DISHES.map((d) => [d.name, d.prepLossPct] as [string, number]),
  );
  const demandHistory: DemandHistoryRow[] = [];
  const wasteHistoryByMeal: Record<string, { date: Date; mealType: string; weightKg: number }[]> = {
    BREAKFAST: [], LUNCH: [], SNACKS: [], DINNER: [],
  };
  const dailyWasteHistory: { date: Date; weightKg: number }[] = [];

  const attendanceBuffer: Prisma.AttendanceCreateManyInput[] = [];
  const alertRows: Prisma.AlertCreateManyInput[] = [];
  let anomalyCount = 0;

  for (let d = 0; d < DAYS; d++) {
    const date = addDays(firstDay, d);
    const weekday = date.getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const isToday = d === DAYS - 1;

    const event = eventByDay.get(d);
    const extraGuests = event?.expectedGuests && event.guestsArrived ? event.expectedGuests : 0;

    // Attendance on a fully residential campus: most students are on campus on
    // weekdays, slightly fewer at weekends, and calendar events move the number.
    let presentRatio = isWeekend ? 0.9 : 0.97;
    if (event) presentRatio *= event.attendanceFactor;
    presentRatio += (rand() - 0.5) * 0.02;
    const presentCount = Math.round(ENROLLED * clamp(presentRatio, 0.3, 0.99));

    // Mark students present/absent deterministically.
    for (let s = 0; s < students.length; s++) {
      const st = students[s];
      const present = rand() < presentRatio;
      attendanceBuffer.push({
        date,
        studentId: st.id,
        present,
        location: st.hostel ?? "Hostel",
        breakfast: present && rand() < MEAL_CONFIG.BREAKFAST.participation,
        lunch: present && rand() < MEAL_CONFIG.LUNCH.participation,
        snacks: present && rand() < MEAL_CONFIG.SNACKS.participation,
        dinner: present && rand() < MEAL_CONFIG.DINNER.participation,
      });
    }

    let dayTotalWaste = 0;

    for (const mealType of ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"] as const) {
      const cfg = MEAL_CONFIG[mealType];
      // The menu comes from the published weekly rotation, not a fixed list.
      const menuDishNames = [...(WEEK_MENU[weekday]?.[mealType] ?? [])];
      if (event?.specialMenu?.meal === mealType && !menuDishNames.includes(event.specialMenu.dish)) {
        menuDishNames.push(event.specialMenu.dish);
      }

      // Menu for the day/meal.
      const menu = await prisma.menu.create({
        data: {
          name: `${DAY_NAMES[weekday]} ${mealType.charAt(0) + mealType.slice(1).toLowerCase()}`,
          date,
          mealType,
          published: true,
        },
      });
      for (const n of menuDishNames) {
        await prisma.menuItem.create({ data: { menuId: menu.id, dishId: dishByName[n].id } });
      }

      // Staff eat breakfast and lunch in the mess, so they are part of the
      // demand the kitchen has to plan for.
      const staffHeads = CAMPUS.staffMeals.includes(mealType) ? CAMPUS.staff : 0;
      const headsOnCampus = presentCount + staffHeads + extraGuests;

      // --- Demand prediction using ONLY prior history (true backtest) ---
      const prediction = predictDemand({
        date,
        mealType,
        attendance: headsOnCampus,
        enrolled: ENROLLED + CAMPUS.staff,
        history: demandHistory,
        baselineParticipationPct: cfg.participation * 100,
        prepBufferPct: 2,
      });

      // --- Actual attendance-driven participation ------------------------
      const actualParticipation = cfg.participation + (rand() - 0.5) * 0.06;
      const actualConsumption = Math.round(headsOnCampus * actualParticipation);

      // Preparation: normally close to recommendation, sometimes over.
      const spike = ANOMALY_DAYS[d];
      const isSpikeMeal = spike?.meal === mealType;
      let prepDeviation = (rand() - 0.5) * 0.03;
      if (LOW_ATTENDANCE_DAYS.has(d) && mealType === "DINNER") prepDeviation += 0.07;
      if (isSpikeMeal) prepDeviation += spike.prep;
      // A cancelled event leaves food already cooked for guests who never came.
      if (event?.expectedGuests && !event.guestsArrived && mealType === "LUNCH") prepDeviation += 0.12;
      const actualPrep = Math.round(prediction.recommendedPrep * (1 + prepDeviation));

      // --- Dish-level waste, derived from the menu itself ------------------
      // Plate waste is built up from each dish on today's menu: how many
      // portions were taken, how much of each was left, and how much of the
      // raw ingredient was lost in preparation. Nothing here is a per-dish
      // constant — see rishihood/waste-model.ts for the documented factors.
      const attendanceRatio = actualConsumption / Math.max(1, prediction.predicted);
      const dishStats = menuDishNames.map((name) => {
        const dishRow = dishByName[name];
        const uptake = DISH_UPTAKE[dishRow.category] ?? 0.8;
        const drift = DISH_DRIFT[name];
        const driftFactor = drift
          ? 1 + (drift.toMultiplier - 1) * clamp((d - drift.fromDay) / Math.max(1, DAYS - 1 - drift.fromDay), 0, 1)
          : 1;
        const wastePct = expectedDishWastePct({
          date,
          mealType,
          dishName: name,
          category: dishRow.category as DishCategory,
          portionSizeG: dishRow.portionSizeG,
          attendanceRatio,
          dayFactor: (event?.wasteFactor ?? 1) * driftFactor,
          rng: rand,
        });
        const servingsServed = Math.max(1, Math.round(actualPrep * uptake));
        const portionKg = dishRow.portionSizeG / 1000;
        return {
          dish: dishRow,
          name,
          wastePct: round(wastePct, 1),
          servingsServed,
          servingsConsumed: Math.max(0, Math.round(servingsServed * (1 - wastePct / 100))),
          leftoverKg: round(servingsServed * portionKg * (wastePct / 100), 2),
        };
      });

      let plateWasteKg = round(dishStats.reduce((a, s) => a + s.leftoverKg, 0), 1);

      // Cooked but never served: driven by the gap between preparation and
      // actual turnout (the cancelled-event and holiday scenarios).
      const avgPortionKg = 0.17;
      let unservedKg = Math.max(0, actualPrep - actualConsumption) * avgPortionKg;
      // Kitchen preparation waste: trimmings and peelings that never reach a
      // plate. Derived from each dish's own recorded preparation loss, and only
      // a quarter of the theoretical trimming actually becomes waste (the rest
      // stays in the dish), so this stays a realistic share of the total.
      let kitchenKg = dishStats.reduce((a, s) => {
        const prepLossPct = recipePrepLoss.get(s.name) ?? 0;
        const handledKg = s.servingsServed * (s.dish.portionSizeG / 1000);
        return a + handledKg * (prepLossPct / 100) * 0.25;
      }, 0);
      if (event?.wasteFactor) {
        unservedKg *= event.wasteFactor;
        kitchenKg *= 1 + (event.wasteFactor - 1) * 0.4;
      }
      if (isSpikeMeal) {
        plateWasteKg *= Math.min(1.35, spike.multiplier * 0.6);
        unservedKg *= spike.multiplier * 0.7;
      }
      unservedKg = round(unservedKg, 1);
      kitchenKg = round(kitchenKg, 1);
      const foodWasteKg = round(plateWasteKg + unservedKg + kitchenKg, 1);

      // --- Waste prediction (also backtested) ----------------------------
      const wp = predictWaste({
        date,
        mealType,
        history: wasteHistoryByMeal[mealType],
        dailyHistory: dailyWasteHistory,
        dailyBaselineKg: DAILY_BASELINE_KG,
        recommendedPrep: prediction.recommendedPrep,
        actualPrep,
        // Menu composition is a feature: the dish-level waste profile of the
        // dishes actually being cooked today, from observed history.
        menuWastePcts: menuDishNames.map((n) => runningDishWaste.get(n) ?? 6),
        overallDishWastePct: 6,
      });

      // --- Persist meal ---------------------------------------------------
      const meal = await prisma.meal.create({
        data: {
          date,
          mealType,
          menuId: menu.id,
          expectedStudents: presentCount,
          predictedConsumption: prediction.predicted,
          recommendedPrep: prediction.recommendedPrep,
          actualPrep,
          actualConsumption,
          unservedKg,
          plateWasteKg,
          totalWasteKg: foodWasteKg,
          status: isToday ? "COMPLETED" : "COMPLETED",
        },
      });

      // --- Persist prediction (learning loop) -----------------------------
      await prisma.mealPrediction.create({
        data: {
          date,
          mealType,
          predictedConsumption: prediction.predicted,
          recommendedPrep: prediction.recommendedPrep,
          rangeLow: prediction.rangeLow,
          rangeHigh: prediction.rangeHigh,
          confidence: prediction.confidence,
          actualConsumption,
          error: actualConsumption - prediction.predicted,
          inputs: JSON.stringify(prediction.inputs),
          model: prediction.model,
        },
      });

      // --- Dish-level consumption (from the same derived observations) ----
      for (const s of dishStats) {
        await prisma.mealConsumption.create({
          data: {
            mealId: meal.id,
            dishId: s.dish.id,
            servingsServed: s.servingsServed,
            servingsConsumed: s.servingsConsumed,
            leftoverKg: s.leftoverKg,
            wastePct: s.wastePct,
          },
        });
        // Rolling in-memory baseline so later predictions see real history.
        const prev = runningDishWaste.get(s.name);
        runningDishWaste.set(s.name, prev == null ? s.wastePct : prev * 0.7 + s.wastePct * 0.3);
      }

      // --- Waste records --------------------------------------------------
      const location = "Main Mess";
      const wasteRows: Prisma.WasteRecordCreateManyInput[] = [
        { date, mealType, mealId: meal.id, location, category: "FOOD", subCategory: "PLATE", source: "PLATE", weightKg: plateWasteKg, treatmentDestination: "COMPOST" },
        { date, mealType, mealId: meal.id, location, category: "FOOD", subCategory: "UNSERVED", source: "UNSERVED", weightKg: Math.max(0, unservedKg), treatmentDestination: "COMPOST" },
        { date, mealType, mealId: meal.id, location, category: "FOOD", subCategory: "KITCHEN", source: "KITCHEN", weightKg: Math.max(0, kitchenKg), treatmentDestination: "COMPOST" },
      ];
      // Attribute plate waste to the highest-waste dish on today's menu.
      const topDish = dishStats.slice().sort((a, b) => b.leftoverKg - a.leftoverKg)[0];
      wasteRows[0].dishId = topDish.dish.id;
      if (isSpikeMeal) {
        wasteRows[0].reasonId = reasonMap[spike.cause];
      }
      await prisma.wasteRecord.createMany({ data: wasteRows });

      // --- Waste prediction record ---------------------------------------
      await prisma.wastePrediction.create({
        data: {
          date,
          mealType,
          expectedKg: wp.expectedKg,
          rangeLow: wp.rangeLow,
          rangeHigh: wp.rangeHigh,
          actualKg: foodWasteKg,
          variancePct: round(((foodWasteKg - wp.expectedKg) / wp.expectedKg) * 100, 1),
        },
      });

      // --- Anomaly detection ---------------------------------------------
      const detected = detectWasteAnomaly({
        actualKg: foodWasteKg,
        expectedKg: wp.expectedKg,
        history: wasteHistoryByMeal[mealType].map((h) => ({ date: h.date, weightKg: h.weightKg })),
        actualAttendance: headsOnCampus,
        predictedAttendance: Math.round(presentCount + staffHeads),
        actualPrep,
        recommendedPrep: prediction.recommendedPrep,
        menuHighWasteDishes: dishStats.map((s) => ({
          name: s.name,
          wastePct: s.wastePct,
          baselinePct: round(runningDishWaste.get(s.name) ?? 6, 1),
        })),
        thresholdPct: 25,
      });

      if (detected.isAnomaly && (isToday || anomalyCount < MAX_HISTORICAL_ANOMALIES)) {
        if (!isToday) anomalyCount++;
        const anomaly = await prisma.wasteAnomaly.create({
          data: {
            date,
            mealType,
            expectedKg: wp.expectedKg,
            actualKg: foodWasteKg,
            variancePct: detected.variancePct,
            severity: detected.severity,
            status: isToday ? "OPEN" : "RESOLVED",
            contributors: JSON.stringify(detected.contributors),
            summary: detected.summary,
          },
        });
        if (!isToday) {
          const cause = isSpikeMeal ? spike.cause : "OVERPRODUCTION";
          await prisma.correctiveAction.create({
            data: {
              anomalyId: anomaly.id,
              causeCode: cause,
              action: `Logged cause. ${recommendAction(detected, { mealType })}`,
              notes: `Auto-summary: ${recommendAction(detected, { mealType })}`,
              createdBy: "Lakshmi Menon",
            },
          });
        }
        alertRows.push({
          type: "WASTE_ANOMALY",
          severity: isToday ? "CRITICAL" : detected.severity === "HIGH" ? "CRITICAL" : "WARNING",
          title: `${mealType} waste anomaly (+${detected.variancePct.toFixed(0)}%)`,
          message: detected.summary,
          entityType: "WASTE_ANOMALY",
          entityId: anomaly.id,
          status: isToday ? "UNREAD" : "RESOLVED",
        });
      }

      // --- Accumulate history ---------------------------------------------
      demandHistory.push({ date, mealType, consumed: actualConsumption, present: presentCount });
      wasteHistoryByMeal[mealType].push({ date, mealType, weightKg: foodWasteKg });
      dayTotalWaste += foodWasteKg;
    }

    // Recyclable + reject waste (daily, not meal-specific).
    const recyclable = round(9 + rand() * 6, 1);
    const reject = round(3 + rand() * 3, 1);
    await prisma.wasteRecord.createMany({
      data: [
        { date, location: "Main Mess", category: "RECYCLABLE", subCategory: "PLASTIC", source: "RECYCLABLE", weightKg: round(recyclable * 0.5, 1), treatmentDestination: "RECYCLE" },
        { date, location: "Main Mess", category: "RECYCLABLE", subCategory: "PAPER", source: "RECYCLABLE", weightKg: round(recyclable * 0.3, 1), treatmentDestination: "RECYCLE" },
        { date, location: "Main Mess", category: "RECYCLABLE", subCategory: "CARDBOARD", source: "RECYCLABLE", weightKg: round(recyclable * 0.2, 1), treatmentDestination: "RECYCLE" },
        { date, location: "Main Mess", category: "REJECT", subCategory: "CONTAMINATED", source: "REJECT", weightKg: reject, treatmentDestination: "DISPOSAL" },
      ],
    });
    dayTotalWaste += recyclable + reject;
    dailyWasteHistory.push({ date, weightKg: round(dayTotalWaste, 1) });

    // Inventory transactions: daily consumption for staple ingredients so
    // inventory-efficiency KPIs are computed from a real receipt/consumption
    // history rather than hardcoded ratios.
    for (const i of ingredients.slice(0, 8)) {
      await prisma.inventoryTransaction.create({
        data: {
          ingredientId: i.id,
          type: "CONSUMPTION",
          quantity: -round(1.5 + rand() * 2.5, 1),
          note: "Daily mess consumption",
          refType: "DAY",
          createdAt: date,
        },
      });
    }
  }

  console.log(`  • writing ${attendanceBuffer.length} attendance rows…`);
  for (let i = 0; i < attendanceBuffer.length; i += 8000) {
    await prisma.attendance.createMany({ data: attendanceBuffer.slice(i, i + 8000) });
  }

  // ---- Upcoming planned menus (next 3 days) -----------------------------
  // These give the inventory / purchase planning engine something real to
  // project against without inventing historical averages.
  const weekdayName = (d: Date) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];
  for (let d = 1; d <= 3; d++) {
    const date = addDays(today, d);
    for (const mealType of ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"] as const) {
      const dishNames = WEEK_MENU[date.getDay()]?.[mealType] ?? [];
      await prisma.menu.create({
        data: {
          name: `${weekdayName(date)} ${mealType.charAt(0) + mealType.slice(1).toLowerCase()}`,
          date,
          mealType,
          published: true,
          items: { create: dishNames.map((n) => ({ dishId: dishByName[n].id })) },
        },
      });
    }
  }

  // ---- Suppliers POs (history) -----------------------------------------
  const poIngredients = ["Rice", "Paneer", "Milk", "Tomato", "Cooking Oil"];
  for (let k = 0; k < 14; k++) {
    const name = poIngredients[k % poIngredients.length];
    const ing = ingredients.find((i) => i.name === name)!;
    const qty = round(20 + rand() * 60, 0);
    await prisma.purchaseOrder.create({
      data: {
        code: `PO-2026-${String(100 + k).padStart(4, "0")}`,
        supplierId: ing.supplierId,
        ingredientId: ing.id,
        quantity: qty,
        unitCost: ing.costPerUnit,
        totalCost: round(qty * ing.costPerUnit, 2),
        status: k < 12 ? "RECEIVED" : "ORDERED",
        orderedAt: addDays(today, -(DAYS - k)),
        expectedAt: addDays(today, -(DAYS - k) + (ing.shelfLifeDays > 30 ? 3 : 1)),
        receivedQty: k < 12 ? qty : null,
        receivedAt: k < 12 ? addDays(today, -(DAYS - k) + 2) : null,
      },
    });
    if (k < 12) {
      // Match the inventory ledger to the received purchase order.
      await prisma.inventoryTransaction.create({
        data: {
          ingredientId: ing.id,
          type: "RECEIPT",
          quantity: qty,
          note: `Received PO-2026-${String(100 + k).padStart(4, "0")}`,
          refType: "PO",
          createdAt: addDays(today, -(DAYS - k) + 2),
        },
      });
    }
  }

  // ---- Treatment batches / outputs / reuse ------------------------------
  const methods = ["COMPOSTING", "ANAEROBIC_DIGESTION", "COMPOSTING", "COMPOSTING", "ANAEROBIC_DIGESTION"];
  for (let b = 0; b < 6; b++) {
    const start = addDays(today, -((b + 1) * 5));
    const method = methods[b % methods.length];
    const inputKg = round(420 + rand() * 220, 0);
    const isActive = b === 0;
    const low = method === "COMPOSTING" ? inputKg * 0.2 : inputKg * 0.65;
    const high = method === "COMPOSTING" ? inputKg * 0.3 : inputKg * 0.75;
    const outputKg = isActive ? null : round(inputKg * (method === "COMPOSTING" ? 0.24 : 0.7), 0);
    const batch = await prisma.treatmentBatch.create({
      data: {
        code: `BATCH-2026-${String(b + 1).padStart(3, "0")}`,
        method,
        wasteCategory: method === "COMPOSTING" ? "FOOD" : "FOOD",
        inputKg,
        startDate: start,
        endDate: isActive ? null : addDays(start, 27),
        status: isActive ? "ACTIVE" : "COMPLETED",
        expectedOutputLow: round(low, 0),
        expectedOutputHigh: round(high, 0),
        outputKg,
        destination: method === "COMPOSTING" ? "Campus Garden" : "Kitchen Fuel",
      },
    });
    if (!isActive && outputKg) {
      const type = method === "COMPOSTING" ? "COMPOST" : "BIOGAS";
      // Biogas yield is configurable m³ per kg of organic input (default 0.06 m³/kg).
      const quantity = type === "BIOGAS" ? round(inputKg * 0.06, 1) : outputKg;
      const output = await prisma.treatmentOutput.create({
        data: {
          batchId: batch.id,
          type,
          unit: type === "BIOGAS" ? "m3" : "kg",
          quantity,
          reusedQuantity: round(quantity * (0.7 + rand() * 0.25), 0),
          reuseDestination: type === "COMPOST" ? "Campus Garden" : "Kitchen Fuel",
          quality: type === "COMPOST" ? "Grade A" : "Standard",
        },
      });
      if (type === "COMPOST" && b % 2 === 0) {
        const destinations = ["Campus Garden", "Landscaping", "Nursery"];
        for (let r = 0; r < 2; r++) {
          await prisma.reuseRecord.create({
            data: {
              outputId: output.id,
              destination: destinations[r % destinations.length],
              quantity: round(quantity * 0.2, 0),
              date: addDays(start, 30 + r),
              note: "Applied to campus grounds",
            },
          });
        }
      }
      if (method === "ANAEROBIC_DIGESTION") {
        await prisma.treatmentOutput.create({
          data: {
            batchId: batch.id,
            type: "DIGESTATE",
            unit: "kg",
            quantity: round(inputKg * 0.65, 0),
            reusedQuantity: round(inputKg * 0.6, 0),
            reuseDestination: "Agriculture Dept. Farm",
          },
        });
      }
    }
  }

  // ---- Alerts ------------------------------------------------------------
  // Every alert is derived from the data generated above: the condition has to
  // actually hold and the message quotes the real figures. Nothing is asserted
  // that the inventory / waste / treatment screens would contradict.
  const liveInventory = await prisma.ingredient.findMany({
    where: { name: { not: "Water" }, costPerUnit: { gt: 0 } },
    include: { inventory: true },
    orderBy: { name: "asc" },
  });
  const onHandOf = (i: (typeof liveInventory)[number]) => i.inventory?.quantity ?? 0;

  // 1. Stock below the configured minimum — worst gap first.
  const belowMin = liveInventory
    .filter((i) => onHandOf(i) < i.minStock)
    .sort((a, b) => onHandOf(a) - a.minStock - (onHandOf(b) - b.minStock))
    .slice(0, 3);
  for (const i of belowMin) {
    const onHand = round(onHandOf(i), 1);
    alertRows.push({
      type: "LOW_INVENTORY",
      severity: "WARNING",
      title: `${i.name} below minimum stock`,
      message: `${i.name} is at ${onHand} ${i.unit} against a ${i.minStock} ${i.unit} minimum — ${round(i.minStock - onHand, 1)} ${i.unit} short of the safety level.`,
      entityType: "INGREDIENT",
      entityId: i.id,
    });
  }

  // 2. Perishables that are into the last day of their shelf life.
  const expiring = liveInventory
    .filter((i) => {
      const item = i.inventory;
      if (!item?.lastRestockedAt || i.shelfLifeDays <= 1 || onHandOf(i) <= 0) return false;
      const ageDays = Math.floor((today.getTime() - startOfDay(item.lastRestockedAt).getTime()) / 86400000);
      return ageDays >= i.shelfLifeDays - 1;
    })
    .slice(0, 2);
  for (const i of expiring) {
    alertRows.push({
      type: "EXPIRY",
      severity: "WARNING",
      title: `${i.name} approaching expiry`,
      message: `${round(onHandOf(i), 1)} ${i.unit} of ${i.name} was restocked ${i.shelfLifeDays - 1} day(s) ago with a ${i.shelfLifeDays}-day shelf life — prioritise usage today.`,
      entityType: "INGREDIENT",
      entityId: i.id,
    });
  }

  // 3. The dish that most consistently exceeds its own historical waste baseline.
  const flaggedDish = (await getDishWasteStats(DAYS, today)).find(
    (d) => d.occurrences >= 5 && d.exceedances >= 4,
  );
  if (flaggedDish) {
    alertRows.push({
      type: "HIGH_WASTE_DISH",
      severity: "WARNING",
      title: `${flaggedDish.name} above its waste baseline`,
      message: `${flaggedDish.name} exceeded its historical baseline of ${flaggedDish.baselinePct.toFixed(1)}% in ${flaggedDish.exceedances} of the last ${flaggedDish.occurrences} occurrences (averaging ${flaggedDish.avgWastePct.toFixed(1)}%).`,
      entityType: "DISH",
      entityId: flaggedDish.dishId,
    });
  }

  // 4. Stock held above the configured maximum.
  const overstock = liveInventory.filter((i) => i.maxStock > 0 && onHandOf(i) > i.maxStock).slice(0, 2);
  for (const i of overstock) {
    alertRows.push({
      type: "OVERSTOCK",
      severity: "INFO",
      title: `${i.name} overstock risk`,
      message: `${i.name} on hand (${round(onHandOf(i), 1)} ${i.unit}) exceeds the ${i.maxStock} ${i.unit} maximum — consider pausing purchases.`,
      entityType: "INGREDIENT",
      entityId: i.id,
    });
  }

  // 5. The most recently completed treatment batch, with its real output.
  const completedBatch = await prisma.treatmentBatch.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { endDate: "desc" },
    include: { outputs: true },
  });
  if (completedBatch) {
    const outputText = completedBatch.outputs
      .map((o) => `${round(o.quantity, 0)} ${o.unit} of ${o.type.toLowerCase()}`)
      .join(" and ");
    alertRows.push({
      type: "BATCH_COMPLETE",
      severity: "SUCCESS",
      title: `Treatment batch ${completedBatch.code} completed`,
      message: `${completedBatch.code} finished ${completedBatch.method.replace(/_/g, " ").toLowerCase()} from ${round(completedBatch.inputKg, 0)} kg of input, producing ${outputText || "a recorded output"}.`,
      entityType: "TREATMENT_BATCH",
      entityId: completedBatch.id,
    });
  }

  await prisma.alert.createMany({ data: alertRows.map((a) => ({ ...a, status: a.status ?? "UNREAD" })) });

  // ---- Station current weight from today's waste ------------------------
  const todayFoodWaste = await prisma.wasteRecord.aggregate({
    where: { date: today, category: "FOOD" },
    _sum: { weightKg: true },
  });
  const todayRecyclable = await prisma.wasteRecord.aggregate({
    where: { date: today, category: "RECYCLABLE" },
    _sum: { weightKg: true },
  });
  const todayReject = await prisma.wasteRecord.aggregate({
    where: { date: today, category: "REJECT" },
    _sum: { weightKg: true },
  });
  await prisma.station.updateMany({
    where: { location: "Main Mess" },
    data: {
      currentWeightKg: round(todayFoodWaste._sum.weightKg ?? 0, 1),
      organicKg: round(todayFoodWaste._sum.weightKg ?? 0, 1),
      recyclableKg: round(todayRecyclable._sum.weightKg ?? 0, 1),
      rejectKg: round(todayReject._sum.weightKg ?? 0, 1),
      lastCollectionAt: addDays(today, -1),
    },
  });

  // ---- Update rolling dish/inventory stats ------------------------------
  for (const dish of dishes) {
    const agg = await prisma.mealConsumption.aggregate({
      where: { dishId: dish.id },
      _avg: { wastePct: true, servingsConsumed: true },
    });
    await prisma.dish.update({
      where: { id: dish.id },
      data: {
        historicalConsumption: round(agg._avg.servingsConsumed ?? dish.historicalConsumption, 0),
        historicalWastePct: round((agg._avg.wastePct ?? dish.historicalWastePct), 1),
      },
    });
  }

  // ---- Train the ML regression models -----------------------------------
  // Done last so the models train on the freshly generated history, exactly as
  // they would once real campus data accumulates.
  console.log("  • training regression models…");
  try {
    const { trainModels } = await import("@/lib/ml/registry");
    const { forecastMeal } = await import("@/lib/services/forecast");
    const { mlWastePredict, recordWastePrediction } = await import("@/lib/services/ml-forecast");

    const summaries = await trainModels(["DEMAND", "WASTE"]);
    console.log(
      "    " +
        summaries
          .filter((s) => s.isActive)
          .map((s) => `${s.kind}:${s.algorithm} R2=${s.metrics.r2} RMSE=${s.metrics.rmse}`)
          .join("  ")
    );

    // Backfill the *held-out* recent window so live scoring shows honest,
    // out-of-sample error rather than in-sample fit.
    const BACKFILL = 7;
    for (let i = BACKFILL - 1; i >= 0; i--) {
      const day = addDays(today, -i);
      const dayMeals = await prisma.meal.findMany({ where: { date: day } });
      for (const meal of dayMeals) {
        const fc = await forecastMeal(day, meal.mealType, { force: true });
        const actual = meal.actualConsumption ?? null;
        await prisma.mealPrediction.upsert({
          where: { date_mealType: { date: day, mealType: meal.mealType } },
          update: {
            predictedConsumption: fc.predicted,
            recommendedPrep: fc.recommendedPrep,
            rangeLow: fc.rangeLow,
            rangeHigh: fc.rangeHigh,
            confidence: fc.confidence,
            model: fc.model,
            actualConsumption: actual,
            error: actual != null ? actual - fc.predicted : null,
          },
          create: {
            date: day,
            mealType: meal.mealType,
            predictedConsumption: fc.predicted,
            recommendedPrep: fc.recommendedPrep,
            rangeLow: fc.rangeLow,
            rangeHigh: fc.rangeHigh,
            confidence: fc.confidence,
            model: fc.model,
            actualConsumption: actual,
            error: actual != null ? actual - fc.predicted : null,
            inputs: JSON.stringify({ attendance: fc.attendance, method: fc.method }),
          },
        });
        await prisma.meal.update({
          where: { id: meal.id },
          data: { predictedConsumption: fc.predicted, recommendedPrep: fc.recommendedPrep },
        });

        const ml = await mlWastePredict(day, meal.mealType, {
          predictedDemand: meal.predictedConsumption ?? fc.predicted,
          recommendedPrep: meal.recommendedPrep ?? fc.recommendedPrep,
          actualPrep: meal.actualPrep ?? 0,
          actualConsumption: meal.actualConsumption ?? 0,
          attendance: meal.expectedStudents,
        });
        if (ml) {
          await recordWastePrediction(ml, day, meal.mealType, meal.totalWasteKg ?? null);
          if (meal.totalWasteKg != null) {
            await prisma.wastePrediction.upsert({
              where: { date_mealType: { date: day, mealType: meal.mealType } },
              update: {
                expectedKg: ml.predicted,
                rangeLow: ml.rangeLow,
                rangeHigh: ml.rangeHigh,
                actualKg: meal.totalWasteKg,
                variancePct: ml.predicted > 0 ? Math.round(((meal.totalWasteKg - ml.predicted) / ml.predicted) * 1000) / 10 : null,
                model: `ml-${ml.algorithm.toLowerCase()}-${ml.modelVersion}`,
              },
              create: {
                date: day,
                mealType: meal.mealType,
                expectedKg: ml.predicted,
                rangeLow: ml.rangeLow,
                rangeHigh: ml.rangeHigh,
                actualKg: meal.totalWasteKg,
                variancePct: ml.predicted > 0 ? Math.round(((meal.totalWasteKg - ml.predicted) / ml.predicted) * 1000) / 10 : null,
                model: `ml-${ml.algorithm.toLowerCase()}-${ml.modelVersion}`,
              },
            });
          }
        }
      }
    }
    // Anomalies were flagged during the simulation against the statistical
    // baseline. The backfill above has since replaced those days' expected
    // waste with the ML model's value — which is also what the "Recompute"
    // action in the app uses. Re-score the flags against that same expectation,
    // otherwise one meal reads "+192% above expected" on the anomaly row and
    // "+84%" on the expected-waste row at the same time.
    const resyncFrom = addDays(today, -(BACKFILL - 1));
    const anomalies = await prisma.wasteAnomaly.findMany({ where: { date: { gte: resyncFrom } } });
    for (const a of anomalies) {
      const [meal, prediction] = await Promise.all([
        prisma.meal.findUnique({ where: { date_mealType: { date: a.date, mealType: a.mealType } } }),
        prisma.wastePrediction.findUnique({ where: { date_mealType: { date: a.date, mealType: a.mealType } } }),
      ]);
      if (!meal?.totalWasteKg || !prediction || prediction.expectedKg <= 0) continue;

      const history = await prisma.wasteRecord.findMany({
        where: { category: "FOOD", mealType: a.mealType, date: { lt: a.date } },
        select: { date: true, weightKg: true },
      });
      const res = detectWasteAnomaly({
        actualKg: meal.totalWasteKg,
        expectedKg: prediction.expectedKg,
        history,
        actualPrep: meal.actualPrep ?? undefined,
        recommendedPrep: meal.recommendedPrep ?? undefined,
        thresholdPct: Number(DEFAULT_SETTINGS.anomaly_threshold_pct.value),
      });

      if (!res.isAnomaly) {
        // No longer unusual once the better model's expectation is used.
        await prisma.correctiveAction.deleteMany({ where: { anomalyId: a.id } });
        await prisma.alert.deleteMany({ where: { entityType: "WASTE_ANOMALY", entityId: a.id } });
        await prisma.wasteAnomaly.delete({ where: { id: a.id } });
        continue;
      }

      await prisma.wasteAnomaly.update({
        where: { id: a.id },
        data: {
          expectedKg: prediction.expectedKg,
          actualKg: meal.totalWasteKg,
          variancePct: res.variancePct,
          severity: res.severity,
          contributors: JSON.stringify(res.contributors),
          summary: res.summary,
        },
      });
      await prisma.alert.updateMany({
        where: { entityType: "WASTE_ANOMALY", entityId: a.id },
        data: {
          title: `${a.mealType} waste anomaly (+${res.variancePct.toFixed(0)}%)`,
          message: res.summary,
          severity: res.severity === "HIGH" ? "CRITICAL" : "WARNING",
        },
      });
    }
  } catch (e) {
    console.warn("  ⚠ ML training skipped:", (e as Error).message);
  }

  const counts = {
    students: await prisma.student.count(),
    attendance: await prisma.attendance.count(),
    meals: await prisma.meal.count(),
    wasteRecords: await prisma.wasteRecord.count(),
    anomalies: await prisma.wasteAnomaly.count(),
    batches: await prisma.treatmentBatch.count(),
  };
  console.log("✅ Seed complete:", counts);
}
