import { Cpu, Scale, Wifi } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { collectStation, recordStationReading, setStationStatus } from "@/actions/station";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  PageHeader,
  ProgressBar,
  Select,
  Stat,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { Flash, Modal, SubmitButton } from "@/components/form-ui";
import { fmtDate, kg, num } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "WasteWise Station" };

const STATUS_VARIANT: Record<string, string> = { ONLINE: "success", IDLE: "neutral", MAINTENANCE: "warning" };

export default async function StationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["ADMIN", "MESS_MANAGER", "WASTE_MANAGER"]);
  const sp = await searchParams;

  const [stations, activeBatch, recentReadings] = await Promise.all([
    prisma.station.findMany({ orderBy: { name: "asc" } }),
    prisma.treatmentBatch.findFirst({ where: { status: "ACTIVE" }, orderBy: { startDate: "desc" } }),
    prisma.wasteRecord.findMany({
      where: { source: "STATION" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const totalToday = stations.reduce((a, s) => a + s.currentWeightKg, 0);
  const organic = stations.reduce((a, s) => a + s.organicKg, 0);
  const recyclable = stations.reduce((a, s) => a + s.recyclableKg, 0);
  const reject = stations.reduce((a, s) => a + s.rejectKg, 0);

  return (
    <div>
      <PageHeader
        title="WasteWise Station"
        description="The physical collection point. Operators enter weights manually today; the same endpoint is ready for load cells, fill-level sensors and RFID identification over the API."
        actions={
          <Badge variant="brand">
            <Wifi className="h-3 w-3" /> Sensor-ready architecture
          </Badge>
        }
      />

      <Flash error={sp.error} ok={sp.ok} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="On-station now" value={num(totalToday, 1)} unit="kg" tone="brand" />
        <Stat label="Organic" value={num(organic, 1)} unit="kg" />
        <Stat label="Recyclables" value={num(recyclable, 1)} unit="kg" />
        <Stat label="Rejects" value={num(reject, 1)} unit="kg" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {stations.map((s) => {
          const fill = s.capacityKg > 0 ? (s.currentWeightKg / s.capacityKg) * 100 : 0;
          return (
            <Card key={s.id}>
              <CardHeader>
                <div>
                  <CardTitle className="inline-flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-ink-500" /> {s.name}
                  </CardTitle>
                  <p className="mt-0.5 text-[11px] text-ink-500">{s.location}</p>
                </div>
                <Badge variant={STATUS_VARIANT[s.status]}>{s.status}</Badge>
              </CardHeader>
              <CardBody className="pt-3">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-ink-400">Current weight</p>
                    <p className="text-2xl font-semibold tabular-nums text-ink-900">{num(s.currentWeightKg, 1)} kg</p>
                  </div>
                  <p className="text-[11px] text-ink-400">capacity {num(s.capacityKg, 0)} kg</p>
                </div>
                <div className="mt-2">
                  <ProgressBar value={fill} tone={fill > 85 ? "danger" : fill > 60 ? "warning" : "brand"} />
                  <p className="mt-1 text-[10px] text-ink-400">{fill.toFixed(0)}% full</p>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="rounded-lg bg-brand-50 py-1.5">
                    <div className="font-semibold text-brand-700">{num(s.organicKg, 1)}</div>
                    <div className="text-brand-600">organic</div>
                  </div>
                  <div className="rounded-lg bg-sky-50 py-1.5">
                    <div className="font-semibold text-sky-700">{num(s.recyclableKg, 1)}</div>
                    <div className="text-sky-600">recyclable</div>
                  </div>
                  <div className="rounded-lg bg-ink-100 py-1.5">
                    <div className="font-semibold text-ink-700">{num(s.rejectKg, 1)}</div>
                    <div className="text-ink-500">reject</div>
                  </div>
                </div>

                <p className="mt-3 text-[10px] text-ink-400">
                  {s.deviceId ? `Device ${s.deviceId} · ` : ""}
                  Last collection {s.lastCollectionAt ? fmtDate(s.lastCollectionAt) : "never"}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Modal trigger={<><Scale className="h-3.5 w-3.5" /> Weigh</>} size="sm" title={`Record reading — ${s.name}`} description="Manual weight entry (future hardware will post here automatically).">
                    <form action={recordStationReading} className="space-y-3">
                      <input type="hidden" name="redirectTo" value="/station" />
                      <input type="hidden" name="stationId" value={s.id} />
                      <div className="grid grid-cols-3 gap-3">
                        <Field label="Organic kg">
                          <Input name="organicKg" type="number" min={0} step="0.1" defaultValue={0} />
                        </Field>
                        <Field label="Recyclable kg">
                          <Input name="recyclableKg" type="number" min={0} step="0.1" defaultValue={0} />
                        </Field>
                        <Field label="Reject kg">
                          <Input name="rejectKg" type="number" min={0} step="0.1" defaultValue={0} />
                        </Field>
                      </div>
                      <p className="text-[11px] text-ink-400">This creates waste records for today at {s.location}.</p>
                      <SubmitButton>Save reading</SubmitButton>
                    </form>
                  </Modal>
                  <form action={collectStation}>
                    <input type="hidden" name="redirectTo" value="/station" />
                    <input type="hidden" name="stationId" value={s.id} />
                    <SubmitButton variant="secondary" size="sm" pendingLabel="…">
                      Mark collected
                    </SubmitButton>
                  </form>
                  <form action={setStationStatus} className="flex items-center gap-1.5">
                    <input type="hidden" name="redirectTo" value="/station" />
                    <input type="hidden" name="stationId" value={s.id} />
                    <Select name="status" defaultValue={s.status} className="h-8 w-28 text-xs">
                      <option value="ONLINE">Online</option>
                      <option value="IDLE">Idle</option>
                      <option value="MAINTENANCE">Maintenance</option>
                    </Select>
                    <SubmitButton variant="ghost" size="sm" pendingLabel="…">
                      Set
                    </SubmitButton>
                  </form>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current treatment batch</CardTitle>
          </CardHeader>
          <CardBody className="pt-3">
            {activeBatch ? (
              <div className="rounded-xl border border-ink-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm font-medium text-ink-800">{activeBatch.code}</p>
                  <Badge variant="warning">{activeBatch.status}</Badge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <div className="font-semibold tabular-nums text-ink-800">{num(activeBatch.inputKg, 0)} kg</div>
                    <div className="text-ink-400">input</div>
                  </div>
                  <div>
                    <div className="font-semibold tabular-nums text-ink-800">
                      {num(activeBatch.expectedOutputLow ?? 0, 0)}–{num(activeBatch.expectedOutputHigh ?? 0, 0)}
                    </div>
                    <div className="text-ink-400">expected output</div>
                  </div>
                  <div>
                    <div className="font-semibold text-ink-800">{activeBatch.destination ?? "—"}</div>
                    <div className="text-ink-400">destination</div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-ink-500">
                  Started {fmtDate(activeBatch.startDate)} · {activeBatch.method.replace(/_/g, " ").toLowerCase()}
                </p>
              </div>
            ) : (
              <p className="text-xs text-ink-400">No active treatment batch. Start one from Treatment &amp; Outputs.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent station readings</CardTitle>
          </CardHeader>
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Location</Th>
                  <Th>Category</Th>
                  <Th className="text-right">Weight</Th>
                </tr>
              </thead>
              <tbody>
                {recentReadings.length === 0 && (
                  <Tr>
                    <Td colSpan={4} className="text-center text-xs text-ink-400">
                      No station readings recorded yet.
                    </Td>
                  </Tr>
                )}
                {recentReadings.map((r) => (
                  <Tr key={r.id}>
                    <Td className="text-xs text-ink-500">
                      {fmtDate(r.createdAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </Td>
                    <Td className="text-xs">{r.location}</Td>
                    <Td>
                      <Badge variant={r.category === "FOOD" ? "success" : r.category === "RECYCLABLE" ? "info" : "neutral"}>{r.category}</Badge>
                    </Td>
                    <Td className="text-right tabular-nums">{kg(r.weightKg)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Hardware integration roadmap</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-3 text-[11px] text-ink-600 sm:grid-cols-3">
          <div className="rounded-xl border border-ink-200 p-3">
            <p className="font-medium text-ink-800">Sensor → API → database → dashboard</p>
            <p className="mt-1">
              A single `recordStationReading` endpoint accepts a station id and category weights. A load cell + ESP32 can POST the
              same payload the manual form submits today.
            </p>
          </div>
          <div className="rounded-xl border border-ink-200 p-3">
            <p className="font-medium text-ink-800">Fill-level &amp; identity</p>
            <p className="mt-1">
              The station record carries a `deviceId` and capacity so fill-level sensors and RFID/QR identification can be added
              without schema changes.
            </p>
          </div>
          <div className="rounded-xl border border-ink-200 p-3">
            <p className="font-medium text-ink-800">No hardware required</p>
            <p className="mt-1">
              The MVP is fully functional with manual entry — nothing here depends on physical hardware being present.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
