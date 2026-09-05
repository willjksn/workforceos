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
  "military.read",
  "military.write",
  "solutions.read",
  "solutions.write",
  "projects.read",
  "projects.write",
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
    "solutions.read",
    "solutions.write",
    "projects.read",
    "projects.write",
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
    "military.read",
    "solutions.read",
    "projects.read",
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
    "military.read",
    "military.write",
    "solutions.read",
    "solutions.write",
    "projects.read",
  ],
  recruiter: [
    "companies.read",
    "contacts.read",
    "candidates.read",
    "candidates.write",
    "candidate_pii.read",
    "jobs.read",
    "jobs.write",
    "military.read",
  ],
  "workforce-consultant": [
    "companies.read",
    "contacts.read",
    "opportunities.read",
    "candidates.read",
    "jobs.read",
    "military.read",
    "solutions.read",
    "solutions.write",
    "projects.read",
    "projects.write",
  ],
  "military-talent-specialist": [
    "companies.read",
    "candidates.read",
    "candidates.write",
    "candidate_pii.read",
    "jobs.read",
    "jobs.write",
    "military.read",
    "military.write",
    "solutions.read",
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

export function can(principal: Principal, permission: Permission) {
  if (principal.status !== "active") return false;
  return principal.permissions.has(permission);
}

export function canAny(principal: Principal, permissions: Permission[]) {
  return permissions.some((permission) => can(principal, permission));
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
