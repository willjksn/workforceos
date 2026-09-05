import { can, canAny, type Permission, type Principal } from "@/lib/rbac/permissions";

import type { NavGroup } from "./app-nav";

type NavItemConfig = {
  href: string;
  label: string;
  permission?: Permission;
  anyPermission?: Permission[];
};

const NAV: Array<{ label: string; items: NavItemConfig[] }> = [
  { label: "Command", items: [{ href: "/app", label: "Command Center" }] },
  {
    label: "CRM",
    items: [
      { href: "/app/companies", label: "Companies", permission: "companies.read" },
      { href: "/app/contacts", label: "Contacts", permission: "contacts.read" },
      { href: "/app/opportunities", label: "Opportunities", permission: "opportunities.read" },
      { href: "/app/signals", label: "Signals", permission: "opportunities.read" },
    ],
  },
  {
    label: "Talent",
    items: [
      { href: "/app/talent", label: "Candidates", permission: "candidates.read" },
      { href: "/app/talent/search", label: "Talent Search", permission: "candidates.read" },
      { href: "/app/talent/pools", label: "Talent Pools", permission: "candidates.read" },
      { href: "/app/talent/silver-medalists", label: "Silver Medalists", permission: "candidates.read" },
      { href: "/app/talent/watchlists", label: "Watchlists", permission: "candidates.read" },
      { href: "/app/talent/rediscovery", label: "Rediscovery", permission: "candidates.read" },
      { href: "/app/talent/nurture", label: "Nurture", permission: "candidates.read" },
    ],
  },
  {
    label: "Recruiting",
    items: [
      { href: "/app/jobs", label: "Jobs", permission: "jobs.read" },
      { href: "/app/services", label: "Services", anyPermission: ["solutions.read", "jobs.read"] },
    ],
  },
  {
    label: "Military",
    items: [{ href: "/app/military", label: "Military Talent", permission: "military.read" }],
  },
  {
    label: "Delivery",
    items: [
      { href: "/app/workforce", label: "Workforce", permission: "solutions.read" },
      { href: "/app/projects", label: "Projects", permission: "projects.read" },
      { href: "/app/legal", label: "Legal & Contracts", permission: "legal.read" },
      { href: "/app/finance", label: "Finance", permission: "finance.read" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/app/admin/users", label: "People", permission: "admin.users" },
      { href: "/app/admin/roles", label: "Roles & access", permission: "admin.roles" },
      { href: "/app/admin/integrations", label: "Connected tools", anyPermission: ["admin.users", "admin.roles"] },
      { href: "/app/admin/system-health", label: "System status", anyPermission: ["admin.users", "admin.roles"] },
      { href: "/app/admin/approvals", label: "Approvals", anyPermission: ["admin.users", "admin.roles"] },
    ],
  },
];

export function navGroupsForPrincipal(principal: Principal): NavGroup[] {
  return NAV.map((group) => ({
    label: group.label,
    items: group.items.filter((item) => {
      if (item.permission && !can(principal, item.permission)) return false;
      if (item.anyPermission && !canAny(principal, item.anyPermission)) return false;
      return true;
    }),
  })).filter((group) => group.items.length > 0);
}
