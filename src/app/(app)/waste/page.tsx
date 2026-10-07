import Link from "next/link";
import { AlertTriangle, Plus, ScanSearch, Trash2, Upload } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getWasteRecords } from "@/lib/analytics";
import { createWasteRecord, deleteWasteRecord, generateWastePredictions, importWasteCsv, runAnomalyDetection, updateWasteRecord } from "@/actions/waste";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Stat,
  Table,
  Td,
  Th,
  Tr,
  Textarea,
} from "@/components/ui";
import { ConfirmButton, Flash, Modal, SubmitButton } from "@/components/form-ui";
import { addDays, fmtDate, kg, num, startOfDay, toISODate } from "@/lib/utils";
import { LOCATIONS, MEAL_TYPES, TREATMENT_DESTINATIONS, WASTE_CATEGORIES, WASTE_SUBCATEGORIES } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Waste Management" };

const MEAL_LABEL: Record<string, string> = { BREAKFAST: "Breakfast", LUNCH: "Lunch", SNACKS: "Snacks", DINNER: "Dinner" };
const CAT_VARIANT: Record<string, string> = { FOOD: "success", RECYCLABLE: "info", REJECT: "danger" };
const SEV_VARIANT: Record<string, string> = { LOW: "info", MEDIUM: "warning", HIGH: "danger" };
const STATUS_VARIANT: Record<string, string> = { OPEN: "danger", INVESTIGATING: "warning", RESOLVED: "success", IGNORED: "neutral" };

