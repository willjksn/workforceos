import "./load-env";

import { eq } from "drizzle-orm";

import { getDb } from "../db";
import { organizations, roles } from "../db/schema";
import { INTERNAL_ORG_SLUG } from "../db/seed/constants";

async function main() {
  const db = getDb();
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, INTERNAL_ORG_SLUG))
    .limit(1);
  if (!organization) {
    throw new Error("Seeded organization not found");
  }
  const seededRoles = await db.select().from(roles).where(eq(roles.organizationId, organization.id));
  if (seededRoles.length < 8) {
    throw new Error(`Expected 8 roles, found ${seededRoles.length}`);
  }
  console.log(`Organization: ${organization.name} (${organization.id})`);
  for (const role of seededRoles) {
    console.log(`- ${role.name}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
