import { prisma } from "@/lib/db";
import { startOfDay, toISODate } from "@/lib/utils";
import {
  DEMAND_FEATURES,
  WASTE_FEATURES,
  computeDemandFeatures,
  computeWasteFeatures,
  type DishInfo,
  type MealHistoryRow,
} from "@/lib/ml/features";
import { getSettings, settingNumber } from "@/lib/settings";
import { estimateHeadsOnCampus, STAFF_MEALS } from "@/lib/services/attendance";

export type Dataset = {
  X: number[][];
  y: number[];
  featureNames: string[];
  meta: { date: string; mealType: string }[];
};

type MenuWithItems = { items: { dish: { historicalConsumption: number; historicalWastePct: number } }[] } | null | undefined;

function dishesOf(menu: MenuWithItems): DishInfo[] {
  return (menu?.items ?? []).map((i) => ({
    historicalConsumption: i.dish.historicalConsumption,
    historicalWastePct: i.dish.historicalWastePct,
  }));
}

/** Chronological dataset for the meal-demand regression (target = consumed). */
export async function buildDemandDataset(): Promise<Dataset> {
  const [meals, enrolled] = await Promise.all([
    prisma.meal.findMany({ orderBy: [{ date: "asc" }, { mealType: "asc" }], include: { menu: { include: { items: { include: { dish: true } } } } } }),
    prisma.student.count({ where: { active: true } }),
  ]);

  const X: number[][] = [];
  const y: number[] = [];
  const meta: { date: string; mealType: string }[] = [];
  const history: MealHistoryRow[] = [];

  for (const m of meals) {
    if (m.actualConsumption != null) {
      X.push(
        computeDemandFeatures({
          date: m.date,
          mealType: m.mealType,
          attendance: m.expectedStudents,
          enrolled,
          menuDishes: dishesOf(m.menu),
          history,
        })
      );
      y.push(m.actualConsumption);
      meta.push({ date: toISODate(m.date), mealType: m.mealType });
    }
    history.push({
      date: m.date,
      mealType: m.mealType,
      consumed: m.actualConsumption ?? 0,
      present: Math.max(1, m.expectedStudents),
      wasteKg: m.totalWasteKg ?? 0,
    });
  }

  return { X, y, featureNames: [...DEMAND_FEATURES], meta };
}

/** Chronological dataset for the food-waste regression (target = total waste kg). */
export async function buildWasteDataset(): Promise<Dataset> {
  const meals = await prisma.meal.findMany({ orderBy: [{ date: "asc" }, { mealType: "asc" }], include: { menu: { include: { items: { include: { dish: true } } } } } });
  const X: number[][] = [];
  const y: number[] = [];
  const meta: { date: string; mealType: string }[] = [];
  const history: MealHistoryRow[] = [];

  for (const m of meals) {
    if (m.totalWasteKg != null) {
      X.push(
        computeWasteFeatures({
          date: m.date,
          mealType: m.mealType,
          predictedDemand: m.predictedConsumption ?? m.actualConsumption ?? 0,
          recommendedPrep: m.recommendedPrep ?? 0,
          actualPrep: m.actualPrep ?? 0,
          actualConsumption: m.actualConsumption ?? 0,
          attendance: m.expectedStudents,
          menuDishes: dishesOf(m.menu),
          history,
        })
      );
      y.push(m.totalWasteKg);
      meta.push({ date: toISODate(m.date), mealType: m.mealType });
    }
    history.push({
      date: m.date,
      mealType: m.mealType,
      consumed: m.actualConsumption ?? 0,
      present: Math.max(1, m.expectedStudents),
      wasteKg: m.totalWasteKg ?? 0,
    });
  }

  return { X, y, featureNames: [...WASTE_FEATURES], meta };
}

/** Build the demand feature vector for a single (date, meal) at serving time. */
export async function demandFeatureRow(date: Date, mealType: string): Promise<number[] | null> {
  const day = startOfDay(date);
  const [settings, enrolled, present, priorMeals, menu] = await Promise.all([
    getSettings(),
    prisma.student.count({ where: { active: true } }),
    prisma.attendance.count({ where: { date: day, present: true } }),
    prisma.meal.findMany({ where: { date: { lt: day } }, orderBy: [{ date: "asc" }, { mealType: "asc" }] }),
    prisma.menu.findUnique({ where: { date_mealType: { date: day, mealType } }, include: { items: { include: { dish: true } } } }),
  ]);

  if (!enrolled) return null;
  // Attendance (people on campus), not meal participation — see services/attendance.ts.
  const staffHeads = STAFF_MEALS.includes(mealType) ? Math.round(settingNumber(settings, "staff_count", 0)) : 0;
  const attendance =
    present > 0 ? present + staffHeads : (await estimateHeadsOnCampus(day, mealType)).heads;
  const history: MealHistoryRow[] = priorMeals.map((m) => ({
    date: m.date,
    mealType: m.mealType,
    consumed: m.actualConsumption ?? 0,
    present: Math.max(1, m.expectedStudents),
    wasteKg: m.totalWasteKg ?? 0,
  }));

  return computeDemandFeatures({
    date: day,
    mealType,
    attendance,
    enrolled,
    menuDishes: dishesOf(menu),
    history,
  });
}

/** Build the waste feature vector for a single (date, meal) at serving time. */
export async function wasteFeatureRow(
  date: Date,
  mealType: string,
  values: {
    predictedDemand: number;
    recommendedPrep: number;
    actualPrep: number;
    actualConsumption: number;
    attendance?: number;
  }
): Promise<number[] | null> {
  const day = startOfDay(date);
  const [priorMeals, menu, meal] = await Promise.all([
    prisma.meal.findMany({ where: { date: { lt: day } }, orderBy: [{ date: "asc" }, { mealType: "asc" }] }),
    prisma.menu.findUnique({ where: { date_mealType: { date: day, mealType } }, include: { items: { include: { dish: true } } } }),
    prisma.meal.findUnique({ where: { date_mealType: { date: day, mealType } } }),
  ]);

  const history: MealHistoryRow[] = priorMeals.map((m) => ({
    date: m.date,
    mealType: m.mealType,
    consumed: m.actualConsumption ?? 0,
    present: Math.max(1, m.expectedStudents),
    wasteKg: m.totalWasteKg ?? 0,
  }));

  return computeWasteFeatures({
    date: day,
    mealType,
    predictedDemand: values.predictedDemand,
    recommendedPrep: values.recommendedPrep,
    actualPrep: values.actualPrep,
    actualConsumption: values.actualConsumption,
    attendance: values.attendance ?? meal?.expectedStudents ?? 0,
    menuDishes: dishesOf(menu),
    history,
  });
}
