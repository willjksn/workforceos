import { NextResponse } from "next/server";

import { militaryTalentPayloadSchema } from "@/lib/contracts";

import { workforceOsPublic } from "@/lib/workforceos/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const parsed = militaryTalentPayloadSchema.safeParse({
    firstName: form.get("firstName"),
    lastName: form.get("lastName"),
    email: form.get("email"),
    phone: optional(form.get("phone")),
    branch: optional(form.get("branch")),
    mos: optional(form.get("mos")),
    rank: optional(form.get("rank")),
    currentInstallation: optional(form.get("currentInstallation")),
    currentLocation: optional(form.get("currentLocation")),
    separationDate: optional(form.get("separationDate")),
    skillbridgeWindowStart: optional(form.get("skillbridgeWindowStart")),
    skillbridgeWindowEnd: optional(form.get("skillbridgeWindowEnd")),
    preferredLocation: optional(form.get("preferredLocation")),
    relocationWillingness: optional(form.get("relocationWillingness")),
    remotePreference: optional(form.get("remotePreference")),
    targetCivilianRoles: optional(form.get("targetCivilianRoles")),
    employmentPreference: optional(form.get("employmentPreference")),
    idealIndustry: optional(form.get("idealIndustry")),
    idealEmployer: optional(form.get("idealEmployer")),
    linkedinUrl: optional(form.get("linkedinUrl")),
    honeypot: optional(form.get("honeypot")),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid submission" }, { status: 400 });
  }
  const resumeEntry = form.get("resume");
  const resume = resumeEntry instanceof File && resumeEntry.size > 0 ? resumeEntry : null;
  try {
    await workforceOsPublic.submitMilitaryTalent(parsed.data, resume);
    return NextResponse.json({ accepted: true });
  } catch (error) {
    const { publicSafeErrorMessage, PUBLIC_SERVICE_UNAVAILABLE } = await import("@/lib/public-errors");
    const message = publicSafeErrorMessage(error, PUBLIC_SERVICE_UNAVAILABLE);
    const status = /signed request required/i.test(message) ? 401 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}

function optional(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}
