import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { evidenceReviewLabel } from "../lib/military-talent/evidence-labels";
import { FIELD_OWNERSHIP } from "../lib/military-talent/field-ownership";
import { assessTransitionProfile } from "../lib/military-talent/profile-completeness";
import { ROLE_PERMISSIONS } from "../lib/rbac/permissions";
import { emptyFieldFill, planResumeEvidenceSuggestions } from "../lib/talent/resume-suggestions";

const resumeText = `
Education
Bachelor of Science in Electrical Engineering, Old Dominion University
Certifications
OSHA 30
Active Secret clearance
`;

describe("M2 Transition Talent Profile", () => {
  it("keeps compensation on the candidate and current clearance on the person", () => {
    expect(FIELD_OWNERSHIP.compensationExpectations).toBe("CANONICAL ON CANDIDATE");
    expect(FIELD_OWNERSHIP.currentClearance).toBe("CANONICAL ON CANDIDATE");
    expect(FIELD_OWNERSHIP.historicalClearanceText).toBe("CANONICAL ON MILITARY EXPERIENCE");
    expect(FIELD_OWNERSHIP.skillbridgePathway).toBe("CANONICAL ON TRANSITION PROFILE");
    expect(FIELD_OWNERSHIP.educationPartners).toBe("DO NOT STORE");
    expect(FIELD_OWNERSHIP.matchRankReject).toBe("DO NOT STORE");
  });

  it("does not overwrite a filled field and fills an empty one", () => {
    expect(emptyFieldFill("555-0100", "555-0199")).toBeUndefined();
    expect(emptyFieldFill("  ", "555-0199")).toBe("555-0199");
    expect(emptyFieldFill(null, null)).toBeUndefined();
  });

  it("plans resume suggestions without replacing human-reviewed evidence", () => {
    const plan = planResumeEvidenceSuggestions({
      text: resumeText,
      existingEducation: [
        {
          institution: "Old Dominion University",
          degreeOrCredential: "Bachelor of Science",
          humanVerified: true,
        },
      ],
      existingCredentials: [{ name: "OSHA 30", humanVerified: true }],
      existingClearance: { clearanceLevel: "secret", humanVerified: true },
    });
    expect(plan.education).toEqual([]);
    expect(plan.credentials).toEqual([]);
    expect(plan.clearance).toBeNull();
    expect(plan.preservedHumanReviewed).toEqual(
      expect.arrayContaining(["education:Old Dominion University", "credential:OSHA 30", "clearance"]),
    );
  });

  it("suggests new resume evidence as unverified and leaves an existing clearance row alone", () => {
    const fresh = planResumeEvidenceSuggestions({
      text: resumeText,
      existingEducation: [],
      existingCredentials: [],
      existingClearance: null,
    });
    expect(fresh.education[0]).toMatchObject({
      institution: "Old Dominion University",
      source: "resume",
      humanVerified: false,
    });
    expect(fresh.credentials[0]).toMatchObject({ name: "OSHA 30", source: "resume", humanVerified: false });
    expect(fresh.clearance).toMatchObject({ clearanceLevel: "secret", humanVerified: false, source: "resume" });

    const topSecret = planResumeEvidenceSuggestions({
      text: "Active Top Secret clearance",
      existingEducation: [],
      existingCredentials: [],
      existingClearance: { clearanceLevel: "secret", humanVerified: true },
    });
    expect(topSecret.clearance).toBeNull();
    expect(topSecret.preservedHumanReviewed).toContain("clearance");

    const existingUnverified = planResumeEvidenceSuggestions({
      text: "Top Secret clearance",
      existingEducation: [],
      existingCredentials: [],
      existingClearance: { clearanceLevel: "secret", humanVerified: false },
    });
    expect(existingUnverified.clearance).toBeNull();
  });

  it("distinguishes inferred evidence from human-reviewed evidence", () => {
    expect(evidenceReviewLabel({ source: "ai_extraction", humanVerified: false })).toBe(
      "AI extraction, pending review",
    );
    expect(evidenceReviewLabel({ source: "resume", humanVerified: false })).toBe(
      "Resume extracted, pending review",
    );
    expect(evidenceReviewLabel({ source: "recruiter", humanVerified: true })).toBe(
      "Human reviewed (Recruiter entered origin)",
    );
    expect(evidenceReviewLabel({ source: "candidate", humanVerified: false })).toBe("Candidate reported");
    expect(evidenceReviewLabel({ source: "recruiter", humanVerified: true })).not.toMatch(/Pier 24|authorized source/i);
  });

  it("keeps recruiter jobs access and withholds opportunities.read", () => {
    expect(ROLE_PERMISSIONS.recruiter).toContain("jobs.read");
    expect(ROLE_PERMISSIONS.recruiter).toContain("jobs.write");
    expect(ROLE_PERMISSIONS.recruiter).toContain("candidates.write");
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("opportunities.read");
    const slugs = new Set(Object.values(ROLE_PERMISSIONS).flat());
    expect([...slugs].some((slug) => slug.startsWith("transition."))).toBe(false);
  });

  it("reports informational completeness without a match, rank, or rejection", () => {
    const result = assessTransitionProfile({
      militaryExperiences: [],
      duties: [],
      equipment: [],
      trainingRecords: [],
      education: [],
      credentials: [],
      skillsCount: 0,
      separationDate: null,
      etsDate: null,
      eaosDate: null,
      endOfServiceDate: null,
      retirementDate: null,
      availableDate: null,
      preferredLocationPrimary: null,
      preferredLocationCount: 0,
      candidateCity: null,
      targetRoleCount: 0,
      resumeStatus: "missing",
      hasResumeFile: false,
    });
    expect(result.informational).toBe(true);
    expect(result.affectsMatch).toBe(false);
    expect(result.affectsRank).toBe(false);
    expect(result.affectsReject).toBe(false);
    expect(result.sections.every((section) => section.state === "missing_information")).toBe(true);
    expect(result).not.toHaveProperty("score");
    expect(result).not.toHaveProperty("rank");

    const reviewed = assessTransitionProfile({
      militaryExperiences: [{ certifications: null, training: null }],
      duties: [{ humanVerified: true }],
      equipment: [{ humanVerified: false }],
      trainingRecords: [],
      education: [{ humanVerified: true }],
      credentials: [{ humanVerified: true }],
      skillsCount: 1,
      separationDate: new Date("2027-06-01"),
      etsDate: null,
      eaosDate: null,
      endOfServiceDate: null,
      retirementDate: null,
      availableDate: null,
      preferredLocationPrimary: "Norfolk, VA",
      preferredLocationCount: 1,
      candidateCity: "Norfolk",
      targetRoleCount: 1,
      resumeStatus: "current",
      hasResumeFile: true,
    });
    expect(reviewed.sections.find((section) => section.key === "skills_evidence")?.state).toBe("needs_review");
    expect(reviewed.affectsMatch).toBe(false);
  });

  it("does not let completeness or a new person table into matching or intake", () => {
    const matching = readFileSync("lib/skillbridge/matching.ts", "utf8");
    const recruitingMatch = readFileSync("lib/recruiting/matching.ts", "utf8");
    const intake = readFileSync("lib/military-talent/public-intake.ts", "utf8");
    expect(matching).not.toContain("assessTransitionProfile");
    expect(matching).not.toContain("profile-completeness");
    expect(recruitingMatch).not.toContain("assessTransitionProfile");
    expect(intake).toContain("skillbridgeProfiles");
    expect(intake).toContain("persistMilitaryTalentIntake");
    expect(intake).not.toMatch(/veteran_profiles|transitioning_service_members|Veteran table/i);
  });
});
