import { cache } from "react";

import { AuthorizationError } from "../rbac/permissions";
import { clerkAuthAvailable, syncLocalUser, type ClerkIdentity } from "./sync-user";
import { assertLocalAccountActive, assertLocalAccountNotDisabled } from "./account-status";
import { loadPrincipalByUserId } from "../rbac/authorize";

async function readClerkIdentity(): Promise<ClerkIdentity | null> {
  if (!clerkAuthAvailable()) return null;
  const { auth, currentUser } = await import("@clerk/nextjs/server");
  const session = await auth();
  if (!session.userId) return null;
  const clerkUser = await currentUser();
  if (!clerkUser) return null;
  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    throw new AuthorizationError("Clerk user is missing an email address");
  }
  return {
    clerkUserId: clerkUser.id,
    email: email.toLowerCase(),
    fullName:
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email,
  };
}

export const getCurrentPrincipal = cache(async () => {
  const identity = await readClerkIdentity();
  if (!identity) return null;
  const user = await syncLocalUser(identity);
  assertLocalAccountNotDisabled(user.status);
  return loadPrincipalByUserId(user.id);
});

export async function requireCurrentPrincipal() {
  const principal = await getCurrentPrincipal();
  if (!principal) {
    throw new AuthorizationError("Authentication required");
  }
  assertLocalAccountActive(principal.status);
  return principal;
}
