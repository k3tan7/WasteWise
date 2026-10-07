import { Brain, Database, RefreshCw, Rocket, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { importanceOf, type AnyModel } from "@/lib/ml/registry";
import { regressionMetrics } from "@/lib/ml/metrics";
import { backfillPredictionsAction, trainModelsAction } from "@/actions/models";
import { Badge, Card, CardBody, CardHeader, CardTitle, Input, PageHeader, Stat, Table, Td, Th, Tr } from "@/components/ui";
import { Flash, SubmitButton } from "@/components/form-ui";
import { BarsChart } from "@/components/charts";
import { fmtDate, num } from "@/lib/utils";
import type { RegressionMetrics } from "@/lib/ml/metrics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Model Performance" };

const KIND_LABEL: Record<string, string> = { DEMAND: "Meal demand", WASTE: "Food waste" };
const ALGO_LABEL: Record<string, string> = { LINEAR: "Ridge linear regression", RANDOM_FOREST: "Random forest" };

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["ADMIN", "MESS_MANAGER"]);
  const sp = await searchParams;

  const [models, predictions] = await Promise.all([
    prisma.mlModel.findMany({ orderBy: [{ trainedAt: "desc" }, { kind: "asc" }] }),
    prisma.mlPrediction.findMany({ orderBy: [{ date: "desc" }], take: 200, include: { model: true } }),
  ]);

  const active = ["DEMAND", "WASTE"].map((kind) => models.find((m) => m.kind === kind && m.isActive)).filter(Boolean) as typeof models;

  // Live scoring from stored predictions (prediction → actual → error).
  function scoredFor(kind: string) {
    const rows = predictions.filter((p) => p.kind === kind && p.actual != null);
    const m = regressionMetrics(
      rows.map((r) => r.actual as number),
      rows.map((r) => r.predicted)
    );
    return { m, rows: rows.length };
  }
  const demandScore = scoredFor("DEMAND");
  const wasteScore = scoredFor("WASTE");

  const recentScored = predictions.filter((p) => p.actual != null).slice(0, 12);

  const demoOnly = models.length === 0 || models.every((m) => m.dataSource === "demo");

  return (
    <div>
      <PageHeader
        title="Model performance"
        description="WasteWise trains regression models on your own meal history. Demand is predicted by one model and food waste by another; both are versioned, evaluated on held-out data, and continuously re-scored against actuals."
        actions={
          <>
            <form action={trainModelsAction}>
              <input type="hidden" name="redirectTo" value="/models" />
              <input type="hidden" name="kind" value="BOTH" />
              <SubmitButton pendingLabel="Training…">
                <RefreshCw className="h-3.5 w-3.5" /> Retrain both models
              </SubmitButton>
            </form>
            <form action={backfillPredictionsAction} className="flex items-center gap-2">
              <input type="hidden" name="redirectTo" value="/models" />
              <Input name="days" type="number" min={1} max={30} defaultValue={7} className="h-9 w-16 text-xs" />
              <SubmitButton variant="secondary" pendingLabel="Scoring…">
                <Rocket className="h-3.5 w-3.5" /> Re-score last N days
              </SubmitButton>
            </form>
          </>
        }
      />

      <Flash error={sp.error} ok={sp.ok} />

      {demoOnly && (
        <Card className="mb-6 border-amber-200 bg-amber-50/60">
          <CardBody className="flex items-start gap-3 py-4">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-xs font-semibold text-amber-800">Demo campus dataset</p>
              <p className="mt-0.5 text-[11px] text-amber-700">
                These models are trained on the seeded demo campus data (Rishihood University: 2,500 residential students + 200 staff, 30 days of meals and the full menu rotation). They will retrain
                automatically as real campus data replaces it — every model row records its data source so demo and live metrics
                are never mixed up. Metrics shown are from a held-out, time-ordered test split; they are honest estimates, not
                guarantees.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Active models */}
      <div className="grid gap-6 lg:grid-cols-2">
        {["DEMAND", "WASTE"].map((kind) => {
          const row = active.find((m) => m.kind === kind);
          if (!row) {
            return (
              <Card key={kind}>
                <CardHeader>
                  <CardTitle className="inline-flex items-center gap-2">
                    <Brain className="h-4 w-4 text-ink-400" /> {KIND_LABEL[kind]} model
                  </CardTitle>
                  <Badge variant="warning">Not trained</Badge>
                </CardHeader>
                <CardBody className="pt-2">
                  <p className="text-xs text-ink-500">
                    No active model for this task yet. Complete some meals, then retrain — the model needs at least ~16 scored
                    meals.
                  </p>
                  <form action={trainModelsAction} className="mt-3">
                    <input type="hidden" name="redirectTo" value="/models" />
                    <input type="hidden" name="kind" value={kind} />
                    <SubmitButton variant="secondary" size="sm" pendingLabel="Training…">
                      Train {KIND_LABEL[kind].toLowerCase()} model
                    </SubmitButton>
                  </form>
                </CardBody>
              </Card>
            );
          }
          const metrics = JSON.parse(row.metrics) as RegressionMetrics;
          const model = JSON.parse(row.artifact) as AnyModel;
          const importance = importanceOf(model);
          const score = kind === "DEMAND" ? demandScore : wasteScore;

          return (
            <Card key={kind}>
              <CardHeader>
                <div>
                  <CardTitle className="inline-flex items-center gap-2">
                    <Brain className="h-4 w-4 text-brand-600" /> {KIND_LABEL[kind]} model
                  </CardTitle>
                  <p className="mt-1 text-[11px] text-ink-500">
                    {ALGO_LABEL[row.algorithm] ?? row.algorithm} · {row.version} · trained {fmtDate(row.trainedAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={row.dataSource === "demo" ? "warning" : "success"}>{row.dataSource} data</Badge>
                  <Badge variant="brand">{row.algorithm}</Badge>
                </div>
              </CardHeader>
              <CardBody className="pt-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-ink-50 p-2.5 text-center">
                    <p className="text-base font-semibold tabular-nums text-ink-900">{metrics.mae}</p>
                    <p className="text-[10px] uppercase tracking-wide text-ink-400">MAE</p>
                  </div>
                  <div className="rounded-xl bg-ink-50 p-2.5 text-center">
                    <p className="text-base font-semibold tabular-nums text-ink-900">{metrics.rmse}</p>
                    <p className="text-[10px] uppercase tracking-wide text-ink-400">RMSE</p>
                  </div>
                  <div className="rounded-xl bg-brand-50 p-2.5 text-center">
                    <p className="text-base font-semibold tabular-nums text-brand-700">{metrics.r2.toFixed(3)}</p>
                    <p className="text-[10px] uppercase tracking-wide text-brand-600">R²</p>
                  </div>
                  <div className="rounded-xl bg-ink-50 p-2.5 text-center">
                    <p className="text-base font-semibold tabular-nums text-ink-900">{metrics.mape}%</p>
                    <p className="text-[10px] uppercase tracking-wide text-ink-400">MAPE</p>
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-ink-500">
                  Evaluated on a held-out time-ordered test set of {row.testN} meals (trained on {row.trainN}). Unit:{" "}
                  {kind === "DEMAND" ? "diners" : "kg"}.
                </p>

                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] font-medium text-ink-600">Feature importance</p>
                  <BarsChart
                    data={importance.slice(0, 7).map((f) => ({ name: f.name.replace(/_/g, " "), importance: Number((f.weight * 100).toFixed(1)) }))}
                    xKey="name"
                    horizontal
                    height={220}
                    unit="%"
                    series={[{ key: "importance", label: "Importance", color: "#16a34a" }]}
                  />
                </div>

                <div className="mt-3 rounded-xl border border-ink-200 p-3">
                  <p className="text-[11px] font-medium text-ink-600">
                    Live scoring on {score.rows} stored prediction{score.rows === 1 ? "" : "s"}
                  </p>
                  <div className="mt-1.5 grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div>
                      <span className="font-semibold text-ink-800">{score.m.mae}</span>
                      <div className="text-ink-400">MAE</div>
                    </div>
                    <div>
                      <span className="font-semibold text-ink-800">{score.m.rmse}</span>
                      <div className="text-ink-400">RMSE</div>
                    </div>
                    <div>
                      <span className="font-semibold text-ink-800">{score.m.r2.toFixed(3)}</span>
                      <div className="text-ink-400">R²</div>
                    </div>
                  </div>
                  {score.rows === 0 && (
                    <p className="mt-1 text-[10px] text-ink-400">
                      No scored predictions yet — complete a meal after forecasting to close the loop.
                    </p>
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Learning loop */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Continuous learning — prediction → actual → error</CardTitle>
          <Badge variant="info">{predictions.filter((p) => p.actual != null).length} scored predictions</Badge>
        </CardHeader>
        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Task</Th>
                <Th>Meal</Th>
                <Th>Model</Th>
                <Th className="text-right">Predicted</Th>
                <Th className="text-right">Actual</Th>
                <Th className="text-right">Error</Th>
                <Th className="text-right">Within range?</Th>
              </tr>
            </thead>
            <tbody>
              {recentScored.length === 0 && (
                <Tr>
                  <Td colSpan={8} className="text-center text-xs text-ink-400">
                    No scored ML predictions yet. Forecast a meal, complete it, and the error will appear here.
                  </Td>
                </Tr>
              )}
              {recentScored.map((p) => (
                <Tr key={p.id}>
                  <Td className="text-xs text-ink-500">{fmtDate(p.date, { month: "short", day: "numeric" })}</Td>
                  <Td>
                    <Badge variant={p.kind === "DEMAND" ? "info" : "warning"}>{KIND_LABEL[p.kind]}</Badge>
                  </Td>
                  <Td className="text-xs">{p.mealType}</Td>
                  <Td className="font-mono text-[10px] text-ink-400">{p.model.version} · {p.model.algorithm}</Td>
                  <Td className="text-right tabular-nums">{num(p.predicted, 1)}</Td>
                  <Td className="text-right tabular-nums">{num(p.actual, 1)}</Td>
                  <Td className={`text-right tabular-nums ${(p.error ?? 0) < 0 ? "text-red-600" : "text-brand-700"}`}>
                    {(p.error ?? 0) > 0 ? "+" : ""}
                    {num(p.error, 1)}
                  </Td>
                  <Td className="text-right">
                    {p.actual != null && p.actual >= p.rangeLow && p.actual <= p.rangeHigh ? (
                      <Badge variant="success">yes</Badge>
                    ) : (
                      <Badge variant="neutral">no</Badge>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      {/* Version history */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Model version history</CardTitle>
          <span className="text-[11px] text-ink-400">both algorithms are persisted each run so they can be compared</span>
        </CardHeader>
        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th>Task</Th>
                <Th>Algorithm</Th>
                <Th>Version</Th>
                <Th className="text-right">MAE</Th>
                <Th className="text-right">RMSE</Th>
                <Th className="text-right">R²</Th>
                <Th className="text-right">Train / Test</Th>
                <Th>Data</Th>
                <Th>Trained</Th>
                <Th>Active</Th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const metrics = JSON.parse(m.metrics) as RegressionMetrics;
                return (
                  <Tr key={m.id}>
                    <Td className="text-xs">{KIND_LABEL[m.kind]}</Td>
                    <Td className="text-xs">{ALGO_LABEL[m.algorithm] ?? m.algorithm}</Td>
                    <Td className="font-mono text-xs">{m.version}</Td>
                    <Td className="text-right tabular-nums">{metrics.mae}</Td>
                    <Td className="text-right tabular-nums">{metrics.rmse}</Td>
                    <Td className="text-right tabular-nums">{metrics.r2.toFixed(3)}</Td>
                    <Td className="text-right tabular-nums text-ink-500">
                      {m.trainN} / {m.testN}
                    </Td>
                    <Td>
                      <Badge variant={m.dataSource === "demo" ? "warning" : "success"}>{m.dataSource}</Badge>
                    </Td>
                    <Td className="text-xs text-ink-500">{fmtDate(m.trainedAt, { month: "short", day: "numeric" })}</Td>
                    <Td>{m.isActive ? <Badge variant="brand">active</Badge> : <span className="text-[11px] text-ink-400">—</span>}</Td>
                  </Tr>
                );
              })}
              {models.length === 0 && (
                <Tr>
                  <Td colSpan={10} className="text-center text-xs text-ink-400">
                    No models trained yet. Click “Retrain both models”.
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Demand live MAE" value={num(demandScore.m.mae, 2)} hint="diners" />
        <Stat label="Waste live MAE" value={num(wasteScore.m.mae, 2)} hint="kg" />
        <Stat label="Demand R² (live)" value={demandScore.m.r2.toFixed(3)} tone={demandScore.m.r2 > 0.5 ? "brand" : "warning"} />
        <Stat label="Waste R² (live)" value={wasteScore.m.r2.toFixed(3)} tone={wasteScore.m.r2 > 0.5 ? "brand" : "warning"} />
      </div>

      <Card className="mt-6">
        <CardBody className="text-[11px] leading-relaxed text-ink-500">
          <p className="mb-2 inline-flex items-center gap-2 font-medium text-ink-700">
            <TrendingUp className="h-3.5 w-3.5" /> How the prediction pipeline works
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              <strong>Deterministic inventory maths</strong> (requirement × recipe − usable stock + safety) is used for purchasing
              — regression is deliberately not used where arithmetic is exact.
            </li>
            <li>
              <strong>Two regression models</strong> predict diners and expected food waste from engineered features (attendance,
              participation history, menu composition, day-of-week, preparation ratios, recent waste trends).
            </li>
            <li>
              <strong>Ridge linear regression</strong> is the interpretable baseline; a <strong>random forest</strong> captures
              non-linear interactions. Both are trained each run and the lower-RMSE model is activated.
            </li>
            <li>
              <strong>Evaluation uses a time-ordered hold-out split</strong> (not a random shuffle) so metrics reflect real
              forecasting conditions. Metrics are MAE, RMSE, R² and MAPE.
            </li>
            <li>
              <strong>Every prediction is persisted</strong> with its features, predicted value, actual value, error, model
              version and timestamp — a growing training set for future models (gradient boosting / XGBoost can be dropped in
              behind the same registry).
            </li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
