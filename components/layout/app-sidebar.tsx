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

export function AppSidebar({
  groups,
  onNavigate,
}: {
  groups: NavGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-text">
      <div className="border-b border-white/10 px-5 py-5">
        <Link href="/app" onClick={onNavigate} className="block">
          <BrandMark compact tone="onNavy" />
        </Link>
        <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.18em] text-sidebar-muted">
          WorkforceOS
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group, index) => (
          <div key={`${group.label}-${index}`} className={index === 0 ? "" : "mt-5"}>
            {group.label ? (
              <p className="px-2 text-[10px] font-medium uppercase tracking-[0.16em] text-sidebar-muted">
                {group.label}
              </p>
            ) : null}
            <ul className={group.label ? "mt-1.5 space-y-0.5" : "space-y-0.5"}>
              {group.items.map((item) => {
                const active = isNavActive(item.href, pathname);
                const Icon = ICONS[item.icon];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.title}
                      onClick={onNavigate}
                      className={`flex items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-[13px] ${
                        active
                          ? "bg-[var(--sidebar-active)] text-white"
                          : "text-sidebar-text/80 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {active ? <span className="h-4 w-0.5 rounded-full bg-teal" aria-hidden /> : <span className="w-0.5" />}
                      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
