"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";

import { AuthControls } from "@/app/auth-controls";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ScoutLauncher } from "@/components/scout/scout-drawer";

const LABELS: Record<string, string> = {
  app: "Command Center",
  companies: "Companies",
  contacts: "Contacts",
  opportunities: "Opportunities",
  signals: "Signals",
  talent: "Talent",
  search: "Talent Search",
  pools: "Talent Pools",
  "silver-medalists": "Silver Medalists",
  watchlists: "Watchlists",
  rediscovery: "Rediscovery",
  nurture: "Nurture",
  jobs: "Jobs",
  skillbridge: "Pathway operations",
  services: "Services",
  workforce: "Workforce",
  projects: "Projects",
  legal: "Legal & Contracts",
  finance: "Finance",
  "ai-operations": "AI Operations",
  admin: "Admin",
  users: "People",
  roles: "Roles & access",
  integrations: "Connected tools",
  "system-health": "System status",
  "data-quality": "Data quality",
  "access-review": "Access review",
  reports: "Reports",
  alerts: "Alerts",
  approvals: "Approvals",
};

function crumbsFromPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: Array<{ href: string; label: string }> = [];
  let href = "";
  for (const part of parts) {
    href += `/${part}`;
    if (/^[0-9a-f-]{36}$/i.test(part)) {
      crumbs.push({ href, label: "Record" });
      continue;
    }
    crumbs.push({ href, label: LABELS[part] ?? part.replaceAll("-", " ") });
  }
  return crumbs;
}

export function TopBar({
  unreadNotifications,
  onMenuClick,
  scoutEnabled,
}: {
  unreadNotifications: number;
  onMenuClick: () => void;
  scoutEnabled: boolean;
}) {
  const pathname = usePathname();
  const crumbs = crumbsFromPath(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        className="rounded-[6px] p-2 text-navy lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" strokeWidth={1.5} />
      </button>
      <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground sm:flex">
        {crumbs.map((crumb, index) => (
          <span key={crumb.href} className="flex min-w-0 items-center gap-2">
            {index > 0 ? <span>/</span> : null}
            <Link href={crumb.href} className="truncate hover:text-navy">
              {crumb.label}
            </Link>
          </span>
        ))}
      </nav>
      <label className="relative hidden min-w-[220px] max-w-sm flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
        <input
          placeholder="Search WorkforceOS"
          className="w-full rounded-[6px] border border-border bg-surface-muted py-1.5 pl-9 pr-3 text-sm placeholder:text-muted-foreground"
          disabled
          aria-label="Global search (coming later)"
        />
      </label>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <NotificationBell unreadCount={unreadNotifications} />
        <ScoutLauncher enabled={scoutEnabled} />
        <AuthControls />
      </div>
    </header>
  );
}
