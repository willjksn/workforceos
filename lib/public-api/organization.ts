import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import { organizations, roles, userRoles, users } from "../../db/schema";
import { getServerEnv } from "../env";

export async function resolvePublicOrganizationId() {
  const env = getServerEnv();
  if (env.PUBLIC_INTAKE_ORGANIZATION_ID) return env.PUBLIC_INTAKE_ORGANIZATION_ID;
  const db = getDb();
  const [named] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(eq(organizations.slug, "workforceos"), isNull(organizations.archivedAt)))
    .limit(1);
  if (named) return named.id;
  const rows = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(isNull(organizations.archivedAt))
    .limit(2);
  if (rows.length !== 1) {
    throw new Error("Public intake organization is not configured.");
  }
  return rows[0].id;
}

export async function resolveOwnerByRole(input: {
  organizationId: string;
  userId?: string | null;
  roleSlug: string;
}) {
  const db = getDb();
  if (input.userId) {
    const [user] = await db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(and(eq(users.id, input.userId), eq(users.organizationId, input.organizationId)))
      .limit(1);
    if (user?.status === "active") return user.id;
  }
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(
      and(
        eq(users.organizationId, input.organizationId),
        eq(users.status, "active"),
        eq(roles.slug, input.roleSlug),
        isNull(users.archivedAt),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}
