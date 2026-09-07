import {
  applicationAcceptedSchema,
  inquiryAcceptedSchema,
  inquiryPayloadSchema,
  militaryTalentAcceptedSchema,
  publicContentResponseSchema,
  publicJobResponseSchema,
  publicJobsResponseSchema,
  EMPTY_PUBLIC_CONTENT,
  type ApplicationPayload,
  type InquiryPayload,
  type MilitaryTalentPayload,
  type PublicContentResponse,
  type PublicJob,
} from "@/lib/contracts";

function apiBase() {
  const url = process.env.WORKFORCEOS_PUBLIC_API_URL;
  if (!url) {
    throw new Error("WORKFORCEOS_PUBLIC_API_URL is not configured.");
  }
  return url.replace(/\/$/, "");
}

async function postSigned(pathname: string, body: string | Uint8Array, contentType: string) {
  const { sha256Hex, signWorkforceOsHeaders, toArrayBuffer, workforceOsWriteUrl } = await import(
    "@/lib/workforceos/hmac"
  );
  const url = workforceOsWriteUrl(apiBase(), pathname);
  const bodyHash = sha256Hex(typeof body === "string" ? body : body);
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      ...signWorkforceOsHeaders({ method: "POST", path: url.pathname, bodyHash }),
    },
    body: typeof body === "string" ? body : toArrayBuffer(body),
    cache: "no-store",
  });
}

export class WorkforceOSPublicClient {
  async getContent(): Promise<PublicContentResponse> {
    try {
      const response = await fetch(`${apiBase()}/content`, {
        next: { revalidate: 60, tags: ["public-content"] },
      });
      if (!response.ok) throw new Error("CONTENT_UNAVAILABLE");
      const parsed = publicContentResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("CONTENT_UNAVAILABLE");
      return parsed.data;
    } catch {
      return { ...EMPTY_PUBLIC_CONTENT };
    }
  }

  async getJobs(): Promise<PublicJob[]> {
    const response = await fetch(`${apiBase()}/jobs`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) throw new Error("JOBS_UNAVAILABLE");
    const parsed = publicJobsResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("JOBS_UNAVAILABLE");
    return parsed.data.jobs;
  }

  async getJob(slug: string): Promise<PublicJob | null> {
    const response = await fetch(`${apiBase()}/jobs/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("JOB_UNAVAILABLE");
    const parsed = publicJobResponseSchema.safeParse(await response.json());
    if (!parsed.success) return null;
    return parsed.data.job;
  }

  async submitInquiry(payload: InquiryPayload) {
    const body = JSON.stringify(inquiryPayloadSchema.parse(payload));
    const response = await postSigned("/inquiries", body, "application/json");
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "INQUIRY_FAILED");
    }
    return inquiryAcceptedSchema.parse(await response.json());
  }

  async submitApplication(payload: ApplicationPayload, resume: File) {
    const { serializeFormBody } = await import("@/lib/workforceos/hmac");
    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      if (value) form.set(key, String(value));
    }
    form.set("resume", resume);
    const { bytes, contentType } = await serializeFormBody(form);
    const response = await postSigned("/applications", bytes, contentType);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "APPLICATION_FAILED");
    }
    return applicationAcceptedSchema.parse(await response.json());
  }

  async submitMilitaryTalent(payload: MilitaryTalentPayload, resume?: File | null) {
    const { serializeFormBody } = await import("@/lib/workforceos/hmac");
    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      if (value) form.set(key, String(value));
    }
    if (resume) form.set("resume", resume);
    const { bytes, contentType } = await serializeFormBody(form);
    const response = await postSigned("/military-talent", bytes, contentType);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "MILITARY_TALENT_FAILED");
    }
    return militaryTalentAcceptedSchema.parse(await response.json());
  }
}

export const workforceOsPublic = new WorkforceOSPublicClient();
