"use client";

import { useState } from "react";

import { AppSidebar } from "./app-sidebar";
import { TopBar } from "./top-bar";
import type { NavGroup } from "../navigation/nav-config";

export function AppShell({
  groups,
  pendingApprovals,
  scoutEnabled,
  children,
}: {
  groups: NavGroup[];
  pendingApprovals: number;
  scoutEnabled: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-full bg-background">
      <aside className="hidden w-[248px] shrink-0 lg:block">
        <div className="sticky top-0 h-screen">
          <AppSidebar groups={groups} />
        </div>
      </aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-navy/40"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full w-[248px]">
            <AppSidebar groups={groups} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
      <div className="app-main flex min-w-0 flex-1 flex-col">
        <TopBar pendingApprovals={pendingApprovals} onMenuClick={() => setOpen(true)} scoutEnabled={scoutEnabled} />
        {children}
      </div>
    </div>
  );
}
