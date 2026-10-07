import { prisma } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/constants";

export type SettingsMap = Record<string, string>;

/** All campus settings, with defaults filled in for any missing row. */
export async function getSettings(): Promise<SettingsMap> {
  const rows = await prisma.campusSetting.findMany();
  const map: SettingsMap = {};
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) map[key] = def.value as string;
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export function settingNumber(map: SettingsMap, key: string, fallback = 0): number {
  const v = Number(map[key]);
  return Number.isFinite(v) ? v : fallback;
}

export function settingBool(map: SettingsMap, key: string): boolean {
  return map[key] === "true";
}

/** Convenience accessors with sensible typed defaults. */
export function prepBufferPct(map: SettingsMap) {
  return settingNumber(map, "prep_buffer_pct", 2);
}
export function anomalyThresholdPct(map: SettingsMap) {
  return settingNumber(map, "anomaly_threshold_pct", 25);
}
/**
 * Reference food waste the campus produced per day *before* WasteWise.
 * Kept in sync with the seed (which reads this same default) so the
 * "reduction vs baseline" KPIs and the simulated data can never drift apart.
 */
export function dailyBaselineKg(map: SettingsMap) {
  return settingNumber(map, "baseline_waste_kg_per_day", Number(DEFAULT_SETTINGS.baseline_waste_kg_per_day.value));
}
export function participationBaseline(map: SettingsMap, mealType: string) {
  const key = `${mealType.toLowerCase()}_participation_baseline`;
  return settingNumber(map, key, 60);
}
