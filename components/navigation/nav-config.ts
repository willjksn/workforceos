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

export type NavActiveMode = "prefix" | "exact";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  title?: string;
  permission?: Permission;
  anyPermission?: Permission[];
  adminOnly?: boolean;
  activeMode?: NavActiveMode;
  children?: NavItem[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
};

/**
 * Peer sidebar destinations before M8. Counted from the previous flat nav:
 * 5 home, 9 commercial, 6 delivery, 18 talent, 13 pathway, 5 admin.
 */
export const SIDEBAR_TOP_LEVEL_COUNT_BEFORE_M8 = 56;

const PRIMARY: NavGroup[] = [
  {
    label: "",
    items: [{ href: "/app", label: "Command Center", icon: "dashboard", activeMode: "exact" }],
  },
  {
    label: "Work",
    items: [
      {
        href: "/app/talent",
        label: "Talent",
        icon: "user",
        anyPermission: ["candidates.read", "military.read", "jobs.read", "agents.read"],
        children: [
          { href: "/app/talent", label: "Talent Network", icon: "user", permission: "candidates.read", activeMode: "exact" },
          { href: "/app/military", label: "Military Talent", icon: "shield", permission: "military.read" },
          {
            href: "/app/review",
            label: "Needs Review",
            icon: "bell",
            anyPermission: ["military.read", "candidates.read", "jobs.read", "agents.read"],
          },
        ],
      },
      {
        href: "/app/jobs",
        label: "Jobs",
        icon: "clipboard",
        permission: "jobs.read",
        children: [
          { href: "/app/jobs", label: "All Jobs", icon: "clipboard", permission: "jobs.read", activeMode: "exact" },
          { href: "/app/jobs/engagements", label: "Follow-ups", icon: "bell", permission: "jobs.read" },
          { href: "/app/jobs/career-sources", label: "Career Sources", icon: "radio", permission: "jobs.read" },
        ],
      },
      { href: "/app/companies", label: "Companies", icon: "building", permission: "companies.read" },
      {
        href: "/app/workforce",
        label: "Workforce",
        icon: "network",
        permission: "workforce.read",
        activeMode: "prefix",
        children: [
          { href: "/app/workforce", label: "Overview", icon: "dashboard", permission: "workforce.read", activeMode: "exact" },
          { href: "/app/workforce/roles", label: "Roles", icon: "layers", permission: "workforce.read" },
          { href: "/app/workforce/assessments", label: "Assessments", icon: "clipboard", permission: "workforce.read" },
          { href: "/app/workforce/military-supply", label: "Military Supply", icon: "shield", permission: "workforce.read" },
        ],
      },
      { href: "/app/scout", label: "Scout", icon: "sparkles", title: "Open Scout", permission: "scout.use" },
      { href: "/app/reports", label: "Reports", icon: "clipboard", permission: "reports.read" },
      { href: "/app/more", label: "More", icon: "layers" },
    ],
  },
];

