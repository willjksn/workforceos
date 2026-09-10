import { ACCESS_TEMPLATE_SLUGS, FUNCTIONAL_BUNDLE_SLUGS } from "./access-bundles";

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
  "finance.approve",
  "invoices.read",
  "invoices.write",
  "payments.read",
  "payments.write",
  "integrations.read",
  "integrations.manage",
  "agents.read",
  "agents.manage",
  "knowledge.read",
  "knowledge.write",
  "knowledge.approve",
  "automations.read",
  "automations.manage",
  "admin.users",
  "admin.roles",
  "workforce.read",
  "workforce.write",
  "workforce.analyze",
  "workforce.approve",
  "forecasts.read",
  "forecasts.write",
  "pipelines.read",
  "pipelines.write",
  "career_paths.read",
  "career_paths.write",
  "education_partners.read",
  "education_partners.write",
  "training_programs.read",
  "training_programs.write",
  "scenario_models.read",
  "scenario_models.write",
  "reports.read",
  "reports.export",
  "reports.export_pii",
  "data_quality.read",
  "alerts.read",
  "privacy.delete",
  "scout.use",
  "scout.search",
  "scout.draft",
  "scout.internal_actions",
  "scout.external_actions",
  "skillbridge.read",
  "skillbridge.write",
  "skillbridge.manage",
  "skillbridge.export",
  "jobs.create",
  "jobs.approve",
  "jobs.publish",
  "jobs.close",
  "applications.read",
  "applications.review",
  "applications.advance",
  "applications.reject",
  "applications.export",
  "interviews.schedule",
  "interviews.score",
  "background_checks.read",
  "background_checks.request",
  "background_checks.review",
  "drug_screens.read",
  "drug_screens.request",
  "drug_screens.review",
  "offers.create",
  "offers.approve",
  "offers.send",
  "onboarding.read",
  "onboarding.manage",
  "onboarding.complete",
  "employees.read",
  "employees.manage",
  "careers.manage",
  "transactional_email.send",
  "public_content.read",
  "public_content.manage",
  "public_content.publish",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_SLUGS = [...ACCESS_TEMPLATE_SLUGS, ...FUNCTIONAL_BUNDLE_SLUGS] as const;

export type RoleSlug = (typeof ROLE_SLUGS)[number];

