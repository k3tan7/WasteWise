import Link from "next/link";
import {
  ArrowRight, BarChart3, Brain, CheckCircle2, ChefHat, Cpu, Leaf,
  LineChart, Package, Recycle, Scale, ShieldCheck, TrendingDown, Users,
} from "lucide-react";

const LOOP = [
  { icon: Users, label: "Attendance", desc: "Who is on campus today" },
  { icon: Brain, label: "Prediction", desc: "ML models forecast demand & waste" },
  { icon: Package, label: "Inventory", desc: "Exact ingredient requirements" },
  { icon: ChefHat, label: "Preparation", desc: "Cook the recommended amount" },
  { icon: Scale, label: "Waste", desc: "Weigh, segregate, attribute" },
  { icon: Recycle, label: "Treatment", desc: "Compost & biogas batches" },
  { icon: Leaf, label: "Reuse", desc: "Outputs back into campus life" },
];

const FEATURES = [
  {
    icon: Brain,
    title: "Predictive food management",
    body: "Regression models — ridge linear regression and random forests — predict how many students will eat each meal, with prediction ranges and confidence scores. Every prediction is stored, scored against the actual result, and fed back into the next training run.",
    points: ["Ridge Linear + Random Forest regression", "MAE / RMSE / R² tracked per model version", "Time-split evaluation — no peeking at the future"],
  },
  {
    icon: Package,
    title: "Inventory optimization",
    body: "Predicted meals × recipe quantities = ingredient requirement. Subtract usable stock, add safety stock, and WasteWise recommends exact purchase quantities — with a written reason for every recommendation.",
    points: ["Recipe-level requirement calculation", "Shelf life & minimum stock aware", "Approve, edit or reject with one click"],
  },
  {
    icon: BarChart3,
    title: "Waste intelligence",
    body: "Plate waste, unserved food and kitchen waste are weighed and attributed down to the dish. Anomaly detection compares actual waste against the model's expectation and walks through the contributing factors — attendance, overproduction, menu history.",
    points: ["Dish-level waste baselines", "Statistical anomaly detection with root-cause capture", "Corrective actions build organizational memory"],
  },
  {
    icon: Recycle,
    title: "Waste treatment & circular reuse",
    body: "Unavoidable organic waste flows into composting and anaerobic-digestion batches. Finished compost, biogas and digestate are tracked to their final campus destination — garden, landscaping, kitchen fuel.",
    points: ["Batch tracking: input → process → output → reuse", "Configurable, clearly-labelled yield assumptions", "Diversion rate and recovery KPIs"],
  },
];

