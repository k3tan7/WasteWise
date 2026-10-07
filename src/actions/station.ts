"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fail, success, redirectTarget } from "@/lib/flash";
import { toNumber } from "@/lib/csv";
import { round, startOfDay } from "@/lib/utils";

const ALLOWED = ["ADMIN", "MESS_MANAGER", "WASTE_MANAGER"] as const;

function str(fd: FormData, key: string, fallback = "") {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : fallback;
}

function refresh() {
  revalidatePath("/station");
  revalidatePath("/waste");
  revalidatePath("/dashboard");
}

/**
 * Manual weight entry for a station. In the MVP an operator types the reading;
 * the same handler is the endpoint future hardware (load cells / ESP32) would
 * call via the API.
 */
export async function recordStationReading(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/station");
  const stationId = str(fd, "stationId");
  const station = await prisma.station.findUnique({ where: { id: stationId } });
  if (!station) fail(path, "Station not found.");

  const organicKg = Math.max(0, toNumber(str(fd, "organicKg"), 0));
  const recyclableKg = Math.max(0, toNumber(str(fd, "recyclableKg"), 0));
  const rejectKg = Math.max(0, toNumber(str(fd, "rejectKg"), 0));
  if (organicKg + recyclableKg + rejectKg <= 0) fail(path, "Enter at least one weight above zero.");

  const today = startOfDay(new Date());
  const rows: {
    category: string;
    subCategory: string;
    source: string;
    weightKg: number;
  }[] = [];
  if (organicKg > 0) rows.push({ category: "FOOD", subCategory: "PLATE", source: "STATION", weightKg: organicKg });
  if (recyclableKg > 0) rows.push({ category: "RECYCLABLE", subCategory: "PLASTIC", source: "STATION", weightKg: recyclableKg });
  if (rejectKg > 0) rows.push({ category: "REJECT", subCategory: "CONTAMINATED", source: "STATION", weightKg: rejectKg });

  await prisma.wasteRecord.createMany({
    data: rows.map((r) => ({
      date: today,
      location: station!.location,
      mealType: null,
      treatmentDestination: r.category === "FOOD" ? "COMPOST" : r.category === "RECYCLABLE" ? "RECYCLE" : "DISPOSAL",
      notes: `Station reading (${station!.name})`,
      ...r,
    })),
  });

  await prisma.station.update({
    where: { id: stationId },
    data: {
      organicKg: round(station!.organicKg + organicKg, 2),
      recyclableKg: round(station!.recyclableKg + recyclableKg, 2),
      rejectKg: round(station!.rejectKg + rejectKg, 2),
      currentWeightKg: round(station!.currentWeightKg + organicKg + recyclableKg + rejectKg, 2),
      status: "ONLINE",
    },
  });

  refresh();
  success(path, `Recorded ${round(organicKg + recyclableKg + rejectKg, 1)} kg at ${station!.name}.`);
}

/** Mark a station as emptied/collected. */
export async function collectStation(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/station");
  const stationId = str(fd, "stationId");
  const station = await prisma.station.findUnique({ where: { id: stationId } });
  if (!station) fail(path, "Station not found.");
  await prisma.station.update({
    where: { id: stationId },
    data: { currentWeightKg: 0, organicKg: 0, recyclableKg: 0, rejectKg: 0, lastCollectionAt: new Date() },
  });
  refresh();
  success(path, `${station!.name} marked as collected.`);
}

export async function setStationStatus(fd: FormData) {
  await requireRole([...ALLOWED]);
  const path = redirectTarget(fd, "/station");
  const status = str(fd, "status");
  if (!["ONLINE", "IDLE", "MAINTENANCE"].includes(status)) fail(path, "Invalid station status.");
  await prisma.station.update({ where: { id: str(fd, "stationId") }, data: { status } });
  refresh();
  success(path, `Station marked ${status.toLowerCase()}.`);
}
