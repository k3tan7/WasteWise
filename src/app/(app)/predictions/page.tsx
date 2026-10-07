import { Info, Sparkles, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getDemandAccuracy } from "@/lib/analytics";
import { forecastMeal } from "@/lib/services/forecast";
import { generateAllPredictions } from "@/actions/meals";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  ProgressBar,
  Stat,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { Flash, SubmitButton } from "@/components/form-ui";
import { TrendChart } from "@/components/charts";
import { num, startOfDay, toISODate } from "@/lib/utils";
import { MEAL_TYPES } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demand Prediction" };

const MEAL_LABEL: Record<string, string> = { BREAKFAST: "Breakfast", LUNCH: "Lunch", SNACKS: "Snacks", DINNER: "Dinner" };

export default async function PredictionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["ADMIN", "MESS_MANAGER"]);
  const sp = await searchParams;
  const date = sp.date ? startOfDay(new Date(sp.date)) : startOfDay(new Date());
  const dateISO = toISODate(date);

  const forecasts = await Promise.all(MEAL_TYPES.map((m) => forecastMeal(date, m)));
  const [predictedRows, accuracy14, accuracy30] = await Promise.all([
    prisma.mealPrediction.findMany({ where: { date }, orderBy: { mealType: "asc" } }),
    getDemandAccuracy(14, date),
    getDemandAccuracy(30, date),
  ]);

  const demandChart = Object.values(
    accuracy14.rows.reduce<Record<string, { date: string; Predicted: number; Actual: number }>>((acc, r) => {
      const e = acc[r.date] ?? { date: r.date.slice(5), Predicted: 0, Actual: 0 };
      e.Predicted += r.predicted;
      e.Actual += r.actual;
      acc[r.date] = e;
      return acc;
    }, {})
  );

  const errorChart = accuracy14.rows.map((r) => ({
    date: r.date.slice(5),
    Error: Number(r.error.toFixed(0)),
  }));

  const totalPredicted = forecasts.reduce((a, f) => a + f.predicted, 0);
  const totalRecommended = forecasts.reduce((a, f) => a + f.recommendedPrep, 0);

  return (
    <div>
      <PageHeader
        title="Demand prediction"
        description="A deterministic weighted-history model forecasts diners per meal using attendance, day-of-week, trends, menu and events. Every prediction is stored and scored against actuals."
        actions={
          <>
            <form className="flex items-center gap-2">
              <Input type="date" name="date" defaultValue={dateISO} className="h-9 w-40 text-xs" />
              <SubmitButton variant="secondary">View</SubmitButton>
            </form>
            <form action={generateAllPredictions}>
              <input type="hidden" name="redirectTo" value={`/predictions?date=${dateISO}`} />
              <input type="hidden" name="date" value={dateISO} />
              <SubmitButton pendingLabel="Forecasting…">
                <Sparkles className="h-3.5 w-3.5" /> Generate forecasts
              </SubmitButton>
            </form>
          </>
        }
      />

      <Flash error={sp.error} ok={sp.ok} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Predicted total diners" value={num(totalPredicted)} hint="all meals" />
        <Stat label="Recommended preparation" value={num(totalRecommended)} tone="brand" />
        <Stat label="Forecast accuracy (14d)" value={`${accuracy14.accuracy.toFixed(1)}%`} tone={accuracy14.accuracy >= 90 ? "brand" : "warning"} />
        <Stat label="Mean abs error (14d)" value={num(accuracy14.mae)} hint={`${accuracy14.count} scored meals`} />
      </div>

      {/* Forecast cards */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {forecasts.map((f) => {
          const stored = predictedRows.find((p) => p.mealType === f.mealType);
          const actual = stored?.actualConsumption ?? null;
          const error = actual != null ? actual - f.predicted : null;
          return (
            <Card key={f.mealType}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>{MEAL_LABEL[f.mealType]}</CardTitle>
                  {f.stored ? <Badge variant="info">stored</Badge> : <Badge>live forecast</Badge>}
                </div>
                <Badge variant={f.confidence >= 0.85 ? "success" : f.confidence >= 0.7 ? "warning" : "danger"}>
                  {(f.confidence * 100).toFixed(0)}% confidence
                </Badge>
              </CardHeader>
              <CardBody className="pt-3">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-ink-400">Predicted demand</p>
                    <p className="text-xl font-semibold tabular-nums text-ink-900">{num(f.predicted)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-ink-400">Recommended prep</p>
                    <p className="text-xl font-semibold tabular-nums text-brand-700">{num(f.recommendedPrep)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-ink-400">Prediction range</p>
                    <p className="text-sm font-medium tabular-nums text-ink-700">
                      {num(f.rangeLow)}–{num(f.rangeHigh)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-ink-400">Actual</p>
                    <p className="text-xl font-semibold tabular-nums text-ink-900">{actual != null ? num(actual) : "—"}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[10px] text-ink-400">
                    <span>Confidence</span>
                    <span>{f.factors.length ? "model factors below" : "stored prediction"}</span>
                  </div>
                  <ProgressBar value={f.confidence * 100} tone={f.confidence >= 0.85 ? "brand" : "warning"} />
                </div>

                {error != null && (
                  <p className="mt-3 text-xs text-ink-600">
                    Forecast error:{" "}
                    <span className={error < 0 ? "font-medium text-red-600" : "font-medium text-brand-700"}>
                      {error > 0 ? "+" : ""}
                      {num(error)} diners
                    </span>{" "}
                    ({f.predicted > 0 ? ((error / f.predicted) * 100).toFixed(1) : "0"}%). The actual has been stored to improve
                    future forecasts.
                  </p>
                )}

                {f.factors.length > 0 && (
                  <details className="mt-3 rounded-lg border border-ink-200 p-2">
                    <summary className="cursor-pointer text-[11px] font-medium text-ink-600">
                      How this forecast was calculated
                    </summary>
                    <div className="mt-2 space-y-1.5">
                      {f.factors.map((f2, i) => (
                        <div key={i} className="flex items-start justify-between gap-3 text-[11px]">
                          <span className="text-ink-600">{f2.name}</span>
                          <span className="text-right text-ink-500">
                            <span className="font-medium text-ink-800">{f2.value}</span> · {f2.note}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Accuracy */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Predicted vs actual demand</CardTitle>
            <span className="text-[11px] text-ink-400">last 14 days</span>
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
        <Card>
          <CardHeader>
            <CardTitle>Forecast error per meal</CardTitle>
            <span className="text-[11px] text-ink-400">actual − predicted</span>
          </CardHeader>
          <CardBody className="pt-3">
            <TrendChart data={errorChart} xKey="date" series={[{ key: "Error", label: "Error (diners)", color: "#ef4444" }]} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Learning loop — recent scored predictions</CardTitle>
          <Badge variant={accuracy30.accuracy >= 90 ? "success" : "warning"}>30-day accuracy {accuracy30.accuracy.toFixed(1)}%</Badge>
        </CardHeader>
        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Meal</Th>
                <Th className="text-right">Predicted</Th>
                <Th className="text-right">Actual</Th>
                <Th className="text-right">Error</Th>
                <Th className="text-right">Error %</Th>
                <Th className="text-right">Confidence</Th>
              </tr>
            </thead>
            <tbody>
              {accuracy30.rows.slice(-12).reverse().map((r, i) => (
                <Tr key={i}>
                  <Td>{r.date}</Td>
                  <Td>{MEAL_LABEL[r.mealType] ?? r.mealType}</Td>
                  <Td className="text-right tabular-nums">{num(r.predicted)}</Td>
                  <Td className="text-right tabular-nums">{num(r.actual)}</Td>
                  <Td className={`text-right tabular-nums ${r.error < 0 ? "text-red-600" : "text-brand-700"}`}>
                    {r.error > 0 ? "+" : ""}
                    {num(r.error)}
                  </Td>
                  <Td className="text-right tabular-nums">{r.absErrorPct.toFixed(1)}%</Td>
                  <Td className="text-right tabular-nums">{(r.confidence * 100).toFixed(0)}%</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
        <CardBody className="pt-0">
          <p className="flex items-start gap-2 text-[11px] text-ink-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Predictions are statistical estimates, not guarantees. Accuracy is the mean absolute percentage error between
            predicted and actual consumption. The model is designed to be replaced by a trained ML model later — each prediction
            stores its model name and inputs.
          </p>
        </CardBody>
      </Card>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-ink-400">
        <TrendingUp className="h-3.5 w-3.5" />
        Mean bias over 30 days: {accuracy30.bias > 0 ? "+" : ""}
        {num(accuracy30.bias)} diners ({accuracy30.bias > 0 ? "under-forecasting" : "over-forecasting"} on average).
      </div>
    </div>
  );
}
