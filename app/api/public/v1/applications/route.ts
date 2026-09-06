import { NextResponse } from "next/server";
import { z } from "zod";

import { FileValidationError } from "@/lib/hiring/files";
import { HiringError, submitPublicApplication } from "@/lib/hiring/service";
import { RATE_LIMITS, RateLimitError, assertRateLimit } from "@/lib/security/rate-limit";

const bodySchema = z.object({
  slug: z.string().min(1).max(120),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  preferredName: z.string().max(80).optional(),
  email: z.string().email().max(200),
  phone: z.string().max(40).optional(),
  city: z.string().max(80).optional(),
  region: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  linkedinUrl: z.string().url().max(300).optional().or(z.literal("")),
  source: z.enum([
    "career_site",
    "referral",
    "recruiter",
    "linkedin",
    "indeed",
    "military_event",
    "skillbridge",
    "client_referral",
    "internal",
    "agency",
    "other",
  ]).optional(),
  answers: z.array(z.object({ key: z.string().max(80), answer: z.string().max(4000) })).optional(),
  honeypot: z.string().optional(),
  branch: z.string().max(40).optional(),
  mos: z.string().max(40).optional(),
  rank: z.string().max(40).optional(),
  installation: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  try {
    await assertRateLimit({ key: `public-application:${ip}`, ...RATE_LIMITS.publicApplication });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "Too many applications. Try again shortly." }, { status: 429 });
    }
    throw error;
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid application" }, { status: 400 });
  }

  try {
    const result = await submitPublicApplication({
      ...parsed.data,
      linkedinUrl: parsed.data.linkedinUrl || null,
      ip,
    });
    return NextResponse.json({
      ok: true,
      applicationId: result.application.id,
      message: "Application received. We will contact you if there is a next step.",
    });
  } catch (error) {
    if (error instanceof HiringError || error instanceof FileValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
