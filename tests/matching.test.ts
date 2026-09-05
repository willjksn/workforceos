import { describe, expect, it } from "vitest";

import { applyHumanOverallOverride, scoreCandidateJobMatch } from "../lib/recruiting/matching";

describe("job-specific match components", () => {
  it("scores required skill overlap independently per job", () => {
    const electrician = scoreCandidateJobMatch({
      jobTitle: "Plant Electrician",
      jobSkillNames: ["Electrical Troubleshooting"],
      candidateName: "Taylor Ellis",
      candidateTitle: "Electrician",
      experienceTitles: [],
      candidateSkillNames: ["Electrical Troubleshooting"],
    });
    const planner = scoreCandidateJobMatch({
      jobTitle: "Workforce Planner",
      jobSkillNames: ["Workforce Planning"],
      candidateName: "Taylor Ellis",
      candidateTitle: "Electrician",
      experienceTitles: [],
      candidateSkillNames: ["Electrical Troubleshooting"],
    });
    expect(electrician.overall).not.toBe(planner.overall);
    expect(electrician.skills).toBeGreaterThan(planner.skills);
    expect(electrician.explanation.toLowerCase()).toContain("electrical troubleshooting");
  });

  it("records a human overall override without inventing a universal score", () => {
    const base = scoreCandidateJobMatch({
      jobTitle: "Plant Electrician",
      jobSkillNames: ["Electrical Troubleshooting"],
      candidateName: "Taylor Ellis",
      experienceTitles: [],
      candidateSkillNames: ["Electrical Troubleshooting"],
    });
    const overridden = applyHumanOverallOverride(base, 91, "Hiring manager interview");
    expect(overridden.overall).toBe(91);
    expect(overridden.skills).toBe(base.skills);
    expect(overridden.explanation).toContain("Human overall override");
  });
});
