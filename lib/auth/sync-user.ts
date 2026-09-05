import { eq } from "drizzle-orm";

import { getDb } from "../../db";
import { organizations, userRoles, users } from "../../db/schema";
import { isClerkConfigured } from "../env";
import { type Principal } from "../rbac/permissions";
import { assertLocalAccountNotDisabled } from "./account-status";
import { loadPrincipalByUserId } from "../rbac/authorize";
import { INTERNAL_ORG_SLUG } from "../../db/seed/constants";

export class AuthSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthSyncError";
  }
}

export type ClerkIdentity = {
  clerkUserId: string;
  email: string;
  fullName: string;
};

export async function syncLocalUser(identity: ClerkIdentity) {
  const db = getDb();
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, INTERNAL_ORG_SLUG))
    .limit(1);
  if (!organization) {
    throw new AuthSyncError("WorkforceOS organization has not been seeded");
  }

  const [byClerk] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, identity.clerkUserId))
    .limit(1);
  if (byClerk) {
    assertLocalAccountNotDisabled(byClerk.status);
    const [updated] = await db
      .update(users)
      .set({
        email: identity.email,
        fullName: identity.fullName,
        status: byClerk.status === "invited" ? "active" : byClerk.status,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, byClerk.id))
      .returning();
    return updated;
  }

  const [byEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, identity.email.toLowerCase()))
    .limit(1);
  if (byEmail) {
    assertLocalAccountNotDisabled(byEmail.status);
    const [updated] = await db
      .update(users)
      .set({
        clerkUserId: identity.clerkUserId,
        fullName: identity.fullName,
        status: byEmail.status === "invited" ? "active" : byEmail.status,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, byEmail.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(users)
    .values({
      organizationId: organization.id,
      clerkUserId: identity.clerkUserId,
      email: identity.email.toLowerCase(),
      fullName: identity.fullName,
      status: "active",
      lastLoginAt: new Date(),
    })
    .returning();

  void userRoles;
  return created;
}

export async function getCurrentPrincipalFromIdentity(
  identity: ClerkIdentity | null,
): Promise<Principal | null> {
  if (!identity) return null;
  const user = await syncLocalUser(identity);
  return loadPrincipalByUserId(user.id);
}

export function clerkAuthAvailable() {
  return isClerkConfigured();
}
