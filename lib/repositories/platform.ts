import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import { decisionLog, roles, users } from "../../db/schema";

export async function listOrganizationUsers(organizationId: string) {
  const db = getDb();
  return db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      status: users.status,
    })
    .from(users)
    .where(and(eq(users.organizationId, organizationId), isNull(users.archivedAt)))
    .orderBy(users.fullName);
}

export async function listOrganizationRoles(organizationId: string) {
  const db = getDb();
  return db
    .select({
      id: roles.id,
      name: roles.name,
      slug: roles.slug,
      description: roles.description,
    })
    .from(roles)
    .where(and(eq(roles.organizationId, organizationId), isNull(roles.archivedAt)))
    .orderBy(roles.name);
}

export async function listDecisionLog() {
  const db = getDb();
  return db.select().from(decisionLog).orderBy(decisionLog.code);
}
