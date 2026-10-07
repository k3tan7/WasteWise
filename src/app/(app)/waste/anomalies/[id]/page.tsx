import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lightbulb, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { recordCause, setAnomalyStatus } from "@/actions/waste";
import { recommendAction, type AnomalyFactor } from "@/lib/prediction/anomaly";
import { Card, CardBody, CardHeader, CardTitle, Badge, Field, Select, Textarea, PageHeader, Table, Td, Th, Tr } from "@/components/ui";
import { Flash, SubmitButton } from "@/components/form-ui";
import { fmtDate, kg, num } from "@/lib/utils";
import { WASTE_CAUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const MEAL_LABEL: Record<string, string> = { BREAKFAST: "Breakfast", LUNCH: "Lunch", SNACKS: "Snacks", DINNER: "Dinner" };
const SEV_VARIANT: Record<string, string> = { LOW: "info", MEDIUM: "warning", HIGH: "danger" };

export default async function AnomalyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["ADMIN", "MESS_MANAGER", "WASTE_MANAGER"]);
  const { id } = await params;
  const sp = await searchParams;

  const anomaly = await prisma.wasteAnomaly.findUnique({
    where: { id },
    include: { correctiveActions: { orderBy: { createdAt: "desc" } } },
  });
  if (!anomaly) notFound();

  const contributors = JSON.parse(anomaly!.contributors || "[]") as AnomalyFactor[];
  const meal = await prisma.meal.findUnique({
    where: { date_mealType: { date: anomaly!.date, mealType: anomaly!.mealType } },
  });

  const recommendation = recommendAction(
    { isAnomaly: true, variancePct: anomaly!.variancePct, robustZ: 0, medianKg: 0, madKg: 0, severity: anomaly!.severity as "LOW", contributors, summary: anomaly!.summary ?? "" },
    { mealType: anomaly!.mealType }
  );

  return (
    <div>
      <Link href="/waste" className="mb-3 inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to waste management
      </Link>
      <PageHeader
        title={`${MEAL_LABEL[anomaly!.mealType]} waste anomaly`}
        description={`${fmtDate(anomaly!.date, { weekday: "long", month: "long", day: "numeric" })} · detected by robust statistical threshold (median ± MAD)`}
        actions={
          <>
            <Badge variant={SEV_VARIANT[anomaly!.severity]}>{anomaly!.severity} severity</Badge>
            <Badge variant={anomaly!.status === "OPEN" ? "danger" : anomaly!.status === "RESOLVED" ? "success" : "warning"}>
              {anomaly!.status}
            </Badge>
          </>
        }
      />

      <Flash error={sp.error} ok={sp.ok} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>What happened?</CardTitle>
            </CardHeader>
            <CardBody className="pt-2">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-ink-50 py-3">
                  <p className="text-lg font-semibold tabular-nums text-ink-800">{kg(anomaly!.expectedKg)}</p>
                  <p className="text-[10px] uppercase tracking-wide text-ink-400">Expected</p>
                </div>
                <div className="rounded-xl bg-red-50 py-3">
                  <p className="text-lg font-semibold tabular-nums text-red-700">{kg(anomaly!.actualKg)}</p>
                  <p className="text-[10px] uppercase tracking-wide text-red-500">Actual</p>
                </div>
                <div className="rounded-xl bg-amber-50 py-3">
                  <p className="text-lg font-semibold tabular-nums text-amber-700">+{anomaly!.variancePct.toFixed(0)}%</p>
                  <p className="text-[10px] uppercase tracking-wide text-amber-600">Variance</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-ink-600">{anomaly!.summary}</p>
              {meal && (
                <p className="mt-2 text-[11px] text-ink-500">
                  Context: prepared {num(meal.actualPrep)} (recommended {num(meal.recommendedPrep)}), consumed{" "}
                  {num(meal.actualConsumption)} of a predicted {num(meal.predictedConsumption)}. Plate waste {kg(meal.plateWasteKg)},
                  unserved {kg(meal.unservedKg)}.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-amber-500" /> Possible contributors
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 pt-2">
              {contributors.length === 0 && (
                <p className="text-xs text-ink-500">
                  No single dominant factor was identified from the available data. Review operations manually.
                </p>
              )}
              {contributors.map((c, i) => (
                <div key={i} className="rounded-xl border border-ink-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-ink-800">{c.factor}</p>
                    <span className="text-[10px] text-ink-400">confidence weight {(c.weight * 100).toFixed(0)}%</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-600">{c.detail}</p>
                </div>
              ))}
              <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3">
                <p className="text-xs font-semibold text-brand-800">Recommended action</p>
                <p className="mt-1 text-xs text-brand-700">{recommendation}</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Corrective action log</CardTitle>
            </CardHeader>
            <div className="mt-3">
              <Table>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Cause</Th>
                    <Th>Action</Th>
                    <Th>By</Th>
                  </tr>
                </thead>
                <tbody>
                  {anomaly!.correctiveActions.length === 0 && (
                    <Tr>
                      <Td colSpan={4} className="text-center text-xs text-ink-400">
                        No cause recorded yet — confirm one below.
                      </Td>
                    </Tr>
                  )}
                  {anomaly!.correctiveActions.map((a) => (
                    <Tr key={a.id}>
                      <Td className="text-xs text-ink-500">{fmtDate(a.createdAt, { month: "short", day: "numeric" })}</Td>
                      <Td>
                        <Badge variant="warning">{WASTE_CAUSES.find((c) => c.code === a.causeCode)?.label ?? a.causeCode}</Badge>
                      </Td>
                      <Td className="text-xs text-ink-700">{a.action}</Td>
                      <Td className="text-xs text-ink-500">{a.createdBy ?? "—"}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Confirm root cause</CardTitle>
            </CardHeader>
            <CardBody className="pt-2">
              <form action={recordCause} className="space-y-3">
                <input type="hidden" name="redirectTo" value={`/waste/anomalies/${id}`} />
                <input type="hidden" name="anomalyId" value={id} />
                <Field label="Confirmed cause">
                  <Select name="causeCode" required>
                    <option value="">Select a cause…</option>
                    {WASTE_CAUSES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Corrective action">
                  <Textarea name="action" required className="min-h-[80px]" placeholder="e.g. Reduce future event-day preparation buffer by 10%." />
                </Field>
                <Field label="Additional notes (optional)">
                  <Textarea name="notes" className="min-h-[48px]" />
                </Field>
                <SubmitButton className="w-full">Record cause & resolve</SubmitButton>
              </form>
              <p className="mt-2 text-[11px] text-ink-400">
                Recording a cause marks the anomaly resolved and tags this meal&apos;s waste records — building organisational
                learning that informs future forecasts.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-wrap gap-2 pt-2">
              {["INVESTIGATING", "IGNORED", "OPEN", "RESOLVED"].map((s) => (
                <form key={s} action={setAnomalyStatus}>
                  <input type="hidden" name="redirectTo" value={`/waste/anomalies/${id}`} />
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="status" value={s} />
                  <SubmitButton variant={anomaly!.status === s ? "primary" : "secondary"} size="sm" pendingLabel="…">
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </SubmitButton>
                </form>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-sky-500" /> Why this was flagged
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-2 text-[11px] text-ink-500">
              The system compares actual waste against a robust baseline (median ± MAD) for this meal type, then only flags an
              anomaly when the variance exceeds the configured threshold <em>and</em> the value is statistically unusual. Isolated
              incidents do not trigger a flag.
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
