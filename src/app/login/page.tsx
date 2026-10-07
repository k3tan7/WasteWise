import Link from "next/link";
import { redirect } from "next/navigation";
import { Leaf, ShieldCheck, TrendingUp, Recycle } from "lucide-react";
import { loginAction } from "@/actions/auth";
import { getSession } from "@/lib/auth";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/form-ui";

export const metadata = { title: "Sign in" };

const DEMO = [
  { role: "Campus Admin", email: "admin@wastewise.demo", password: "admin123" },
  { role: "Mess Manager", email: "mess@wastewise.demo", password: "mess123" },
  { role: "Sustainability Manager", email: "waste@wastewise.demo", password: "waste123" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/dashboard");
  const { error, next } = await searchParams;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="relative hidden flex-col justify-between bg-ink-900 p-10 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
            <Leaf className="h-4 w-4 text-white" />
          </span>
          <span className="text-sm font-semibold tracking-tight">WasteWise</span>
        </Link>

        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Prevent waste before it is created. Treat the rest.
          </h2>
          <p className="mt-4 max-w-md text-sm text-white/60">
            Attendance → Demand → Inventory → Procurement → Preparation → Waste → Treatment → Reuse. One connected loop.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { icon: TrendingUp, label: "Demand prediction" },
              { icon: ShieldCheck, label: "Waste anomaly detection" },
              { icon: Recycle, label: "Treatment & reuse" },
            ].map((f) => (
              <div key={f.label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <f.icon className="h-4 w-4 text-brand-400" />
                <p className="mt-2 text-[11px] leading-tight text-white/70">{f.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-white/40">Demo campus dataset · Rishihood University</p>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center bg-ink-50 p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
              <Leaf className="h-5 w-5 text-white" />
            </span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">Sign in to WasteWise</h1>
          <p className="mt-1 text-sm text-ink-500">Use a demo account to explore the platform.</p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <form action={loginAction} className="mt-5 space-y-4">
            <input type="hidden" name="next" value={next ?? "/dashboard"} />
            <Field label="Email">
              <Input name="email" type="email" required placeholder="admin@wastewise.demo" defaultValue="admin@wastewise.demo" />
            </Field>
            <Field label="Password">
              <Input name="password" type="password" required placeholder="••••••••" defaultValue="admin123" />
            </Field>
            <SubmitButton className="w-full" size="lg" pendingLabel="Signing in…">
              Sign in
            </SubmitButton>
            <p className="text-center text-[11px] text-ink-400">
              First sign-in can take a few seconds while the server wakes up.
            </p>
          </form>

          <div className="mt-6 rounded-xl border border-ink-200 bg-white p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Demo accounts</p>
            <div className="space-y-1.5">
              {DEMO.map((d) => (
                <div key={d.email} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-ink-600">{d.role}</span>
                  <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-ink-700">
                    {d.email} / {d.password}
                  </code>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-ink-400">
            <Link href="/" className="hover:text-ink-600">
              ← Back to landing page
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
