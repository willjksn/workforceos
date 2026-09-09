import { applyPermissionOverrides, ROLE_PERMISSIONS, type Permission } from "../rbac/permissions";
import { getOrganizationUser, listOrganizationUsers } from "../repositories/platform";

export const SENSITIVE_PERMISSIONS: Permission[] = [
  "candidate_pii.read",
  "reports.export_pii",
  "privacy.delete",
  "admin.roles",
  "admin.users",
  "finance.approve",
  "contracts.approve",
];

const STALE_LOGIN_MS = 30 * 24 * 60 * 60 * 1000;

export async function getAccessReview(organizationId: string) {
  const people = await listOrganizationUsers(organizationId);
  const now = Date.now();
  return Promise.all(
    people.map(async (person) => {
      const detail = await getOrganizationUser(organizationId, person.id);
      const permissions = new Set(
        detail?.effectivePermissions ??
          applyPermissionOverrides(
            person.roles.flatMap((role) => ROLE_PERMISSIONS[role.slug as keyof typeof ROLE_PERMISSIONS] ?? []),
          ),
      );
      const lastLoginAt = person.lastLoginAt ?? null;
      return {
        id: person.id,
        fullName: person.fullName,
        email: person.email,
        organizationalTitle: person.organizationalTitle,
        status: person.status,
        roles: person.roles.map((role) => role.name),
        lastLoginAt,
        sensitivePermissions: SENSITIVE_PERMISSIONS.filter((permission) => permissions.has(permission)),
        stale: person.status !== "disabled" && (!lastLoginAt || now - lastLoginAt.getTime() > STALE_LOGIN_MS),
      };
    }),
  );
}
