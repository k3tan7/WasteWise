import Link from "next/link";
import { AlertTriangle, ArrowRight, Lightbulb, Sparkles, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings, dailyBaselineKg } from "@/lib/settings";
import {
  getAttendanceSummary,
  getDailyWasteSeries,
  getDemandAccuracy,
  getDishWasteStats,
  getWasteBreakdown,
  reductionVsBaseline,
} from "@/lib/analytics";
import { buildPurchasePlan } from "@/lib/services/plan";
import { buildInsights, type Insight } from "@/lib/insights";
import { Badge, Card, CardBody, CardHeader, CardTitle, LinkButton, PageHeader, Stat, Table, Td, Th, Tr } from "@/components/ui";
import { TrendChart } from "@/components/charts";
import { cn, fmtDate, kg, num, pct, startOfDay, toISODate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

const MEAL_LABEL: Record<string, string> = { BREAKFAST: "Breakfast", LUNCH: "Lunch", SNACKS: "Snacks", DINNER: "Dinner" };
const SEVERITY_STYLE: Record<Insight["severity"], { badge: string; wrap: string; icon: React.ReactNode }> = {
  critical: { badge: "danger", wrap: "border-red-200 bg-red-50/60", icon: <TriangleAlert className="h-4 w-4 text-red-600" /> },
  warning: { badge: "warning", wrap: "border-amber-200 bg-amber-50/60", icon: <AlertTriangle className="h-4 w-4 text-amber-600" /> },
  positive: { badge: "success", wrap: "border-brand-200 bg-brand-50/60", icon: <Sparkles className="h-4 w-4 text-brand-600" /> },
  info: { badge: "info", wrap: "border-sky-200 bg-sky-50/60", icon: <Lightbulb className="h-4 w-4 text-sky-600" /> },
};

export default async function DashboardPage() {
  await requireUser();
  const today = startOfDay(new Date());

  const [settings, attendance, meals, breakdownToday, series30, accuracy14, dishStats, openAnomaly, stationAgg] =
    await Promise.all([
      getSettings(),
      getAttendanceSummary(today),
      prisma.meal.findMany({ where: { date: today }, orderBy: { mealType: "asc" } }),
      getWasteBreakdown({ from: today, to: today }),
      getDailyWasteSeries(30, today),
      getDemandAccuracy(14, today),
      getDishWasteStats(30, today),
      // The worst open anomaly today, not an arbitrary one, so the banner points
      // at the most significant thing on the board.
      prisma.wasteAnomaly.findFirst({
        where: { status: { in: ["OPEN", "INVESTIGATING"] } },
        orderBy: [{ date: "desc" }, { variancePct: "desc" }],
      }),
      // station totals today
      prisma.wasteRecord.groupBy({ by: ["category"], where: { date: today }, _sum: { weightKg: true } }),
    ]);

  const [{ plan }, wastePredToday, recentAlerts, predictedPresent] = await Promise.all([
    buildPurchasePlan(today, 4),
    prisma.wastePrediction.findMany({ where: { date: today } }),
    prisma.alert.findMany({ where: { status: { in: ["UNREAD", "READ"] } }, orderBy: { createdAt: "desc" }, take: 20 }),
    // expected attendance from today's meal rows (present / participation is stored per meal as expectedStudents)
    prisma.meal.findFirst({ where: { date: today, mealType: "LUNCH" }, select: { expectedStudents: true } }),
  ]);

  // Severity is a string column, so the database sorts it alphabetically. Rank it
  // here so critical alerts are never pushed below informational ones.
  const SEVERITY_RANK: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2, SUCCESS: 3 };
  const alerts = recentAlerts
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) || b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  // ---- KPI maths ---------------------------------------------------------
  const plannedMeals = meals.length;
  const expectedConsumption = meals.reduce((a, m) => a + (m.predictedConsumption ?? 0), 0);
  const recommendedPrep = meals.reduce((a, m) => a + (m.recommendedPrep ?? 0), 0);
  const mealsPrepared = meals.reduce((a, m) => a + (m.actualPrep ?? 0), 0);
  const foodConsumed = meals.reduce((a, m) => a + (m.actualConsumption ?? 0), 0);

  const foodWaste = breakdownToday.byCategory.FOOD ?? 0;
  const recyclable = breakdownToday.byCategory.RECYCLABLE ?? 0;
  const reject = breakdownToday.byCategory.REJECT ?? 0;
  const totalWaste = breakdownToday.total;

  const predictedWaste = Math.round(wastePredToday.reduce((a, w) => a + w.expectedKg, 0) * 10) / 10;
  const wasteVariance = predictedWaste > 0 ? ((foodWaste - predictedWaste) / predictedWaste) * 100 : 0;

  const baseline = dailyBaselineKg(settings);
  // The baseline is defined as *food* waste per day, so only the FOOD stream is
  // comparable — recyclable and reject waste are different streams entirely.
  const reduction7 = reductionVsBaseline(
    series30.slice(-7).map((d) => d.food),
    baseline,
    7
  );

  const wasteTrend = series30.slice(-14).map((d) => ({
    date: d.date.slice(5),
    Food: d.food,
    Recyclable: d.recyclable,
    Reject: d.reject,
  }));

  // Predicted vs actual demand (per day, all meals)
  const demandByDay = new Map<string, { date: string; Predicted: number; Actual: number }>();
  for (const r of accuracy14.rows) {
    const key = r.date;
    const e = demandByDay.get(key) ?? { date: key.slice(5), Predicted: 0, Actual: 0 };
    e.Predicted += r.predicted;
    e.Actual += r.actual;
    demandByDay.set(key, e);
  }
  const demandChart = Array.from(demandByDay.values());

  // ---- Insights ----------------------------------------------------------
  const recent7 = series30.slice(-7).reduce((a, d) => a + d.total, 0);
  const prior7 = series30.slice(-14, -7).reduce((a, d) => a + d.total, 0);
  const insights = buildInsights({
    meals: meals.map((m) => ({
      mealType: m.mealType,
      predictedConsumption: m.predictedConsumption,
      recommendedPrep: m.recommendedPrep,
      actualPrep: m.actualPrep,
      actualConsumption: m.actualConsumption,
      totalWasteKg: m.totalWasteKg,
    })),
    wastePred: wastePredToday.map((w) => ({
      mealType: w.mealType,
      expectedKg: w.expectedKg,
      actualKg: w.actualKg ?? 0,
      variancePct: w.variancePct ?? 0,
    })),
    attendance: { present: attendance.present, enrolled: attendance.enrolled },
    predictedPresent: predictedPresent?.expectedStudents,
    dishStats,
    inventory: plan.rows
      .filter((r) => r.breaching && r.recommendedQty > 0)
      .map((r) => ({ name: r.name, onHand: r.currentStock, unit: r.unit, minStock: r.safetyStock, required: r.requiredQty })),
    weekly: { recent: recent7, prior: prior7, days: 7 },
    demandAccuracy: accuracy14.accuracy,
    topAnomaly: openAnomaly
      ? { mealType: openAnomaly.mealType, variancePct: openAnomaly.variancePct, summary: openAnomaly.summary ?? "" }
      : undefined,
  });

  const station = Object.fromEntries(stationAgg.map((s) => [s.category, Math.round((s._sum.weightKg ?? 0) * 10) / 10]));
  const topDishes = dishStats.filter((d) => d.occurrences >= 5).slice(0, 4);
  const purchaseAttention = plan.rows.filter((r) => r.recommendedQty > 0).slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Campus overview"
        description={`Operational snapshot for ${fmtDate(today, { weekday: "long", month: "long", day: "numeric" })} — attendance, demand, preparation and waste in one place.`}
        actions={
          <>
            <LinkButton href="/purchases" variant="secondary">
              Purchase plan
            </LinkButton>
            <LinkButton href="/waste">Record waste</LinkButton>
          </>
        }
      />

      {/* Active anomaly banner */}
      {openAnomaly && (
        <Card className="mb-6 overflow-hidden border-red-200">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100">
                <TriangleAlert className="h-5 w-5 text-red-600" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink-900">Waste anomaly detected</p>
                  <Badge variant="danger">+{openAnomaly.variancePct.toFixed(0)}% above expected</Badge>
                </div>
                <p className="mt-1 text-xs text-ink-600">
                  {MEAL_LABEL[openAnomaly.mealType] ?? openAnomaly.mealType} · {fmtDate(openAnomaly.date)} · recorded{" "}
                  {kg(openAnomaly.actualKg)} vs {kg(openAnomaly.expectedKg)} expected.
                </p>
                <p className="mt-1 text-xs text-ink-500">{openAnomaly.summary}</p>
              </div>
            </div>
            <LinkButton href={`/waste/anomalies/${openAnomaly.id}`} variant="danger" className="shrink-0">
              Investigate &amp; assign cause <ArrowRight className="h-3.5 w-3.5" />
            </LinkButton>
          </div>
        </Card>
      )}

      {/* Today's KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <Stat label="Students present" value={num(attendance.present)} hint={`of ${num(attendance.enrolled)} enrolled`} />
        <Stat label="Expected consumption" value={num(expectedConsumption)} hint="all meals" />
        <Stat label="Recommended prep" value={num(recommendedPrep)} hint="with buffer" tone="brand" />
        <Stat label="Meals prepared" value={num(mealsPrepared)} hint={`${plannedMeals} meals planned`} />
        <Stat label="Food consumed" value={num(foodConsumed)} hint="servings" />
        <Stat label="Total waste" value={num(totalWaste, 1)} unit="kg" hint="all categories" />
        <Stat label="Food waste" value={num(foodWaste, 1)} unit="kg" tone={wasteVariance > 25 ? "danger" : "neutral"} />
        <Stat label="Recyclable waste" value={num(recyclable, 1)} unit="kg" />
        <Stat label="Reject waste" value={num(reject, 1)} unit="kg" />
        <Stat label="Predicted food waste" value={num(predictedWaste, 1)} unit="kg" />
        <Stat
          label="Waste variance"
          value={pct(wasteVariance)}
          tone={wasteVariance > 25 ? "danger" : wasteVariance > 0 ? "warning" : "brand"}
          hint="actual vs predicted"
        />
        <Stat
          label="Waste reduction (7d)"
          value={pct(reduction7.reductionPct)}
          tone={reduction7.reductionPct >= 0 ? "brand" : "danger"}
          hint={`vs ${num(baseline)} kg/day baseline`}
        />
      </div>

      {/* Insights */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-ink-900">AI Insights</h2>
            <span className="text-[11px] text-ink-400">generated from today&apos;s data</span>
          </div>
          <div className="space-y-3">
            {insights.length === 0 && (
              <Card className="p-5 text-sm text-ink-500">No notable signals today — operations are within normal ranges.</Card>
            )}
            {insights.slice(0, 6).map((ins) => {
              const s = SEVERITY_STYLE[ins.severity];
              return (
                <Card key={ins.id} className={cn("p-4", s.wrap)}>
                  <div className="flex gap-3">
                    <span className="mt-0.5">{s.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-ink-900">{ins.title}</p>
                        <Badge variant={s.badge}>{ins.severity}</Badge>
                      </div>
                      <p className="mt-1.5 text-xs text-ink-600">
                        <span className="font-medium text-ink-700">What happened: </span>
                        {ins.what}
                      </p>
                      <p className="mt-1 text-xs text-ink-600">
                        <span className="font-medium text-ink-700">Why: </span>
                        {ins.why}
                      </p>
                      <p className="mt-1 text-xs text-ink-600">
                        <span className="font-medium text-ink-700">What to do: </span>
                        {ins.action}
                      </p>
                      {ins.href && (
                        <Link href={ins.href} className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:underline">
                          Take action <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          {/* Station summary */}
          <Card>
            <CardHeader>
              <CardTitle>WasteWise Station</CardTitle>
              <Link href="/station" className="text-[11px] font-medium text-brand-700 hover:underline">
                View
              </Link>
            </CardHeader>
            <CardBody className="pt-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Organic", value: station.FOOD ?? 0, color: "text-brand-700" },
                  { label: "Recyclable", value: station.RECYCLABLE ?? 0, color: "text-sky-700" },
                  { label: "Reject", value: station.REJECT ?? 0, color: "text-ink-600" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-ink-50 py-3">
                    <p className={cn("text-lg font-semibold tabular-nums", s.color)}>{num(s.value, 1)}</p>
                    <p className="text-[10px] uppercase tracking-wide text-ink-400">{s.label} kg</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-ink-500">
                Today&apos;s collection at Main Mess. Future sensor hardware can push readings to this station via the API.
              </p>
            </CardBody>
          </Card>

          {/* Alerts */}
          <Card>
            <CardHeader>
              <CardTitle>Recent alerts</CardTitle>
              <Link href="/alerts" className="text-[11px] font-medium text-brand-700 hover:underline">
                All
              </Link>
            </CardHeader>
            <CardBody className="space-y-2 pt-3">
              {alerts.length === 0 && <p className="text-xs text-ink-400">No active alerts.</p>}
              {alerts.map((a) => (
                <div key={a.id} className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      a.severity === "CRITICAL" ? "bg-red-500" : a.severity === "SUCCESS" ? "bg-brand-500" : "bg-amber-500"
                    )}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-ink-800">{a.title}</p>
                    <p className="line-clamp-2 text-[11px] text-ink-500">{a.message}</p>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          {/* Purchase attention */}
          <Card>
            <CardHeader>
              <CardTitle>Inventory attention</CardTitle>
              <Link href="/purchases" className="text-[11px] font-medium text-brand-700 hover:underline">
                Plan
              </Link>
            </CardHeader>
            <CardBody className="space-y-2 pt-3">
              {purchaseAttention.length === 0 && <p className="text-xs text-ink-400">Stock covers the planning horizon.</p>}
              {purchaseAttention.map((r) => (
                <div key={r.ingredientId} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-ink-700">{r.name}</span>
                  <span className="tabular-nums text-ink-500">
                    {r.currentStock} → need {r.requiredQty} {r.unit}
                  </span>
                  <Badge variant="warning">buy {r.recommendedQty}</Badge>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Waste by category (last 14 days)</CardTitle>
          </CardHeader>
          <CardBody className="pt-3">
            <TrendChart
              data={wasteTrend}
              xKey="date"
              unit=" kg"
              series={[
                { key: "Food", label: "Food", color: "#16a34a" },
                { key: "Recyclable", label: "Recyclable", color: "#0ea5e9" },
                { key: "Reject", label: "Reject", color: "#64748b" },
              ]}
              area
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Predicted vs actual demand (last 14 days)</CardTitle>
            <Badge variant={accuracy14.accuracy >= 90 ? "success" : "warning"}>
              {accuracy14.accuracy.toFixed(1)}% accuracy
            </Badge>
          </CardHeader>
          <CardBody className="pt-3">
            <TrendChart
              data={demandChart}
              xKey="date"
              series={[
                { key: "Predicted", label: "Predicted", color: "#6366f1" },
                { key: "Actual", label: "Actual", color: "#16a34a" },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      {/* Lower grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s meals</CardTitle>
            <Link href="/meals" className="text-[11px] font-medium text-brand-700 hover:underline">
              Manage
            </Link>
          </CardHeader>
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Meal</Th>
                  <Th className="text-right">Predicted</Th>
                  <Th className="text-right">Prep</Th>
                  <Th className="text-right">Consumed</Th>
                  <Th className="text-right">Waste</Th>
                </tr>
              </thead>
              <tbody>
                {meals.map((m) => (
                  <Tr key={m.id}>
                    <Td className="font-medium text-ink-800">{MEAL_LABEL[m.mealType] ?? m.mealType}</Td>
                    <Td className="text-right tabular-nums">{num(m.predictedConsumption)}</Td>
                    <Td className="text-right tabular-nums">{num(m.actualPrep)}</Td>
                    <Td className="text-right tabular-nums">{num(m.actualConsumption)}</Td>
                    <Td className="text-right tabular-nums">{num(m.totalWasteKg, 1)} kg</Td>
                  </Tr>
                ))}
                {meals.length === 0 && (
                  <Tr>
                    <Td colSpan={5} className="text-center text-xs text-ink-400">
                      No meals recorded for today yet.
                    </Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dish waste watchlist</CardTitle>
            <Link href="/waste/analytics" className="text-[11px] font-medium text-brand-700 hover:underline">
              Analytics
            </Link>
          </CardHeader>
          <CardBody className="space-y-3 pt-3">
            {topDishes.length === 0 && <p className="text-xs text-ink-400">Not enough dish history yet.</p>}
            {topDishes.map((d) => (
              <div key={d.dishId}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink-800">{d.name}</span>
                  <span className="tabular-nums text-ink-500">
                    {d.avgWastePct.toFixed(1)}% avg · exceeded {d.exceedances}/{d.occurrences}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                  <div
                    className={cn("h-full rounded-full", d.exceedanceRate > 0.5 ? "bg-red-500" : d.exceedanceRate > 0.3 ? "bg-amber-500" : "bg-brand-500")}
                    style={{ width: `${Math.min(100, (d.avgWastePct / 20) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="text-[11px] text-ink-400">
              A dish is flagged only when it repeatedly exceeds its own historical waste baseline.
            </p>
          </CardBody>
        </Card>
      </div>

      <p className="mt-6 text-[11px] text-ink-400">
        Data as of {toISODate(today)} · Forecast model: weighted-history-v1 · Waste model: waste-baseline-v1. Predictions are
        statistical estimates, not guarantees.
      </p>
    </div>
  );
}
