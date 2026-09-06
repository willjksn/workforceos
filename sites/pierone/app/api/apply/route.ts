import { NextResponse } from "next/server";

import { applicationPayloadSchema } from "@/lib/contracts";

import { workforceOsPublic } from "@/lib/workforceos/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const parsed = applicationPayloadSchema.safeParse({
    slug: form.get("slug"),
    firstName: form.get("firstName"),
    lastName: form.get("lastName"),
    email: form.get("email"),
    phone: optional(form.get("phone")),
    city: optional(form.get("city")),
    region: optional(form.get("region")),
    linkedinUrl: optional(form.get("linkedinUrl")),
    honeypot: optional(form.get("honeypot")),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid application" }, { status: 400 });
  }
  const resumeEntry = form.get("resume");
  if (!(resumeEntry instanceof File) || resumeEntry.size <= 0) {
    return NextResponse.json({ error: "A resume file is required." }, { status: 400 });
  }
  try {
    await workforceOsPublic.submitApplication(parsed.data, resumeEntry);
    return NextResponse.json({ accepted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "APPLICATION_FAILED";
    return NextResponse.json({ error: message === "APPLICATION_FAILED" ? "Unable to submit application right now." : message }, { status: 400 });
  }
}

function optional(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}
