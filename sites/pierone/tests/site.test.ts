import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PRIMARY_NAV, SERVICES, SOLUTIONS_NAV } from "../lib/content";
import { inquiryPayloadSchema, publicContentResponseSchema, EMPTY_PUBLIC_CONTENT } from "../lib/contracts";
import { IMAGES } from "../lib/images";
import {
  HMAC_HEADER_REQUEST_ID,
  publicSiteSignaturePayload,
  serializeFormBody,
  sha256Hex,
  signPublicSiteRequest,
  workforceOsWriteUrl,
} from "../lib/workforceos/hmac";

describe("PierOne public website", () => {
  it("defines five commercial services", () => {
    expect(SERVICES).toHaveLength(5);
    expect(SERVICES.map((row) => row.code)).toEqual([
      "professional-search",
      "military-talent-opportunity-assessment",
      "ta-performance-assessment",
      "fractional-talent-partner",
      "workforce-pipeline-assessment",
    ]);
  });

  it("rejects invalid employer inquiries", () => {
    const parsed = inquiryPayloadSchema.safeParse({
      firstName: "",
      lastName: "Test",
      email: "not-an-email",
      company: "Acme",
      serviceInterest: "professional-search",
      challenge: "Need help",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a valid employer inquiry payload", () => {
    const parsed = inquiryPayloadSchema.safeParse({
      firstName: "Alex",
      lastName: "Rivera",
      email: "alex@example.com",
      company: "Example Energy",
      serviceInterest: "workforce-pipeline-assessment",
      challenge: "Need a pipeline view for technicians.",
    });
    expect(parsed.success).toBe(true);
  });

  it("keeps primary navigation uncluttered", () => {
    const labels = PRIMARY_NAV.map((item) => item.label);
    expect(labels).toEqual(["Home", "Solutions", "Military Talent", "Careers", "About", "Contact"]);
    expect(labels).not.toContain("Insights");
    expect(labels).not.toContain("What We Do");
    expect(labels).not.toContain("Workforce Development");
    expect(SOLUTIONS_NAV.map((item) => item.label)).toContain("Workforce Development");
    expect(SOLUTIONS_NAV).toHaveLength(6);
  });

  it("accepts an empty public content payload so pages can omit sections", () => {
    const parsed = publicContentResponseSchema.safeParse(EMPTY_PUBLIC_CONTENT);
    expect(parsed.success).toBe(true);
  });

  it("marks every public image slot for licensed replacement", () => {
    const slots = Object.values(IMAGES);
    expect(slots.length).toBeGreaterThanOrEqual(12);
    for (const slot of slots) {
      expect(slot.replacementNeeded).toBe(true);
      expect(slot.src.startsWith("/images/placeholders/")).toBe(true);
      expect(slot.alt.length).toBeGreaterThan(12);
    }
  });
});

describe("PierOne WorkforceOS HMAC signing", () => {
  it("signs METHOD/PATH/TIMESTAMP/REQUEST_ID/BODY_HASH", () => {
    const timestamp = "1710000000000";
    const requestId = "11111111-1111-4111-8111-111111111111";
    const path = "/api/public/v1/inquiries";
    const bodyHash = sha256Hex('{"company":"Example Energy"}');
    const payload = publicSiteSignaturePayload({ method: "POST", path, timestamp, requestId, bodyHash });
    expect(payload).toBe(`POST\n${path}\n${timestamp}\n${requestId}\n${bodyHash}`);
    const signature = signPublicSiteRequest({
      secret: "test-site-secret",
      method: "POST",
      path,
      timestamp,
      requestId,
      bodyHash,
    });
    expect(signature).toBe(createHmac("sha256", "test-site-secret").update(payload).digest("hex"));
  });

  it("signs the actual public gateway pathname, not a stripped /inquiries path", () => {
    const url = workforceOsWriteUrl("https://app.pieronepartners.com/api/public/v1", "/applications");
    expect(url.href).toBe("https://app.pieronepartners.com/api/public/v1/applications");
    expect(url.pathname).toBe("/api/public/v1/applications");
  });

  it("hashes exact multipart bytes including resume content", async () => {
    const form = new FormData();
    form.set("slug", "electrical-technician");
    form.set("firstName", "Alex");
    form.set("resume", new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "resume.pdf", { type: "application/pdf" }));
    const { bytes, contentType } = await serializeFormBody(form);
    expect(contentType).toMatch(/^multipart\/form-data;\s*boundary=/);
    expect(bytes.byteLength).toBeGreaterThan(20);
    const decoder = new TextDecoder();
    expect(decoder.decode(bytes)).toContain("electrical-technician");
    expect(HMAC_HEADER_REQUEST_ID).toBe("x-pierone-request-id");
  });
});
