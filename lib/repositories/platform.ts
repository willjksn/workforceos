import { and, count, eq, inArray, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import { decisionLog, permissions, rolePermissions, roles, userPermissionOverrides, userRoles, users } from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { assertAccessBundlesAllowed, assertAccountAccessChange, assertRoleAssignmentAllowed } from "../rbac/assign-role";
import {
  applyPermissionOverrides,
  asRoleSlug,
  canonicalizeRoleSlug,
  requirePermission,
  type Permission,
  type PermissionOverrideEffect,
  type Principal,
  type RoleSlug,
} from "../rbac/permissions";

export async function listOrganizationUsers(organizationId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      organizationalTitle: users.organizationalTitle,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      roleName: roles.name,
      roleSlug: roles.slug,
    })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(eq(users.organizationId, organizationId), isNull(users.archivedAt)))
    .orderBy(users.fullName);

  const byId = new Map<
    string,
    {
      id: string;
      fullName: string;
      email: string;
      organizationalTitle: string | null;
      status: string;
      lastLoginAt: Date | null;
      roles: Array<{ name: string; slug: string }>;
    }
  >();
  for (const row of rows) {
    const existing = byId.get(row.id);
    if (!existing) {
      byId.set(row.id, {
        id: row.id,
        fullName: row.fullName,
        email: row.email,
        organizationalTitle: row.organizationalTitle,
        status: row.status,
        lastLoginAt: row.lastLoginAt,
        roles: row.roleName && row.roleSlug ? [{ name: row.roleName, slug: row.roleSlug }] : [],
      });
    } else if (row.roleName && row.roleSlug && !existing.roles.some((role) => role.slug === row.roleSlug)) {
      existing.roles.push({ name: row.roleName, slug: row.roleSlug });
    }
  }
  return [...byId.values()];
}

export async function listOrganizationRoles(organizationId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: roles.id,
      name: roles.name,
      slug: roles.slug,
      description: roles.description,
      assignedCount: count(userRoles.id),
    })
    .from(roles)
    .leftJoin(userRoles, eq(userRoles.roleId, roles.id))
    .where(and(eq(roles.organizationId, organizationId), isNull(roles.archivedAt)))
    .groupBy(roles.id)
    .orderBy(roles.name);
  return rows;
}

export async function countManagingPartners(organizationId: string, activeOnly = false) {
  const db = getDb();
  const [row] = await db
    .select({ value: count(users.id) })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(users, eq(userRoles.userId, users.id))
    .where(
      and(
        eq(users.organizationId, organizationId),
        eq(roles.slug, "managing-partner"),
        isNull(users.archivedAt),
        isNull(roles.archivedAt),
        activeOnly ? eq(users.status, "active") : undefined,
      ),
    );
  return Number(row?.value ?? 0);
}

export async function assignUserRole(input: {
  actor: Principal;
  userId: string;
  roleSlug: RoleSlug;
}) {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, input.userId), eq(users.organizationId, input.actor.organizationId)))
    .limit(1);
  if (!user || user.archivedAt) {
    throw new Error("That person is not in this organization.");
  }

  const [role] = await db
    .select()
    .from(roles)
    .where(
      and(
        eq(roles.organizationId, input.actor.organizationId),
        eq(roles.slug, input.roleSlug),
        isNull(roles.archivedAt),
      ),
    )
    .limit(1);
  if (!role) {
    throw new Error("That role is not available.");
  }

  const current = await db
    .select({ id: userRoles.id, slug: roles.slug, roleId: userRoles.roleId })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));
  const currentSlugs = current.map((row) => row.slug);

  if (currentSlugs.length === 1 && currentSlugs[0] === input.roleSlug) {
    return { user, roleSlug: input.roleSlug };
  }

  const managingPartnerCount = await countManagingPartners(input.actor.organizationId);
  assertRoleAssignmentAllowed({
    actor: input.actor,
    nextSlug: input.roleSlug,
    currentSlugs,
    managingPartnerCount,
  });

  const [keep, ...extras] = current;
  for (const extra of extras) {
    await db.delete(userRoles).where(eq(userRoles.id, extra.id));
  }
  if (keep) {
    if (keep.roleId !== role.id) {
      await db
        .update(userRoles)
        .set({ roleId: role.id, updatedAt: new Date() })
        .where(eq(userRoles.id, keep.id));
    }
  } else {
    await db.insert(userRoles).values({ userId: user.id, roleId: role.id });
  }

  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "human", userId: input.actor.id },
    action: "user.role.assign",
    recordType: "user",
    recordId: user.id,
    before: { roleSlugs: currentSlugs },
    after: { roleSlugs: [input.roleSlug] },
  });

  return { user, roleSlug: input.roleSlug };
}

async function loadUserWithRoles(organizationId: string, userId: string) {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.organizationId, organizationId)))
    .limit(1);
  if (!user || user.archivedAt) {
    throw new Error("That person is not in this organization.");
  }
  const assigned = await db
    .select({ slug: roles.slug })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));
  return { user, roleSlugs: assigned.map((row) => row.slug) };
}

