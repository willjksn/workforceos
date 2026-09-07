import { z } from "zod";

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

export const publicApplicationBodySchema = z.object({
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

export async function parseApplicationRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const resumeEntry = form.get("resume");
    const parsed = publicApplicationBodySchema.safeParse({
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
  const parsed = publicApplicationBodySchema.safeParse(json);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid application" } as const;
  }
  return { data: parsed.data, resume: null } as const;
}
