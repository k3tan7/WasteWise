import { AlertTriangle, Package, Plus, Upload } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { createIngredient, deleteIngredient, importInventoryCsv, adjustStock, updateIngredient } from "@/actions/inventory";
import { stockStatus } from "@/lib/prediction/inventory";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
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
import { fmtDate, num } from "@/lib/utils";
import { INGREDIENT_CATEGORIES } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inventory" };

const STATUS_VARIANT: Record<string, string> = { OUT: "danger", LOW: "warning", OK: "success", OVERSTOCK: "info" };
const STATUS_LABEL: Record<string, string> = { OUT: "Out of stock", LOW: "Low", OK: "Healthy", OVERSTOCK: "Overstock" };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["ADMIN", "MESS_MANAGER"]);
  const sp = await searchParams;

  const [ingredients, suppliers, transactions] = await Promise.all([
    prisma.ingredient.findMany({ include: { inventory: true, supplier: true }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.inventoryTransaction.findMany({ orderBy: { createdAt: "desc" }, take: 18, include: { ingredient: true } }),
  ]);

  const rows = ingredients.map((i) => {
    const onHand = i.inventory?.quantity ?? 0;
    return { ...i, onHand, status: stockStatus(onHand, i.minStock, i.maxStock) };
  });

  const lowCount = rows.filter((r) => r.status === "LOW" || r.status === "OUT").length;
  const overCount = rows.filter((r) => r.status === "OVERSTOCK").length;
  const totalValue = Math.round(rows.reduce((a, r) => a + r.onHand * r.costPerUnit, 0));

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Current stock for every ingredient, with shelf life and minimum levels. The purchase planner uses this data to compute exactly what to buy."
        actions={
          <>
            <Modal trigger={<><Upload className="h-3.5 w-3.5" /> Import CSV</>} variant="secondary" title="Import inventory">
              <form action={importInventoryCsv} className="space-y-3">
                <input type="hidden" name="redirectTo" value="/inventory" />
                <p className="text-[11px] text-ink-500">
                  Columns: name, category, unit, quantity, minStock, maxStock, costPerUnit. Existing ingredients are updated.
                </p>
                <input type="file" name="file" accept=".csv" required className="block w-full text-xs" />
                <SubmitButton variant="secondary">Import inventory</SubmitButton>
              </form>
            </Modal>
            <Modal trigger={<><Plus className="h-3.5 w-3.5" /> Add ingredient</>} title="Add an ingredient">
              <form action={createIngredient} className="space-y-3">
                <input type="hidden" name="redirectTo" value="/inventory" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name" className="col-span-2">
                    <Input name="name" required placeholder="Basmati Rice" />
                  </Field>
                  <Field label="Category">
                    <Select name="category">
                      {INGREDIENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c.charAt(0) + c.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Unit">
                    <Select name="unit">
                      <option value="kg">kg</option>
                      <option value="L">L</option>
                      <option value="unit">unit</option>
                    </Select>
                  </Field>
                  <Field label="Opening quantity">
                    <Input name="openingQuantity" type="number" min={0} step="0.1" defaultValue={0} />
                  </Field>
                  <Field label="Cost per unit">
                    <Input name="costPerUnit" type="number" min={0} step="0.5" defaultValue={0} />
                  </Field>
                  <Field label="Minimum stock">
                    <Input name="minStock" type="number" min={0} defaultValue={0} />
                  </Field>
                  <Field label="Maximum stock">
                    <Input name="maxStock" type="number" min={0} defaultValue={100} />
                  </Field>
                  <Field label="Shelf life (days)">
                    <Input name="shelfLifeDays" type="number" min={1} defaultValue={30} />
                  </Field>
                  <Field label="Supplier">
                    <Select name="supplierId">
                      <option value="">— none —</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <div className="flex justify-end">
                  <SubmitButton>Save ingredient</SubmitButton>
                </div>
              </form>
            </Modal>
          </>
        }
      />

      <Flash error={sp.error} ok={sp.ok} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Ingredients tracked" value={num(rows.length)} />
        <Stat label="Low / out of stock" value={num(lowCount)} tone={lowCount ? "warning" : "brand"} />
        <Stat label="Overstock risk" value={num(overCount)} tone={overCount ? "warning" : "neutral"} />
        <Stat label="Stock value" value={`₹${num(totalValue)}`} hint="at cost price" />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Current inventory</CardTitle>
          <Badge variant="neutral">Values update via stock adjustments and received orders</Badge>
        </CardHeader>
        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th>Ingredient</Th>
                <Th>Category</Th>
                <Th className="text-right">On hand</Th>
                <Th className="text-right">Min / Max</Th>
                <Th className="text-right">Shelf life</Th>
                <Th className="text-right">Cost</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <div className="font-medium text-ink-800">{r.name}</div>
                    {r.supplier && <div className="text-[11px] text-ink-400">{r.supplier.name}</div>}
                  </Td>
                  <Td>
                    <Badge>{r.category}</Badge>
                  </Td>
                  <Td className="text-right tabular-nums">
                    {num(r.onHand, r.onHand % 1 === 0 ? 0 : 1)} {r.unit}
                  </Td>
                  <Td className="text-right tabular-nums text-ink-500">
                    {num(r.minStock)} / {num(r.maxStock)}
                  </Td>
                  <Td className="text-right tabular-nums">{r.shelfLifeDays}d</Td>
                  <Td className="text-right tabular-nums">₹{num(r.costPerUnit)}</Td>
                  <Td>
                    <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Modal trigger="Adjust" variant="secondary" size="sm" title={`Adjust stock — ${r.name}`}>
                        <form action={adjustStock} className="space-y-3">
                          <input type="hidden" name="redirectTo" value="/inventory" />
                          <input type="hidden" name="ingredientId" value={r.id} />
                          <Field label="Transaction type">
                            <Select name="type">
                              <option value="RECEIPT">Receipt (add stock)</option>
                              <option value="CONSUMPTION">Consumption (remove)</option>
                              <option value="WASTE">Waste / spoilage (remove)</option>
                              <option value="ADJUSTMENT">Adjustment (± signed)</option>
                            </Select>
                          </Field>
                          <Field label={`Quantity (${r.unit})`} hint={`Current on hand: ${num(r.onHand, 1)} ${r.unit}`}>
                            <Input name="quantity" type="number" step="0.1" required />
                          </Field>
                          <Field label="Note (optional)">
                            <Input name="note" />
                          </Field>
                          <div className="flex justify-end">
                            <SubmitButton>Save transaction</SubmitButton>
                          </div>
                        </form>
                      </Modal>
                      <Modal trigger="Edit" variant="ghost" size="sm" title={`Edit ${r.name}`}>
                        <form action={updateIngredient} className="space-y-3">
                          <input type="hidden" name="redirectTo" value="/inventory" />
                          <input type="hidden" name="id" value={r.id} />
                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Name" className="col-span-2">
                              <Input name="name" defaultValue={r.name} required />
                            </Field>
                            <Field label="Category">
                              <Select name="category" defaultValue={r.category}>
                                {INGREDIENT_CATEGORIES.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <Field label="Unit">
                              <Input name="unit" defaultValue={r.unit} />
                            </Field>
                            <Field label="Minimum stock">
                              <Input name="minStock" type="number" defaultValue={r.minStock} />
                            </Field>
                            <Field label="Maximum stock">
                              <Input name="maxStock" type="number" defaultValue={r.maxStock} />
                            </Field>
                            <Field label="Shelf life (days)">
                              <Input name="shelfLifeDays" type="number" defaultValue={r.shelfLifeDays} />
                            </Field>
                            <Field label="Cost per unit">
                              <Input name="costPerUnit" type="number" step="0.5" defaultValue={r.costPerUnit} />
                            </Field>
                            <Field label="Supplier" className="col-span-2">
                              <Select name="supplierId" defaultValue={r.supplierId ?? ""}>
                                <option value="">— none —</option>
                                {suppliers.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                          </div>
                          <div className="flex justify-end">
                            <SubmitButton>Update ingredient</SubmitButton>
                          </div>
                        </form>
                      </Modal>
                      <form action={deleteIngredient}>
                        <input type="hidden" name="redirectTo" value="/inventory" />
                        <input type="hidden" name="id" value={r.id} />
                        <ConfirmButton message={`Delete ${r.name}? Ingredients used in recipes cannot be deleted.`}>Delete</ConfirmButton>
                      </form>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
        <CardBody className="pt-0 text-[11px] text-ink-400">
          <Package className="mr-1 inline h-3.5 w-3.5" />
          {lowCount > 0 ? (
            <span className="text-amber-700">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
              {lowCount} ingredient(s) are below their minimum stock level — check the Purchase plan.
            </span>
          ) : (
            "All ingredients are at or above their minimum stock level."
          )}
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent stock transactions</CardTitle>
        </CardHeader>
        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Ingredient</Th>
                <Th>Type</Th>
                <Th className="text-right">Change</Th>
                <Th className="text-right">Balance</Th>
                <Th>Note</Th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <Tr>
                  <Td colSpan={6} className="text-center text-xs text-ink-400">
                    No stock transactions recorded yet.
                  </Td>
                </Tr>
              )}
              {transactions.map((t) => (
                <Tr key={t.id}>
                  <Td className="text-xs text-ink-500">{fmtDate(t.createdAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</Td>
                  <Td className="font-medium text-ink-800">{t.ingredient.name}</Td>
                  <Td>
                    <Badge variant={t.type === "RECEIPT" ? "success" : t.type === "WASTE" ? "danger" : "neutral"}>{t.type}</Badge>
                  </Td>
                  <Td className={`text-right tabular-nums ${t.quantity < 0 ? "text-red-600" : "text-brand-700"}`}>
                    {t.quantity > 0 ? "+" : ""}
                    {num(t.quantity, 1)}
                  </Td>
                  <Td className="text-right tabular-nums">{num(t.balanceAfter, 1)}</Td>
                  <Td className="text-xs text-ink-500">{t.note ?? "—"}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
