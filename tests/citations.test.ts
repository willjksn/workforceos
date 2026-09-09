import { describe, expect, it } from "vitest";

import { formatCitations, knowledgeCitation } from "../lib/ai/citations";

describe("knowledge citations", () => {
  it("formats stored source references for operators", () => {
    expect(
      formatCitations([
        { type: "knowledge_record", label: "Professional Search playbook" },
        { type: "service_workflow", label: "Intake" },
      ]),
    ).toBe("Professional Search playbook · Intake");
  });

  it("says when no citations were recorded", () => {
    expect(formatCitations([])).toBeNull();
    expect(formatCitations(null)).toBeNull();
  });

  it("shows knowledge source, URL, and version", () => {
    expect(
      knowledgeCitation({
        source: "Approved playbook",
        sourceUrl: "https://example.test/playbook",
        version: "1.2",
      }),
    ).toBe("Approved playbook · https://example.test/playbook · v1.2");
    expect(knowledgeCitation({})).toBe("No source recorded");
  });
});