export async function setUserAccessStatus(input: {
  actor: Principal;
  userId: string;
  status: "active" | "disabled";
}) {
  const { user, roleSlugs } = await loadUserWithRoles(input.actor.organizationId, input.userId);
  if (user.status === input.status) return user;

  const activeManagingPartnerCount = await countManagingPartners(input.actor.organizationId, true);
  assertAccountAccessChange({
    actor: input.actor,
    targetUserId: user.id,
    targetRoleSlugs: roleSlugs,
    action: input.status === "disabled" ? "disable" : "enable",
    activeManagingPartnerCount,
  });

  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();

  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "human", userId: input.actor.id },
    action: input.status === "disabled" ? "user.disable" : "user.enable",
    recordType: "user",
    recordId: user.id,
    before: { status: user.status },
    after: { status: input.status },
  });

  return updated;
}

export async function archiveUser(input: { actor: Principal; userId: string }) {
  const { user, roleSlugs } = await loadUserWithRoles(input.actor.organizationId, input.userId);
  const activeManagingPartnerCount = await countManagingPartners(input.actor.organizationId, true);
  assertAccountAccessChange({
    actor: input.actor,
    targetUserId: user.id,
    targetRoleSlugs: roleSlugs,
    action: "archive",
    activeManagingPartnerCount,
  });

  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({
      status: "disabled",
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning();

  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "human", userId: input.actor.id },
    action: "user.archive",
    recordType: "user",
    recordId: user.id,
    before: { status: user.status, archivedAt: null },
    after: { status: "disabled", archivedAt: updated?.archivedAt },
  });

  return updated;
}

export async function getOrganizationUser(organizationId: string, userId: string) {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.organizationId, organizationId), isNull(users.archivedAt)))
    .limit(1);
  if (!user) return null;

  const assigned = await db
    .select({ id: roles.id, name: roles.name, slug: roles.slug })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));

  const overrideRows = await db
    .select({
      id: userPermissionOverrides.id,
      permissionId: userPermissionOverrides.permissionId,
      permission: permissions.slug,
      effect: userPermissionOverrides.effect,
    })
    .from(userPermissionOverrides)
    .innerJoin(permissions, eq(userPermissionOverrides.permissionId, permissions.id))
    .where(eq(userPermissionOverrides.userId, user.id));

  const bundlePermissionRows = await db
    .select({ slug: permissions.slug })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(userRoles.userId, user.id));

  const bundlePermissions = [...new Set(bundlePermissionRows.map((row) => row.slug))].sort();
  const overrides = overrideRows.map((row) => ({
    id: row.id,
    permission: row.permission,
    effect: row.effect as PermissionOverrideEffect,
  }));
  const effectivePermissions = [...applyPermissionOverrides(bundlePermissions, overrides)].sort();

  return {
    user,
    roles: assigned.map((role) => ({
      id: role.id,
      name: role.name,
      slug: canonicalizeRoleSlug(role.slug),
    })),
    overrides,
    bundlePermissions,
    effectivePermissions,
  };
}

export async function setUserOrganizationalTitle(input: {
  actor: Principal;
  userId: string;
  organizationalTitle: string | null;
}) {
  const { user } = await loadUserWithRoles(input.actor.organizationId, input.userId);
  const nextTitle = input.organizationalTitle?.trim() ? input.organizationalTitle.trim() : null;
  if ((user.organizationalTitle ?? null) === nextTitle) return user;

  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({ organizationalTitle: nextTitle, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();

  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "human", userId: input.actor.id },
    action: "user.profile.update",
    recordType: "user",
    recordId: user.id,
    before: { organizationalTitle: user.organizationalTitle },
    after: { organizationalTitle: nextTitle },
  });

  return updated;
}

export async function setUserAccessBundles(input: {
  actor: Principal;
  userId: string;
  roleSlugs: RoleSlug[];
}) {
  const db = getDb();
  const { user, roleSlugs: currentSlugs } = await loadUserWithRoles(input.actor.organizationId, input.userId);
  const nextSlugs = [...new Set(input.roleSlugs)];
  const currentCanonical = currentSlugs.map((slug) => canonicalizeRoleSlug(slug));
  if (currentCanonical.length === nextSlugs.length && nextSlugs.every((slug) => currentCanonical.includes(slug))) {
    return { user, roleSlugs: nextSlugs };
  }

  const managingPartnerCount = await countManagingPartners(input.actor.organizationId);
  assertAccessBundlesAllowed({
    actor: input.actor,
    nextSlugs,
    currentSlugs: currentCanonical,
    managingPartnerCount,
  });

  const nextRoles = nextSlugs.length
    ? await db
        .select()
        .from(roles)
        .where(
          and(
            eq(roles.organizationId, input.actor.organizationId),
            inArray(roles.slug, nextSlugs),
            isNull(roles.archivedAt),
          ),
        )
    : [];
  if (nextRoles.length !== nextSlugs.length) {
    throw new Error("One or more access bundles are not available.");
  }

  const current = await db
    .select({ id: userRoles.id, slug: roles.slug, roleId: userRoles.roleId })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));
  const nextRoleIds = new Set(nextRoles.map((role) => role.id));
  for (const row of current) {
    if (!nextRoleIds.has(row.roleId)) {
      await db.delete(userRoles).where(eq(userRoles.id, row.id));
    }
  }
  const currentRoleIds = new Set(current.map((row) => row.roleId));
  for (const role of nextRoles) {
    if (!currentRoleIds.has(role.id)) {
      await db.insert(userRoles).values({ userId: user.id, roleId: role.id });
    }
  }

  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "human", userId: input.actor.id },
    action: "user.access_bundles.assign",
    recordType: "user",
    recordId: user.id,
    before: { roleSlugs: currentCanonical },
    after: { roleSlugs: nextSlugs },
  });

  return { user, roleSlugs: nextSlugs };
}

