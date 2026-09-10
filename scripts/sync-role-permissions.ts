/**
 * Sync `roles` and `role_permissions` from `ROLE_PERMISSIONS`.
 *
 * Usage:
 *   npx tsx scripts/sync-role-permissions.ts
 *
 * DATABASE_URL must already be set for the target database. dotenv does not
 * override a pre-set DATABASE_URL. Do not run db:seed:dev against production.
 *
 * Locked bundle notes (DEC-AI-012 / DEC-RBAC-001 / DEC-AUTH-003):
 * - Recruiter / Talent Partner / Military Talent Partner receive agents.read
 *   (Review Queue) and never agents.manage (costs).
 * - Workforce Consultant receives agents.read + scout.draft.
 * - Recruiter Standard does not receive opportunities.read.
 * - Functional module bundles may be assigned to any person by admin.roles only.
 *   Title is not access. The Recruiter template still lacks opportunities.read.
 */
import "./load-env";

import { and, eq, notInArray } from "drizzle-orm";

import { getDb } from "../db";
import { organizations, permissions, rolePermissions, roles } from "../db/schema";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLE_SLUGS, type RoleSlug } from "../lib/rbac/permissions";
import { ACCESS_BUNDLE_LABELS, ROLE_GUIDE } from "../lib/rbac/role-guide";

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
  const orgs = await db.select({ id: organizations.id }).from(organizations);

  for (const org of orgs) {
    const existing = await db
      .select({ id: roles.id, slug: roles.slug })
      .from(roles)
      .where(eq(roles.organizationId, org.id));
    const bySlug = new Map(existing.map((row) => [row.slug, row.id]));
    for (const slug of ROLE_SLUGS) {
      const name = ACCESS_BUNDLE_LABELS[slug];
      const description = ROLE_GUIDE[slug].access;
      const roleId = bySlug.get(slug);
      if (roleId) {
        await db
          .update(roles)
          .set({ name, description, updatedAt: new Date() })
          .where(eq(roles.id, roleId));
        continue;
      }
      await db.insert(roles).values({
        organizationId: org.id,
        slug,
        name,
        description,
      });
    }
  }

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
      `${slug}: agents.read=${set.has("agents.read") ? "yes" : "no"} agents.manage=${set.has("agents.manage") ? "yes" : "no"} opportunities.read=${set.has("opportunities.read") ? "yes" : "no"}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
