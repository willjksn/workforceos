import { and, count, eq, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import { decisionLog, roles, userRoles, users } from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { assertAccountAccessChange, assertRoleAssignmentAllowed } from "../rbac/assign-role";
import type { Principal, RoleSlug } from "../rbac/permissions";

export async function listOrganizationUsers(organizationId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
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

export async function listDecisionLog() {
  const db = getDb();
  return db.select().from(decisionLog).orderBy(decisionLog.code);
}
