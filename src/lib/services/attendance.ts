import { prisma } from "@/lib/db";
import { startOfDay } from "@/lib/utils";
import { getSettings, settingNumber } from "@/lib/settings";

// ---------------------------------------------------------------------------
// ATTENDANCE ESTIMATION
// ---------------------------------------------------------------------------
// Forecasting a future meal needs the number of people who will be on campus.
// Until today's attendance is actually entered, that is unknown, so it is
// estimated from the campus's own recent history:
//
//   attendanceRatio = mean(expected students present / students enrolled)
//                     over the last N served meals
//   heads           = enrolled × attendanceRatio + staff (breakfast & lunch)
//
// This is deliberately separate from MEAL PARTICIPATION (the share of people
// present who eat a given meal). Conflating the two under-predicts demand badly,
// because participation is always far lower than attendance.

/** Meals that campus staff eat in the mess. */
export const STAFF_MEALS = ["BREAKFAST", "LUNCH"];

const LOOKBACK_MEALS = 24;

export type AttendanceEstimate = {
  /** students + staff expected on campus for this meal */
  heads: number;
  /** students only */
  students: number;
  staff: number;
  /** true when today's attendance has actually been recorded */
  actual: boolean;
  source: string;
};

/** Estimate how many people will eat, for a meal on `date`. */
export async function estimateHeadsOnCampus(date: Date, mealType: string): Promise<AttendanceEstimate> {
  const day = startOfDay(date);
  const [settings, enrolled, recorded, recent] = await Promise.all([
    getSettings(),
    prisma.student.count({ where: { active: true } }),
    prisma.attendance.count({ where: { date: day, present: true } }),
    prisma.meal.findMany({
      where: { date: { lt: day }, actualConsumption: { not: null } },
      select: { expectedStudents: true, actualConsumption: true, mealType: true },
      orderBy: { date: "desc" },
      take: LOOKBACK_MEALS,
    }),
  ]);

  const staff = STAFF_MEALS.includes(mealType)
    ? Math.round(settingNumber(settings, "staff_count", 0))
    : 0;

  if (recorded > 0) {
    return { heads: recorded + staff, students: recorded, staff, actual: true, source: "recorded attendance" };
  }

  // Recent average attendance ratio, weighted towards the meals closest in time.
  let num = 0;
  let den = 0;
  recent.forEach((m, i) => {
    const w = 0.9 ** i;
    num += w * (m.expectedStudents / Math.max(1, enrolled));
    den += w;
  });
  const ratio = den > 0 ? num / den : 0.95;
  const students = Math.round(enrolled * Math.min(0.99, Math.max(0.3, ratio)));

  return {
    heads: students + staff,
    students,
    staff,
    actual: false,
    source: `projected from the last ${recent.length} services (${Math.round(ratio * 100)}% on campus)`,
  };
}
