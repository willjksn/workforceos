import { NextResponse } from "next/server";

import { inquiryPayloadSchema } from "@/lib/contracts";

import { workforceOsPublic } from "@/lib/workforceos/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const parsed = inquiryPayloadSchema.safeParse({
    firstName: form.get("firstName"),
    lastName: form.get("lastName"),
    email: form.get("email"),
    phone: optional(form.get("phone")),
    company: form.get("company"),
    title: optional(form.get("title")),
    companyWebsite: optional(form.get("companyWebsite")),
    serviceInterest: form.get("serviceInterest"),
    challenge: form.get("challenge"),
    timeline: optional(form.get("timeline")),
    roleCount: optional(form.get("roleCount")),
    location: optional(form.get("location")),
    referralSource: optional(form.get("referralSource")),
    pagePath: optional(form.get("pagePath")),
    landingUrl: request.headers.get("referer") ?? undefined,
    referrer: request.headers.get("referer") ?? undefined,
    honeypot: optional(form.get("company_website_hp")),
    consent: form.get("consent") === "on",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid inquiry" }, { status: 400 });
  }
  try {
    await workforceOsPublic.submitInquiry(parsed.data);
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
