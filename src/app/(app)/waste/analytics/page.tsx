import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getDailyWasteSeries, getDishWasteStats, getWasteBreakdown, getWastePredictionAccuracy } from "@/lib/analytics";
import { getSettings, settingNumber } from "@/lib/settings";
import { Badge, Card, CardBody, CardHeader, CardTitle, Input, PageHeader, Select, Stat, Table, Td, Th, Tr } from "@/components/ui";
import { Flash, SubmitButton } from "@/components/form-ui";
import { BarsChart, DonutChart, TrendChart } from "@/components/charts";
import { addDays, mean, num, startOfDay, toISODate } from "@/lib/utils";
import { LOCATIONS, MEAL_TYPES, WASTE_CATEGORIES } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Waste Analytics" };

const MEAL_LABEL: Record<string, string> = { BREAKFAST: "Breakfast", LUNCH: "Lunch", SNACKS: "Snacks", DINNER: "Dinner" };
const CAT_COLORS: Record<string, string> = { FOOD: "#16a34a", RECYCLABLE: "#0284c7", REJECT: "#64748b" };

export default async function WasteAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["ADMIN", "MESS_MANAGER", "WASTE_MANAGER"]);
  const sp = await searchParams;
  const to = sp.to ? startOfDay(new Date(sp.to)) : startOfDay(new Date());
  const from = sp.from ? startOfDay(new Date(sp.from)) : addDays(to, -29);
  const mealFilter = sp.meal ?? "ALL";
  const categoryFilter = sp.category ?? "ALL";
  const locationFilter = sp.location ?? "ALL";
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);

  const [breakdown, series, dishStats, wastePreds, settings, meals, outputs] = await Promise.all([
    getWasteBreakdown({ from, to, mealType: mealFilter, category: categoryFilter, location: locationFilter }),
    // The daily-by-category series always breaks waste down by category, so only
    // the meal and location filters apply to it — that keeps it consistent with
    // the KPI cards above, which use the same meal/location scope.
    getDailyWasteSeries(days, to, {
      ...(mealFilter !== "ALL" ? { mealType: mealFilter } : {}),
      ...(locationFilter !== "ALL" ? { location: locationFilter } : {}),
    }),
    getDishWasteStats(days, to),
    getWastePredictionAccuracy(days, to),
    getSettings(),
    // Meals consumed must use the same meal scope as the waste numerator, or
    // "waste per meal" divides one meal's waste by every meal's servings.
    prisma.meal.findMany({
      where: { date: { gte: from, lte: to }, ...(mealFilter !== "ALL" ? { mealType: mealFilter } : {}) },
    }),
    prisma.treatmentOutput.aggregate({ _sum: { quantity: true } }),
  ]);

  const mealsConsumed = meals.reduce((a, m) => a + (m.actualConsumption ?? 0), 0);
  const foodWaste = breakdown.byCategory.FOOD ?? 0;
  const reject = breakdown.byCategory.REJECT ?? 0;
  const total = breakdown.total;
  const avoidable = (breakdown.bySub.PLATE ?? 0) + (breakdown.bySub.UNSERVED ?? 0) + (breakdown.bySub.KITCHEN ?? 0);

  const wastePerStudent = mealsConsumed > 0 ? foodWaste / mealsConsumed : 0;
  const diversionRate = total > 0 ? ((total - reject) / total) * 100 : 0;
  const recoveryTarget = settingNumber(settings, "compost_yield_max_pct", 30);

  const catDonut = WASTE_CATEGORIES.map((c) => ({
    name: c,
    value: Math.round((breakdown.byCategory[c] ?? 0) * 10) / 10,
    color: CAT_COLORS[c],
  })).filter((d) => d.value > 0);

  const mealBars = MEAL_TYPES.map((m) => ({ name: MEAL_LABEL[m], value: Math.round((breakdown.byMeal[m] ?? 0) * 10) / 10 }));
  const locationBars = Object.entries(breakdown.byLocation)
    .map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 }))
    .sort((a, b) => b.value - a.value);
  const dishBars = dishStats
    .slice(0, 8)
    .map((d) => ({ name: d.name, waste: d.totalLeftoverKg, baseline: Math.round(d.baselinePct * 10) / 10 }));

  const pvWaste = wastePreds.map((p) => ({
    date: p.date.slice(5),
    Expected: Math.round(p.expected * 10) / 10,
    Actual: Math.round(p.actual * 10) / 10,
  }));

  const avgVariance = wastePreds.length ? mean(wastePreds.map((p) => p.variancePct)) : 0;
  const overPredictionCount = wastePreds.filter((p) => p.variancePct >= 25).length;

  return (
    <div>
      <PageHeader
        title="Waste analytics"
        description="Filter by date, meal, category and location. Every metric is defined transparently and derived from stored waste records."
      />

      <Flash error={sp.error} ok={sp.ok} />

      <Card className="mb-5">
        <CardBody className="py-4">
          <form className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-ink-500">From</label>
              <Input type="date" name="from" defaultValue={toISODate(from)} className="h-9 w-36 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-ink-500">To</label>
              <Input type="date" name="to" defaultValue={toISODate(to)} className="h-9 w-36 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-ink-500">Meal</label>
              <Select name="meal" defaultValue={mealFilter} className="h-9 w-28 text-xs">
                <option value="ALL">All</option>
                {MEAL_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {MEAL_LABEL[m]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-ink-500">Category</label>
              <Select name="category" defaultValue={categoryFilter} className="h-9 w-32 text-xs">
                <option value="ALL">All</option>
                {WASTE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-ink-500">Location</label>
              <Select name="location" defaultValue={locationFilter} className="h-9 w-36 text-xs">
                <option value="ALL">All</option>
                {LOCATIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <SubmitButton variant="secondary">Apply filters</SubmitButton>
          </form>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total waste" value={num(total, 1)} unit="kg" />
        <Stat label="Food waste" value={num(foodWaste, 1)} unit="kg" tone="warning" />
        <Stat label="Avoidable food waste" value={num(avoidable, 1)} unit="kg" hint="plate + unserved + kitchen" />
        <Stat label="Waste per meal" value={num(wastePerStudent * 1000, 1)} unit="g" hint={`${num(mealsConsumed)} meals`} />
        <Stat label="Diversion rate" value={`${diversionRate.toFixed(1)}%`} tone="brand" hint="diverted from disposal" />
        <Stat label="Reject waste" value={num(reject, 1)} unit="kg" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily waste by category</CardTitle>
            <span className="text-[11px] text-ink-400">
              {days} day(s)
              {mealFilter !== "ALL" ? ` · ${mealFilter.toLowerCase()}` : ""}
              {locationFilter !== "ALL" ? ` · ${locationFilter}` : ""}
            </span>
          </CardHeader>
          <CardBody className="pt-3">
            <TrendChart
              data={series.map((s) => ({ date: s.date.slice(5), Food: s.food, Recyclable: s.recyclable, Reject: s.reject }))}
              xKey="date"
              area
              unit=" kg"
              series={[
                { key: "Food", label: "Food", color: "#16a34a" },
                { key: "Recyclable", label: "Recyclable", color: "#0ea5e9" },
                { key: "Reject", label: "Reject", color: "#64748b" },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Waste by category</CardTitle>
          </CardHeader>
          <CardBody className="pt-3">
            <DonutChart data={catDonut} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Waste by meal</CardTitle>
          </CardHeader>
          <CardBody className="pt-3">
            <BarsChart data={mealBars} xKey="name" unit=" kg" series={[{ key: "value", label: "Waste (kg)", color: "#16a34a" }]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Waste by location</CardTitle>
          </CardHeader>
          <CardBody className="pt-3">
            <BarsChart data={locationBars} xKey="name" unit=" kg" series={[{ key: "value", label: "Waste (kg)", color: "#0ea5e9" }]} horizontal height={240} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Predicted vs actual food waste</CardTitle>
            <Badge variant={avgVariance >= 25 ? "danger" : avgVariance >= 0 ? "warning" : "success"}>
              avg variance {avgVariance > 0 ? "+" : ""}
              {avgVariance.toFixed(1)}%
            </Badge>
          </CardHeader>
          <CardBody className="pt-3">
            <TrendChart
              data={pvWaste}
              xKey="date"
              unit=" kg"
              series={[
                { key: "Expected", label: "Expected", color: "#6366f1" },
                { key: "Actual", label: "Actual", color: "#dc2626" },
              ]}
            />
            <p className="mt-2 text-[11px] text-ink-500">
              {overPredictionCount} of {wastePreds.length} meals exceeded the expected waste by 25% or more.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dish-level waste (leftover kg)</CardTitle>
          </CardHeader>
          <CardBody className="pt-3">
            <BarsChart data={dishBars} xKey="name" unit=" kg" series={[{ key: "waste", label: "Leftover (kg)", color: "#f59e0b" }]} horizontal height={260} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>High-waste dishes</CardTitle>
          <span className="text-[11px] text-ink-400">flagged only on repeated exceedance of the dish&apos;s own baseline</span>
        </CardHeader>
        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th>Dish</Th>
                <Th>Category</Th>
                <Th className="text-right">Occurrences</Th>
                <Th className="text-right">Avg waste %</Th>
                <Th className="text-right">Baseline %</Th>
                <Th className="text-right">Exceeded</Th>
                <Th className="text-right">Total leftover</Th>
                <Th>Assessment</Th>
              </tr>
            </thead>
            <tbody>
              {dishStats.slice(0, 12).map((d) => {
                const chronic = d.occurrences >= 5 && d.exceedances >= 4;
                const watch = d.occurrences >= 5 && d.exceedances >= 2 && !chronic;
                return (
                  <Tr key={d.dishId}>
                    <Td className="font-medium text-ink-800">{d.name}</Td>
                    <Td>
                      <Badge>{d.category}</Badge>
                    </Td>
                    <Td className="text-right tabular-nums">{d.occurrences}</Td>
                    <Td className="text-right tabular-nums">{d.avgWastePct.toFixed(1)}%</Td>
                    <Td className="text-right tabular-nums text-ink-500">{d.baselinePct.toFixed(1)}%</Td>
                    <Td className="text-right tabular-nums">
                      {d.exceedances}/{d.occurrences}
                    </Td>
                    <Td className="text-right tabular-nums">{num(d.totalLeftoverKg, 1)} kg</Td>
                    <Td>
                      {chronic ? (
                        <Badge variant="danger">Consistently high — review portion or frequency</Badge>
                      ) : watch ? (
                        <Badge variant="warning">Watch</Badge>
                      ) : (
                        <Badge variant="success">Within baseline</Badge>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </div>
        <CardBody className="pt-3 text-[11px] text-ink-500">
          Possible actions for flagged dishes: reduce preparation quantity, review portion size, review the recipe or quality,
          collect student feedback, or change menu frequency. WasteWise does not attribute a cause (such as taste) without
          supporting data.
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>KPI definitions</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-2 text-[11px] text-ink-600 sm:grid-cols-2">
          <p><strong>Avoidable waste:</strong> {settings.avoidable_definition}</p>
          <p><strong>Waste per meal:</strong> food waste ÷ meals consumed (shown in grams).</p>
          <p><strong>Diversion rate:</strong> (total waste − reject) ÷ total waste × 100.</p>
          <p><strong>Treatment recovery:</strong> useful output ÷ treatment input (target yield ≈ {recoveryTarget}%).</p>
          <p><strong>Rejected from treatment:</strong> {num(reject, 1)} kg contaminated/non-recoverable material.</p>
          <p><strong>Output generated to date:</strong> {num(outputs._sum.quantity ?? 0, 0)} units across all batches.</p>
        </CardBody>
      </Card>
    </div>
  );
}