export async function setUserPermissionOverride(input: {
  actor: Principal;
  userId: string;
  permission: Permission;
  effect: PermissionOverrideEffect;
}) {
  requireAdminRoles(input.actor);
  const { user } = await loadUserWithRoles(input.actor.organizationId, input.userId);
  const db = getDb();
  const [permission] = await db
    .select()
    .from(permissions)
    .where(eq(permissions.slug, input.permission))
    .limit(1);
  if (!permission) {
    throw new Error("That permission is not available.");
  }

  const [existing] = await db
    .select()
    .from(userPermissionOverrides)
    .where(
      and(eq(userPermissionOverrides.userId, user.id), eq(userPermissionOverrides.permissionId, permission.id)),
    )
    .limit(1);

  if (existing) {
    await db
      .update(userPermissionOverrides)
      .set({ effect: input.effect, updatedAt: new Date() })
      .where(eq(userPermissionOverrides.id, existing.id));
  } else {
    await db.insert(userPermissionOverrides).values({
      userId: user.id,
      permissionId: permission.id,
      effect: input.effect,
    });
  }

  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "human", userId: input.actor.id },
    action: "user.permission_override.set",
    recordType: "user",
    recordId: user.id,
    before: existing ? { permission: input.permission, effect: existing.effect } : null,
    after: { permission: input.permission, effect: input.effect },
  });

  return { userId: user.id, permission: input.permission, effect: input.effect };
}

export async function resetUserPermissionOverrides(input: { actor: Principal; userId: string }) {
  requireAdminRoles(input.actor);
  const { user } = await loadUserWithRoles(input.actor.organizationId, input.userId);
  const db = getDb();
  const existing = await db
    .select({ permission: permissions.slug, effect: userPermissionOverrides.effect })
    .from(userPermissionOverrides)
    .innerJoin(permissions, eq(userPermissionOverrides.permissionId, permissions.id))
    .where(eq(userPermissionOverrides.userId, user.id));
  if (existing.length === 0) return { userId: user.id, cleared: 0 };

  await db.delete(userPermissionOverrides).where(eq(userPermissionOverrides.userId, user.id));
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "human", userId: input.actor.id },
    action: "user.permission_override.reset",
    recordType: "user",
    recordId: user.id,
    before: { overrides: existing },
    after: { overrides: [] },
  });
  return { userId: user.id, cleared: existing.length };
}

export async function copyUserAccess(input: {
  actor: Principal;
  sourceUserId: string;
  targetUserId: string;
  includeOverrides: boolean;
}) {
  if (input.sourceUserId === input.targetUserId) {
    throw new Error("Choose a different person to copy access from.");
  }
  const source = await getOrganizationUser(input.actor.organizationId, input.sourceUserId);
  if (!source) throw new Error("The source person is not in this organization.");
  const typedSlugs = source.roles
    .map((role) => asRoleSlug(role.slug))
    .filter((slug): slug is RoleSlug => Boolean(slug));

  await setUserAccessBundles({
    actor: input.actor,
    userId: input.targetUserId,
    roleSlugs: typedSlugs,
  });

  if (input.includeOverrides) {
    await resetUserPermissionOverrides({ actor: input.actor, userId: input.targetUserId });
    for (const override of source.overrides) {
      await setUserPermissionOverride({
        actor: input.actor,
        userId: input.targetUserId,
        permission: override.permission as Permission,
        effect: override.effect,
      });
    }
  }

  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "human", userId: input.actor.id },
    action: "user.access.copy",
    recordType: "user",
    recordId: input.targetUserId,
    after: {
      sourceUserId: input.sourceUserId,
      roleSlugs: typedSlugs,
      includeOverrides: input.includeOverrides,
    },
  });

  return { roleSlugs: typedSlugs, overridesCopied: input.includeOverrides ? source.overrides.length : 0 };
}

function requireAdminRoles(actor: Principal) {
  requirePermission(actor, "admin.roles");
}

export async function listDecisionLog() {
  const db = getDb();
  return db.select().from(decisionLog).orderBy(decisionLog.code);
}
