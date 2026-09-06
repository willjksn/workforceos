import { NextResponse } from "next/server";
import { z } from "zod";

import { FileValidationError } from "@/lib/hiring/files";
import { HiringError, submitPublicApplication } from "@/lib/hiring/service";
import { clientIp } from "@/lib/public-api/normalize";
import { readReplayableBody } from "@/lib/public-api/read-body";
import { PublicGatewayError, assertPublicWriteAccess } from "@/lib/public-api/write-access";
import { RATE_LIMITS, RateLimitError, assertRateLimit } from "@/lib/security/rate-limit";

const sourceEnum = z.enum([
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
]);

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
  source: sourceEnum.optional(),
  answers: z.array(z.object({ key: z.string().max(80), answer: z.string().max(4000) })).optional(),
  honeypot: z.string().optional(),
  branch: z.string().max(40).optional(),
  mos: z.string().max(40).optional(),
  rank: z.string().max(40).optional(),
  installation: z.string().max(120).optional(),
});

async function resumeFromFile(file: File | null) {
  if (!file || file.size <= 0) return null;
  const body = new Uint8Array(await file.arrayBuffer());
  return {
    filename: file.name || "resume.pdf",
    mimeType: file.type || "application/octet-stream",
    body,
  };
}

function optionalText(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}

async function parseApplicationRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const resumeEntry = form.get("resume");
    const parsed = bodySchema.safeParse({
      slug: optionalText(form.get("slug")) ?? "",
      firstName: optionalText(form.get("firstName")) ?? "",
      lastName: optionalText(form.get("lastName")) ?? "",
      preferredName: optionalText(form.get("preferredName")),
      email: optionalText(form.get("email")) ?? "",
      phone: optionalText(form.get("phone")),
      city: optionalText(form.get("city")),
      region: optionalText(form.get("region")),
      country: optionalText(form.get("country")),
      linkedinUrl: optionalText(form.get("linkedinUrl")) ?? "",
      source: optionalText(form.get("source")),
      honeypot: optionalText(form.get("honeypot")) ?? optionalText(form.get("company_website")),
      branch: optionalText(form.get("branch")),
      mos: optionalText(form.get("mos")),
      rank: optionalText(form.get("rank")),
      installation: optionalText(form.get("installation")),
      answers: [
        { key: "work_authorization", answer: optionalText(form.get("workAuthorization")) ?? "" },
        { key: "how_heard", answer: optionalText(form.get("howHeard")) ?? "" },
      ].filter((item) => item.answer),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid application" } as const;
    }
    return {
      data: parsed.data,
      resume: await resumeFromFile(resumeEntry instanceof File ? resumeEntry : null),
    } as const;
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { error: "Invalid JSON" } as const;
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid application" } as const;
  }
  return { data: parsed.data, resume: null } as const;
}

export async function POST(request: Request) {
  const { replay, text } = await readReplayableBody(request);
  const ip = clientIp(request);
  try {
    await assertRateLimit({ key: `public-application:${ip}`, ...RATE_LIMITS.publicApplication });
    await assertPublicWriteAccess(replay, text);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "Too many applications. Try again shortly." }, { status: 429 });
    }
    if (error instanceof PublicGatewayError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const parsed = await parseApplicationRequest(replay);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await submitPublicApplication({
      ...parsed.data,
      linkedinUrl: parsed.data.linkedinUrl || null,
      resume: parsed.resume,
      ip,
    });
    return NextResponse.json(
      {
        accepted: true,
        message: "Application received. We will contact you if there is a next step.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof HiringError || error instanceof FileValidationError) {
      const storageFailure = /storage is not configured|not implemented/i.test(error.message);
      return NextResponse.json({ error: error.message }, { status: storageFailure ? 503 : 400 });
    }
    return NextResponse.json({ error: "Unable to submit application right now." }, { status: 503 });
  }
}