const ALL = [...PERMISSIONS];
const READ_ONLY = PERMISSIONS.filter(
  (permission) =>
    permission.endsWith(".read") &&
    permission !== "candidate_pii.read" &&
    permission !== "background_checks.read" &&
    permission !== "drug_screens.read" &&
    permission !== "agents.read",
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
    "finance.approve",
    "invoices.read",
    "invoices.write",
    "payments.read",
    "payments.write",
    "integrations.read",
    "agents.read",
    "knowledge.read",
    "automations.read",
    "admin.users",
    "workforce.read",
    "workforce.write",
    "forecasts.read",
    "pipelines.read",
    "career_paths.read",
    "education_partners.read",
    "training_programs.read",
    "scenario_models.read",
    "reports.read",
    "reports.export",
    "data_quality.read",
    "alerts.read",
    "scout.use",
    "scout.search",
    "scout.external_actions",
    "transactional_email.send",
    "skillbridge.read",
    "applications.read",
    "background_checks.read",
    "drug_screens.read",
    "onboarding.read",
    "onboarding.manage",
    "employees.read",
    "employees.manage",
    "public_content.read",
    "public_content.manage",
    "public_content.publish",
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
    "finance.read",
    "invoices.read",
    "payments.read",
    "integrations.read",
    "integrations.manage",
    "agents.read",
    "agents.manage",
    "knowledge.read",
    "knowledge.write",
    "knowledge.approve",
    "automations.read",
    "automations.manage",
    "admin.users",
    "admin.roles",
    "workforce.read",
    "forecasts.read",
    "pipelines.read",
    "career_paths.read",
    "education_partners.read",
    "training_programs.read",
    "scenario_models.read",
    "reports.read",
    "reports.export",
    "data_quality.read",
    "alerts.read",
    "scout.use",
    "scout.search",
    "scout.external_actions",
    "transactional_email.send",
    "skillbridge.read",
    "public_content.read",
    "public_content.manage",
    "public_content.publish",
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
    "finance.read",
    "invoices.read",
    "payments.read",
    "knowledge.read",
    "knowledge.write",
    "agents.read",
    "workforce.read",
    "forecasts.read",
    "pipelines.read",
    "career_paths.read",
    "education_partners.read",
    "training_programs.read",
    "scenario_models.read",
    "reports.read",
    "reports.export",
    "scout.use",
    "scout.search",
    "scout.draft",
    "scout.internal_actions",
    "skillbridge.read",
    "skillbridge.write",
    "skillbridge.manage",
    "skillbridge.export",
    "jobs.create",
    "jobs.approve",
    "jobs.publish",
    "jobs.close",
    "applications.read",
    "applications.review",
    "applications.advance",
    "applications.reject",
    "applications.export",
    "interviews.schedule",
    "interviews.score",
    "background_checks.read",
    "background_checks.request",
    "background_checks.review",
    "drug_screens.read",
    "drug_screens.request",
    "drug_screens.review",
    "offers.create",
    "offers.approve",
    "offers.send",
    "onboarding.read",
    "onboarding.manage",
    "onboarding.complete",
    "employees.read",
    "employees.manage",
    "careers.manage",
    "transactional_email.send",
    "public_content.read",
  ],
  // Recruiter is talent/jobs execution, not commercial opportunity ownership (DEC-RBAC-001).
  // Do not add opportunities.read unless product explicitly expands that bundle.
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
    "workforce.read",
    "reports.read",
    "agents.read",
    "scout.use",
    "scout.search",
    "scout.draft",
    "scout.internal_actions",
    "skillbridge.read",
    "skillbridge.write",
    "jobs.create",
    "jobs.publish",
    "jobs.close",
    "applications.read",
    "applications.review",
    "applications.advance",
    "applications.reject",
    "interviews.schedule",
    "interviews.score",
    "background_checks.read",
    "background_checks.request",
    "drug_screens.read",
    "drug_screens.request",
    "offers.create",
    "offers.send",
    "onboarding.read",
    "onboarding.manage",
    "employees.read",
    "careers.manage",
    "transactional_email.send",
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
    "finance.read",
    "invoices.read",
    "workforce.read",
    "workforce.write",
    "workforce.analyze",
    "workforce.approve",
    "forecasts.read",
    "forecasts.write",
    "pipelines.read",
    "pipelines.write",
    "career_paths.read",
    "career_paths.write",
    "education_partners.read",
    "education_partners.write",
    "training_programs.read",
    "training_programs.write",
    "scenario_models.read",
    "scenario_models.write",
    "knowledge.read",
    "knowledge.write",
    "reports.read",
    "agents.read",
    "scout.use",
    "scout.search",
    "scout.draft",
    "skillbridge.read",
  ],
  "military-talent-partner": [
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
    "workforce.read",
    "forecasts.read",
    "pipelines.read",
    "knowledge.read",
    "reports.read",
    "agents.read",
    "scout.use",
    "scout.search",
    "scout.draft",
    "scout.internal_actions",
    "skillbridge.read",
    "skillbridge.write",
    "skillbridge.manage",
    "skillbridge.export",
    "applications.read",
    "onboarding.read",
  ],
  "read-only": [...READ_ONLY, "scout.use", "scout.search"],
  "crm-business-development": [
    "companies.read",
    "companies.write",
    "contacts.read",
    "contacts.write",
    "opportunities.read",
    "opportunities.write",
    "discovery.read",
    "discovery.write",
  ],
  "talent-network": ["candidates.read", "candidates.write", "candidate_pii.read"],
  recruiting: [
    "jobs.read",
    "jobs.write",
    "jobs.create",
    "jobs.approve",
    "jobs.publish",
    "jobs.close",
    "search_projects.read",
    "search_projects.write",
    "submissions.read",
    "submissions.write",
    "submissions.approve",
    "interviews.read",
    "interviews.write",
    "interviews.schedule",
    "interviews.score",
    "offers.read",
    "offers.write",
    "placements.read",
    "placements.write",
    "recruiting.analytics.read",
  ],
  "military-talent": [
    "military.read",
    "military.write",
    "military.review",
    "military_reference.manage",
    "skillbridge.read",
    "skillbridge.write",
    "skillbridge.manage",
    "skillbridge.export",
  ],
  "workforce-consulting": [
    "workforce.read",
    "workforce.write",
    "workforce.analyze",
    "workforce.approve",
    "forecasts.read",
    "forecasts.write",
    "pipelines.read",
    "pipelines.write",
    "career_paths.read",
    "career_paths.write",
    "education_partners.read",
    "education_partners.write",
    "training_programs.read",
    "training_programs.write",
    "scenario_models.read",
    "scenario_models.write",
  ],
  projects: [
    "projects.read",
    "projects.write",
    "deliverables.read",
    "deliverables.write",
    "deliverables.approve",
  ],
  proposals: [
    "proposals.read",
    "proposals.write",
    "proposals.approve",
    "solutions.read",
    "solutions.write",
    "solutions.approve",
    "pricing.approve",
    "services.read",
  ],
  contracts: ["contracts.read", "contracts.write", "contracts.approve", "legal.read", "legal.write"],
  finance: [
    "finance.read",
    "finance.write",
    "finance.approve",
    "invoices.read",
    "invoices.write",
    "payments.read",
    "payments.write",
    "billing.read",
    "billing.write",
  ],
  "hiring-onboarding": [
    "applications.read",
    "applications.review",
    "applications.advance",
    "applications.reject",
    "applications.export",
    "background_checks.read",
    "background_checks.request",
    "background_checks.review",
    "drug_screens.read",
    "drug_screens.request",
    "drug_screens.review",
    "offers.create",
    "offers.approve",
    "offers.send",
    "onboarding.read",
    "onboarding.manage",
    "onboarding.complete",
    "employees.read",
    "employees.manage",
    "careers.manage",
  ],
  "reports-analytics": ["reports.read", "reports.export", "alerts.read", "data_quality.read"],
  scout: ["scout.use", "scout.search", "scout.draft", "scout.internal_actions"],
  "ai-review": ["agents.read"],
  "ai-administration": ["agents.manage", "automations.read", "automations.manage"],
  "knowledge-training": ["knowledge.read", "knowledge.write", "knowledge.approve"],
  "system-administration": [
    "admin.users",
    "admin.roles",
    "integrations.read",
    "integrations.manage",
    "public_content.read",
    "public_content.manage",
    "public_content.publish",
    "services.manage",
    "privacy.delete",
    "reports.export_pii",
  ],
};

