"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Bell, Leaf, LogOut, Menu as MenuIcon, X } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; icon: string };

export function AppShell({
  user,
  campus,
  nav,
  unread,
  children,
}: {
  user: { name: string; email: string; role: Role };
  campus: string;
  nav: NavItem[];
  unread: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 px-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600">
          <Leaf className="h-4 w-4 text-white" />
        </span>
        <span className="text-sm font-semibold tracking-tight text-ink-900">WasteWise</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
              isActive(item.href)
                ? "bg-brand-50 text-brand-700"
                : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
            )}
          >
            <Icon name={item.icon} className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="border-t border-ink-200 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">
            {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-ink-900">{user.name}</p>
            <p className="truncate text-[10px] text-ink-500">{ROLE_LABELS[user.role]}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-ink-200 bg-white lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl">
            <button
              className="absolute right-2 top-2 rounded-md p-1.5 text-ink-400 hover:bg-ink-100"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-ink-200 bg-white/80 px-4 shadow-[0_1px_2px_rgba(16,24,20,0.04)] backdrop-blur-md sm:px-6">
          <button
            className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-ink-500">
              <span className="font-medium text-ink-700">{campus}</span>
              <span className="mx-2 hidden text-ink-300 sm:inline">·</span>
              <span className="hidden sm:inline">Demo campus dataset</span>
            </p>
          </div>
          <Badge variant="brand" className="hidden sm:inline-flex">
            Predict · Prevent · Process · Reuse
          </Badge>
          <Link
            href="/alerts"
            className="relative rounded-md p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
            title="Alerts"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
