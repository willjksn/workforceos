import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import { publicAccessTokens } from "../../db/schema";
import { getAppUrl } from "../env";

export const PUBLIC_ACCESS_PURPOSES = [
  "interview_self_schedule",
  "hire_onboarding",
  "application_status",
] as const;

export type PublicAccessPurpose = (typeof PUBLIC_ACCESS_PURPOSES)[number];

export class PublicAccessError extends Error {
  constructor(
    message: string,
    public readonly status = 401,
  ) {
    super(message);
    this.name = "PublicAccessError";
  }
}

export function generatePublicAccessToken() {
  return randomBytes(32).toString("base64url");
}

export function hashPublicAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function tokensMatch(raw: string, hash: string) {
  const computed = Buffer.from(hashPublicAccessToken(raw));
  const stored = Buffer.from(hash);
  return computed.length === stored.length && timingSafeEqual(computed, stored);
}

export function publicAccessPath(purpose: PublicAccessPurpose, token: string) {
  if (purpose === "interview_self_schedule") return `/schedule/${token}`;
  if (purpose === "hire_onboarding") return `/onboarding/access?token=${encodeURIComponent(token)}`;
  return `/careers/status/${token}`;
}

export function publicAccessUrl(purpose: PublicAccessPurpose, token: string) {
  const origin = getAppUrl() ?? "";
  return `${origin}${publicAccessPath(purpose, token)}`;
}

export async function issuePublicAccessToken(input: {
  organizationId: string;
  purpose: PublicAccessPurpose;
  applicationId?: string | null;
  onboardingInstanceId?: string | null;
  createdByUserId?: string | null;
  ttlHours?: number;
}) {
  const token = generatePublicAccessToken();
  const expiresAt = new Date(Date.now() + (input.ttlHours ?? 14 * 24) * 60 * 60 * 1000);
  const db = getDb();
  const [row] = await db
    .insert(publicAccessTokens)
    .values({
      organizationId: input.organizationId,
      purpose: input.purpose,
      tokenHash: hashPublicAccessToken(token),
      applicationId: input.applicationId ?? null,
      onboardingInstanceId: input.onboardingInstanceId ?? null,
      createdByUserId: input.createdByUserId ?? null,
      expiresAt,
    })
    .returning();
  return {
    row,
    token,
    expiresAt,
    path: publicAccessPath(input.purpose, token),
    url: publicAccessUrl(input.purpose, token),
  };
}

export async function resolvePublicAccessToken(input: { token: string; purpose: PublicAccessPurpose }) {
  if (!input.token?.trim()) throw new PublicAccessError("A valid access token is required.");
  const db = getDb();
  const [row] = await db
    .select()
    .from(publicAccessTokens)
    .where(
      and(
        eq(publicAccessTokens.tokenHash, hashPublicAccessToken(input.token.trim())),
        eq(publicAccessTokens.purpose, input.purpose),
        isNull(publicAccessTokens.revokedAt),
        isNull(publicAccessTokens.archivedAt),
      ),
    )
    .limit(1);
  if (!row) throw new PublicAccessError("This link is invalid or has been revoked.");
  if (row.expiresAt.getTime() < Date.now()) throw new PublicAccessError("This link has expired.");
  return row;
}
