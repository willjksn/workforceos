import { can, canAny, isPlatformAdmin, type Permission, type Principal } from "@/lib/rbac/permissions";

export type NavIconName =
  | "dashboard"
  | "building"
  | "users"
  | "briefcase"
  | "radio"
  | "user"
  | "search"
  | "layers"
  | "medal"
  | "eye"
  | "rotate"
  | "sprout"
  | "clipboard"
  | "checks"
  | "shield"
  | "network"
  | "folder"
  | "scale"
  | "wallet"
  | "sparkles"
  | "bell";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  permission?: Permission;
  anyPermission?: Permission[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
};

const NAV: NavGroup[] = [
  {
    label: "",
    items: [{ href: "/app", label: "Command Center", icon: "dashboard" }],
  },
  {
    label: "CRM",
    items: [
      { href: "/app/companies", label: "Companies", icon: "building", permission: "companies.read" },
      { href: "/app/contacts", label: "Contacts", icon: "users", permission: "contacts.read" },
      { href: "/app/opportunities", label: "Opportunities", icon: "briefcase", permission: "opportunities.read" },
      { href: "/app/signals", label: "Signals", icon: "radio", permission: "opportunities.read" },
    ],
  },
  {
    label: "Talent",
    items: [
      { href: "/app/talent", label: "Candidates", icon: "user", permission: "candidates.read" },
      { href: "/app/talent/search", label: "Talent Search", icon: "search", permission: "candidates.read" },
      { href: "/app/talent/pools", label: "Talent Pools", icon: "layers", permission: "candidates.read" },
      { href: "/app/talent/silver-medalists", label: "Silver Medalists", icon: "medal", permission: "candidates.read" },
      { href: "/app/talent/watchlists", label: "Watchlists", icon: "eye", permission: "candidates.read" },
      { href: "/app/talent/rediscovery", label: "Rediscovery", icon: "rotate", permission: "candidates.read" },
      { href: "/app/talent/nurture", label: "Nurture", icon: "sprout", permission: "candidates.read" },
    ],
  },
  {
    label: "Recruiting",
    items: [
      { href: "/app/jobs", label: "Jobs", icon: "clipboard", permission: "jobs.read" },
      { href: "/app/search-projects", label: "Search Projects", icon: "search", permission: "search_projects.read" },
      { href: "/app/pipeline", label: "Candidate Pipeline", icon: "layers", permission: "jobs.read" },
      { href: "/app/submissions", label: "Submissions", icon: "users", permission: "submissions.read" },
      { href: "/app/interviews", label: "Interviews", icon: "briefcase", permission: "interviews.read" },
      { href: "/app/offers", label: "Offers", icon: "medal", permission: "offers.read" },
      { href: "/app/placements", label: "Placements", icon: "checks", permission: "placements.read" },
      { href: "/app/guarantees", label: "Guarantees", icon: "bell", permission: "placements.read" },
      { href: "/app/recruiting/analytics", label: "Recruiting Analytics", icon: "dashboard", permission: "recruiting.analytics.read" },
      { href: "/app/services", label: "Services", icon: "checks", anyPermission: ["solutions.read", "jobs.read"] },
    ],
  },
  {
    label: "Military Talent",
    items: [
      { href: "/app/military/translator", label: "Skills Translator", icon: "sparkles", permission: "military.read" },
      { href: "/app/military/occupations", label: "Occupation Library", icon: "layers", permission: "military.read" },
      { href: "/app/military/crosswalk", label: "Civilian Crosswalk", icon: "rotate", permission: "military.read" },
      { href: "/app/military/reverse", label: "Reverse Search", icon: "search", permission: "military.read" },
      { href: "/app/military/installations", label: "Installations", icon: "building", permission: "military.read" },
      { href: "/app/military/installation-mapping", label: "Installation Mapping", icon: "network", permission: "military.read" },
      { href: "/app/military/candidates", label: "Military Candidates", icon: "user", permission: "military.read" },
      { href: "/app/military/bridge-training", label: "Bridge Training", icon: "sprout", permission: "military.read" },
      { href: "/app/military/review", label: "Mapping Review", icon: "bell", permission: "military.review" },
      { href: "/app/military/analytics", label: "Military Analytics", icon: "dashboard", permission: "military.read" },
    ],
  },
  {
    label: "",
    items: [
      { href: "/app/workforce", label: "Workforce", icon: "network", permission: "solutions.read" },
      { href: "/app/projects", label: "Projects", icon: "folder", permission: "projects.read" },
      { href: "/app/legal", label: "Legal & Contracts", icon: "scale", permission: "legal.read" },
      { href: "/app/finance", label: "Finance", icon: "wallet", permission: "finance.read" },
    ],
  },
  {
    label: "Admin",
    adminOnly: true,
    items: [
      { href: "/app/admin/users", label: "People", icon: "users", permission: "admin.users" },
      { href: "/app/admin/roles", label: "Roles & access", icon: "shield", permission: "admin.roles" },
      { href: "/app/admin/integrations", label: "Connected tools", icon: "network" },
      { href: "/app/admin/system-health", label: "System status", icon: "dashboard" },
      { href: "/app/admin/approvals", label: "Approvals", icon: "bell" },
    ],
  },
];

export function navGroupsForPrincipal(principal: Principal): NavGroup[] {
  return NAV.map((group) => {
    if (group.adminOnly && !isPlatformAdmin(principal)) {
      return { ...group, items: [] };
    }
    return {
      label: group.label,
      adminOnly: group.adminOnly,
      items: group.items.filter((item) => {
        if (item.permission && !can(principal, item.permission)) return false;
        if (item.anyPermission && !canAny(principal, item.anyPermission)) return false;
        return true;
      }),
    };
  }).filter((group) => group.items.length > 0);
}

export function isNavActive(href: string, pathname: string) {
  if (href === "/app") return pathname === "/app";
  if (href === "/app/talent") {
    return pathname === "/app/talent" || /^\/app\/talent\/[0-9a-f-]{36}/i.test(pathname);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
