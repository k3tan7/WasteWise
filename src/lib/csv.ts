import Papa from "papaparse";

export type CsvResult<T> = { rows: T[]; errors: string[] };

/** Parse a CSV string into typed rows, collecting useful row-level errors. */
export function parseCsv<T extends Record<string, unknown>>(text: string): CsvResult<T> {
  const result = Papa.parse<T>(text.trim(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const errors = result.errors
    .filter((e) => e.type !== "FieldMismatch" || true)
    .slice(0, 10)
    .map((e) => `Row ${typeof e.row === "number" ? e.row + 2 : "?"}: ${e.message}`);
  return { rows: (result.data ?? []) as T[], errors };
}

/** Build a CSV string from row objects. */
export function toCsv(rows: Record<string, unknown>[], headers?: string[]): string {
  if (!rows.length) return headers ? headers.join(",") + "\n" : "";
  return Papa.unparse(rows, headers ? { columns: headers } : {});
}

export function toBool(v: unknown, fallback = false): boolean {
  if (v === undefined || v === null || v === "") return fallback;
  const s = String(v).trim().toLowerCase();
  return ["true", "1", "yes", "y", "present", "p"].includes(s);
}

export function toNumber(v: unknown, fallback = 0): number {
  const n = Number(String(v ?? "").replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

/** Parse a date value that may be ISO, dd/mm/yyyy, or yyyy/mm/dd. */
export function toDate(v: unknown): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
