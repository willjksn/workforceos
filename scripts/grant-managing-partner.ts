import "./load-env";

import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../db";
import { organizations, roles, userRoles, users } from "../db/schema";
import { INTERNAL_ORG_SLUG, ROLE_IDS } from "../db/seed/constants";
import { recordAuditEvent } from "../lib/audit/record-audit-event";

function readEmail() {
  const flagged = process.argv.find((arg) => arg.startsWith("--email="));
  if (flagged) return flagged.slice("--email=".length).trim().toLowerCase();
  const index = process.argv.indexOf("--email");
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1].trim().toLowerCase();
  const positional = process.argv.slice(2).find((arg) => !arg.startsWith("-"));
  return positional?.trim().toLowerCase();
}

async function main() {
  const email = readEmail();
  if (!email || !email.includes("@")) {
    throw new Error("Usage: npx tsx scripts/grant-managing-partner.ts --email you@company.com");
  }

  const db = getDb();
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, INTERNAL_ORG_SLUG))
    .limit(1);
  if (!organization) {
    throw new Error("WorkforceOS organization is missing. Run `npm run db:seed:prod` first.");
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    throw new Error(
      `No local user exists for ${email}. Sign in once with Clerk so WorkforceOS can sync the user, then rerun this command.`,
    );
  }
  if (user.status === "disabled") {
    throw new Error("That WorkforceOS account is disabled. Re-enable it before granting Managing Partner.");
  }

  const [role] = await db
    .select()
    .from(roles)
    .where(
      and(
        eq(roles.organizationId, organization.id),
        eq(roles.id, ROLE_IDS["managing-partner"]),
        isNull(roles.archivedAt),
      ),
    )
    .limit(1);
  if (!role) {
    throw new Error("Managing Partner role is missing. Run `npm run db:seed:prod` first.");
  }

  const current = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
  if (current.some((row) => row.roleId === role.id) && current.length === 1) {
    console.log(`Managing Partner already assigned to ${email}`);
    return;
  }

  for (const extra of current.slice(1)) {
    await db.delete(userRoles).where(eq(userRoles.id, extra.id));
  }
  if (current[0]) {
    await db
      .update(userRoles)
      .set({ roleId: role.id, updatedAt: new Date() })
      .where(eq(userRoles.id, current[0].id));
  } else {
    await db.insert(userRoles).values({ userId: user.id, roleId: role.id });
  }

  await recordAuditEvent({
    organizationId: organization.id,
    actor: { type: "system" },
    action: "user.role.bootstrap",
    recordType: "user",
    recordId: user.id,
    before: { roleIds: current.map((row) => row.roleId) },
    after: { roleSlug: "managing-partner" },
    reason: "Deployment bootstrap: first Managing Partner assignment",
  });

  console.log(`Granted Managing Partner to ${email}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
