import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NAV_ITEMS } from "@/lib/constants";
import { AppShell } from "@/components/app-shell";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const [unread, settings] = await Promise.all([
    prisma.alert.count({ where: { status: "UNREAD" } }),
    getSettings(),
  ]);

  const nav = NAV_ITEMS.filter((item) => item.roles.includes(user.role)).map((i) => ({
    href: i.href,
    label: i.label,
    icon: i.icon,
  }));

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role }}
      campus={settings.campus_name}
      nav={nav}
      unread={unread}
    >
      {children}
    </AppShell>
  );
}