const MORE: NavGroup[] = [
  {
    label: "CRM",
    items: [
      { href: "/app/contacts", label: "Contacts", icon: "users", permission: "contacts.read" },
      { href: "/app/opportunities", label: "CRM Opportunities", icon: "briefcase", permission: "opportunities.read", title: "Commercial pursuits, not jobs" },
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
      { href: "/app/finance", label: "Finance", icon: "wallet", anyPermission: ["finance.read", "billing.read"] },
    ],
  },
  {
    label: "Talent tools",
    items: [
      { href: "/app/talent/search", label: "Talent Search", icon: "search", permission: "candidates.read" },
      { href: "/app/talent/pools", label: "Talent Pools", icon: "layers", permission: "candidates.read" },
      { href: "/app/talent/silver-medalists", label: "Silver Medalists", icon: "medal", permission: "candidates.read" },
      { href: "/app/talent/watchlists", label: "Watchlists", icon: "eye", permission: "candidates.read" },
      { href: "/app/talent/rediscovery", label: "Rediscovery", icon: "rotate", permission: "candidates.read" },
      { href: "/app/talent/nurture", label: "Nurture", icon: "sprout", permission: "candidates.read" },
      { href: "/app/recruiting/workbench", label: "Recruiting Workbench", icon: "clipboard", permission: "applications.read" },
      { href: "/app/recruiting/applications", label: "Applications", icon: "users", permission: "applications.read" },
      { href: "/app/pipeline", label: "Candidate Pipeline", icon: "layers", permission: "jobs.read" },
      { href: "/app/submissions", label: "Submissions", icon: "users", permission: "submissions.read" },
      { href: "/app/interviews", label: "Interviews", icon: "briefcase", permission: "interviews.read" },
      { href: "/app/offers", label: "Offers", icon: "medal", permission: "offers.read" },
      { href: "/app/placements", label: "Placements", icon: "checks", permission: "placements.read" },
      { href: "/app/guarantees", label: "Guarantees", icon: "bell", permission: "placements.read" },
      { href: "/app/recruiting/analytics", label: "Recruiting Analytics", icon: "dashboard", permission: "recruiting.analytics.read" },
      { href: "/app/onboarding", label: "Onboarding", icon: "sprout", permission: "onboarding.read" },
      { href: "/app/jobs?view=headcount", label: "Headcount requests", icon: "clipboard", permission: "jobs.read" },
      { href: "/app/jobs?view=searches", label: "Internal searches", icon: "search", permission: "jobs.read" },
    ],
  },
  {
    label: "Military tools",
    items: [
      { href: "/app/military/candidates", label: "Transition Talent Profiles", icon: "user", permission: "military.read" },
      { href: "/app/military/translator", label: "Capability Translation", icon: "sparkles", permission: "military.read" },
      { href: "/app/military/review", label: "Mapping Review", icon: "bell", permission: "military.review" },
      { href: "/app/military/skillbridge", label: "Pathway operations", icon: "sprout", anyPermission: ["skillbridge.read", "military.read"] },
      { href: "/app/military/occupations", label: "Occupation Library", icon: "layers", permission: "military.read" },
      { href: "/app/military/crosswalk", label: "Civilian Crosswalk", icon: "rotate", permission: "military.read", title: "Legacy view of the same mappings" },
      { href: "/app/military/reverse", label: "Reverse Search", icon: "search", permission: "military.read", title: "Legacy lookup" },
      { href: "/app/military/installations", label: "Installations", icon: "building", permission: "military.read" },
      { href: "/app/military/installation-mapping", label: "Installation Mapping", icon: "network", permission: "military.read" },
      { href: "/app/military/bridge-training", label: "Bridge Training", icon: "sprout", permission: "military.read" },
      { href: "/app/military/analytics", label: "Military analytics", icon: "dashboard", permission: "military.read" },
      { href: "/app/military/opportunities", label: "Pathway employer records", icon: "briefcase", anyPermission: ["skillbridge.read", "military.read"] },
    ],
  },
  {
    label: "Workforce tools",
    items: [
      { href: "/app/workforce/gaps", label: "Gaps", icon: "layers", permission: "workforce.read" },
      { href: "/app/workforce/skills", label: "Skills", icon: "checks", permission: "workforce.read" },
      { href: "/app/workforce/forecasts", label: "Forecasts", icon: "dashboard", permission: "forecasts.read" },
      { href: "/app/workforce/supply", label: "Supply", icon: "users", permission: "workforce.read" },
      { href: "/app/workforce/pipelines", label: "Pipelines", icon: "network", permission: "pipelines.read" },
      { href: "/app/workforce/career-pathways", label: "Pathways", icon: "sprout", permission: "career_paths.read" },
      { href: "/app/workforce/training-programs", label: "Training", icon: "sprout", permission: "training_programs.read" },
      { href: "/app/workforce/education-partners", label: "Education partners", icon: "building", permission: "education_partners.read" },
      { href: "/app/workforce/scenarios", label: "Scenarios", icon: "layers", permission: "scenario_models.read" },
      { href: "/app/workforce/analytics", label: "Workforce analytics", icon: "dashboard", permission: "workforce.read" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/app/ai-operations", label: "AI & Automation", icon: "sparkles", permission: "agents.manage" },
      { href: "/app/ai-operations/review", label: "Review Queue", icon: "bell", permission: "agents.read" },
      { href: "/app/admin/approvals", label: "Approvals", icon: "checks", anyPermission: ["admin.users", "workforce.approve", "solutions.approve"] },
      { href: "/app/integrations", label: "Connected tools", icon: "network", anyPermission: ["integrations.read", "admin.users", "admin.roles"] },
      { href: "/app/admin/system-health", label: "System status", icon: "dashboard", anyPermission: ["integrations.read", "admin.users"] },
      { href: "/app/public-content", label: "Public content", icon: "eye", permission: "public_content.read" },
      { href: "/app/admin/users", label: "Team & Access", icon: "users", permission: "admin.users" },
      { href: "/app/alerts", label: "Alerts", icon: "bell", anyPermission: ["alerts.read", "reports.read"] },
      { href: "/app/academy", label: "Help & Training", icon: "help", title: "Academy", anyPermission: ["knowledge.read", "scout.use"] },
      { href: "/app/academy/onboarding", label: "Staff onboarding", icon: "sprout", title: "Pier 24 Partners employee onboarding", anyPermission: ["knowledge.read", "scout.use"] },
    ],
  },
];

function itemAllowed(principal: Principal, item: NavItem) {
  const platformAdmin = isPlatformAdmin(principal);
  if (item.adminOnly && !platformAdmin) return false;
  if (item.permission && !can(principal, item.permission)) return false;
  if (item.anyPermission && !canAny(principal, item.anyPermission)) return false;
  return true;
}

function filterItem(principal: Principal, item: NavItem): NavItem | null {
  const children = item.children
    ?.map((child) => filterItem(principal, child))
    .filter((child): child is NavItem => Boolean(child));
  const self = itemAllowed(principal, item);
  if (!self && (!children || children.length === 0)) return null;
  const href = self ? item.href : children?.[0]?.href ?? item.href;
  return { ...item, href, children: children?.length ? children : undefined };
}

function filterGroups(principal: Principal, groups: NavGroup[]) {
  return groups
    .map((group) => ({
      label: group.label,
      adminOnly: group.adminOnly,
      items: group.items
        .map((item) => filterItem(principal, item))
        .filter((item): item is NavItem => Boolean(item)),
    }))
    .filter((group) => group.items.length > 0);
}

export function navGroupsForPrincipal(principal: Principal): NavGroup[] {
  return filterGroups(principal, PRIMARY);
}

export function moreGroupsForPrincipal(principal: Principal): NavGroup[] {
  return filterGroups(principal, MORE);
}

export function topLevelNavHrefs(principal: Principal) {
  return navGroupsForPrincipal(principal).flatMap((group) => group.items.map((item) => item.href));
}

export function collectNavHrefs(groups: NavGroup[]) {
  const hrefs: string[] = [];
  const visit = (item: NavItem) => {
    hrefs.push(item.href);
    item.children?.forEach(visit);
  };
  groups.forEach((group) => group.items.forEach(visit));
  return hrefs;
}

export function isNavActive(href: string, pathname: string, mode: NavActiveMode = "prefix") {
  if (href === "/app") return pathname === "/app";
  const pathOnly = href.split("?")[0] ?? href;
  if (mode === "exact") {
    if (pathOnly === "/app/jobs") {
      return pathname === "/app/jobs" || /^\/app\/jobs\/[0-9a-f-]{36}/i.test(pathname);
    }
    if (pathOnly === "/app/talent") {
      return pathname === "/app/talent" || /^\/app\/talent\/[0-9a-f-]{36}/i.test(pathname);
    }
    if (pathOnly === "/app/workforce") return pathname === "/app/workforce";
    if (pathOnly === "/app/military") return pathname === "/app/military";
    return pathname === pathOnly;
  }
  if (pathOnly === "/app/academy/onboarding") return pathname === "/app/academy/onboarding";
  if (pathOnly === "/app/academy") {
    return pathname === "/app/academy" || (pathname.startsWith("/app/academy/") && pathname !== "/app/academy/onboarding");
  }
  if (pathOnly === "/app/talent") {
    return pathname === "/app/talent" || /^\/app\/talent\/[0-9a-f-]{36}/i.test(pathname);
  }
  if (pathOnly === "/app/jobs") {
    return (
      pathname === "/app/jobs"
      || pathname.startsWith("/app/jobs/")
      || pathname.startsWith("/app/recruiting/requisitions")
      || pathname.startsWith("/app/search-projects")
    );
  }
  if (pathOnly === "/app/military") return pathname === "/app/military" || pathname.startsWith("/app/military/");
  if (pathOnly === "/app/ai-operations") {
    if (pathname.startsWith("/app/ai-operations/review")) return false;
    return pathname === "/app/ai-operations" || pathname.startsWith("/app/ai-operations/");
  }
  if (pathOnly === "/app/integrations") {
    return (
      pathname === "/app/integrations"
      || pathname.startsWith("/app/integrations/")
      || pathname === "/app/admin/integrations"
      || pathname.startsWith("/app/admin/system-health")
    );
  }
  if (pathOnly === "/app/admin/users") {
    return (
      pathname === "/app/admin/users"
      || pathname.startsWith("/app/admin/users/")
      || pathname === "/app/admin/roles"
      || pathname.startsWith("/app/admin/roles/")
      || pathname === "/app/admin/access-review"
    );
  }
  return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
}
