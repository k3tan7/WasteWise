import { Leaf, Plus, Recycle, Sprout, Wind } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { addOutput, completeBatch, createBatch, deleteBatch, recordReuse } from "@/actions/treatment";
import { getSettings, settingNumber } from "@/lib/settings";
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
  Textarea,
} from "@/components/ui";
import { ConfirmButton, Flash, Modal, SubmitButton } from "@/components/form-ui";
import { fmtDate, num, toISODate } from "@/lib/utils";
import { BIOGAS_DESTINATIONS, COMPOST_DESTINATIONS, OUTPUT_TYPES, TREATMENT_METHODS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Treatment & Outputs" };

const METHOD_LABEL: Record<string, string> = {
  COMPOSTING: "Composting",
  ANAEROBIC_DIGESTION: "Anaerobic digestion",
  RECYCLING: "Recycling",
};
const STATUS_VARIANT: Record<string, string> = { PLANNED: "info", ACTIVE: "warning", COMPLETED: "success" };
const TYPE_LABEL: Record<string, string> = { COMPOST: "Compost", BIOGAS: "Biogas", DIGESTATE: "Digestate" };

export default async function TreatmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["ADMIN", "WASTE_MANAGER"]);
  const sp = await searchParams;

  const [batches, outputs, reuse, settings] = await Promise.all([
    prisma.treatmentBatch.findMany({
      orderBy: { startDate: "desc" },
      include: { outputs: { include: { reuseRecords: true } } },
    }),
    prisma.treatmentOutput.findMany({ include: { batch: true } }),
    prisma.reuseRecord.findMany({ orderBy: { date: "desc" }, take: 12, include: { output: { include: { batch: true } } } }),
    getSettings(),
  ]);

  const byType = OUTPUT_TYPES.map((t) => {
    const rows = outputs.filter((o) => o.type === t);
    const generated = rows.reduce((a, o) => a + o.quantity, 0);
    const reused = rows.reduce((a, o) => a + o.reusedQuantity, 0);
    return { type: t, generated, reused, remaining: Math.max(0, generated - reused), unit: rows[0]?.unit ?? "kg" };
  });

  const totalInput = batches.reduce((a, b) => a + b.inputKg, 0);
  const compostRecovery = settingNumber(settings, "compost_yield_max_pct", 30);
  const biogasYield = settingNumber(settings, "biogas_yield_m3_per_kg", 0.06);

  const activeBatches = batches.filter((b) => b.status === "ACTIVE");

  return (
    <div>
      <PageHeader
        title="Treatment & outputs"
        description="Waste → collection → weighing → segregation → treatment → output → reuse. Conversion assumptions are configurable in Settings and are estimates, not guarantees."
        actions={
          <Modal
            trigger={<><Plus className="h-3.5 w-3.5" /> New batch</>}
            title="Start a treatment batch"
            description="Expected output is calculated from the configurable conversion assumptions."
          >
            <form action={createBatch} className="space-y-3">
              <input type="hidden" name="redirectTo" value="/treatment" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Method">
                  <Select name="method" defaultValue="COMPOSTING">
                    {TREATMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {METHOD_LABEL[m]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Waste category">
                  <Select name="wasteCategory" defaultValue="FOOD">
                    <option value="FOOD">Food (organic)</option>
                    <option value="RECYCLABLE">Recyclable</option>
                  </Select>
                </Field>
                <Field label="Input (kg)">
                  <Input name="inputKg" type="number" min={1} step="0.1" required defaultValue={100} />
                </Field>
                <Field label="Start date">
                  <Input name="startDate" type="date" defaultValue={toISODate(new Date())} />
                </Field>
                <Field label="Destination" className="col-span-2">
                  <Input name="destination" placeholder="Campus Garden" />
                </Field>
                <Field label="Notes" className="col-span-2">
                  <Textarea name="notes" className="min-h-[48px]" />
                </Field>
              </div>
              <div className="flex justify-end">
                <SubmitButton>Start batch</SubmitButton>
              </div>
            </form>
          </Modal>
        }
      />

      <Flash error={sp.error} ok={sp.ok} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Compost generated" value={num(byType.find((b) => b.type === "COMPOST")?.generated ?? 0, 0)} unit="kg" tone="brand" />
        <Stat label="Compost reused" value={num(byType.find((b) => b.type === "COMPOST")?.reused ?? 0, 0)} unit="kg" />
        <Stat label="Biogas generated" value={num(byType.find((b) => b.type === "BIOGAS")?.generated ?? 0, 0)} unit="m³" />
        <Stat label="Total processed" value={num(totalInput, 0)} unit="kg" hint={`${batches.length} batches`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Treatment batches</CardTitle>
            <Badge variant={activeBatches.length ? "warning" : "neutral"}>{activeBatches.length} active</Badge>
          </CardHeader>
          {batches.length === 0 ? (
            <CardBody>
              <EmptyState
                title="No treatment batches yet"
                description="Start a composting or anaerobic digestion batch to begin converting organic waste into useful outputs."
                icon={<Recycle className="h-6 w-6" />}
              />
            </CardBody>
          ) : (
            <div className="mt-3">
              <Table>
                <thead>
                  <tr>
                    <Th>Batch</Th>
                    <Th>Method</Th>
                    <Th className="text-right">Input</Th>
                    <Th className="text-right">Expected</Th>
                    <Th className="text-right">Output</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <Tr key={b.id}>
                      <Td>
                        <div className="font-mono text-xs font-medium text-ink-800">{b.code}</div>
                        <div className="text-[10px] text-ink-400">
                          {fmtDate(b.startDate, { month: "short", day: "numeric" })}
                          {b.endDate ? ` → ${fmtDate(b.endDate, { month: "short", day: "numeric" })}` : ""}
                        </div>
                      </Td>
                      <Td className="text-xs">{METHOD_LABEL[b.method] ?? b.method}</Td>
                      <Td className="text-right tabular-nums">{num(b.inputKg, 0)} kg</Td>
                      <Td className="text-right tabular-nums text-ink-500">
                        {num(b.expectedOutputLow, 0)}–{num(b.expectedOutputHigh, 0)}
                      </Td>
                      <Td className="text-right tabular-nums">{b.outputKg != null ? `${num(b.outputKg, 0)} kg` : "—"}</Td>
                      <Td>
                        <Badge variant={STATUS_VARIANT[b.status]}>{b.status}</Badge>
                      </Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {b.status !== "COMPLETED" && (
                            <Modal trigger="Complete" size="sm" title={`Complete ${b.code}`}>
                              <form action={completeBatch} className="space-y-3">
                                <input type="hidden" name="redirectTo" value="/treatment" />
                                <input type="hidden" name="id" value={b.id} />
                                <p className="text-[11px] text-ink-500">
                                  Input {num(b.inputKg, 0)} kg · expected {num(b.expectedOutputLow, 0)}–{num(b.expectedOutputHigh, 0)}.
                                </p>
                                <Field label="Actual output (kg)">
                                  <Input name="outputKg" type="number" min={0} step="0.1" required defaultValue={b.expectedOutputHigh ?? 0} />
                                </Field>
                                <Field label="End date">
                                  <Input name="endDate" type="date" defaultValue={toISODate(new Date())} />
                                </Field>
                                <Field label="Destination">
                                  <Input name="destination" defaultValue={b.destination ?? ""} />
                                </Field>
                                <Field label="Quality grade (optional)">
                                  <Input name="quality" placeholder="Grade A" />
                                </Field>
                                <SubmitButton>Complete batch</SubmitButton>
                              </form>
                            </Modal>
                          )}
                          <form action={deleteBatch}>
                            <input type="hidden" name="redirectTo" value="/treatment" />
                            <input type="hidden" name="id" value={b.id} />
                            <ConfirmButton message={`Delete ${b.code}? Outputs and reuse records will also be removed.`}>Delete</ConfirmButton>
                          </form>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <Sprout className="h-4 w-4 text-brand-600" /> Outputs
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 pt-3">
              {byType.map((t) => (
                <div key={t.type} className="rounded-xl border border-ink-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-800">
                      {t.type === "COMPOST" ? <Leaf className="h-3.5 w-3.5 text-brand-600" /> : <Wind className="h-3.5 w-3.5 text-sky-500" />}
                      {TYPE_LABEL[t.type]}
                    </p>
                    <span className="text-[10px] text-ink-400">{t.unit}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[11px]">
                    <div>
                      <div className="font-semibold text-ink-800">{num(t.generated, 0)}</div>
                      <div className="text-ink-400">generated</div>
                    </div>
                    <div>
                      <div className="font-semibold text-brand-700">{num(t.reused, 0)}</div>
                      <div className="text-ink-400">reused</div>
                    </div>
                    <div>
                      <div className="font-semibold text-ink-800">{num(t.remaining, 0)}</div>
                      <div className="text-ink-400">remaining</div>
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-ink-400">
                Conversion assumptions: compost yield up to {compostRecovery}% of input, biogas ≈ {biogasYield} m³ per kg organic
                waste. These are planning estimates — actual yields vary with feedstock and process control.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Record campus reuse</CardTitle>
            </CardHeader>
            <CardBody className="pt-3">
              <form action={recordReuse} className="space-y-3">
                <input type="hidden" name="redirectTo" value="/treatment" />
                <Field label="Output">
                  <Select name="outputId" required>
                    <option value="">Select an output…</option>
                    {outputs
                      .filter((o) => o.quantity - o.reusedQuantity > 0.001)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.batch.code} · {TYPE_LABEL[o.type]} · {num(o.quantity - o.reusedQuantity, 1)} {o.unit} available
                        </option>
                      ))}
                  </Select>
                </Field>
                <Field label="Destination">
                  <Select name="destination" required>
                    {[...COMPOST_DESTINATIONS, ...BIOGAS_DESTINATIONS].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Quantity">
                    <Input name="quantity" type="number" min={0.1} step="0.1" required />
                  </Field>
                  <Field label="Date">
                    <Input name="date" type="date" defaultValue={toISODate(new Date())} />
                  </Field>
                </div>
                <Field label="Note (optional)">
                  <Input name="note" placeholder="Applied to campus grounds" />
                </Field>
                <SubmitButton className="w-full">Record reuse</SubmitButton>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent reuse records</CardTitle>
          </CardHeader>
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Output</Th>
                  <Th>Destination</Th>
                  <Th className="text-right">Quantity</Th>
                </tr>
              </thead>
              <tbody>
                {reuse.length === 0 && (
                  <Tr>
                    <Td colSpan={4} className="text-center text-xs text-ink-400">
                      No reuse recorded yet.
                    </Td>
                  </Tr>
                )}
                {reuse.map((r) => (
                  <Tr key={r.id}>
                    <Td className="text-xs">{fmtDate(r.date, { month: "short", day: "numeric" })}</Td>
                    <Td className="text-xs">
                      {TYPE_LABEL[r.output.type]} · {r.output.batch.code}
                    </Td>
                    <Td className="text-xs text-ink-600">{r.destination}</Td>
                    <Td className="text-right tabular-nums">
                      {num(r.quantity, 0)} {r.output.unit}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outputs per batch</CardTitle>
          </CardHeader>
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Batch</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Quantity</Th>
                  <Th className="text-right">Reused</Th>
                  <Th>Destination</Th>
                </tr>
              </thead>
              <tbody>
                {outputs.length === 0 && (
                  <Tr>
                    <Td colSpan={5} className="text-center text-xs text-ink-400">
                      Complete a batch to generate outputs.
                    </Td>
                  </Tr>
                )}
                {outputs.map((o) => (
                  <Tr key={o.id}>
                    <Td className="font-mono text-[11px]">{o.batch.code}</Td>
                    <Td>
                      <Badge variant={o.type === "COMPOST" ? "success" : o.type === "BIOGAS" ? "info" : "neutral"}>{TYPE_LABEL[o.type]}</Badge>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {num(o.quantity, 0)} {o.unit}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {num(o.reusedQuantity, 0)}
                    </Td>
                    <Td className="text-xs text-ink-500">{o.reuseDestination ?? "—"}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Add an output to a batch</CardTitle>
        </CardHeader>
        <CardBody className="pt-3">
          <form action={addOutput} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="redirectTo" value="/treatment" />
            <Field label="Batch">
              <Select name="batchId" required>
                <option value="">Select…</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Type">
              <Select name="type" defaultValue="COMPOST">
                {OUTPUT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Quantity">
              <Input name="quantity" type="number" min={0.1} step="0.1" required />
            </Field>
            <Field label="Unit">
              <Select name="unit" defaultValue="kg">
                <option value="kg">kg</option>
                <option value="m3">m³</option>
              </Select>
            </Field>
            <Field label="Destination">
              <Input name="reuseDestination" placeholder="Campus Garden" />
            </Field>
            <SubmitButton variant="secondary">Add output</SubmitButton>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
