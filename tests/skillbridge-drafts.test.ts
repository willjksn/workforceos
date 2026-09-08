import { describe, expect, it } from "vitest";

import { draftEmployerBrief, draftSkillBridgeMessage } from "../lib/skillbridge/drafts";

describe("SkillBridge drafts", () => {
  it("does not repeat on file when occupation is missing from a candidate check-in", () => {
    const draft = draftSkillBridgeMessage({
      kind: "follow_up",
      audience: "candidate",
      candidateName: "Test Transition Candidate",
      canReadPii: false,
    });
    expect(draft.body).not.toMatch(/on file on file/);
    expect(draft.body).toContain("military occupation recorded on this profile");
  });

  it("renders an employer brief as reviewable prose instead of raw JSON fields only", () => {
    const brief = draftEmployerBrief({
      candidateName: "Test Transition Candidate",
      occupationTitle: "Electrician's Mate",
      civilianTranslation: "Industrial electrician",
      skills: ["electrical", "safety"],
      locationPreference: "Charlotte, NC",
      targetRole: "Maintenance electrician",
    });
    expect(brief.body).toContain("Test Transition Candidate");
    expect(brief.body).toContain("Electrician's Mate");
    expect(brief.body).toContain("PierOne is the intermediary");
    expect(brief.body).not.toContain("{");
    expect(brief.sendAllowed).toBe(false);
    expect(brief.humanReviewRequired).toBe(true);
    expect(brief.facts.some((fact) => fact.includes("Charlotte, NC"))).toBe(true);
  });
});
