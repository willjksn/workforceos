import { NextResponse } from "next/server";

import { militaryTalentPayloadSchema } from "@pierone/public-api-contracts";

import { FileValidationError } from "@/lib/hiring/files";
import { MilitaryTalentError, submitMilitaryTalentProfile } from "@/lib/military-talent/public-intake";
import { captureException } from "@/lib/observability/monitor";
import { clientIp } from "@/lib/public-api/normalize";
import { readReplayableBody } from "@/lib/public-api/read-body";
import { PublicGatewayError, assertPublicWriteAccess } from "@/lib/public-api/write-access";
import { RATE_LIMITS, RateLimitError, assertRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function optionalText(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}

async function resumeFromFile(file: File | null) {
  if (!file || file.size <= 0) return null;
  return {
    filename: file.name || "resume.pdf",
    mimeType: file.type || "application/octet-stream",
    body: new Uint8Array(await file.arrayBuffer()),
  };
}

function publicFailure(error: unknown) {
  void captureException(error, { route: "/api/public/v1/military-talent" });
  const message = error instanceof Error ? error.message : "Unable to submit right now.";
  const safe = message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]").slice(0, 200);
  return NextResponse.json({ error: safe || "Unable to submit right now." }, { status: 503 });
}

export async function POST(request: Request) {
  try {
    return await handleMilitaryTalentPost(request);
  } catch (error) {
    return publicFailure(error);
  }
}

async function handleMilitaryTalentPost(request: Request) {
  const { replay, raw, text } = await readReplayableBody(request);
  const ip = clientIp(request);
  try {
    await assertPublicWriteAccess(replay, raw);
    await assertRateLimit({ key: `public-military-talent:${ip}`, ...RATE_LIMITS.publicMilitaryTalent });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "Too many submissions. Try again shortly." }, { status: 429 });
    }
    if (error instanceof PublicGatewayError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return publicFailure(error);
  }

  const contentType = request.headers.get("content-type") ?? "";
  let payload: unknown = {};
  let resume: { filename: string; mimeType: string; body: Uint8Array } | null = null;
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await replay.formData();
      const resumeEntry = form.get("resume");
      resume = await resumeFromFile(resumeEntry instanceof File ? resumeEntry : null);
      payload = {
        firstName: optionalText(form.get("firstName")),
        lastName: optionalText(form.get("lastName")),
        email: optionalText(form.get("email")),
        phone: optionalText(form.get("phone")),
        branch: optionalText(form.get("branch")),
        mos: optionalText(form.get("mos")),
        rank: optionalText(form.get("rank")),
        currentInstallation: optionalText(form.get("currentInstallation")),
        currentLocation: optionalText(form.get("currentLocation")),
        separationDate: optionalText(form.get("separationDate")),
        skillbridgeWindowStart: optionalText(form.get("skillbridgeWindowStart")),
        skillbridgeWindowEnd: optionalText(form.get("skillbridgeWindowEnd")),
        skillbridgeApprovalStatus: optionalText(form.get("skillbridgeApprovalStatus")),
        preferredLocation: optionalText(form.get("preferredLocation")),
        relocationWillingness: optionalText(form.get("relocationWillingness")),
        remotePreference: optionalText(form.get("remotePreference")),
        targetCivilianRoles: optionalText(form.get("targetCivilianRoles")),
        employmentPreference: optionalText(form.get("employmentPreference")),
        idealIndustry: optionalText(form.get("idealIndustry")),
        idealEmployer: optionalText(form.get("idealEmployer")),
        linkedinUrl: optionalText(form.get("linkedinUrl")),
        honeypot: optionalText(form.get("honeypot")) ?? optionalText(form.get("company_website")),
        landingUrl: optionalText(form.get("landingUrl")),
        referrer: optionalText(form.get("referrer")),
        utmSource: optionalText(form.get("utmSource")),
        utmMedium: optionalText(form.get("utmMedium")),
        utmCampaign: optionalText(form.get("utmCampaign")),
      };
    } else {
      payload = JSON.parse(text);
    }
  } catch {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }

  const parsed = militaryTalentPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid submission" }, { status: 400 });
  }

  try {
    await submitMilitaryTalentProfile({ ...parsed.data, resume });
    return NextResponse.json({ accepted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof MilitaryTalentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof FileValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return publicFailure(error);
  }
}
