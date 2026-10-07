"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fail, success, redirectTarget } from "@/lib/flash";
import { toNumber } from "@/lib/csv";
import { round, startOfDay } from "@/lib/utils";
import { getSettings, settingNumber } from "@/lib/settings";

const ALLOWED = ["ADMIN", "WASTE_MANAGER"] as const;

function str(fd: FormData, key: string, fallback = "") {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : fallback;
}

function refresh() {
  revalidatePath("/treatment");
  revalidatePath("/station");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

/** Expected output range from the *configurable* conversion assumptions. */
function expectedRange(method: string, inputKg: number, settings: Record<string, string>) {
  if (method === "COMPOSTING") {
    const lo = settingNumber(settings, "compost_yield_min_pct", 20) / 100;
    const hi = settingNumber(settings, "compost_yield_max_pct", 30) / 100;
    return { low: round(inputKg * lo, 1), high: round(inputKg * hi, 1), unit: "kg" };
  }
  if (method === "ANAEROBIC_DIGESTION") {
    const perKg = settingNumber(settings, "biogas_yield_m3_per_kg", 0.06);
    const digestatePct = settingNumber(settings, "digestate_yield_pct", 65) / 100;
    return { low: round(inputKg * perKg * 0.8, 1), high: round(inputKg * perKg * 1.2, 1), unit: "m3", digestate: round(inputKg * digestatePct, 1) };
  }
  // Recycling reports recovered material tonnage rather than a conversion rate.
  return { low: round(inputKg * 0.7, 1), high: round(inputKg * 0.9, 1), unit: "kg" };
}

export async function createBatch(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/treatment");
  const method = str(fd, "method", "COMPOSTING");
  const inputKg = toNumber(str(fd, "inputKg"), 0);
  if (!["COMPOSTING", "ANAEROBIC_DIGESTION", "RECYCLING"].includes(method)) fail(path, "Invalid treatment method.");
  if (inputKg <= 0) fail(path, "Input weight must be greater than zero.");

  const settings = await getSettings();
  const range = expectedRange(method, inputKg, settings);
  const year = new Date().getFullYear();
  const seq = (await prisma.treatmentBatch.count({ where: { code: { startsWith: `BATCH-${year}` } } })) + 1;
  const code = `BATCH-${year}-${String(seq).padStart(3, "0")}`;

  try {
    await prisma.treatmentBatch.create({
      data: {
        code,
        method,
        wasteCategory: str(fd, "wasteCategory", "FOOD"),
        inputKg,
        startDate: startOfDay(new Date(str(fd, "startDate") || Date.now())),
        status: "ACTIVE",
        expectedOutputLow: range.low,
        expectedOutputHigh: range.high,
        destination: str(fd, "destination") || null,
        notes: str(fd, "notes") || null,
      },
    });
  } catch {
    fail(path, "Could not create the treatment batch.");
  }
  refresh();
  success(path, `Batch ${code} started with ${inputKg} kg input.`);
}

export async function completeBatch(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/treatment");
  const id = str(fd, "id");
  const batch = await prisma.treatmentBatch.findUnique({ where: { id } });
  if (!batch) fail(path, "Batch not found.");
  const outputKg = toNumber(str(fd, "outputKg"), 0);

  await prisma.treatmentBatch.update({
    where: { id },
    data: { status: "COMPLETED", outputKg, endDate: startOfDay(new Date(str(fd, "endDate") || Date.now())) },
  });

  // Record the primary output (and digestate for anaerobic digestion).
  const settings = await getSettings();
  const range = expectedRange(batch!.method, batch!.inputKg, settings);
  const type = batch!.method === "COMPOSTING" ? "COMPOST" : batch!.method === "ANAEROBIC_DIGESTION" ? "BIOGAS" : "COMPOST";
  const existing = await prisma.treatmentOutput.count({ where: { batchId: id, type } });
  if (existing === 0 && outputKg > 0) {
    await prisma.treatmentOutput.create({
      data: {
        batchId: id,
        type,
        unit: range.unit,
        quantity: outputKg,
        reuseDestination: str(fd, "destination") || batch!.destination || null,
        quality: str(fd, "quality") || null,
      },
    });
    if (batch!.method === "ANAEROBIC_DIGESTION" && range.digestate) {
      await prisma.treatmentOutput.create({
        data: { batchId: id, type: "DIGESTATE", unit: "kg", quantity: range.digestate, reuseDestination: "Agriculture Dept. Farm" },
      });
    }
  }

  await prisma.alert.create({
    data: {
      type: "BATCH_COMPLETE",
      severity: "SUCCESS",
      title: `Batch ${batch!.code} completed`,
      message: `${batch!.inputKg} kg processed with ${outputKg} ${range.unit} of usable output recorded.`,
      entityType: "TreatmentBatch",
      entityId: id,
    },
  });

  refresh();
  success(path, `Batch ${batch!.code} completed — ${outputKg} ${range.unit} output recorded.`);
}

export async function addOutput(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/treatment");
  const batchId = str(fd, "batchId");
  const type = str(fd, "type", "COMPOST");
  const quantity = toNumber(str(fd, "quantity"), 0);
  if (!batchId) fail(path, "Select a batch.");
  if (quantity <= 0) fail(path, "Quantity must be greater than zero.");
  await prisma.treatmentOutput.create({
    data: {
      batchId,
      type,
      unit: str(fd, "unit", "kg"),
      quantity,
      reuseDestination: str(fd, "reuseDestination") || null,
      quality: str(fd, "quality") || null,
    },
  });
  refresh();
  success(path, `${type} output recorded.`);
}

export async function recordReuse(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/treatment");
  const outputId = str(fd, "outputId");
  const quantity = toNumber(str(fd, "quantity"), 0);
  const destination = str(fd, "destination");
  if (!outputId || !destination) fail(path, "Output and destination are required.");
  if (quantity <= 0) fail(path, "Quantity must be greater than zero.");

  const output = await prisma.treatmentOutput.findUnique({ where: { id: outputId } });
  if (!output) fail(path, "Output not found.");
  const remaining = output!.quantity - output!.reusedQuantity;
  if (quantity > remaining + 0.001) fail(path, `Only ${round(remaining, 1)} ${output!.unit} of that output remains to be reused.`);

  await prisma.$transaction([
    prisma.reuseRecord.create({
      data: {
        outputId,
        destination,
        quantity,
        date: startOfDay(new Date(str(fd, "date") || Date.now())),
        note: str(fd, "note") || null,
      },
    }),
    prisma.treatmentOutput.update({
      where: { id: outputId },
      data: { reusedQuantity: round(output!.reusedQuantity + quantity, 2), reuseDestination: destination },
    }),
  ]);
  refresh();
  success(path, `${quantity} ${output!.unit} of ${output!.type.toLowerCase()} recorded as reused at ${destination}.`);
}

export async function setBatchStatus(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/treatment");
  const status = str(fd, "status");
  if (!["PLANNED", "ACTIVE", "COMPLETED"].includes(status)) fail(path, "Invalid status.");
  await prisma.treatmentBatch.update({ where: { id: str(fd, "id") }, data: { status } });
  refresh();
  success(path, `Batch marked ${status.toLowerCase()}.`);
}

export async function deleteBatch(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/treatment");
  await prisma.treatmentBatch.delete({ where: { id: str(fd, "id") } }).catch(() => fail(path, "Could not delete batch."));
  refresh();
  success(path, "Treatment batch deleted.");
}
