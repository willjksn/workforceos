import { eq } from "drizzle-orm";

import { getDb } from "../../db";
import { permissions, rolePermissions, roles, userRoles, users } from "../../db/schema";
import {
  AuthorizationError,
  type Permission,
  type Principal,
  type RoleSlug,
  can as canPrincipal,
  requireAnyPermission as requireAnyPermissionOnPrincipal,
  requirePermission as requirePermissionOnPrincipal,
  requireRole as requireRoleOnPrincipal,
} from "./permissions";

export async function loadPrincipalByUserId(userId: string): Promise<Principal | null> {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  const assignedRoles = await db
    .select({ slug: roles.slug })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));

  const assignedPermissions = await db
    .select({ slug: permissions.slug })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(userRoles.userId, user.id));

  return {
    id: user.id,
    status: user.status,
    organizationId: user.organizationId,
    roleSlugs: [...new Set(assignedRoles.map((row) => row.slug))],
    permissions: new Set(assignedPermissions.map((row) => row.slug)),
  };
}

export async function requirePermission(userId: string, permission: Permission) {
  const principal = await loadPrincipalByUserId(userId);
  if (!principal) throw new AuthorizationError("User not found");
  requirePermissionOnPrincipal(principal, permission);
  return principal;
}

export async function requireAnyPermission(userId: string, permissionsToCheck: Permission[]) {
  const principal = await loadPrincipalByUserId(userId);
  if (!principal) throw new AuthorizationError("User not found");
  requireAnyPermissionOnPrincipal(principal, permissionsToCheck);
  return principal;
}

export async function requireRole(userId: string, roleSlug: RoleSlug) {
  const principal = await loadPrincipalByUserId(userId);
  if (!principal) throw new AuthorizationError("User not found");
  requireRoleOnPrincipal(principal, roleSlug);
  return principal;
}

export function can(principal: Principal, permission: Permission) {
  return canPrincipal(principal, permission);
}
