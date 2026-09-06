import { describe, expect, it } from "vitest";

import { FileValidationError, validateResumeUpload } from "../lib/hiring/files";
import { parseScoutIntent } from "../lib/scout/parse-intent";
import { ALLOWED_DISPOSITION_REASONS, assertDispositionReason } from "../lib/hiring/stages";

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
