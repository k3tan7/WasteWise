import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { round, startOfDay } from "@/lib/utils";

/**
 * WasteWise Station ingest API — the endpoint future hardware calls.
 *
 *   sensor / ESP32 controller → POST /api/station/ingest → database → dashboards
 *
 * The MVP UI writes through the same logic via the `recordStationReading`
 * server action, so manual entry and hardware produce identical records.
 *
 * Auth: the station identifies itself with a device key in the
 * `X-Station-Key` header. For the MVP demo this must match the
 * STATION_INGEST_KEY environment variable (a shared device secret, not a
 * user credential).
 */
export async function POST(req: Request) {
  const key = req.headers.get("x-station-key");
  const expected = process.env.STATION_INGEST_KEY;
  if (!expected || !key || key !== expected) {
    return NextResponse.json({ error: "Unauthorized station key." }, { status: 401 });
  }

  let body: {
    deviceId?: string;
    stationId?: string;
    organicKg?: number | string;
    recyclableKg?: number | string;
    rejectKg?: number | string;
    fillLevelPct?: number | string;
    latitude?: number;
    longitude?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const num = (v: unknown): number => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  };
  const organicKg = num(body.organicKg);
  const recyclableKg = num(body.recyclableKg);
  const rejectKg = num(body.rejectKg);
  if (organicKg + recyclableKg + rejectKg <= 0) {
    return NextResponse.json({ error: "At least one weight must be greater than zero." }, { status: 422 });
  }

  // Resolve the station by explicit id or by the device identifier burned into
  // the controller (e.g. an ESP32's chip ID).
  const station = body.stationId
    ? await prisma.station.findUnique({ where: { id: body.stationId } })
    : body.deviceId
      ? await prisma.station.findFirst({ where: { deviceId: body.deviceId } })
      : null;
  if (!station) {
    return NextResponse.json({ error: "Unknown stationId or deviceId." }, { status: 404 });
  }

  const today = startOfDay(new Date());
  const rows = [
    organicKg > 0 && { category: "FOOD", subCategory: "PLATE", source: "STATION", weightKg: organicKg, treatmentDestination: "COMPOST" },
    recyclableKg > 0 && { category: "RECYCLABLE", subCategory: "PLASTIC", source: "STATION", weightKg: recyclableKg, treatmentDestination: "RECYCLE" },
    rejectKg > 0 && { category: "REJECT", subCategory: "CONTAMINATED", source: "STATION", weightKg: rejectKg, treatmentDestination: "DISPOSAL" },
  ].filter(Boolean) as { category: string; subCategory: string; source: string; weightKg: number; treatmentDestination: string }[];

  await prisma.wasteRecord.createMany({
    data: rows.map((r) => ({
      date: today,
      location: station.location,
      mealType: null,
      notes: `Station ingest (${station.name})`,
      ...r,
    })),
  });

  const total = round(organicKg + recyclableKg + rejectKg, 2);
  await prisma.station.update({
    where: { id: station.id },
    data: {
      organicKg: round(station.organicKg + organicKg, 2),
      recyclableKg: round(station.recyclableKg + recyclableKg, 2),
      rejectKg: round(station.rejectKg + rejectKg, 2),
      currentWeightKg: round(station.currentWeightKg + total, 2),
      status: "ONLINE",
    },
  });

  return NextResponse.json({
    ok: true,
    station: station.name,
    recordedKg: total,
    fillLevelPct: body.fillLevelPct != null ? num(body.fillLevelPct) : null,
    at: new Date().toISOString(),
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "WasteWise Station ingest",
    method: "POST",
    headers: { "X-Station-Key": "<STATION_INGEST_KEY>" },
    body: {
      deviceId: "esp32-<chip-id> (or stationId)",
      organicKg: 0,
      recyclableKg: 0,
      rejectKg: 0,
      fillLevelPct: "optional 0-100",
    },
  });
}
