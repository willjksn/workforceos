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
  | "bell"
  | "help";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  title?: string;
  permission?: Permission;
  anyPermission?: Permission[];
  adminOnly?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
};

/**
 * Internal nav follows the operating lifecycle, not a module dump:
 * Commercial → Delivery → Talent → Pathway → Admin.
 * Item visibility is still permission-gated. Do not hide authorized work.
 */
const NAV: NavGroup[] = [
  {
    label: "",
    items: [
      { href: "/app", label: "Command Center", icon: "dashboard" },
      { href: "/app/reports", label: "Reports", icon: "clipboard", permission: "reports.read" },
      { href: "/app/alerts", label: "Alerts", icon: "bell", anyPermission: ["alerts.read", "reports.read"] },
      {
        href: "/app/academy",
        label: "Help & Training",
        icon: "help",
        title: "Academy",
        anyPermission: ["knowledge.read", "scout.use"],
      },
      {
        href: "/app/academy/onboarding",
        label: "Staff onboarding",
        icon: "sprout",
        title: "PierOne employee onboarding",
        anyPermission: ["knowledge.read", "scout.use"],
      },
    ],
  },
  {
    label: "Commercial",
    items: [
      { href: "/app/companies", label: "Companies", icon: "building", permission: "companies.read" },
      { href: "/app/contacts", label: "Contacts", icon: "users", permission: "contacts.read" },
      { href: "/app/opportunities", label: "Opportunities", icon: "briefcase", permission: "opportunities.read" },
      { href: "/app/crm/inquiries", label: "Website inquiries", icon: "radio", permission: "opportunities.read" },
      { href: "/app/signals", label: "Signals", icon: "radio", permission: "opportunities.read" },
      { href: "/app/discovery", label: "Discovery", icon: "clipboard", permission: "discovery.read" },
      { href: "/app/solutions", label: "Solution Plans", icon: "layers", permission: "solutions.read" },
      { href: "/app/services", label: "Service Catalog", icon: "checks", anyPermission: ["services.read", "solutions.read", "jobs.read"] },
      { href: "/app/proposals", label: "Proposals", icon: "briefcase", permission: "proposals.read" },
    ],
  },
  {
    label: "Delivery",
    items: [
      { href: "/app/projects", label: "Projects", icon: "folder", permission: "projects.read" },
      { href: "/app/projects/deliverables", label: "Deliverables", icon: "clipboard", permission: "deliverables.read" },
      { href: "/app/contracts", label: "Contracts", icon: "scale", permission: "contracts.read" },
      { href: "/app/legal/templates", label: "Legal templates", icon: "layers", permission: "legal.read" },
      { href: "/app/workforce", label: "Workforce planning", icon: "network", permission: "workforce.read" },
      { href: "/app/finance", label: "Finance", icon: "wallet", anyPermission: ["finance.read", "billing.read"] },
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
      { href: "/app/recruiting/workbench", label: "Recruiting Workbench", icon: "clipboard", permission: "applications.read" },
      { href: "/app/jobs", label: "Jobs", icon: "clipboard", permission: "jobs.read" },
      { href: "/app/recruiting/applications", label: "Applications", icon: "users", permission: "applications.read" },
      { href: "/app/pipeline", label: "Candidate Pipeline", icon: "layers", permission: "jobs.read" },
      { href: "/app/submissions", label: "Submissions", icon: "users", permission: "submissions.read" },
      { href: "/app/interviews", label: "Interviews", icon: "briefcase", permission: "interviews.read" },
      { href: "/app/offers", label: "Offers", icon: "medal", permission: "offers.read" },
      { href: "/app/placements", label: "Placements", icon: "checks", permission: "placements.read" },
      { href: "/app/guarantees", label: "Guarantees", icon: "bell", permission: "placements.read" },
      { href: "/app/recruiting/analytics", label: "Recruiting Analytics", icon: "dashboard", permission: "recruiting.analytics.read" },
      { href: "/app/onboarding", label: "Onboarding", icon: "sprout", permission: "onboarding.read" },
    ],
  },
  {
    label: "Pathway",
    items: [
      { href: "/app/military", label: "Military Talent", icon: "shield", permission: "military.read" },
      { href: "/app/military/candidates", label: "Transitioning Talent", icon: "user", permission: "military.read" },
      { href: "/app/military/opportunities", label: "Employer Opportunities", icon: "briefcase", anyPermission: ["skillbridge.read", "military.read"] },
      { href: "/app/military/skillbridge", label: "Pathway operations", icon: "sprout", anyPermission: ["skillbridge.read", "military.read"] },
      { href: "/app/military/translator", label: "Skills Translator", icon: "sparkles", permission: "military.read" },
      { href: "/app/military/occupations", label: "Occupation Library", icon: "layers", permission: "military.read" },
      { href: "/app/military/installation-mapping", label: "Installation Mapping", icon: "network", permission: "military.read" },
      { href: "/app/military/bridge-training", label: "Bridge Training", icon: "sprout", permission: "military.read" },
      { href: "/app/military/analytics", label: "Analytics", icon: "dashboard", permission: "military.read" },
      { href: "/app/military/crosswalk", label: "Civilian Crosswalk", icon: "rotate", permission: "military.read" },
      { href: "/app/military/reverse", label: "Reverse Search", icon: "search", permission: "military.read" },
      { href: "/app/military/installations", label: "Installations", icon: "building", permission: "military.read" },
      { href: "/app/military/review", label: "Mapping Review", icon: "bell", permission: "military.review" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/app/ai-operations", label: "AI administration", icon: "sparkles", permission: "agents.manage" },
      { href: "/app/ai-operations/review", label: "Review Queue", icon: "bell", permission: "agents.read" },
      { href: "/app/ai-operations/knowledge", label: "Knowledge Sources", icon: "folder", permission: "knowledge.read" },
      { href: "/app/integrations", label: "Connected tools", icon: "network", anyPermission: ["integrations.read", "admin.users", "admin.roles"] },
      { href: "/app/public-content", label: "Public content", icon: "eye", permission: "public_content.read" },
      { href: "/app/admin/users", label: "People", icon: "users", permission: "admin.users" },
      { href: "/app/admin/roles", label: "Access bundles", icon: "shield", permission: "admin.roles" },
      { href: "/app/admin/integrations", label: "Integration Hub", icon: "network", adminOnly: true },
      { href: "/app/admin/system-health", label: "System status", icon: "dashboard", adminOnly: true },
      { href: "/app/admin/data-quality", label: "Data quality", icon: "clipboard", permission: "data_quality.read" },
      { href: "/app/admin/access-review", label: "Access review", icon: "shield", permission: "admin.users" },
      { href: "/app/admin/approvals", label: "Approvals", icon: "bell", adminOnly: true },
    ],
  },
];

export function navGroupsForPrincipal(principal: Principal): NavGroup[] {
  const platformAdmin = isPlatformAdmin(principal);
  return NAV.map((group) => ({
    label: group.label,
    adminOnly: group.adminOnly,
    items: group.items.filter((item) => {
      if ((group.adminOnly || item.adminOnly) && !platformAdmin) return false;
      if (item.permission && !can(principal, item.permission)) return false;
      if (item.anyPermission && !canAny(principal, item.anyPermission)) return false;
      return true;
    }),
  })).filter((group) => group.items.length > 0);
}

export function isNavActive(href: string, pathname: string) {
  if (href === "/app") return pathname === "/app";
  if (href === "/app/academy/onboarding") {
    return pathname === "/app/academy/onboarding";
  }
  if (href === "/app/academy") {
    return pathname === "/app/academy" || (pathname.startsWith("/app/academy/") && pathname !== "/app/academy/onboarding");
  }
  if (href === "/app/talent") {
    return pathname === "/app/talent" || /^\/app\/talent\/[0-9a-f-]{36}/i.test(pathname);
  }
  if (href === "/app/jobs") {
    return (
      pathname === "/app/jobs" ||
      pathname.startsWith("/app/jobs/") ||
      pathname.startsWith("/app/recruiting/requisitions") ||
      pathname.startsWith("/app/search-projects")
    );
  }
  if (href === "/app/military") return pathname === "/app/military";
  if (href === "/app/ai-operations") return pathname === "/app/ai-operations";
  if (href === "/app/integrations") {
    return pathname === "/app/integrations" || pathname.startsWith("/app/integrations/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
