import "./load-env";

import { and, eq, notInArray } from "drizzle-orm";

import { getDb } from "../db";
import { permissions, rolePermissions, roles } from "../db/schema";
import { PERMISSIONS, ROLE_PERMISSIONS, type RoleSlug } from "../lib/rbac/permissions";

async function main() {
  const db = getDb();
  for (const slug of PERMISSIONS) {
    await db
      .insert(permissions)
      .values({ slug, description: slug })
      .onConflictDoUpdate({
        target: permissions.slug,
        set: { description: slug, updatedAt: new Date() },
      });
  }

  const storedPermissions = await db.select().from(permissions);
  const permissionIdBySlug = Object.fromEntries(storedPermissions.map((row) => [row.slug, row.id]));
  const storedRoles = await db.select({ id: roles.id, slug: roles.slug }).from(roles);

  for (const role of storedRoles) {
    if (!(role.slug in ROLE_PERMISSIONS)) continue;
    const allowedSlugs = ROLE_PERMISSIONS[role.slug as RoleSlug];
    const allowedIds = allowedSlugs
      .map((permissionSlug) => permissionIdBySlug[permissionSlug])
      .filter((id): id is string => Boolean(id));
    for (const permissionId of allowedIds) {
      await db
        .insert(rolePermissions)
        .values({ roleId: role.id, permissionId })
        .onConflictDoNothing();
    }
    if (allowedIds.length === 0) {
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
    } else {
      await db
        .delete(rolePermissions)
        .where(and(eq(rolePermissions.roleId, role.id), notInArray(rolePermissions.permissionId, allowedIds)));
    }
  }

  const granted = await db
    .select({ slug: roles.slug, permission: permissions.slug })
    .from(rolePermissions)
    .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id));
  const byRole = new Map<string, Set<string>>();
  for (const row of granted) {
    const set = byRole.get(row.slug) ?? new Set<string>();
    set.add(row.permission);
    byRole.set(row.slug, set);
  }
  for (const [slug, set] of [...byRole.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(
      `${slug}: agents.read=${set.has("agents.read") ? "yes" : "no"} agents.manage=${set.has("agents.manage") ? "yes" : "no"}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
