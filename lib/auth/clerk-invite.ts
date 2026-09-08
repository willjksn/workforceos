import { getAppUrl, isClerkConfigured, isFailClosedProduction } from "../env";

export class ClerkInviteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClerkInviteError";
  }
}

export async function sendWorkforceOsInvitation(email: string): Promise<{ sent: boolean }> {
  if (!isClerkConfigured()) {
    if (isFailClosedProduction()) {
      throw new ClerkInviteError("Clerk is not configured, so the invitation email was not sent.");
    }
    return { sent: false };
  }

  const appUrl = getAppUrl();
  if (!appUrl) {
    throw new ClerkInviteError("APP_URL is not set, so the invitation email was not sent.");
  }

  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${appUrl}/sign-up`,
      ignoreExisting: true,
      notify: true,
    });
    return { sent: true };
  } catch (error) {
    throw new ClerkInviteError(clerkInviteFailureMessage(error));
  }
}

export function clerkInviteFailureMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  if (/already exists|already been invited|already invited/i.test(raw)) {
    return "Clerk already has this email. They can sign in at /sign-in.";
  }
  return "Clerk could not send the invitation email.";
}
