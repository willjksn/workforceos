import { createHash, createHmac } from "node:crypto";

import {
  HMAC_HEADER_SIGNATURE,
  HMAC_HEADER_TIMESTAMP,
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

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sign(method: string, path: string, timestamp: string, bodyHash: string) {
  const secret = process.env.WORKFORCEOS_SITE_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
      throw new Error("WORKFORCEOS_SITE_SECRET is required for production writes.");
    }
    return {} as Record<string, string>;
  }
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyHash}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return {
    [HMAC_HEADER_TIMESTAMP]: timestamp,
    [HMAC_HEADER_SIGNATURE]: signature,
  };
}

function gatewayPath(pathname: string) {
  try {
    return new URL(pathname, apiBase()).pathname;
  } catch {
    return pathname;
  }
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
    const path = gatewayPath("/inquiries");
    const timestamp = String(Date.now());
    const response = await fetch(`${apiBase()}/inquiries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...sign("POST", path, timestamp, sha256Hex(body)),
      },
      body,
      cache: "no-store",
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "INQUIRY_FAILED");
    }
    return inquiryAcceptedSchema.parse(await response.json());
  }

  async submitApplication(payload: ApplicationPayload, resume: File) {
    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      if (value) form.set(key, String(value));
    }
    form.set("resume", resume);
    const path = gatewayPath("/applications");
    const timestamp = String(Date.now());
    const bodyHash = sha256Hex(`POST\n${path}\n${timestamp}`);
    const response = await fetch(`${apiBase()}/applications`, {
      method: "POST",
      headers: sign("POST", path, timestamp, bodyHash),
      body: form,
      cache: "no-store",
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "APPLICATION_FAILED");
    }
    return applicationAcceptedSchema.parse(await response.json());
  }

  async submitMilitaryTalent(payload: MilitaryTalentPayload, resume?: File | null) {
    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      if (value) form.set(key, String(value));
    }
    if (resume) form.set("resume", resume);
    const path = gatewayPath("/military-talent");
    const timestamp = String(Date.now());
    const bodyHash = sha256Hex(`POST\n${path}\n${timestamp}`);
    const response = await fetch(`${apiBase()}/military-talent`, {
      method: "POST",
      headers: sign("POST", path, timestamp, bodyHash),
      body: form,
      cache: "no-store",
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "MILITARY_TALENT_FAILED");
    }
    return militaryTalentAcceptedSchema.parse(await response.json());
  }
}

export const workforceOsPublic = new WorkforceOSPublicClient();
