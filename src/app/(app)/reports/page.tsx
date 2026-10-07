import { Download, Leaf, TrendingDown, TrendingUp } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { buildMonthlyReport } from "@/lib/services/report";
import { Badge, Card, CardBody, CardHeader, CardTitle, Definition, Input, LinkButton, PageHeader, Stat, Table, Td, Th, Tr } from "@/components/ui";
import { Flash, SubmitButton } from "@/components/form-ui";
import { PrintButton } from "@/components/print-button";
import { fmtDate, num } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

const MEAL_LABEL: Record<string, string> = { BREAKFAST: "Breakfast", LUNCH: "Lunch", SNACKS: "Snacks", DINNER: "Dinner" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["ADMIN", "MESS_MANAGER", "WASTE_MANAGER"]);
  const sp = await searchParams;
  const monthParam = sp.month ?? "";
  const [y, m] = monthParam.split("-").map(Number);
  const monthStart = y && m && m >= 1 && m <= 12 ? new Date(y, m - 1, 1) : new Date();
  const monthValue = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;

  const report = await buildMonthlyReport(monthStart);

  const positive = report.wasteReductionPct >= 0;

  return (
    <div>
      <PageHeader
        title="Sustainability report"
        description={`Campus food & waste management report for ${report.monthLabel} (${report.from} → ${report.to}) — ${report.recordedDays} recorded day(s), generated from stored records.`}
        actions={
          <>
            <form className="flex items-center gap-2">
              <Input type="month" name="month" defaultValue={monthValue} className="h-9 w-40 text-xs" />
              <SubmitButton variant="secondary">View</SubmitButton>
            </form>
            <LinkButton href={`/api/reports/export?month=${monthValue}`} variant="secondary">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </LinkButton>
            <PrintButton />
          </>
        }
      />

      <Flash error={sp.error} ok={sp.ok} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Students" value={num(report.totalStudents)} />
        <Stat label="Meals served" value={num(report.mealsServed)} />
        <Stat label="Food prepared" value={num(report.mealsPrepared)} hint="servings" />
        <Stat label="Food waste" value={num(report.foodWasteKg, 1)} unit="kg" tone="warning" />
        <Stat
          label="Waste vs baseline"
          value={`${positive ? "" : "+"}${(-report.wasteReductionPct).toFixed(1)}%`}
          tone={positive ? "brand" : "danger"}
          hint={`vs ${num(report.baselineExpectedKg)} kg baseline (${report.recordedDays} d)`}
        />
        <Stat label="Diversion rate" value={`${report.diversionRatePct.toFixed(1)}%`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Executive summary</CardTitle>
            <Badge variant={positive ? "success" : "danger"}>
              {positive ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              {positive ? "reduction" : "increase"} vs baseline
            </Badge>
          </CardHeader>
          <CardBody className="pt-3">
            <p className="text-sm leading-relaxed text-ink-700">
              In {report.monthLabel}, {report.totalStudents.toLocaleString()} students were served{" "}
              <strong>{report.mealsServed.toLocaleString()}</strong> meals. Kitchen teams prepared{" "}
              <strong>{report.mealsPrepared.toLocaleString()}</strong> servings. Food waste totalled{" "}
              <strong>{num(report.foodWasteKg, 1)} kg</strong> ({report.wastePerMealG} g per meal), which is{" "}
              <strong>
                {Math.abs(report.wasteReductionPct)}% {positive ? "below" : "above"}
              </strong>{" "}
              the {num(report.baselineExpectedKg)} kg baseline for the month. {num(report.wasteDivertedKg, 1)} kg of waste was
              diverted from disposal, and treatment produced <strong>{num(report.compostKg)} kg of compost</strong> plus{" "}
              <strong>{num(report.biogasM3)} m³ of biogas</strong>.
            </p>
            <div className="mt-4 grid gap-1 sm:grid-cols-2">
              <Definition term="Total waste">{num(report.totalWasteKg, 1)} kg</Definition>
              <Definition term="Recyclable">{num(report.recyclableKg, 1)} kg</Definition>
              <Definition term="Reject (non-recoverable)">{num(report.rejectKg, 1)} kg</Definition>
              <Definition term="Purchase value">₹{num(report.purchaseValue)}</Definition>
              <Definition term="Purchase orders">{report.purchaseOrders}</Definition>
              <Definition term="Inventory efficiency">
                {report.inventoryEfficiencyPct == null ? "— no receipts in period" : `${report.inventoryEfficiencyPct}%`}
              </Definition>
              <Definition term="Compost reused">{num(report.compostReusedKg)} kg</Definition>
              <Definition term="Treatment recovery">{report.treatmentRecoveryPct}%</Definition>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Leaf className="h-4 w-4 text-brand-600" /> Treatment outputs
            </CardTitle>
          </CardHeader>
          <CardBody className="pt-3">
            <div className="space-y-1">
              <Definition term="Compost generated">{num(report.compostKg)} kg</Definition>
              <Definition term="Compost reused">{num(report.compostReusedKg)} kg</Definition>
              <Definition term="Biogas generated">{num(report.biogasM3)} m³</Definition>
              <Definition term="Digestate generated">{num(report.digestateKg)} kg</Definition>
              <Definition term="Waste anomalies">{report.anomalies.length}</Definition>
            </div>
            <p className="mt-3 text-[10px] text-ink-400">
              Conversion yields are configurable estimates and vary with feedstock and process control.
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Highest-waste meals</CardTitle>
          </CardHeader>
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Meal</Th>
                  <Th className="text-right">Waste</Th>
                  <Th className="text-right">Expected</Th>
                  <Th className="text-right">Variance</Th>
                </tr>
              </thead>
              <tbody>
                {report.highWasteMeals.map((m, i) => (
                  <Tr key={i}>
                    <Td className="text-xs">{m.date}</Td>
                    <Td className="text-xs">{MEAL_LABEL[m.mealType] ?? m.mealType}</Td>
                    <Td className="text-right tabular-nums">{num(m.wasteKg, 1)} kg</Td>
                    <Td className="text-right tabular-nums text-ink-500">{m.expectedKg != null ? `${num(m.expectedKg, 1)} kg` : "—"}</Td>
                    <Td className={`text-right tabular-nums ${(m.variancePct ?? 0) > 0 ? "text-red-600" : "text-brand-700"}`}>
                      {m.variancePct != null ? `${m.variancePct > 0 ? "+" : ""}${m.variancePct.toFixed(0)}%` : "—"}
                    </Td>
                  </Tr>
                ))}
                {report.highWasteMeals.length === 0 && (
                  <Tr>
                    <Td colSpan={5} className="text-center text-xs text-ink-400">
                      No meals recorded this month.
                    </Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Waste anomalies</CardTitle>
          </CardHeader>
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Meal</Th>
                  <Th className="text-right">Variance</Th>
                  <Th>Severity</Th>
                  <Th>Cause</Th>
                </tr>
              </thead>
              <tbody>
                {report.anomalies.map((a, i) => (
                  <Tr key={i}>
                    <Td className="text-xs">{a.date}</Td>
                    <Td className="text-xs">{MEAL_LABEL[a.mealType] ?? a.mealType}</Td>
                    <Td className="text-right tabular-nums text-red-600">+{a.variancePct.toFixed(0)}%</Td>
                    <Td>
                      <Badge variant={a.severity === "HIGH" ? "danger" : "warning"}>{a.severity}</Badge>
                    </Td>
                    <Td className="text-xs text-ink-500">{a.cause ? a.cause.replace(/_/g, " ").toLowerCase() : "—"}</Td>
                  </Tr>
                ))}
                {report.anomalies.length === 0 && (
                  <Tr>
                    <Td colSpan={5} className="text-center text-xs text-ink-400">
                      No anomalies recorded this month.
                    </Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top leftover dishes</CardTitle>
          </CardHeader>
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Dish</Th>
                  <Th className="text-right">Leftover</Th>
                  <Th className="text-right">Avg waste %</Th>
                </tr>
              </thead>
              <tbody>
                {report.topWasteDishes.map((d) => (
                  <Tr key={d.name}>
                    <Td className="text-xs font-medium text-ink-800">{d.name}</Td>
                    <Td className="text-right tabular-nums">{num(d.leftoverKg, 1)} kg</Td>
                    <Td className="text-right tabular-nums">{d.avgWastePct.toFixed(1)}%</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suggested improvements</CardTitle>
          </CardHeader>
          <CardBody className="pt-3">
            <ul className="space-y-2">
              {report.suggestedImprovements.map((s, i) => (
                <li key={i} className="flex gap-2 text-xs text-ink-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                  {s}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <p className="mt-6 text-[11px] text-ink-400">
        Generated {fmtDate(new Date())} · Definitions: waste per meal = food waste ÷ meals served; inventory efficiency =
        recorded consumption ÷ recorded receipts; treatment recovery = useful output ÷ treatment input; diversion rate =
        (total waste − reject) ÷ total waste.
      </p>
    </div>
  );
}
