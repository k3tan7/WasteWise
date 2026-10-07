import { CheckCircle2, ShoppingCart, Sparkles, XCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { buildPurchasePlan } from "@/lib/services/plan";
import { convertToOrder, decideRecommendation, generateRecommendations, updateOrderStatus } from "@/actions/purchases";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Stat,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { ConfirmButton, Flash, Modal, SubmitButton } from "@/components/form-ui";
import { fmtDate, num, startOfDay, toISODate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Purchases" };

const STATUS_VARIANT: Record<string, string> = {
  PENDING: "warning",
  APPROVED: "success",
  MODIFIED: "info",
  REJECTED: "danger",
  CONVERTED: "brand",
  DRAFT: "neutral",
  ORDERED: "info",
  RECEIVED: "success",
  CANCELLED: "danger",
};

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["ADMIN", "MESS_MANAGER"]);
  const sp = await searchParams;
  const date = sp.date ? startOfDay(new Date(sp.date)) : startOfDay(new Date());
  const horizon = Math.max(1, Math.min(14, Number(sp.horizon ?? 4) || 4));

  const [{ plan, forecastSource }, recommendations, orders, ingredients] = await Promise.all([
    buildPurchasePlan(date, horizon),
    prisma.purchaseRecommendation.findMany({
      where: { date },
      include: { ingredient: true },
      orderBy: { recommendedQty: "desc" },
    }),
    prisma.purchaseOrder.findMany({
      include: { ingredient: true, supplier: true },
      orderBy: { orderedAt: "desc" },
      take: 20,
    }),
    prisma.ingredient.findMany({ select: { id: true, costPerUnit: true, unit: true } }),
  ]);

  const costById = new Map(ingredients.map((i) => [i.id, i.costPerUnit]));
  const planCost = Math.round(plan.rows.reduce((a, r) => a + r.recommendedQty * (costById.get(r.ingredientId) ?? 0), 0));
  const pendingRecs = recommendations.filter((r) => r.status === "PENDING");
  const decidedRecs = recommendations.filter((r) => r.status !== "PENDING");

  const qs = `/purchases?date=${toISODate(date)}&horizon=${horizon}`;

  return (
    <div>
      <PageHeader
        title="Purchase recommendations"
        description="Requirement is derived from upcoming menus and forecast diners, then compared against usable stock and open orders. Approve, edit or reject each recommendation."
        actions={
          <>
            <form className="flex items-center gap-2">
              <Input type="date" name="date" defaultValue={toISODate(date)} className="h-9 w-40 text-xs" />
              <Select name="horizon" defaultValue={String(horizon)} className="h-9 w-28 text-xs">
                {[2, 3, 4, 7].map((h) => (
                  <option key={h} value={h}>
                    {h} days
                  </option>
                ))}
              </Select>
              <SubmitButton variant="secondary">View</SubmitButton>
            </form>
            <form action={generateRecommendations}>
              <input type="hidden" name="redirectTo" value={qs} />
              <input type="hidden" name="date" value={toISODate(date)} />
              <input type="hidden" name="horizonDays" value={horizon} />
              <SubmitButton pendingLabel="Calculating…">
                <Sparkles className="h-3.5 w-3.5" /> Generate plan
              </SubmitButton>
            </form>
          </>
        }
      />

      <Flash error={sp.error} ok={sp.ok} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Items to purchase" value={num(plan.rows.filter((r) => r.recommendedQty > 0).length)} />
        <Stat label="Estimated cost" value={`₹${num(planCost)}`} tone="brand" />
        <Stat label="Pending decisions" value={num(pendingRecs.length)} tone={pendingRecs.length ? "warning" : "neutral"} />
        <Stat label="Planning horizon" value={`${horizon} days`} hint="from upcoming menus" />
      </div>

      {/* Live plan (always current) */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Requirement vs stock — live calculation</CardTitle>
          <span className="text-[11px] text-ink-400">recomputed on every page load from the planned menus</span>
        </CardHeader>
        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th>Ingredient</Th>
                <Th className="text-right">Required</Th>
                <Th className="text-right">Usable stock</Th>
                <Th className="text-right">Safety</Th>
                <Th className="text-right">On order</Th>
                <Th className="text-right">Recommended</Th>
                <Th>Why</Th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.slice(0, 12).map((r) => (
                <Tr key={r.ingredientId}>
                  <Td className="font-medium text-ink-800">{r.name}</Td>
                  <Td className="text-right tabular-nums">
                    {num(r.requiredQty)} {r.unit}
                  </Td>
                  <Td className="text-right tabular-nums">{num(r.currentStock)}</Td>
                  <Td className="text-right tabular-nums text-ink-500">{num(r.safetyStock)}</Td>
                  <Td className="text-right tabular-nums text-ink-500">{num(r.incoming)}</Td>
                  <Td className="text-right">
                    {r.recommendedQty > 0 ? (
                      <Badge variant="warning">
                        +{r.recommendedQty} {r.unit}
                      </Badge>
                    ) : (
                      <Badge variant="success">sufficient</Badge>
                    )}
                  </Td>
                  <Td className="max-w-md text-[11px] text-ink-500">{r.reason}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
        <CardBody className="pt-0 text-[11px] text-ink-400">
          Forecast basis per meal:{" "}
          {Object.entries(forecastSource)
            .slice(0, 4)
            .map(([k, v]) => `${k.split("|")[1]}→${num(v.predicted)} (${v.source})`)
            .join(" · ")}
          {Object.keys(forecastSource).length === 0 && "No upcoming menus found — create menus to enable planning."}
        </CardBody>
      </Card>

      {/* Stored recommendations */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recommendations for {toISODate(date)}</CardTitle>
        </CardHeader>
        {recommendations.length === 0 ? (
          <CardBody>
            <EmptyState
              title="No stored recommendations"
              description="Click “Generate plan” to persist the current calculation as decisions you can approve and convert to purchase orders."
              icon={<ShoppingCart className="h-6 w-6" />}
            />
          </CardBody>
        ) : (
          <>
            <div className="mt-3">
              <Table>
                <thead>
                  <tr>
                    <Th>Ingredient</Th>
                    <Th className="text-right">Stock → Required</Th>
                    <Th className="text-right">Recommended</Th>
                    <Th>Explanation</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map((r) => (
                    <Tr key={r.id}>
                      <Td className="font-medium text-ink-800">{r.ingredient.name}</Td>
                      <Td className="text-right tabular-nums">
                        {num(r.currentStock)} → {num(r.requiredQty)} {r.ingredient.unit}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {num(r.finalQty ?? r.recommendedQty)} {r.ingredient.unit}
                      </Td>
                      <Td className="max-w-sm text-[11px] text-ink-500">{r.reason}</Td>
                      <Td>
                        <Badge variant={STATUS_VARIANT[r.status] ?? "neutral"}>{r.status}</Badge>
                        {r.decidedBy && <div className="mt-0.5 text-[10px] text-ink-400">by {r.decidedBy}</div>}
                      </Td>
                      <Td className="text-right">
                        {r.status === "PENDING" ? (
                          <div className="flex justify-end gap-1.5">
                            <form action={decideRecommendation}>
                              <input type="hidden" name="redirectTo" value={qs} />
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="decision" value="APPROVE" />
                              <SubmitButton size="sm" variant="secondary" pendingLabel="…">
                                Approve
                              </SubmitButton>
                            </form>
                            <Modal trigger="Edit" variant="ghost" size="sm" title={`Modify quantity — ${r.ingredient.name}`}>
                              <form action={decideRecommendation} className="space-y-3">
                                <input type="hidden" name="redirectTo" value={qs} />
                                <input type="hidden" name="id" value={r.id} />
                                <input type="hidden" name="decision" value="MODIFY" />
                                <p className="text-[11px] text-ink-500">
                                  Recommended {num(r.recommendedQty)} {r.ingredient.unit} · required {num(r.requiredQty)} · stock{" "}
                                  {num(r.currentStock)}.
                                </p>
                                <Field label={`Final quantity (${r.ingredient.unit})`}>
                                  <Input name="finalQty" type="number" min={0} step="0.1" defaultValue={r.recommendedQty} />
                                </Field>
                                <SubmitButton>Save decision</SubmitButton>
                              </form>
                            </Modal>
                            <form action={decideRecommendation}>
                              <input type="hidden" name="redirectTo" value={qs} />
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="decision" value="REJECT" />
                              <SubmitButton size="sm" variant="ghost" pendingLabel="…">
                                Reject
                              </SubmitButton>
                            </form>
                          </div>
                        ) : r.status === "CONVERTED" ? (
                          <Badge variant="brand">Ordered</Badge>
                        ) : (
                          <form action={convertToOrder}>
                            <input type="hidden" name="redirectTo" value={qs} />
                            <input type="hidden" name="id" value={r.id} />
                            <SubmitButton size="sm" pendingLabel="…">
                              Create order
                            </SubmitButton>
                          </form>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <CardBody className="pt-3 text-[11px] text-ink-400">
              Decisions are recorded (who approved/edited/rejected) so recommendation quality can be reviewed over time.{" "}
              {decidedRecs.length} of {recommendations.length} decided.
            </CardBody>
          </>
        )}
      </Card>

      {/* Purchase orders */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Purchase orders</CardTitle>
          <Badge variant="info">{orders.filter((o) => o.status === "ORDERED").length} open</Badge>
        </CardHeader>
        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Ingredient</Th>
                <Th>Supplier</Th>
                <Th className="text-right">Quantity</Th>
                <Th className="text-right">Value</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <Tr key={o.id}>
                  <Td className="font-mono text-xs text-ink-600">{o.code}</Td>
                  <Td className="font-medium text-ink-800">{o.ingredient.name}</Td>
                  <Td className="text-xs text-ink-500">{o.supplier?.name ?? "—"}</Td>
                  <Td className="text-right tabular-nums">
                    {num(o.quantity)} {o.ingredient.unit}
                  </Td>
                  <Td className="text-right tabular-nums">₹{num(o.totalCost)}</Td>
                  <Td>
                    <Badge variant={STATUS_VARIANT[o.status] ?? "neutral"}>{o.status}</Badge>
                    {o.expectedAt && o.status === "ORDERED" && (
                      <div className="mt-0.5 text-[10px] text-ink-400">expected {fmtDate(o.expectedAt)}</div>
                    )}
                  </Td>
                  <Td className="text-right">
                    {o.status === "ORDERED" ? (
                      <div className="flex justify-end gap-1.5">
                        <Modal trigger="Receive" size="sm" title={`Receive ${o.code}`}>
                          <form action={updateOrderStatus} className="space-y-3">
                            <input type="hidden" name="redirectTo" value={qs} />
                            <input type="hidden" name="id" value={o.id} />
                            <input type="hidden" name="action" value="receive" />
                            <Field label={`Received quantity (${o.ingredient.unit})`} hint="Adds to inventory and logs a stock transaction">
                              <Input name="receivedQty" type="number" min={0} step="0.1" defaultValue={o.quantity} />
                            </Field>
                            <SubmitButton>Confirm receipt</SubmitButton>
                          </form>
                        </Modal>
                        <form action={updateOrderStatus}>
                          <input type="hidden" name="redirectTo" value={qs} />
                          <input type="hidden" name="id" value={o.id} />
                          <input type="hidden" name="action" value="cancel" />
                          <ConfirmButton variant="ghost" message={`Cancel ${o.code}?`}>
                            Cancel
                          </ConfirmButton>
                        </form>
                      </div>
                    ) : o.status === "RECEIVED" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-brand-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {num(o.receivedQty)} received
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-ink-400">
                        <XCircle className="h-3.5 w-3.5" /> {o.status.toLowerCase()}
                      </span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
