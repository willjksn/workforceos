export const PERMISSIONS = [
  "companies.read",
  "companies.write",
  "contacts.read",
  "contacts.write",
  "opportunities.read",
  "opportunities.write",
  "candidates.read",
  "candidates.write",
  "candidate_pii.read",
  "jobs.read",
  "jobs.write",
  "search_projects.read",
  "search_projects.write",
  "submissions.read",
  "submissions.write",
  "submissions.approve",
  "interviews.read",
  "interviews.write",
  "offers.read",
  "offers.write",
  "placements.read",
  "placements.write",
  "military.read",
  "military.write",
  "military.review",
  "military_reference.manage",
  "recruiting.analytics.read",
  "solutions.read",
  "solutions.write",
  "solutions.approve",
  "services.read",
  "services.manage",
  "discovery.read",
  "discovery.write",
  "proposals.read",
  "proposals.write",
  "proposals.approve",
  "pricing.approve",
  "contracts.read",
  "contracts.write",
  "contracts.approve",
  "projects.read",
  "projects.write",
  "deliverables.read",
  "deliverables.write",
  "deliverables.approve",
  "billing.read",
  "billing.write",
  "legal.read",
  "legal.write",
  "finance.read",
  "finance.write",
  "agents.read",
  "agents.manage",
  "admin.users",
  "admin.roles",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_SLUGS = [
  "managing-partner",
  "operations-administrator",
  "strategy-technology-administrator",
  "talent-partner",
  "recruiter",
  "workforce-consultant",
  "military-talent-specialist",
  "read-only",
] as const;

export type RoleSlug = (typeof ROLE_SLUGS)[number];

const ALL = [...PERMISSIONS];
const READ_ONLY = PERMISSIONS.filter(
  (permission) => permission.endsWith(".read") && permission !== "candidate_pii.read",
);

export const ROLE_PERMISSIONS: Record<RoleSlug, Permission[]> = {
  "managing-partner": ALL,
  "operations-administrator": [
    "companies.read",
    "companies.write",
    "contacts.read",
    "contacts.write",
    "opportunities.read",
    "opportunities.write",
    "candidates.read",
    "jobs.read",
    "search_projects.read",
    "submissions.read",
    "interviews.read",
    "offers.read",
    "placements.read",
    "placements.write",
    "recruiting.analytics.read",
    "solutions.read",
    "solutions.write",
    "solutions.approve",
    "services.read",
    "discovery.read",
    "discovery.write",
    "proposals.read",
    "proposals.write",
    "proposals.approve",
    "contracts.read",
    "contracts.write",
    "contracts.approve",
    "projects.read",
    "projects.write",
    "deliverables.read",
    "deliverables.write",
    "deliverables.approve",
    "billing.read",
    "billing.write",
    "pricing.approve",
    "legal.read",
    "legal.write",
    "finance.read",
    "finance.write",
    "admin.users",
  ],
  "strategy-technology-administrator": [
    "companies.read",
    "contacts.read",
    "opportunities.read",
    "candidates.read",
    "jobs.read",
    "search_projects.read",
    "submissions.read",
    "interviews.read",
    "offers.read",
    "placements.read",
    "recruiting.analytics.read",
    "military.read",
    "military.review",
    "military_reference.manage",
    "solutions.read",
    "services.read",
    "services.manage",
    "discovery.read",
    "proposals.read",
    "contracts.read",
    "projects.read",
    "deliverables.read",
    "billing.read",
    "agents.read",
    "agents.manage",
    "admin.users",
    "admin.roles",
  ],
  "talent-partner": [
    "companies.read",
    "contacts.read",
    "opportunities.read",
    "candidates.read",
    "candidates.write",
    "candidate_pii.read",
    "jobs.read",
    "jobs.write",
    "search_projects.read",
    "search_projects.write",
    "submissions.read",
    "submissions.write",
    "submissions.approve",
    "interviews.read",
    "interviews.write",
    "offers.read",
    "offers.write",
    "placements.read",
    "placements.write",
    "recruiting.analytics.read",
    "military.read",
    "military.write",
    "military.review",
    "solutions.read",
    "solutions.write",
    "solutions.approve",
    "services.read",
    "discovery.read",
    "discovery.write",
    "proposals.read",
    "proposals.write",
    "projects.read",
    "projects.write",
    "deliverables.read",
    "deliverables.write",
    "contracts.read",
    "billing.read",
  ],
  recruiter: [
    "companies.read",
    "contacts.read",
    "candidates.read",
    "candidates.write",
    "candidate_pii.read",
    "jobs.read",
    "jobs.write",
    "search_projects.read",
    "search_projects.write",
    "submissions.read",
    "submissions.write",
    "submissions.approve",
    "interviews.read",
    "interviews.write",
    "offers.read",
    "offers.write",
    "placements.read",
    "placements.write",
    "recruiting.analytics.read",
    "military.read",
    "services.read",
    "discovery.read",
    "discovery.write",
    "solutions.read",
    "proposals.read",
    "contracts.read",
    "projects.read",
    "deliverables.read",
  ],
  "workforce-consultant": [
    "companies.read",
    "contacts.read",
    "opportunities.read",
    "candidates.read",
    "jobs.read",
    "search_projects.read",
    "submissions.read",
    "interviews.read",
    "offers.read",
    "placements.read",
    "recruiting.analytics.read",
    "military.read",
    "solutions.read",
    "solutions.write",
    "solutions.approve",
    "services.read",
    "discovery.read",
    "discovery.write",
    "proposals.read",
    "proposals.write",
    "projects.read",
    "projects.write",
    "deliverables.read",
    "deliverables.write",
    "deliverables.approve",
    "contracts.read",
    "billing.read",
  ],
  "military-talent-specialist": [
    "companies.read",
    "candidates.read",
    "candidates.write",
    "candidate_pii.read",
    "jobs.read",
    "jobs.write",
    "search_projects.read",
    "submissions.read",
    "interviews.read",
    "offers.read",
    "placements.read",
    "military.read",
    "military.write",
    "military.review",
    "military_reference.manage",
    "solutions.read",
    "solutions.write",
    "solutions.approve",
    "services.read",
    "discovery.read",
    "discovery.write",
    "proposals.read",
    "contracts.read",
    "projects.read",
    "deliverables.read",
  ],
  "read-only": READ_ONLY,
};

export type Principal = {
  id: string;
  status: "active" | "invited" | "disabled";
  organizationId: string;
  roleSlugs: string[];
  permissions: ReadonlySet<string>;
};

export function roleSlugsHavePermission(roleSlugs: readonly string[] | undefined, permission: Permission) {
  return (roleSlugs ?? []).some((slug) => {
    if (slug === "managing-partner") return true;
    if (!(slug in ROLE_PERMISSIONS)) return false;
    return ROLE_PERMISSIONS[slug as RoleSlug].includes(permission);
  });
}

export function can(principal: Principal, permission: Permission) {
  if (principal.status !== "active") return false;
  return principal.permissions.has(permission);
}

export function canAny(principal: Principal, permissions: Permission[]) {
  return permissions.some((permission) => can(principal, permission));
}

/** Managing Partner and the two Administrator roles. Not recruiters or other operating staff. */
export function isPlatformAdmin(principal: Principal) {
  return can(principal, "admin.users") || can(principal, "admin.roles");
}

export function hasRole(principal: Principal, roleSlug: RoleSlug) {
  return principal.roleSlugs.includes(roleSlug);
}

export function requirePermission(principal: Principal, permission: Permission) {
  if (!can(principal, permission)) {
    throw new AuthorizationError(`Missing permission: ${permission}`);
  }
}

export function requireAnyPermission(principal: Principal, permissions: Permission[]) {
  if (!canAny(principal, permissions)) {
    throw new AuthorizationError(`Missing one of: ${permissions.join(", ")}`);
  }
}

export function requireRole(principal: Principal, roleSlug: RoleSlug) {
  if (principal.status !== "active" || !hasRole(principal, roleSlug)) {
    throw new AuthorizationError(`Missing role: ${roleSlug}`);
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function permissionsForRole(slug: RoleSlug): Permission[] {
  return ROLE_PERMISSIONS[slug];
}
