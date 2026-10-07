import Link from "next/link";
import { BellRing, Check, CircleAlert, X } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { markAllAlertsRead, setAlertStatus } from "@/actions/alerts";
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, LinkButton, PageHeader, Table, Td, Th, Tr } from "@/components/ui";
import { Flash, SubmitButton } from "@/components/form-ui";
import { fmtDate } from "@/lib/utils";
import { MEAL_TYPE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Alerts" };

const VARIANT: Record<string, "danger" | "warning" | "info" | "brand" | "success"> = {
  CRITICAL: "danger",
  WARNING: "warning",
  INFO: "info",
  SUCCESS: "success",
};

/** Map an alert's entity coordinates to the page that can act on it. */
function entityHref(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  // Compared case-insensitively so an alert written as "Ingredient" or
  // "INGREDIENT" resolves to the same destination.
  switch (entityType.toUpperCase()) {
    case "WASTE_ANOMALY":
      return `/waste/anomalies/${entityId}`;
    case "MEAL":
      return "/meals";
    case "INGREDIENT":
      return "/inventory";
    case "DISH":
      return "/waste/analytics";
    case "TREATMENT_BATCH":
      return "/treatment";
    default:
      return null;
  }
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["ADMIN", "MESS_MANAGER", "WASTE_MANAGER"]);
  const sp = await searchParams;
  const status = sp.status === "RESOLVED" || sp.status === "IGNORED" || sp.status === "READ" ? sp.status : "UNREAD";

  const [alerts, unreadCount] = await Promise.all([
    prisma.alert.findMany({
      where: status === "UNREAD" ? { status: "UNREAD" } : { status },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.alert.count({ where: { status: "UNREAD" } }),
  ]);

  // Severity is a string column, so sorting it in SQL orders it alphabetically
  // (CRITICAL, INFO, SUCCESS, WARNING) — which puts informational alerts above
  // warnings. Rank it in code instead, newest first within a rank.
  const SEVERITY_RANK: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2, SUCCESS: 3 };
  alerts.sort(
    (a, b) =>
      (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) ||
      b.createdAt.getTime() - a.createdAt.getTime()
  );

  const tabs = [
    { key: "UNREAD", label: "Unread" },
    { key: "READ", label: "Read" },
    { key: "RESOLVED", label: "Resolved" },
    { key: "IGNORED", label: "Ignored" },
  ];

  return (
    <div>
      <PageHeader
        title="Alerts"
        description="Operational alerts generated from live data: anomalies, low inventory, expiry risk, prediction deviation and treatment completions."
        actions={
          unreadCount > 0 ? (
            <form action={markAllAlertsRead}>
              <SubmitButton variant="secondary">
                <Check className="h-3.5 w-3.5" /> Mark all read ({unreadCount})
              </SubmitButton>
            </form>
          ) : null
        }
      />
      <Flash error={sp.error} ok={sp.ok} />

      <div className="mb-4 flex gap-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/alerts?status=${t.key}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              status === t.key ? "bg-ink-900 text-white" : "bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <BellRing className="h-4 w-4 text-brand-600" /> {status === "UNREAD" ? "Unread alerts" : `${status.toLowerCase()} alerts`}
          </CardTitle>
          <Badge variant={unreadCount > 0 ? "warning" : "success"}>{status === "UNREAD" ? `${unreadCount} pending` : `${alerts.length} shown`}</Badge>
        </CardHeader>
        <CardBody className="pt-0">
          {alerts.length === 0 ? (
            <EmptyState
              icon={<CircleAlert className="h-8 w-8" />}
              title="Nothing here"
              description={status === "UNREAD" ? "No unread alerts — everything is under control." : `No ${status.toLowerCase()} alerts.`}
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Severity</Th>
                  <Th>Alert</Th>
                  <Th>Raised</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <Tr key={a.id}>
                    <Td>
                      <Badge variant={VARIANT[a.severity] ?? "info"}>{a.severity}</Badge>
                    </Td>
                    <Td>
                      <p className="text-xs font-medium text-ink-800">{a.title}</p>
                      {a.message && <p className="mt-0.5 text-[11px] text-ink-500">{a.message}</p>}
                      {(() => {
                        const href = entityHref(a.entityType, a.entityId);
                        return href ? (
                          <Link href={href} className="mt-0.5 inline-block text-[11px] font-medium text-brand-700 hover:underline">
                            View details →
                          </Link>
                        ) : null;
                      })()}
                    </Td>
                    <Td className="whitespace-nowrap text-[11px] text-ink-400">{fmtDate(a.createdAt, { hour: "2-digit", minute: "2-digit" })}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        {a.status === "UNREAD" && (
                          <form action={setAlertStatus}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="status" value="READ" />
                            <SubmitButton variant="ghost" className="px-2 py-1 text-[11px]">Mark read</SubmitButton>
                          </form>
                        )}
                        {a.status !== "RESOLVED" && (
                          <form action={setAlertStatus}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="status" value="RESOLVED" />
                            <SubmitButton variant="ghost" className="px-2 py-1 text-[11px] text-brand-700">Resolve</SubmitButton>
                          </form>
                        )}
                        {a.status !== "IGNORED" && (
                          <form action={setAlertStatus}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="status" value="IGNORED" />
                            <SubmitButton variant="ghost" className="px-2 py-1 text-[11px] text-ink-400">
                              <X className="h-3 w-3" />
                            </SubmitButton>
                          </form>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      <div className="mt-4 flex gap-2">
        <LinkButton href="/waste/analytics" variant="secondary">Waste analytics</LinkButton>
        <LinkButton href="/inventory" variant="secondary">Inventory</LinkButton>
        <LinkButton href="/meals" variant="secondary">Meals</LinkButton>
      </div>
      <p className="mt-2 text-[11px] text-ink-400">
        Meal context labels: {Object.entries(MEAL_TYPE_LABELS).map(([k, v]) => `${k.toLowerCase()}=${v}`).join(", ")}.
      </p>
    </div>
  );
}
