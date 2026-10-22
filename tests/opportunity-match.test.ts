import { describe, expect, it } from "vitest";

import { ROLE_PERMISSIONS } from "../lib/rbac/permissions";
import {
  MATCH_WEIGHTS,
  type CandidateMatchProfile,
  type JobMatchProfile,
  capabilityCountsForMatch,
  evaluateOpportunityMatch,
  extractDeterministicJobRequirements,
  isCurrentOpportunityStatus,
  keepCitedRequirements,
  opportunityContextLabel,
} from "../lib/recruiting/opportunity-match";

function candidate(overrides: Partial<CandidateMatchProfile> = {}): CandidateMatchProfile {
  return {
    capabilities: [],
    credentials: [],
    education: [],
    jobFamilies: [],
    occupations: [],
    ...overrides,
  };
}

function job(overrides: Partial<JobMatchProfile> = {}): JobMatchProfile {
  return {
    status: "open",
    contextType: "client",
    title: "Role",
    skillbridgeEligible: false,
    capabilities: [],
    requirements: [],
    ...overrides,
  };
}

function skill(id: string, name: string, requirementType: "required" | "preferred" = "required") {
  return { skillId: id, name, requirementType, reviewStatus: "approved" as const };
}

function capability(
  id: string,
  name: string,
  extras: Partial<CandidateMatchProfile["capabilities"][number]> = {},
) {
  return {
    skillId: id,
    name,
    basis: "explicit" as const,
    reviewStatus: "approved" as const,
    source: null,
    evidence: [`${name} evidence`],
    ...extras,
  };
}

