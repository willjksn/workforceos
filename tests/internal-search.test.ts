import { describe, expect, it } from "vitest";

import {
  buildInternalSearchProjectName,
  externalSourcingBlocked,
  scoreInternalCandidate,
  tokenize,
} from "../lib/recruiting/internal-search";

describe("internal Talent Network search", () => {
  it("tokenizes electrician titles without stop words", () => {
    expect(tokenize("Plant Electrician's Mate")).toContain("electrician");
    expect(tokenize("Plant Electrician's Mate")).not.toContain("the");
  });

  it("scores a military electrician against a plant electrician job", () => {
    const result = scoreInternalCandidate({
      jobTitle: "Plant Electrician",
      jobDescription: "Industrial electrical maintenance",
      jobSkillNames: [],
      candidateName: "Taylor Ellis",
      candidateTitle: "Navy Electrician's Mate",
      experienceTitles: ["Electrician's Mate U.S. Navy"],
      candidateSkillNames: ["Electrical Troubleshooting", "Motor Controls"],
    });
    expect(result.score).toBeGreaterThan(20);
    expect(result.explanation.toLowerCase()).toContain("electrician");
  });

  it("keeps job-required skill overlap independent of other jobs", () => {
    const electrician = scoreInternalCandidate({
      jobTitle: "Plant Electrician",
      jobSkillNames: ["Electrical Troubleshooting"],
      candidateName: "Taylor Ellis",
      candidateTitle: "Electrician",
      experienceTitles: [],
      candidateSkillNames: ["Electrical Troubleshooting"],
    });
    const planner = scoreInternalCandidate({
      jobTitle: "Workforce Planner",
      jobSkillNames: ["Workforce Planning"],
      candidateName: "Taylor Ellis",
      candidateTitle: "Electrician",
      experienceTitles: [],
      candidateSkillNames: ["Electrical Troubleshooting"],
    });
    expect(electrician.score).not.toBe(planner.score);
  });

  it("names the required internal search project from the job title", () => {
    expect(buildInternalSearchProjectName("Plant Electrician")).toBe(
      "Internal Talent Network: Plant Electrician",
    );
  });

  it("blocks external sourcing until internal search is complete", () => {
    expect(externalSourcingBlocked(null)).toBe(true);
    expect(externalSourcingBlocked(new Date("2026-09-05T00:00:00.000Z"))).toBe(false);
  });
});
