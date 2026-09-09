import {
  AuthorizationError,
  ROLE_SLUGS,
  can,
  hasRole,
  requirePermission,
  type Principal,
  type RoleSlug,
} from "./permissions";

export const MANAGING_PARTNER_SLUG = "managing-partner" satisfies RoleSlug;

export function assignableRoleSlugs(actor: Principal): RoleSlug[] {
  if (!can(actor, "admin.roles")) return [];
  if (hasRole(actor, MANAGING_PARTNER_SLUG)) return [...ROLE_SLUGS];
  return ROLE_SLUGS.filter((slug) => slug !== MANAGING_PARTNER_SLUG);
}

export function assertRoleAssignmentAllowed(input: {
  actor: Principal;
  nextSlug: RoleSlug;
  currentSlugs: string[];
  managingPartnerCount: number;
}) {
  assertAccessBundlesAllowed({
    actor: input.actor,
    nextSlugs: [input.nextSlug],
    currentSlugs: input.currentSlugs,
    managingPartnerCount: input.managingPartnerCount,
  });
}

export function assertAccessBundlesAllowed(input: {
  actor: Principal;
  nextSlugs: readonly RoleSlug[];
  currentSlugs: string[];
  managingPartnerCount: number;
}) {
  requirePermission(input.actor, "admin.roles");
  const allowed = assignableRoleSlugs(input.actor);
  for (const slug of input.nextSlugs) {
    if (!allowed.includes(slug)) {
      throw new AuthorizationError("Only a Managing Partner can assign the Managing Partner role.");
    }
  }
  const currentlyManagingPartner = input.currentSlugs.includes(MANAGING_PARTNER_SLUG);
  const nextIsManagingPartner = input.nextSlugs.includes(MANAGING_PARTNER_SLUG);
  if (currentlyManagingPartner && !nextIsManagingPartner && input.managingPartnerCount <= 1) {
    throw new AuthorizationError("The organization must keep at least one Managing Partner.");
  }
  if (currentlyManagingPartner && !nextIsManagingPartner && !hasRole(input.actor, MANAGING_PARTNER_SLUG)) {
    throw new AuthorizationError("Only a Managing Partner can remove the Managing Partner role.");
  }
}

export function assertAccountAccessChange(input: {
  actor: Principal;
  targetUserId: string;
  targetRoleSlugs: string[];
  action: "disable" | "enable" | "archive";
  activeManagingPartnerCount: number;
}) {
  requirePermission(input.actor, "admin.users");
  if (input.actor.id === input.targetUserId) {
    throw new AuthorizationError("You cannot change your own access.");
  }
  const targetIsManagingPartner = input.targetRoleSlugs.includes(MANAGING_PARTNER_SLUG);
  if (
    targetIsManagingPartner &&
    (input.action === "disable" || input.action === "archive") &&
    input.activeManagingPartnerCount <= 1
  ) {
    throw new AuthorizationError("The organization must keep at least one active Managing Partner.");
  }
}
