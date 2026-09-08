import { afterEach, describe, expect, it, vi } from "vitest";

import { inviteDisplayName, inviteResultMessage, normalizeInviteEmail } from "../lib/admin/invite-user";
import {
  ClerkInviteError,
  clerkInviteFailureMessage,
  sendWorkforceOsInvitation,
} from "../lib/auth/clerk-invite";
import { resetServerEnvCache } from "../lib/env";

afterEach(() => {
  vi.unstubAllEnvs();
  resetServerEnvCache();
});

describe("admin invite helpers", () => {
  it("normalizes invite email", () => {
    expect(normalizeInviteEmail("  Alex@Firm.COM ")).toBe("alex@firm.com");
  });

  it("uses the typed name, otherwise the email local part", () => {
    expect(inviteDisplayName("Alex Rivera", "alex@firm.com")).toBe("Alex Rivera");
    expect(inviteDisplayName("  ", "alex.rivera+ops@firm.com")).toBe("alex rivera ops");
    expect(inviteDisplayName(undefined, "nobody")).toBe("nobody");
  });

  it("explains sent vs recorded-only invites", () => {
    expect(
      inviteResultMessage({
        email: "alex@firm.com",
        roleName: "Recruiter",
        resent: false,
        invitationSent: true,
      }),
    ).toBe("Invitation sent to alex@firm.com. They will have Recruiter when they sign in.");
    expect(
      inviteResultMessage({
        email: "alex@firm.com",
        roleName: "Recruiter",
        resent: true,
        invitationSent: false,
      }),
    ).toBe("Updated alex@firm.com as invited with Recruiter. Clerk is not configured, so no email was sent.");
  });
});

describe("Clerk invitation send", () => {
  it("skips email when Clerk is not configured outside production", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("NODE_ENV", "development");
    resetServerEnvCache();
    await expect(sendWorkforceOsInvitation("alex@firm.com")).resolves.toEqual({ sent: false });
  });

  it("fails closed in production when Clerk is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");
    resetServerEnvCache();
    await expect(sendWorkforceOsInvitation("alex@firm.com")).rejects.toBeInstanceOf(ClerkInviteError);
  });

  it("fails when the app URL is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_x");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");
    resetServerEnvCache();
    await expect(sendWorkforceOsInvitation("alex@firm.com")).rejects.toThrow(/APP_URL/);
  });

  it("keeps Clerk errors generic", () => {
    expect(clerkInviteFailureMessage(new Error("Invitation already exists for this email"))).toMatch(
      /already has this email/,
    );
    expect(clerkInviteFailureMessage(new Error("secret_key leaked"))).toBe("Clerk could not send the invitation email.");
  });
});
