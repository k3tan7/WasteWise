import { AlertTriangle, RotateCcw, Save } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { resetDemoData, updateSettings } from "@/actions/settings";
import { Badge, Card, CardBody, CardHeader, CardTitle, Input, PageHeader, Stat } from "@/components/ui";
import { ConfirmButton, Flash, SubmitButton } from "@/components/form-ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

const CATEGORY_LABELS: Record<string, { title: string; description: string }> = {
  general: { title: "Campus", description: "Identity and display settings for this campus deployment." },
  operations: { title: "Kitchen operations", description: "Buffers and thresholds used by the planning and anomaly engines." },
  sustainability: { title: "Sustainability definitions", description: "Transparent definitions used in KPI calculations and reports." },
  treatment: { title: "Treatment assumptions", description: "Configurable conversion estimates. Actual yields vary with feedstock and process control — recorded outputs always take precedence." },
  ml: { title: "Machine learning", description: "Behaviour of the regression prediction layer." },
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["ADMIN"]);
  const sp = await searchParams;

  const [settings, counts] = await Promise.all([
    getSettings(),
    Promise.all([
      prisma.student.count(),
      prisma.meal.count(),
      prisma.wasteRecord.count(),
      prisma.treatmentBatch.count(),
    ]),
  ]);

  const categories = Array.from(new Set(Object.values(DEFAULT_SETTINGS).map((d) => d.category)));
  const demoMode = settings.demo_mode === "true";

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Campus configuration, KPI definitions and demo-data controls. All thresholds and conversion assumptions here are editable — the application never hardcodes them."
        actions={
          <Badge variant={demoMode ? "warning" : "success"}>
            {demoMode ? "Demo dataset active" : "Live campus data"}
          </Badge>
        }
      />
      <Flash error={sp.error} ok={sp.ok} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Students" value={counts[0].toLocaleString()} />
        <Stat label="Meal records" value={counts[1].toLocaleString()} />
        <Stat label="Waste records" value={counts[2].toLocaleString()} />
        <Stat label="Treatment batches" value={counts[3].toLocaleString()} />
      </div>

      <form action={updateSettings} className="mt-6 space-y-6">
        {categories.map((cat) => (
          <Card key={cat}>
            <CardHeader>
              <div>
                <CardTitle>{CATEGORY_LABELS[cat]?.title ?? cat}</CardTitle>
                <p className="mt-0.5 text-[11px] text-ink-400">{CATEGORY_LABELS[cat]?.description}</p>
              </div>
            </CardHeader>
            <CardBody className="pt-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(DEFAULT_SETTINGS)
                  .filter(([, d]) => d.category === cat)
                  .map(([key, def]) => {
                    const current = settings[key] ?? def.value;
                    if (def.type === "BOOLEAN") {
                      return (
                        <label key={key} className="flex items-center gap-3 rounded-xl bg-ink-50 px-3 py-2.5 ring-1 ring-ink-100">
                          <input type="checkbox" name={`setting:${key}`} value="true" defaultChecked={current === "true"} className="h-4 w-4 accent-brand-600" />
                          <input type="hidden" name={`bool:${key}`} value="1" />
                          <span className="text-xs font-medium text-ink-700">{def.label}</span>
                        </label>
                      );
                    }
                    return (
                      <label key={key} className="block">
                        <span className="mb-1 block text-[11px] font-medium text-ink-600">{def.label}</span>
                        {def.type === "NUMBER" ? (
                          <Input name={`setting:${key}`} type="number" step="any" defaultValue={current} className="h-9 text-xs" />
                        ) : (
                          <Input name={`setting:${key}`} defaultValue={current} className="h-9 text-xs" />
                        )}
                      </label>
                    );
                  })}
              </div>
            </CardBody>
          </Card>
        ))}

        <div className="flex justify-end">
          <SubmitButton>
            <Save className="h-3.5 w-3.5" /> Save settings
          </SubmitButton>
        </div>
      </form>

      <Card className="mt-6 border-red-100">
        <CardHeader>
          <div>
            <CardTitle className="inline-flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" /> Demo data
            </CardTitle>
            <p className="mt-0.5 text-[11px] text-ink-400">
              The current dataset is a clearly-marked fictional demo campus generated from seeded patterns. Resetting regenerates
              ~30 days of history and retrains the regression models. This cannot be undone.
            </p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <form action={resetDemoData}>
            <ConfirmButton message="Regenerate the entire demo campus? All current data will be replaced.">
              <RotateCcw className="h-3.5 w-3.5" /> Reset demo data
            </ConfirmButton>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