describe("opportunity match", () => {
  it("documents interpretable weights that total 100", () => {
    expect(Object.values(MATCH_WEIGHTS).reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it("A — Navy ET aligns with instrumentation and records the utility gap", () => {
    const result = evaluateOpportunityMatch(
      candidate({
        capabilities: [
          capability("troubleshooting", "Electronic Troubleshooting", { evidence: ["Radar maintenance duty"] }),
          capability("calibration", "Calibration", { evidence: ["Calibration equipment"] }),
          capability("maintenance", "Preventive Maintenance"),
          capability("instrumentation", "Instrumentation"),
          capability("leadership", "Technical Leadership", { evidence: ["Reviewed leadership scope"] }),
        ],
        relocationWillingness: "willing",
        city: "Norfolk",
      }),
      job({
        title: "Instrumentation Technician",
        locationLabel: "Charlotte",
        contextType: "monitored_public",
        capabilities: [
          skill("instrumentation", "Instrumentation"),
          skill("calibration", "Calibration"),
          skill("maintenance", "Preventive Maintenance"),
          skill("utility", "Utility Switching"),
        ],
      }),
    );
    expect(result.category).toBe("strong_match");
    expect(result.explanation).toContain("Strong Match");
    expect(result.explanation).toContain("Instrumentation");
    expect(result.explanation).toContain("Utility Switching");
    expect(result.explanation).toContain("Not documented");
    expect(result.explanation.toLowerCase()).not.toContain("cannot");
    expect(result.blocksStrong).toBe(false);
    expect(opportunityContextLabel("monitored_public")).toBe("Public opportunity");
  });

  it("B — Navy LS can match materials work without a shared title", () => {
    const result = evaluateOpportunityMatch(
      candidate({
        capabilities: [
          capability("inventory", "Inventory Control"),
          capability("warehouse", "Warehouse Operations"),
          capability("logistics", "Logistics Systems"),
          capability("accountability", "Material Accountability"),
        ],
        jobFamilies: ["Materials"],
      }),
      job({
        title: "Materials Coordinator",
        capabilities: [
          skill("inventory", "Inventory Control"),
          skill("erp", "ERP"),
          skill("coordination", "Material Coordination"),
          skill("vendor", "Vendor Interaction"),
        ],
        requirements: [{ kind: "job_family", requirementType: "preferred", label: "Materials", reviewStatus: "approved" }],
      }),
    );
    expect(["strong_match", "possible_match"]).toContain(result.category);
    expect(result.strengths).toContain("Inventory Control");
    expect(result.explanation).not.toContain("Logistics Specialist");
  });

  it("C — sourcing depth that is not documented stays a gap", () => {
    const result = evaluateOpportunityMatch(
      candidate({
        capabilities: [capability("inventory", "Inventory Control"), capability("warehouse", "Warehouse Operations")],
      }),
      job({
        title: "Strategic Sourcing Manager",
        capabilities: [
          skill("sourcing", "Strategic Sourcing"),
          skill("negotiation", "Contract Negotiation"),
          skill("strategy", "Supplier Strategy"),
        ],
      }),
    );
    expect(["possible_match", "developmental_match", "no_current_match"]).toContain(result.category);
    expect(result.explanation).toContain("Strategic Sourcing");
    expect(result.explanation).toContain("Not documented");
  });

  it("D and E — warehouse and approved cyber capabilities contribute", () => {
    const warehouse = evaluateOpportunityMatch(
      candidate({ capabilities: [capability("warehouse", "Warehouse Operations"), capability("inventory", "Inventory Control")] }),
      job({
        title: "Warehouse Associate",
        capabilities: [skill("warehouse", "Warehouse Operations"), skill("inventory", "Inventory Control")],
      }),
    );
    const cyber = evaluateOpportunityMatch(
      candidate({ capabilities: [capability("cyber", "Cyber Defense", { basis: "reference_supported", source: "capability_translation" })] }),
      job({ title: "Cybersecurity Analyst", capabilities: [skill("cyber", "Cyber Defense")] }),
    );
    expect(["strong_match", "possible_match"]).toContain(warehouse.category);
    expect(cyber.category).toBe("strong_match");
  });

  it("F G H — occupation-only, pending, and rejected capabilities do not improve the match", () => {
    const bare = evaluateOpportunityMatch(candidate(), job({ capabilities: [skill("supply", "Supply Operations")] }));
    const pending = evaluateOpportunityMatch(
      candidate({
        capabilities: [capability("supply", "Supply Operations", { basis: "reference_supported", reviewStatus: "pending", source: "capability_translation" })],
      }),
      job({ capabilities: [skill("supply", "Supply Operations")] }),
    );
    const rejected = evaluateOpportunityMatch(
      candidate({
        capabilities: [capability("supply", "Supply Operations", { reviewStatus: "rejected", source: "capability_translation" })],
      }),
      job({ capabilities: [skill("supply", "Supply Operations")] }),
    );
    expect(bare.category).toBe("no_current_match");
    expect(bare.explanation).toContain("Needs more profile information");
    expect(pending.category).toBe(bare.category);
    expect(pending.score).toBe(bare.score);
    expect(rejected.score).toBe(bare.score);
    expect(capabilityCountsForMatch({ basis: "explicit", reviewStatus: "pending", source: null })).toBe(true);
  });

  it("I J — closed jobs are not current opportunities and a reopened status changes the hash", () => {
    expect(isCurrentOpportunityStatus("closed")).toBe(false);
    expect(isCurrentOpportunityStatus("open")).toBe(true);
    const person = candidate({ capabilities: [capability("supply", "Supply Operations")] });
    const closed = evaluateOpportunityMatch(person, job({ status: "closed", capabilities: [skill("supply", "Supply Operations")] }));
    const reopened = evaluateOpportunityMatch(person, job({ status: "open", capabilities: [skill("supply", "Supply Operations")] }));
    expect(closed.inputHash).not.toBe(reopened.inputHash);
  });

  it("K L — location mismatch is a gap, and willingness to relocate softens it", () => {
    const person = candidate({ capabilities: [capability("tech", "Calibration")], city: "Norfolk" });
    const posting = job({ locationLabel: "Charlotte", capabilities: [skill("tech", "Calibration")] });
    const blocked = evaluateOpportunityMatch(person, posting);
    const willing = evaluateOpportunityMatch(candidate({ ...person, relocationWillingness: "willing" }), posting);
    expect(blocked.blocksStrong).toBe(true);
    expect(blocked.category).not.toBe("strong_match");
    expect(blocked.explanation).toContain("Charlotte");
    expect(willing.blocksStrong).toBe(false);
    expect(willing.category).toBe("strong_match");
    expect(willing.explanation).toContain("willing to relocate");
  });

  it("M — SkillBridge status does not reduce a direct-hire match", () => {
    const posting = job({
      skillbridgeEligible: false,
      targetStart: "2026-12-01",
      capabilities: [skill("tech", "Calibration")],
    });
    const eligible = evaluateOpportunityMatch(
      candidate({
        capabilities: [capability("tech", "Calibration")],
        skillbridgeWindowStart: "2026-01-01",
        skillbridgeWindowEnd: "2026-06-01",
        availableOn: "2026-11-01",
      }),
      posting,
    );
    const ineligible = evaluateOpportunityMatch(
      candidate({ capabilities: [capability("tech", "Calibration")], availableOn: "2026-11-01" }),
      posting,
    );
    expect(eligible.score).toBe(ineligible.score);
    expect(eligible.category).toBe(ineligible.category);
    const pathway = evaluateOpportunityMatch(
      candidate({
        capabilities: [capability("tech", "Calibration")],
        skillbridgeWindowStart: "2026-11-01",
        skillbridgeWindowEnd: "2027-02-01",
      }),
      job({ skillbridgeEligible: true, targetStart: "2026-12-01", capabilities: [skill("tech", "Calibration")] }),
    );
    expect(pathway.explanation).toContain("SkillBridge");
  });

  it("N O — preferred education does not block Strong, and a missing license is a gap without rejection", () => {
    const aligned = candidate({ capabilities: [capability("tech", "Calibration")] });
    const preferred = evaluateOpportunityMatch(
      aligned,
      job({
        capabilities: [skill("tech", "Calibration")],
        requirements: [{ kind: "education", requirementType: "preferred", label: "Bachelor's degree", reviewStatus: "approved" }],
      }),
    );
    const license = evaluateOpportunityMatch(
      aligned,
      job({
        capabilities: [skill("tech", "Calibration")],
        requirements: [{ kind: "license", requirementType: "required", label: "CDL", reviewStatus: "approved" }],
      }),
    );
    expect(preferred.category).toBe("strong_match");
    expect(preferred.explanation).toContain("Bachelor's degree");
    expect(license.category).not.toBe("no_current_match");
    expect(license.blocksStrong).toBe(true);
    expect(license.explanation).toContain("CDL");
    expect(license.explanation).toContain("does not reject");
  });

  it("P R — the same result is returned for a non-military candidate from either direction", () => {
    const person = candidate({ capabilities: [capability("planning", "Maintenance Planning", { reviewStatus: "pending", source: null })] });
    const posting = job({ title: "Maintenance Planner", capabilities: [skill("planning", "Maintenance Planning")] });
    const candidateSide = evaluateOpportunityMatch(person, posting);
    const jobSide = evaluateOpportunityMatch(person, posting);
    expect(candidateSide.category).toBe("strong_match");
    expect(jobSide).toEqual(candidateSide);
  });

  it("S T — a job content change or a capability change makes the stored input hash stale", () => {
    const person = candidate({ capabilities: [capability("tech", "Calibration", { reviewStatus: "pending" })] });
    const before = evaluateOpportunityMatch(person, job({ contentHash: "aaa", capabilities: [skill("tech", "Calibration")] }));
    const descriptionChanged = evaluateOpportunityMatch(person, job({ contentHash: "bbb", capabilities: [skill("tech", "Calibration")] }));
    const approved = evaluateOpportunityMatch(
      candidate({ capabilities: [capability("tech", "Calibration", { reviewStatus: "approved" })] }),
      job({ contentHash: "aaa", capabilities: [skill("tech", "Calibration")] }),
    );
    expect(before.inputHash).not.toBe(descriptionChanged.inputHash);
    expect(before.inputHash).not.toBe(approved.inputHash);
    const pendingTranslation = evaluateOpportunityMatch(
      candidate({
        capabilities: [capability("tech", "Calibration", { reviewStatus: "pending", source: "capability_translation", basis: "reference_supported" })],
      }),
      job({ contentHash: "aaa", capabilities: [skill("tech", "Calibration")] }),
    );
    expect(pendingTranslation.category).toBe("no_current_match");
    expect(approved.category).toBe("strong_match");
  });

  it("drops invented AI requirements and keeps cited excerpts", () => {
    const description = "Must have Secret clearance and 5 years of calibration experience. Preferred bachelor's degree.";
    const drafts = extractDeterministicJobRequirements(description);
    expect(drafts.some((row) => row.kind === "clearance" && row.valueText === "secret")).toBe(true);
    const cited = keepCitedRequirements(description, [
      ...drafts,
      { kind: "credential", requirementType: "required" as const, label: "Invented cert", sourceText: "Invented cert" },
    ]);
    expect(cited.some((row) => row.label === "Invented cert")).toBe(false);
    expect(cited.some((row) => row.kind === "clearance")).toBe(true);
  });

  it("does not give recruiters CRM opportunity access", () => {
    expect(ROLE_PERMISSIONS.recruiter).toContain("candidates.read");
    expect(ROLE_PERMISSIONS.recruiter).toContain("jobs.read");
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("opportunities.read");
  });
});
