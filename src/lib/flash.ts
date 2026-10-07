import { redirect } from "next/navigation";

/** Append query params to a path and redirect (used for success/error feedback). */
export function flash(path: string, params: Record<string, string | undefined>): never {
  const [base, hash] = path.split("#");
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const qs = q.toString();
  redirect(`${base}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`);
}

export function success(path: string, message: string): never {
  return flash(path, { ok: message });
}

export function fail(path: string, message: string): never {
  return flash(path, { error: message });
}

/** Where a form should return to, defaulting to a sensible path. */
export function redirectTarget(formData: FormData, fallback: string): string {
  const t = String(formData.get("redirectTo") ?? "").trim();
  if (t && t.startsWith("/")) return t;
  return fallback;
}
