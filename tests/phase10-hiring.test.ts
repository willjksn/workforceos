import { describe, expect, it } from "vitest";

import { canPreviewResumeInline, FileValidationError, validateResumeUpload } from "../lib/hiring/files";
import { parseScoutIntent } from "../lib/scout/parse-intent";
import { ALLOWED_DISPOSITION_REASONS, assertDispositionReason } from "../lib/hiring/stages";
import { getBackgroundCheckProvider } from "../lib/background-checks";
import { calendarProviderStatus, getCalendarProvider } from "../lib/calendar";
import { getDrugScreenProvider } from "../lib/drug-screens";
import { UnconfiguredEmailProvider } from "../lib/email";
import { isCheckrLiveApiWired, isDrugScreenConfigured } from "../lib/integrations/credentials";

const pdfBody = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x34]);
const oleBody = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00]);
const zipBody = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);

describe("phase 10 public file validation", () => {
  it("rejects oversized and executable uploads", () => {
    expect(() =>
      validateResumeUpload({
        filename: "resume.pdf",
        mimeType: "application/pdf",
        sizeBytes: 11 * 1024 * 1024,
        body: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      }),
    ).toThrow(FileValidationError);
    expect(() =>
      validateResumeUpload({
        filename: "malware.exe",
        mimeType: "application/octet-stream",
        sizeBytes: 2,
        body: new Uint8Array([0x4d, 0x5a]),
      }),
    ).toThrow(FileValidationError);
  });

  it("accepts PDF DOC and DOCX with matching magic bytes and rejects txt", () => {
    expect(
      validateResumeUpload({
        filename: "resume.pdf",
        mimeType: "application/pdf",
        sizeBytes: pdfBody.byteLength,
        body: pdfBody,
      }).mimeType,
    ).toBe("application/pdf");
    expect(
      validateResumeUpload({
        filename: "resume.doc",
        mimeType: "application/msword",
        sizeBytes: oleBody.byteLength,
        body: oleBody,
      }).mimeType,
    ).toBe("application/msword");
    expect(
      validateResumeUpload({
        filename: "resume.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: zipBody.byteLength,
        body: zipBody,
      }).mimeType,
    ).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(() =>
      validateResumeUpload({
        filename: "resume.txt",
        mimeType: "text/plain",
        sizeBytes: 4,
        body: new TextEncoder().encode("text"),
      }),
    ).toThrow(FileValidationError);
  });

  it("previews PDFs inline and leaves Word files for download", () => {
    expect(canPreviewResumeInline({ mimeType: "application/pdf", filename: "resume.pdf" })).toBe(true);
    expect(canPreviewResumeInline({ mimeType: "application/octet-stream", filename: "resume.PDF" })).toBe(true);
    expect(canPreviewResumeInline({ mimeType: "application/msword", filename: "resume.doc" })).toBe(false);
    expect(
      canPreviewResumeInline({
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename: "resume.docx",
      }),
    ).toBe(false);
  });
});

describe("phase 10 scout safety", () => {
  it("requires confirmation language for rejection and refuses SQL", () => {
    const parsed = parseScoutIntent("Reject this candidate");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.dto.family).toBe("UPDATE");
      expect(parsed.dto.entity).toBe("application_reject");
    }
    expect(parseScoutIntent("SELECT * FROM applications").ok).toBe(false);
  });
});

describe("disposition reasons", () => {
  it("allows structured reasons only", () => {
    expect(ALLOWED_DISPOSITION_REASONS.includes("experience_mismatch")).toBe(true);
    expect(() => assertDispositionReason("race")).toThrow();
  });
});

describe("phase 10 provider honesty", () => {
  it("keeps calendar mock-only even if workspace credentials exist", () => {
    const calendar = getCalendarProvider();
    expect(calendar.name).toBe("mock");
    expect(calendar.liveScheduling).toBe(false);
    expect(calendarProviderStatus().liveScheduling).toBe(false);
    expect(calendarProviderStatus().provider).toBe("mock");
  });

  it("does not treat Checkr as live or sandbox-ready", () => {
    expect(isCheckrLiveApiWired()).toBe(false);
    expect(getBackgroundCheckProvider().name).toBe("manual");
    expect(getBackgroundCheckProvider().configured).toBe(false);
  });

  it("keeps drug screening on the manual provider with no vendor", () => {
    expect(isDrugScreenConfigured()).toBe(false);
    expect(getDrugScreenProvider().name).toBe("manual");
    expect(getDrugScreenProvider().configured).toBe(false);
  });

  it("fails clearly when production transactional email is unconfigured", async () => {
    const result = await new UnconfiguredEmailProvider().sendTransactional({
      organizationId: "00000000-0000-4000-8000-000000000001",
      to: "applicant@example.test",
      template: "application_received",
      subject: "Application received",
      html: "<p>test</p>",
    });
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/RESEND_API_KEY/);
    expect(result.mock).toBe(false);
  });
});
