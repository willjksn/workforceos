"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CircleHelp,
  Briefcase,
  Building2,
  ClipboardList,
  Eye,
  FolderKanban,
  LayoutDashboard,
  Layers,
  ListChecks,
  Medal,
  Network,
  Radio,
  RotateCcw,
  Scale,
  Search,
  Shield,
  Sparkles,
  Sprout,
  User,
  Users,
  Wallet,
} from "lucide-react";

import { BrandMark } from "@/components/branding/brand-mark";

import { isNavActive, type NavGroup, type NavIconName } from "../navigation/nav-config";

const ICONS: Record<NavIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  building: Building2,
  users: Users,
  briefcase: Briefcase,
  radio: Radio,
  user: User,
  search: Search,
  layers: Layers,
  medal: Medal,
  eye: Eye,
  rotate: RotateCcw,
  sprout: Sprout,
  clipboard: ClipboardList,
  checks: ListChecks,
  shield: Shield,
  network: Network,
  folder: FolderKanban,
  scale: Scale,
  wallet: Wallet,
  sparkles: Sparkles,
  bell: Bell,
  help: CircleHelp,
};

function NavLinks({
  groups,
  pathname,
  onNavigate,
  rail,
}: {
  groups: NavGroup[];
  pathname: string;
  onNavigate?: () => void;
  rail?: boolean;
}) {
  return (
    <>
      {groups.map((group, index) => (
        <div key={`${group.label}-${index}`} className={index === 0 ? "" : rail ? "mt-2" : "mt-5"}>
          {group.label && !rail ? (
            <p className="px-2 text-[10px] font-medium uppercase tracking-[0.16em] text-sidebar-muted">
              {group.label}
            </p>
          ) : null}
          <ul className={group.label && !rail ? "mt-1.5 space-y-0.5" : "space-y-0.5"}>
            {group.items.map((item) => {
              const childActive = item.children?.some((child) => isNavActive(child.href, pathname, child.activeMode ?? "prefix")) ?? false;
              const active = isNavActive(item.href, pathname, item.activeMode ?? "prefix") || childActive;
              const Icon = ICONS[item.icon];
              return (
                <li key={`${item.href}-${item.label}`}>
                  <Link
                    href={item.href}
                    title={item.title ?? item.label}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 rounded-[6px] ${rail ? "justify-center px-2 py-2" : "px-2.5 py-1.5"} text-[13px] ${
                      active
                        ? "bg-[var(--sidebar-active)] text-white"
                        : "text-sidebar-text/80 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {rail ? null : active ? <span className="h-4 w-0.5 rounded-full bg-teal" aria-hidden /> : <span className="w-0.5" />}
                    <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                    {rail ? <span className="sr-only">{item.label}</span> : <span>{item.label}</span>}
                  </Link>
                  {!rail && item.children?.length ? (
                    <ul className="mt-0.5 space-y-0.5 pl-6">
                      {item.children.map((child) => {
                        const childOn = isNavActive(child.href, pathname, child.activeMode ?? "prefix");
                        return (
                          <li key={`${child.href}-${child.label}`}>
                            <Link
                              href={child.href}
                              title={child.title ?? child.label}
                              aria-current={childOn ? "page" : undefined}
                              onClick={onNavigate}
                              className={`block rounded-[6px] px-2.5 py-1 text-[12px] ${
                                childOn ? "bg-white/10 text-white" : "text-sidebar-text/70 hover:bg-white/5 hover:text-white"
                              }`}
                            >
                              {child.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

export function AppSidebar({
  groups,
  onNavigate,
  variant = "full",
}: {
  groups: NavGroup[];
  onNavigate?: () => void;
  variant?: "full" | "rail";
}) {
  const pathname = usePathname();
  const rail = variant === "rail";

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-text">
      {rail ? (
        <div className="border-b border-white/10 px-1 py-3 text-center">
          <Link href="/app" onClick={onNavigate} aria-label="Command Center" className="text-[10px] font-semibold text-white">
            WOS
          </Link>
        </div>
      ) : (
        <div className="border-b border-white/10 px-5 py-5">
          <Link href="/app" onClick={onNavigate} className="block">
            <BrandMark compact tone="onNavy" />
          </Link>
          <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.18em] text-sidebar-muted">
            WorkforceOS
          </p>
        </div>
      )}
      <nav aria-label={rail ? "Compact navigation" : "Primary navigation"} className={`flex-1 overflow-y-auto py-4 ${rail ? "px-1" : "px-3"}`}>
        <NavLinks groups={groups} pathname={pathname} onNavigate={onNavigate} rail={rail} />
      </nav>
    </div>
  );
}