export default async function WastePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["ADMIN", "MESS_MANAGER", "WASTE_MANAGER"]);
  const sp = await searchParams;
  const to = sp.to ? startOfDay(new Date(sp.to)) : startOfDay(new Date());
  const from = sp.from ? startOfDay(new Date(sp.from)) : addDays(to, -6);
  const category = sp.category ?? "ALL";
  const meal = sp.meal ?? "ALL";
  const location = sp.location ?? "ALL";
  const dateISO = toISODate(to);

  const [records, reasons, dishes, anomalies, predictions, todayMeals, breakdown, recentAnomalies] = await Promise.all([
    getWasteRecords({ from, to, category, mealType: meal, location }, 120),
    prisma.wasteReason.findMany({ where: { category: "CAUSE" }, orderBy: { label: "asc" } }),
    prisma.dish.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.wasteAnomaly.findMany({ orderBy: { date: "desc" }, take: 6 }),
    prisma.wastePrediction.findMany({ where: { date: to }, orderBy: { mealType: "asc" } }),
    prisma.meal.findMany({ where: { date: { gte: from, lte: to } } }),
    prisma.wasteRecord.findMany({ where: { date: { gte: from, lte: to } } }),
    prisma.wasteAnomaly.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
  ]);

  const byCat = { FOOD: 0, RECYCLABLE: 0, REJECT: 0 } as Record<string, number>;
  for (const r of breakdown) byCat[r.category] = (byCat[r.category] ?? 0) + r.weightKg;

  const mealsServed = todayMeals.reduce((a, m) => a + (m.actualConsumption ?? 0), 0);
  const plateWasteKg = todayMeals.reduce((a, m) => a + (m.plateWasteKg ?? 0), 0);
  const unservedKg = todayMeals.reduce((a, m) => a + (m.unservedKg ?? 0), 0);
  const avgPerPlateG = mealsServed > 0 ? (plateWasteKg / mealsServed) * 1000 : 0;
  const wastePct = mealsServed > 0 ? (plateWasteKg / (mealsServed * 0.15)) * 100 : 0; // vs a 150 g nominal plate

  const qs = new URLSearchParams({ from: toISODate(from), to: dateISO, category, meal, location }).toString();

  return (
    <div>
      <PageHeader
        title="Waste management"
        description="Record food, recyclable and reject waste. Plate waste is tracked per meal so high-waste dishes and anomalies can be identified."
        actions={
          <>
            <Modal trigger={<><Upload className="h-3.5 w-3.5" /> Import CSV</>} variant="secondary" title="Import waste records">
              <form action={importWasteCsv} className="space-y-3">
                <input type="hidden" name="redirectTo" value={`/waste?${qs}`} />
                <p className="text-[11px] text-ink-500">
                  Columns: date, mealType, location, category, subCategory, source, weightKg, treatmentDestination, notes
                </p>
                <input type="file" name="file" accept=".csv" required className="block w-full text-xs" />
                <SubmitButton variant="secondary">Import waste records</SubmitButton>
              </form>
            </Modal>
            <Modal trigger={<><Plus className="h-3.5 w-3.5" /> Record waste</>} title="Record waste" description="Quick entry — optimised for phone use in the kitchen.">
              <form action={createWasteRecord} className="space-y-3">
                <input type="hidden" name="redirectTo" value={`/waste?${qs}`} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date">
                    <Input name="date" type="date" required defaultValue={dateISO} />
                  </Field>
                  <Field label="Meal (optional)">
                    <Select name="mealType" defaultValue="">
                      <option value="">— none —</option>
                      {MEAL_TYPES.map((m) => (
                        <option key={m} value={m}>
                          {MEAL_LABEL[m]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Category">
                    <Select name="category" defaultValue="FOOD">
                      {WASTE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Sub-category">
                    <Select name="subCategory" defaultValue="PLATE">
                      {Object.entries(WASTE_SUBCATEGORIES).map(([cat, subs]) => (
                        <optgroup key={cat} label={cat}>
                          {subs.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Weight (kg)">
                    <Input name="weightKg" type="number" step="0.1" min="0.1" required defaultValue={1} />
                  </Field>
                  <Field label="Source">
                    <Select name="source" defaultValue="PLATE">
                      {["PLATE", "UNSERVED", "KITCHEN", "RECYCLABLE", "REJECT", "OTHER"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Location">
                    <Select name="location" defaultValue="Main Mess">
                      {LOCATIONS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Dish (optional)">
                    <Select name="dishId" defaultValue="">
                      <option value="">— none —</option>
                      {dishes.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Reason (optional)">
                    <Select name="reasonId" defaultValue="">
                      <option value="">— none —</option>
                      {reasons.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Treatment destination">
                    <Select name="treatmentDestination" defaultValue="COMPOST">
                      {TREATMENT_DESTINATIONS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label="Notes (optional)">
                  <Textarea name="notes" className="min-h-[48px]" />
                </Field>
                <div className="flex justify-end">
                  <SubmitButton>Save record</SubmitButton>
                </div>
              </form>
            </Modal>
          </>
        }
      />

      <Flash error={sp.error} ok={sp.ok} />

      {/* Plate waste */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total waste (range)" value={num(byCat.FOOD + byCat.RECYCLABLE + byCat.REJECT, 1)} unit="kg" />
        <Stat label="Food waste" value={num(byCat.FOOD, 1)} unit="kg" tone="warning" />
        <Stat label="Recyclable" value={num(byCat.RECYCLABLE, 1)} unit="kg" />
        <Stat label="Reject" value={num(byCat.REJECT, 1)} unit="kg" />
        <Stat label="Meals served (range)" value={num(mealsServed)} />
        <Stat label="Plate waste / plate" value={avgPerPlateG.toFixed(1)} unit="g" hint={`${kg(plateWasteKg)} total`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Plate waste detail — {toISODate(from)} → {dateISO}</CardTitle>
          </CardHeader>
          <CardBody className="pt-3">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-ink-400">Meals consumed</p>
                <p className="text-lg font-semibold tabular-nums text-ink-900">{num(mealsServed)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-ink-400">Plates returned</p>
                <p className="text-lg font-semibold tabular-nums text-ink-900">{num(mealsServed)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-ink-400">Plate waste</p>
                <p className="text-lg font-semibold tabular-nums text-ink-900">{kg(plateWasteKg)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-ink-400">Unserved food</p>
                <p className="text-lg font-semibold tabular-nums text-ink-900">{kg(unservedKg)}</p>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-ink-50 p-3 text-xs text-ink-600">
              Average waste per plate ≈ <strong>{avgPerPlateG.toFixed(1)} g</strong>. Plate waste is 
              <strong> {wastePct.toFixed(1)}%</strong> of a nominal 150 g serving. Each consumed meal is assumed to return one
              plate.
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expected waste (baseline)</CardTitle>
            <form action={generateWastePredictions}>
              <input type="hidden" name="redirectTo" value={`/waste?${qs}`} />
              <input type="hidden" name="date" value={dateISO} />
              <SubmitButton variant="secondary" size="sm" pendingLabel="…">
                Recompute
              </SubmitButton>
            </form>
          </CardHeader>
          <CardBody className="space-y-2 pt-3">
            {predictions.length === 0 && <p className="text-xs text-ink-400">No expected-waste baseline for this date yet.</p>}
            {predictions.map((p) => {
              const v = p.variancePct ?? 0;
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-ink-700">{MEAL_LABEL[p.mealType] ?? p.mealType}</span>
                  <span className="text-right tabular-nums text-ink-500">
                    exp {num(p.expectedKg, 1)} · act {p.actualKg != null ? num(p.actualKg, 1) : "—"}
                  </span>
                  <Badge variant={v >= 25 ? "danger" : v >= 0 ? "warning" : "success"}>
                    {v > 0 ? "+" : ""}
                    {v.toFixed(0)}%
                  </Badge>
                </div>
              );
            })}
            <form action={runAnomalyDetection} className="pt-2">
              <input type="hidden" name="redirectTo" value={`/waste?${qs}`} />
              <input type="hidden" name="date" value={dateISO} />
              <SubmitButton variant="secondary" size="sm" pendingLabel="Scanning…" className="w-full">
                <ScanSearch className="h-3.5 w-3.5" /> Detect anomalies
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      </div>

      {/* Anomalies */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Waste anomalies
            </span>
          </CardTitle>
          <Badge variant={recentAnomalies > 0 ? "danger" : "neutral"}>{recentAnomalies} active</Badge>
        </CardHeader>
        <div className="mt-3">
          {anomalies.length === 0 ? (
            <CardBody>
              <EmptyState title="No anomalies recorded" description="Run anomaly detection to compare actual waste against the statistical baseline." />
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Meal</Th>
                  <Th className="text-right">Expected</Th>
                  <Th className="text-right">Actual</Th>
                  <Th className="text-right">Variance</Th>
                  <Th>Severity</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((a) => (
                  <Tr key={a.id}>
                    <Td>{toISODate(a.date)}</Td>
                    <Td>{MEAL_LABEL[a.mealType] ?? a.mealType}</Td>
                    <Td className="text-right tabular-nums">{num(a.expectedKg, 1)} kg</Td>
                    <Td className="text-right tabular-nums">{num(a.actualKg, 1)} kg</Td>
                    <Td className="text-right tabular-nums font-medium text-red-600">+{a.variancePct.toFixed(0)}%</Td>
                    <Td>
                      <Badge variant={SEV_VARIANT[a.severity]}>{a.severity}</Badge>
                    </Td>
                    <Td>
                      <Badge variant={STATUS_VARIANT[a.status]}>{a.status}</Badge>
                    </Td>
                    <Td className="text-right">
                      <Link href={`/waste/anomalies/${a.id}`} className="text-[11px] font-medium text-brand-700 hover:underline">
                        Investigate →
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      {/* Records */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Waste records</CardTitle>
          <form className="flex flex-wrap items-center gap-2">
            <Input type="date" name="from" defaultValue={toISODate(from)} className="h-8 w-36 text-xs" />
            <Input type="date" name="to" defaultValue={dateISO} className="h-8 w-36 text-xs" />
            <Select name="category" defaultValue={category} className="h-8 w-32 text-xs">
              <option value="ALL">All categories</option>
              {WASTE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select name="meal" defaultValue={meal} className="h-8 w-28 text-xs">
              <option value="ALL">All meals</option>
              {MEAL_TYPES.map((m) => (
                <option key={m} value={m}>
                  {MEAL_LABEL[m]}
                </option>
              ))}
            </Select>
            <Select name="location" defaultValue={location} className="h-8 w-36 text-xs">
              <option value="ALL">All locations</option>
              {LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
            <SubmitButton variant="secondary" size="sm">
              Filter
            </SubmitButton>
          </form>
        </CardHeader>
        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Meal</Th>
                <Th>Category</Th>
                <Th>Source</Th>
                <Th>Location</Th>
                <Th className="text-right">Weight</Th>
                <Th>Destination</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <Tr>
                  <Td colSpan={8} className="text-center text-xs text-ink-400">
                    No waste records match these filters. Record waste or adjust the filters.
                  </Td>
                </Tr>
              )}
              {records.map((r) => (
                <Tr key={r.id}>
                  <Td className="text-xs">{fmtDate(r.date, { month: "short", day: "numeric" })}</Td>
                  <Td className="text-xs">{r.mealType ? MEAL_LABEL[r.mealType] : "—"}</Td>
                  <Td>
                    <Badge variant={CAT_VARIANT[r.category]}>{r.category}</Badge>
                    {r.subCategory && <span className="ml-1 text-[10px] text-ink-400">{r.subCategory}</span>}
                  </Td>
                  <Td className="text-xs text-ink-500">
                    {r.source}
                    {r.dish && <div className="text-[10px] text-ink-400">{r.dish.name}</div>}
                  </Td>
                  <Td className="text-xs text-ink-500">{r.location}</Td>
                  <Td className="text-right tabular-nums font-medium">{num(r.weightKg, 1)} kg</Td>
                  <Td className="text-xs">
                    <Badge variant={r.treatmentDestination === "COMPOST" ? "success" : r.treatmentDestination === "DISPOSAL" ? "danger" : "neutral"}>
                      {r.treatmentDestination}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Modal trigger="Edit" variant="ghost" size="sm" title="Edit waste record">
                        <form action={updateWasteRecord} className="space-y-3">
                          <input type="hidden" name="redirectTo" value={`/waste?${qs}`} />
                          <input type="hidden" name="id" value={r.id} />
                          <Field label="Weight (kg)">
                            <Input name="weightKg" type="number" step="0.1" min="0.1" defaultValue={r.weightKg} />
                          </Field>
                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Category">
                              <Select name="category" defaultValue={r.category}>
                                {WASTE_CATEGORIES.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <Field label="Sub-category">
                              <Input name="subCategory" defaultValue={r.subCategory ?? ""} />
                            </Field>
                            <Field label="Source">
                              <Input name="source" defaultValue={r.source} />
                            </Field>
                            <Field label="Location">
                              <Input name="location" defaultValue={r.location} />
                            </Field>
                            <Field label="Reason" className="col-span-2">
                              <Select name="reasonId" defaultValue={r.reasonId ?? ""}>
                                <option value="">— none —</option>
                                {reasons.map((x) => (
                                  <option key={x.id} value={x.id}>
                                    {x.label}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <Field label="Treatment destination" className="col-span-2">
                              <Select name="treatmentDestination" defaultValue={r.treatmentDestination}>
                                {TREATMENT_DESTINATIONS.map((d) => (
                                  <option key={d} value={d}>
                                    {d}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                          </div>
                          <Field label="Notes">
                            <Textarea name="notes" defaultValue={r.notes ?? ""} className="min-h-[48px]" />
                          </Field>
                          <SubmitButton>Update record</SubmitButton>
                        </form>
                      </Modal>
                      <form action={deleteWasteRecord}>
                        <input type="hidden" name="redirectTo" value={`/waste?${qs}`} />
                        <input type="hidden" name="id" value={r.id} />
                        <ConfirmButton message="Delete this waste record?">
                          <Trash2 className="h-3.5 w-3.5" />
                        </ConfirmButton>
                      </form>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      <div className="mt-4">
        <LinkButton href="/waste/analytics" variant="secondary">
          Open waste analytics →
        </LinkButton>
      </div>
    </div>
  );
}