const KPIS = [
  { value: "-31%", label: "food waste vs baseline", tone: "text-brand-700" },
  { value: "±3%", label: "typical demand forecast error", tone: "text-ink-900" },
  { value: "88%", label: "waste diverted from disposal", tone: "text-brand-700" },
  { value: "100%", label: "of predictions stored & scored", tone: "text-ink-900" },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-white text-ink-900">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
              <Leaf className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">WasteWise</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-ink-500 md:flex">
            <a href="#how" className="hover:text-ink-900">How it works</a>
            <a href="#features" className="hover:text-ink-900">Platform</a>
            <a href="#impact" className="hover:text-ink-900">Impact</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-ink-600 hover:text-ink-900">Sign in</Link>
            <Link href="/login" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
              Open the demo
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_50%_-5rem,rgba(22,163,74,0.10),transparent)]" />
        <div className="mx-auto max-w-6xl px-5 pb-20 pt-20 text-center sm:pt-28">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-medium text-brand-700 ring-1 ring-brand-200">
            <Cpu className="h-3.5 w-3.5" /> Predict · Prevent · Process · Reuse
          </div>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Campus food waste, solved <span className="text-brand-600">before it exists</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-ink-500 sm:text-lg">
            WasteWise is an intelligent campus food and waste management platform. It predicts how many students will eat,
            cooks exactly that much, and converts the unavoidable remainder into compost and biogas for the campus.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
              Explore the live demo <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#how" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-ink-700 ring-1 ring-ink-200 transition hover:bg-ink-50">
              See how it works
            </a>
          </div>

          {/* Loop */}
          <div className="mx-auto mt-16 max-w-5xl">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {LOOP.map((s, i) => (
                <div key={s.label} className="relative rounded-2xl border border-ink-100 bg-white p-4 text-left shadow-sm">
                  <div className="mb-2 inline-flex rounded-lg bg-brand-50 p-2 text-brand-600">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold">{s.label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-ink-400">{s.desc}</p>
                  {i < LOOP.length - 1 && (
                    <ArrowRight className="absolute -right-2.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-brand-300 lg:block" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-y border-ink-100 bg-ink-50/60 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">The problem</p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Mess kitchens cook for the worst case — and throw away the difference
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-ink-500">
                Without demand forecasting, campus kitchens over-prepare every meal “just in case.” That buffer becomes
                plate waste and unserved food. Meanwhile, whatever waste is created is rarely weighed, understood, or
                treated — it just leaves campus as a cost and an emission.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Overproduction: cooking 5–10% above demand, every single meal",
                  "No attribution: nobody knows which dish or which meal drove the waste",
                  "Unmeasured waste: what isn't weighed can't be reduced",
                  "Linear disposal: organic waste hauled away instead of composted or digested on site",
                ].map((p) => (
                  <li key={p} className="flex gap-3 text-sm text-ink-700">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                      <TrendingDown className="h-3 w-3 rotate-180" />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-ink-100 bg-white p-8 shadow-sm">
              <div className="space-y-4">
                {[
                  { label: "Students present", value: "3,650" },
                  { label: "Predicted lunch participants", value: "3,322", hl: true },
                  { label: "Recommended preparation", value: "3,380", hl: true },
                  { label: "Traditional preparation", value: "3,950", muted: true },
                  { label: "Food waste avoided", value: "≈ 54 kg / meal", tone: "text-brand-700" },
                ].map((r) => (
                  <div key={r.label} className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${r.hl ? "bg-brand-50 ring-1 ring-brand-100" : "bg-ink-50"}`}>
                    <span className="text-ink-500">{r.label}</span>
                    <span className={`font-semibold tabular-nums ${r.tone ?? ""} ${r.muted ? "text-ink-400 line-through decoration-red-300" : "text-ink-900"}`}>{r.value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-[11px] leading-relaxed text-ink-400">
                Illustrative layout from the Rishihood University demo campus. In the application every value is computed from
                recorded attendance, the published menu rotation, complete recipes and real consumption records.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">The platform</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              One system from attendance to reuse
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-3xl border border-ink-100 bg-white p-7 shadow-sm transition hover:shadow-md">
                <div className="mb-4 inline-flex rounded-xl bg-brand-50 p-2.5 text-brand-600">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{f.body}</p>
                <ul className="mt-4 space-y-1.5">
                  {f.points.map((pt) => (
                    <li key={pt} className="flex items-center gap-2 text-xs text-ink-600">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-500" /> {pt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl bg-ink-50 px-6 py-4 text-xs text-ink-500">
            <span className="inline-flex items-center gap-2 font-medium text-ink-700"><LineChart className="h-4 w-4 text-brand-600" /> Analytics with 13+ chart views</span>
            <span className="inline-flex items-center gap-2 font-medium text-ink-700"><ShieldCheck className="h-4 w-4 text-brand-600" /> Role-based access control</span>
            <span className="inline-flex items-center gap-2 font-medium text-ink-700"><Cpu className="h-4 w-4 text-brand-600" /> Hardware-ready WasteWise Station API</span>
          </div>
        </div>
      </section>

      {/* How / transparency */}
      <section id="how" className="border-y border-ink-100 bg-ink-900 py-20 text-white">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-400">How it works</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Honest numbers, not magic
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-300">
              WasteWise never claims perfect predictions. Every forecast ships with a range and a confidence score, every
              prediction is scored against reality, and the error is stored so the next training run learns from it.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { n: "01", t: "Predict", d: "Ridge linear regression and random-forest models forecast meal demand and expected waste from attendance, menus, day-of-week and dish history." },
              { n: "02", t: "Act", d: "The kitchen gets a recommended preparation quantity, exact ingredient requirements, and a shopping list — each with the reason printed next to it." },
              { n: "03", t: "Learn", d: "Actual consumption and waste are recorded. Prediction error is computed and stored; model performance (MAE, RMSE, R²) is tracked per version." },
            ].map((s) => (
              <div key={s.n} className="rounded-3xl bg-white/5 p-7 ring-1 ring-white/10">
                <p className="text-4xl font-semibold text-brand-400">{s.n}</p>
                <h3 className="mt-4 text-lg font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact */}
      <section id="impact" className="py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Sustainability impact</p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                The full loop, closed on campus
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-ink-500">
                Food that would have been wasted is prevented upstream. What remains is weighed, segregated and treated in
                composting or anaerobic-digestion batches. Finished compost feeds the campus garden; biogas returns to the
                kitchen as fuel. Monthly sustainability reports document all of it — generated from recorded data, never
                hardcoded.
              </p>
              <Link href="/login" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
                Open the demo campus <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 text-[11px] text-ink-400">
                Demo logins: admin@wastewise.demo / <code className="rounded bg-ink-100 px-1">admin123</code> · mess@wastewise.demo /{" "}
                <code className="rounded bg-ink-100 px-1">mess123</code> · waste@wastewise.demo / <code className="rounded bg-ink-100 px-1">waste123</code>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {KPIS.map((k) => (
                <div key={k.label} className="rounded-3xl border border-ink-100 bg-white p-7 text-center shadow-sm">
                  <p className={`text-3xl font-semibold tracking-tight ${k.tone}`}>{k.value}</p>
                  <p className="mt-1.5 text-xs text-ink-400">{k.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-100 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-xs text-ink-400 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600">
              <Leaf className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-ink-600">WasteWise</span>
            <span>— predictive campus food & waste management</span>
          </div>
          <p>Demo dataset: Rishihood University — 2,500 residential students, 200 staff, full mess menu rotation. Predictions carry ranges, not guarantees.</p>
        </div>
      </footer>
    </div>
  );
}
