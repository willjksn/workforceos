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
    items: [
      { href: "/app", label: "Command Center", icon: "dashboard" },
      { href: "/app/reports", label: "Reports", icon: "clipboard", permission: "reports.read" },
      { href: "/app/alerts", label: "Alerts", icon: "bell", anyPermission: ["alerts.read", "reports.read"] },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/app/companies", label: "Companies", icon: "building", permission: "companies.read" },
      { href: "/app/contacts", label: "Contacts", icon: "users", permission: "contacts.read" },
      { href: "/app/opportunities", label: "Opportunities", icon: "briefcase", permission: "opportunities.read" },
      { href: "/app/crm/inquiries", label: "Website inquiries", icon: "radio", permission: "opportunities.read" },
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
      { href: "/app/recruiting/workbench", label: "Recruiting Workbench", icon: "clipboard", permission: "applications.read" },
      { href: "/app/recruiting/applications", label: "Applications", icon: "users", permission: "applications.read" },
      { href: "/app/recruiting/requisitions", label: "Requisitions", icon: "folder", permission: "jobs.read" },
      { href: "/app/jobs", label: "Jobs", icon: "clipboard", permission: "jobs.read" },
      { href: "/app/search-projects", label: "Search Projects", icon: "search", permission: "search_projects.read" },
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
    label: "Military Talent",
    items: [
      { href: "/app/military", label: "Overview", icon: "shield", permission: "military.read" },
      { href: "/app/military/candidates", label: "Transitioning Talent", icon: "user", permission: "military.read" },
      { href: "/app/military/opportunities", label: "Employer Opportunities", icon: "briefcase", anyPermission: ["skillbridge.read", "military.read"] },
      { href: "/app/military/skillbridge", label: "SkillBridge", icon: "sprout", anyPermission: ["skillbridge.read", "military.read"] },
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
    label: "Solutions",
    items: [
      { href: "/app/discovery", label: "Discovery", icon: "clipboard", permission: "discovery.read" },
      { href: "/app/solutions", label: "Solution Plans", icon: "layers", permission: "solutions.read" },
      { href: "/app/services", label: "Service Catalog", icon: "checks", anyPermission: ["services.read", "solutions.read", "jobs.read"] },
    ],
  },
  {
    label: "Proposals",
    items: [
      { href: "/app/proposals", label: "All Proposals", icon: "briefcase", permission: "proposals.read" },
      { href: "/app/proposals?status=draft", label: "Drafts", icon: "clipboard", permission: "proposals.read" },
      { href: "/app/proposals?status=internal_review", label: "Awaiting Approval", icon: "bell", permission: "proposals.read" },
      { href: "/app/proposals?status=sent", label: "Sent", icon: "checks", permission: "proposals.read" },
      { href: "/app/proposals?status=accepted", label: "Accepted", icon: "medal", permission: "proposals.read" },
      { href: "/app/proposals?status=declined", label: "Declined", icon: "rotate", permission: "proposals.read" },
    ],
  },
  {
    label: "Legal & Contracts",
    items: [
      { href: "/app/contracts", label: "Contracts", icon: "scale", permission: "contracts.read" },
      { href: "/app/legal/templates", label: "Templates", icon: "layers", permission: "legal.read" },
      { href: "/app/contracts?filter=executed", label: "Executed", icon: "checks", permission: "contracts.read" },
      { href: "/app/contracts?filter=expiring", label: "Expiring", icon: "bell", permission: "contracts.read" },
      { href: "/app/contracts?filter=compliance", label: "Compliance", icon: "shield", permission: "contracts.read" },
    ],
  },
  {
    label: "Projects",
    items: [
      { href: "/app/projects", label: "All Projects", icon: "folder", permission: "projects.read" },
      { href: "/app/projects?filter=active", label: "Active", icon: "checks", permission: "projects.read" },
      { href: "/app/projects?filter=at_risk", label: "At Risk", icon: "bell", permission: "projects.read" },
      { href: "/app/projects?filter=completed", label: "Completed", icon: "medal", permission: "projects.read" },
      { href: "/app/projects/deliverables", label: "Deliverables", icon: "clipboard", permission: "deliverables.read" },
    ],
  },
  {
    label: "Workforce",
    items: [
      { href: "/app/workforce", label: "Overview", icon: "network", permission: "workforce.read" },
      { href: "/app/workforce/assessments", label: "Assessments", icon: "clipboard", permission: "workforce.read" },
      { href: "/app/workforce/roles", label: "Workforce Roles", icon: "users", permission: "workforce.read" },
      { href: "/app/workforce/skills", label: "Skills", icon: "layers", permission: "workforce.read" },
      { href: "/app/workforce/forecasts", label: "Forecasts", icon: "dashboard", permission: "forecasts.read" },
      { href: "/app/workforce/gaps", label: "Workforce Gaps", icon: "bell", permission: "workforce.read" },
      { href: "/app/workforce/supply", label: "Talent Supply", icon: "sprout", permission: "workforce.read" },
      { href: "/app/workforce/pipelines", label: "Talent Pipelines", icon: "rotate", permission: "pipelines.read" },
      { href: "/app/workforce/career-pathways", label: "Career Pathways", icon: "medal", permission: "career_paths.read" },
      { href: "/app/workforce/training-programs", label: "Training Programs", icon: "checks", permission: "training_programs.read" },
      { href: "/app/workforce/education-partners", label: "Education Partners", icon: "building", permission: "education_partners.read" },
      { href: "/app/workforce/apprenticeships", label: "Apprenticeships", icon: "folder", permission: "workforce.read" },
      { href: "/app/workforce/military-supply", label: "Military Supply", icon: "shield", anyPermission: ["workforce.read", "military.read"] },
      { href: "/app/workforce/scenarios", label: "Scenario Modeling", icon: "sparkles", permission: "scenario_models.read" },
      { href: "/app/workforce/analytics", label: "Workforce Analytics", icon: "dashboard", permission: "workforce.read" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/app/finance", label: "Finance", icon: "wallet", anyPermission: ["finance.read", "billing.read"] },
      { href: "/app/finance/invoices", label: "Invoices", icon: "clipboard", permission: "invoices.read" },
      { href: "/app/finance/ar", label: "Accounts Receivable", icon: "bell", permission: "finance.read" },
    ],
  },
  {
    label: "AI Operations",
    items: [
      { href: "/app/ai-operations", label: "Agent Command Center", icon: "sparkles", permission: "agents.read" },
      { href: "/app/ai-operations/review", label: "Review Queue", icon: "bell", permission: "agents.read" },
      { href: "/app/ai-operations/runs", label: "Agent Runs", icon: "clipboard", permission: "agents.read" },
      { href: "/app/ai-operations/outputs", label: "Agent Outputs", icon: "layers", permission: "agents.read" },
      { href: "/app/ai-operations/automation", label: "Automation Rules", icon: "rotate", permission: "automations.read" },
      { href: "/app/ai-operations/permissions", label: "Agent Permissions", icon: "shield", permission: "agents.read" },
      { href: "/app/ai-operations/prompts", label: "Prompt Versions", icon: "clipboard", permission: "agents.read" },
      { href: "/app/ai-operations/costs", label: "Costs & Usage", icon: "wallet", permission: "agents.read" },
      { href: "/app/ai-operations/failures", label: "Failures", icon: "bell", permission: "agents.read" },
      { href: "/app/ai-operations/knowledge", label: "Knowledge Sources", icon: "folder", permission: "knowledge.read" },
    ],
  },
  {
    label: "Integrations",
    items: [
      { href: "/app/integrations", label: "Overview", icon: "network", anyPermission: ["integrations.read", "admin.users", "admin.roles"] },
      { href: "/app/integrations/quickbooks", label: "QuickBooks", icon: "wallet", anyPermission: ["integrations.read", "admin.users"] },
      { href: "/app/integrations/docusign", label: "DocuSign", icon: "scale", anyPermission: ["integrations.read", "admin.users"] },
      { href: "/app/integrations/apollo", label: "Apollo", icon: "search", anyPermission: ["integrations.read", "admin.users"] },
    ],
  },
  {
    label: "Public website",
    items: [
      { href: "/app/public-content", label: "Public content", icon: "eye", permission: "public_content.read" },
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
      { href: "/app/admin/data-quality", label: "Data quality", icon: "clipboard", permission: "data_quality.read" },
      { href: "/app/admin/access-review", label: "Access review", icon: "shield", permission: "admin.users" },
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
  if (href === "/app/workforce") return pathname === "/app/workforce";
  if (href === "/app/ai-operations") return pathname === "/app/ai-operations";
  return pathname === href || pathname.startsWith(`${href}/`);
}
