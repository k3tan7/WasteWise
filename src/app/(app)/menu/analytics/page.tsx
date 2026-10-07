import Link from "next/link";
import { AlertTriangle, BarChart3, CheckCircle2, Info, TrendingDown, TrendingUp } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { buildMenuAnalytics, incompleteRecipes } from "@/lib/services/dish-analytics";
import { DISH_CATEGORY_LABELS } from "@/lib/constants";
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader, ProgressBar, Stat, Table, Td, Th, Tr } from "@/components/ui";
import { BarsChart, TrendChart } from "@/components/charts";
import { num } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Menu Analytics" };

const MEAL_LABEL: Record<string, string> = { BREAKFAST: "Breakfast", LUNCH: "Lunch", SNACKS: "Snacks", DINNER: "Dinner" };

export default async function MenuAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["ADMIN", "MESS_MANAGER"]);
  const sp = await searchParams;
  const days = [7, 14, 30, 60].includes(Number(sp.days)) ? Number(sp.days) : 30;

  const [a, incomplete] = await Promise.all([buildMenuAnalytics(days), incompleteRecipes()]);

  const mealChart = a.wasteByMealType.map((m) => ({
    meal: MEAL_LABEL[m.mealType] ?? m.mealType,
    Plate: m.plateKg,
    Unserved: m.unservedKg,
    Kitchen: m.kitchenKg,
  }));

  const trendChart = a.weeklyTrend.map((t) => ({ date: t.date.slice(5), Waste: t.plateKg }));
  const demandChart = a.demandAccuracy.map((d) => ({ meal: MEAL_LABEL[d.mealType] ?? d.mealType, Predicted: d.predicted, Actual: d.actual }));
  const wasteChart = a.wasteAccuracy.map((d) => ({ meal: MEAL_LABEL[d.mealType] ?? d.mealType, Predicted: d.predicted, Actual: d.actual }));

  const topWaste = a.wasteByDish.slice(0, 10).map((d) => ({ name: d.name.length > 16 ? d.name.slice(0, 15) + "…" : d.name, Leftover: d.leftoverKg }));

  if (a.observations === 0) {
    return (
      <div>
        <PageHeader title="Menu analytics" description="Dish-level consumption and waste performance, computed from recorded history." />
        <Card className="mt-6">
          <EmptyState icon={<BarChart3 className="h-8 w-8" />} title="No meal history yet" description="Complete a few meals and dish analytics will appear here." />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Menu analytics"
        description={`How the Rishihood menu actually performs. Every figure is computed from ${a.observations.toLocaleString()} recorded dish observations between ${a.from} and ${a.to} — nothing is hardcoded.`}
        actions={
          <div className="flex gap-1">
            {[7, 14, 30, 60].map((d) => (
              <Link
                key={d}
                href={`/menu/analytics?days=${d}`}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${days === d ? "bg-ink-900 text-white" : "bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50"}`}
              >
                {d}d
              </Link>
            ))}
          </div>
        }
      />

      {/* Recipe completeness — the gate that protects purchasing */}
      <Card className={incomplete.length ? "border-amber-200 bg-amber-50/40" : "border-brand-100"}>
        <CardBody className="flex flex-wrap items-center gap-3 py-3">
          {incomplete.length === 0 ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-brand-600" />
              <p className="text-xs text-ink-700">
                <strong>All recipes complete.</strong> Every dish on the menu has ingredients, quantities, units, a yield and an
                inventory link — purchasing calculations can be finalised.
              </p>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-xs text-amber-800">
                <strong>Recipe incomplete — purchasing calculation cannot be finalised</strong> for {incomplete.length} dish(es):{" "}
                {incomplete.slice(0, 5).map((d) => d.name).join(", ")}
                {incomplete.length > 5 ? ` and ${incomplete.length - 5} more` : ""}.
              </p>
            </>
          )}
        </CardBody>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Dishes on the menu" value={a.dishCount} hint="complete recipes" />
        <Stat label="Dish observations" value={num(a.observations)} hint={`last ${days} days`} />
        <Stat
          label="Average plate waste"
          value={`${(a.wasteByDish.reduce((s, d) => s + d.avgWastePct, 0) / Math.max(1, a.wasteByDish.length)).toFixed(1)}%`}
          hint="per dish served"
        />
        <Stat
          label="Total leftover"
          value={num(a.wasteByDish.reduce((s, d) => s + d.leftoverKg, 0), 0)}
          unit="kg"
          tone="warning"
        />
      </div>

      {/* Insights */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Insights from the menu history</CardTitle>
          <Badge variant="info">{a.insights.length} generated from data</Badge>
        </CardHeader>
        <CardBody className="space-y-3 pt-3">
          {a.insights.length === 0 && <p className="text-xs text-ink-400">No repeated-observation patterns detected yet.</p>}
          {a.insights.map((i, idx) => (
            <div key={idx} className="flex gap-3 rounded-xl bg-ink-50 px-4 py-3 ring-1 ring-ink-100">
              {i.tone === "warning" ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              ) : i.tone === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              ) : (
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              )}
              <div>
                <p className="text-xs font-semibold text-ink-800">{i.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">{i.detail}</p>
                {i.action && <p className="mt-1 text-[11px] font-medium text-brand-700">→ {i.action}</p>}
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* Predicted vs actual */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Predicted vs actual consumption</CardTitle>
            <Badge variant="info">servings per meal</Badge>
          </CardHeader>
          <CardBody className="pt-3">
            <BarsChart data={demandChart} xKey="meal" series={[{ key: "Predicted", color: "#64748b", label: "Predicted" }, { key: "Actual", color: "#16a34a", label: "Actual" }]} height={220} />
            <Table className="mt-3">
              <thead>
                <tr>
                  <Th>Meal</Th>
                  <Th className="text-right">Predicted</Th>
                  <Th className="text-right">Actual</Th>
                  <Th className="text-right">MAE</Th>
                  <Th className="text-right">Bias</Th>
                </tr>
              </thead>
              <tbody>
                {a.demandAccuracy.map((d) => (
                  <Tr key={d.mealType}>
                    <Td className="text-xs">{MEAL_LABEL[d.mealType]}</Td>
                    <Td className="text-right tabular-nums">{num(d.predicted)}</Td>
                    <Td className="text-right tabular-nums">{num(d.actual)}</Td>
                    <Td className="text-right tabular-nums">{d.mae}</Td>
                    <Td className={`text-right tabular-nums ${Math.abs(d.biasPct) > 5 ? "text-amber-600" : "text-brand-700"}`}>
                      {d.biasPct > 0 ? "+" : ""}
                      {d.biasPct}%
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Predicted vs actual waste</CardTitle>
            <Badge variant="info">kg per meal</Badge>
          </CardHeader>
          <CardBody className="pt-3">
            <BarsChart data={wasteChart} xKey="meal" series={[{ key: "Predicted", color: "#64748b", label: "Predicted" }, { key: "Actual", color: "#dc2626", label: "Actual" }]} height={220} unit=" kg" />
            <Table className="mt-3">
              <thead>
                <tr>
                  <Th>Meal</Th>
                  <Th className="text-right">Predicted</Th>
                  <Th className="text-right">Actual</Th>
                  <Th className="text-right">MAE</Th>
                  <Th className="text-right">Bias</Th>
                </tr>
              </thead>
              <tbody>
                {a.wasteAccuracy.map((d) => (
                  <Tr key={d.mealType}>
                    <Td className="text-xs">{MEAL_LABEL[d.mealType]}</Td>
                    <Td className="text-right tabular-nums">{d.predicted} kg</Td>
                    <Td className="text-right tabular-nums">{d.actual} kg</Td>
                    <Td className="text-right tabular-nums">{d.mae} kg</Td>
                    <Td className={`text-right tabular-nums ${Math.abs(d.biasPct) > 15 ? "text-red-600" : "text-brand-700"}`}>
                      {d.biasPct > 0 ? "+" : ""}
                      {d.biasPct}%
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </div>

      {/* Waste breakdown */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Waste by meal type</CardTitle>
          </CardHeader>
          <CardBody className="pt-3">
            <BarsChart
              data={mealChart}
              xKey="meal"
              stacked
              series={[
                { key: "Plate", color: "#f59e0b", label: "Plate" },
                { key: "Unserved", color: "#dc2626", label: "Unserved" },
                { key: "Kitchen", color: "#64748b", label: "Kitchen" },
              ]}
              height={220}
              unit=" kg"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily food waste trend</CardTitle>
            <Badge variant="info">last {days} days</Badge>
          </CardHeader>
          <CardBody className="pt-3">
            <TrendChart data={trendChart} xKey="date" area series={[{ key: "Waste", color: "#16a34a", label: "Waste" }]} height={220} unit=" kg" />
          </CardBody>
        </Card>
      </div>

      {/* Dish rankings */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-600" /> Most consumed
            </CardTitle>
          </CardHeader>
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Dish</Th>
                  <Th className="text-right">Servings</Th>
                </tr>
              </thead>
              <tbody>
                {a.mostConsumed.map((d) => (
                  <Tr key={d.dishId}>
                    <Td className="text-xs font-medium text-ink-800">{d.name}</Td>
                    <Td className="text-right tabular-nums">{num(d.servingsConsumed)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-ink-400" /> Least consumed
            </CardTitle>
          </CardHeader>
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Dish</Th>
                  <Th className="text-right">Servings</Th>
                </tr>
              </thead>
              <tbody>
                {a.leastConsumed.map((d) => (
                  <Tr key={d.dishId}>
                    <Td className="text-xs font-medium text-ink-800">{d.name}</Td>
                    <Td className="text-right tabular-nums">{num(d.servingsConsumed)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most frequently served</CardTitle>
          </CardHeader>
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Dish</Th>
                  <Th>Category</Th>
                  <Th className="text-right">Times</Th>
                </tr>
              </thead>
              <tbody>
                {a.mostFrequent.map((d) => (
                  <Tr key={d.name}>
                    <Td className="text-xs font-medium text-ink-800">{d.name}</Td>
                    <Td className="text-[11px] text-ink-500">{DISH_CATEGORY_LABELS[d.category] ?? d.category}</Td>
                    <Td className="text-right tabular-nums">{d.occurrences}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Waste by dish */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Highest-waste dishes</CardTitle>
            <Badge variant="warning">avg plate waste %</Badge>
          </CardHeader>
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Dish</Th>
                  <Th className="text-right">Avg waste</Th>
                  <Th className="text-right">Leftover</Th>
                  <Th className="text-right">Above baseline</Th>
                </tr>
              </thead>
              <tbody>
                {a.highestWaste.map((d) => (
                  <Tr key={d.dishId}>
                    <Td className="text-xs font-medium text-ink-800">
                      {d.name}
                      <span className="ml-1 text-[10px] text-ink-400">· {DISH_CATEGORY_LABELS[d.category] ?? d.category}</span>
                    </Td>
                    <Td className="text-right tabular-nums">{d.avgWastePct}%</Td>
                    <Td className="text-right tabular-nums">{num(d.leftoverKg, 1)} kg</Td>
                    <Td className="text-right tabular-nums text-[11px] text-ink-500">
                      {d.aboveBaselineLast8}/{d.last8.length} recent
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lowest-waste dishes</CardTitle>
            <Badge variant="success">efficient</Badge>
          </CardHeader>
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Dish</Th>
                  <Th className="text-right">Avg waste</Th>
                  <Th className="text-right">Servings</Th>
                  <Th className="text-right">Cost/serving</Th>
                </tr>
              </thead>
              <tbody>
                {a.lowestWaste.map((d) => (
                  <Tr key={d.dishId}>
                    <Td className="text-xs font-medium text-ink-800">{d.name}</Td>
                    <Td className="text-right tabular-nums text-brand-700">{d.avgWastePct}%</Td>
                    <Td className="text-right tabular-nums">{num(d.servingsConsumed)}</Td>
                    <Td className="text-right tabular-nums">₹{d.costPerServing.toFixed(1)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Waste by dish chart + day-of-week patterns */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Waste by individual dish</CardTitle>
            <Badge variant="info">top 10 leftover</Badge>
          </CardHeader>
          <CardBody className="pt-3">
            <BarsChart data={topWaste} xKey="name" horizontal series={[{ key: "Leftover", color: "#f59e0b", label: "Leftover" }]} height={300} unit=" kg" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dish performance over time</CardTitle>
            <Badge variant="info">last occurrences</Badge>
          </CardHeader>
          <CardBody className="pt-3">
            <p className="mb-2 text-[11px] text-ink-400">
              Plate waste % against each dish&apos;s own baseline. A dish is only treated as a problem when it exceeds its
              baseline repeatedly, not from one bad service.
            </p>
            <div className="space-y-3">
              {a.highestWaste.slice(0, 5).map((d) => (
                <div key={d.dishId}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-ink-700">{d.name}</span>
                    <span className="tabular-nums text-ink-400">
                      baseline {d.baselinePct}% · {d.aboveBaselineLast8}/{d.last8.length} recent above
                    </span>
                  </div>
                  <div className="mt-1 flex gap-1">
                    {d.last8.map((o, i) => (
                      <span
                        key={i}
                        title={`${o.date} ${o.mealType}: ${o.wastePct}% waste`}
                        className={`h-6 flex-1 rounded ${o.wastePct > d.baselinePct * 1.08 && o.wastePct > d.baselinePct + 1.5 ? "bg-red-400" : "bg-brand-300"}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {a.dayOfWeekPatterns.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Day-of-week consumption patterns</CardTitle>
            <Badge variant="info">≥15% above a dish&apos;s usual draw</Badge>
          </CardHeader>
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Dish</Th>
                  <Th>Day</Th>
                  <Th className="text-right">Avg servings</Th>
                  <Th className="text-right">Overall avg</Th>
                  <Th>Ratio</Th>
                </tr>
              </thead>
              <tbody>
                {a.dayOfWeekPatterns.map((p, i) => (
                  <Tr key={i}>
                    <Td className="text-xs font-medium text-ink-800">{p.dish}</Td>
                    <Td className="text-xs">{p.day}</Td>
                    <Td className="text-right tabular-nums">{num(p.avgServings)}</Td>
                    <Td className="text-right tabular-nums text-ink-500">{num(p.overall)}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <ProgressBar value={Math.min(100, (p.ratio / 2) * 100)} />
                        <span className="text-[11px] tabular-nums text-ink-600">{p.ratio}×</span>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