export type Principal = {
  id: string;
  status: "active" | "invited" | "disabled";
  organizationId: string;
  roleSlugs: string[];
  permissions: ReadonlySet<string>;
};

export type PermissionOverrideEffect = "grant" | "deny";

export type PermissionOverride = {
  permission: string;
  effect: PermissionOverrideEffect;
};

/** One-release alias after DEC-MIL-005 / Phase C. Production rows are migrated to `military-talent-partner`. */
export const LEGACY_ROLE_SLUG_ALIASES: Record<string, RoleSlug> = {
  "military-talent-specialist": "military-talent-partner",
};

export function canonicalizeRoleSlug(slug: string): string {
  return LEGACY_ROLE_SLUG_ALIASES[slug] ?? slug;
}

export function isRoleSlug(value: string): value is RoleSlug {
  return (ROLE_SLUGS as readonly string[]).includes(canonicalizeRoleSlug(value));
}

export function asRoleSlug(value: string): RoleSlug | null {
  const canonical = canonicalizeRoleSlug(value);
  return (ROLE_SLUGS as readonly string[]).includes(canonical) ? (canonical as RoleSlug) : null;
}

export function roleSlugLookupValues(slug: string): string[] {
  const canonical = canonicalizeRoleSlug(slug);
  const aliases = Object.entries(LEGACY_ROLE_SLUG_ALIASES)
    .filter(([, target]) => target === canonical)
    .map(([from]) => from);
  return [...new Set([canonical, slug, ...aliases])];
}

/**
 * Effective permissions = union of assigned access-bundle permissions, then overrides.
 * Explicit deny removes a bundle grant. Explicit grant adds a permission. Deny wins if both exist.
 * Organizational title is never an input.
 */
export function applyPermissionOverrides(
  bundlePermissions: Iterable<string>,
  overrides: readonly PermissionOverride[] = [],
): Set<string> {
  const effective = new Set(bundlePermissions);
  const grants = new Set<string>();
  const denies = new Set<string>();
  for (const override of overrides) {
    if (override.effect === "deny") denies.add(override.permission);
    if (override.effect === "grant") grants.add(override.permission);
  }
  for (const permission of grants) {
    if (!denies.has(permission)) effective.add(permission);
  }
  for (const permission of denies) {
    effective.delete(permission);
  }
  return effective;
}

export function roleSlugsHavePermission(roleSlugs: readonly string[] | undefined, permission: Permission) {
  return (roleSlugs ?? []).some((slug) => {
    const canonical = canonicalizeRoleSlug(slug);
    if (canonical === "managing-partner") return true;
    if (!(canonical in ROLE_PERMISSIONS)) return false;
    return ROLE_PERMISSIONS[canonical as RoleSlug].includes(permission);
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
  return principal.roleSlugs.some((slug) => canonicalizeRoleSlug(slug) === roleSlug);
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
