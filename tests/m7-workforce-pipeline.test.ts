import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ROLE_PERMISSIONS } from "../lib/rbac/permissions";
import {
  analyzeWorkforceRole,
  classifyAvailability,
  presentSupplyCandidate,
  skillCountsForSupply,
  summarizeJobFamilies,
  type PersonFact,
  type SkillFact,
} from "../lib/workforce/pipeline-analysis";

const asOf = new Date("2026-10-22T18:00:00.000Z");
const skillId = "skill-electrical";

function person(id: string, overrides: Partial<PersonFact> = {}): PersonFact {
  return {
    id,
    availability: "available_now",
    militaryStatus: "none",
    city: "Charlotte",
    region: "NC",
    relocationWillingness: "no",
    ...overrides,
  };
}

function skill(candidateId: string, overrides: Partial<SkillFact> = {}): SkillFact {
  return {
    candidateId,
    skillId,
    basis: "explicit",
    reviewStatus: "approved",
    source: "recruiter",
    ...overrides,
  };
}

function analyze(people: PersonFact[], skills: SkillFact[], extra: Parameters<typeof analyzeWorkforceRole>[0] = {
  calculatedAt: asOf,
  demandQuantity: 20,
  demandHorizon: "future",
  planningHorizon: "0_90_days",
  requiredSkills: [{ skillId, name: "Electrical Troubleshooting" }],
  siteCity: "Charlotte",
  siteRegion: "NC",
}) {
  return analyzeWorkforceRole({ ...extra, people, skills });
}

describe("M7 workforce pipeline analysis", () => {
  it("A — demand 20 and known supply 12 leaves a gap of 8", () => {
    const people = Array.from({ length: 12 }, (_, index) => person(`p${index}`));
    const result = analyze(people, people.map((row) => skill(row.id)));
    expect(result.knownSupply).toBe(12);
    expect(result.quantityGap).toBe(8);
    expect(result.planningDemandIsNotAJob).toBe(true);
  });

  it("B — one candidate with the same capability twice counts once", () => {
    const result = analyze([person("p1")], [skill("p1"), skill("p1")]);
    expect(result.knownSupply).toBe(1);
  });

  it("C — pending inferred translation does not count", () => {
    const result = analyze(
      [person("p1")],
      [skill("p1", { basis: "inferred", reviewStatus: "pending", source: "capability_translation" })],
    );
    expect(result.knownSupply).toBe(0);
    expect(skillCountsForSupply({ basis: "inferred", reviewStatus: "pending", source: "capability_translation" })).toBe(false);
  });

  it("D — approved military translation counts", () => {
    const result = analyze(
      [person("p1", { militaryStatus: "veteran" })],
      [skill("p1", { basis: "inferred", reviewStatus: "approved", source: "capability_translation" })],
    );
    expect(result.knownSupply).toBe(1);
    expect(result.militarySupply).toBe(1);
  });

  it("E — explicit non-military skill counts before approval", () => {
    const result = analyze(
      [person("p1")],
      [skill("p1", { reviewStatus: "pending", source: "recruiter" })],
    );
    expect(result.knownSupply).toBe(1);
    expect(result.nonMilitarySupply).toBe(1);
  });

  it("F — archived and privacy-deleted candidates are excluded", () => {
    const result = analyze(
      [person("gone", { archived: true }), person("deleted", { privacyDeleted: true }), person("kept")],
      [skill("gone"), skill("deleted"), skill("kept")],
    );
    expect(result.knownSupply).toBe(1);
    expect(result.relevantCandidateIds).toEqual(["kept"]);
  });

  it("G — available now and future transition are different counts", () => {
    const future = person("later", { transitionDates: ["2027-03-01"] });
    const now = person("now");
    const result = analyze([future, now], [skill("later"), skill("now")]);
    expect(classifyAvailability(future, asOf)).toBe("future_transition");
    expect(classifyAvailability(now, asOf)).toBe("available_now");
    expect(result.availability.available_now).toBe(1);
    expect(result.availability.future_transition).toBe(1);
    expect(result.availableByHorizon).toBe(1);
  });

  it("H — location willingness changes location-specific supply", () => {
    const local = person("local");
    const away = person("away", { city: "Norfolk", region: "VA", relocationWillingness: "no" });
    const willing = person("move", { city: "Norfolk", region: "VA", relocationWillingness: "yes" });
    const result = analyze([local, away, willing], [skill("local"), skill("away"), skill("move")]);
    expect(result.locationFit).toBe(2);
    expect(result.locationConstrained).toBe(1);
  });

  it("I/J — several jobs stay linked and a closed job is not a current opening", () => {
    const result = analyze([person("p1")], [skill("p1")], {
      calculatedAt: asOf,
      demandQuantity: 15,
      demandHorizon: "future",
      requiredSkills: [{ skillId, name: "Electrical Troubleshooting" }],
      jobs: [
        { jobId: "open-1", title: "Req 1", status: "open" },
        { jobId: "open-2", title: "Req 2", status: "search_active" },
        { jobId: "closed-1", title: "Old req", status: "closed" },
      ],
    });
    expect(result.linkedJobs).toHaveLength(3);
    expect(result.currentOpenings).toBe(2);
    expect(result.currentOpenings).not.toBe(result.demandQuantity);
  });

  it("K/L/M — matches and engagements aggregate, and no fit leaves the category alone", () => {
    const matches = [
      { candidateId: "p1", jobId: "open-1", matchCategory: "strong_match", recruiterDisposition: "viable" },
      { candidateId: "p2", jobId: "open-1", matchCategory: "possible_match", recruiterDisposition: "needs_information" },
      { candidateId: "p3", jobId: "open-1", matchCategory: "no_current_match", recruiterDisposition: null },
    ];
    const before = matches[0].matchCategory;
    const result = analyze(
      [person("p1"), person("p2"), person("p3")],
      [skill("p1"), skill("p2"), skill("p3")],
      {
        calculatedAt: asOf,
        demandQuantity: 5,
        demandHorizon: "current",
        requiredSkills: [{ skillId, name: "Electrical Troubleshooting" }],
        jobs: [{ jobId: "open-1", status: "open" }],
        matches,
        engagements: [
          { candidateId: "p1", jobId: "open-1", status: "reviewing", employerResponse: null },
          { candidateId: "p2", jobId: "open-1", status: "no_fit", employerResponse: "not_a_fit" },
        ],
        interviewCandidateIds: ["p1"],
        placementCandidateIds: ["p3"],
      },
    );
    expect(matches[0].matchCategory).toBe(before);
    expect(result.funnel.opportunityMatch).toBe(2);
    expect(result.funnel.recruiterViable).toBe(1);
    expect(result.funnel.employerReviewing).toBe(1);
    expect(result.funnel.interview).toBe(1);
    expect(result.funnel.placement).toBe(1);
    expect(result.funnel.noFit).toBe(1);
  });

  it("N/O — military and other supply partition the same people once", () => {
    const result = analyze(
      [
        person("vet", { militaryStatus: "veteran", hasMilitaryProfile: true }),
        person("profile", { militaryStatus: "none", hasMilitaryProfile: true }),
        person("civilian"),
      ],
      [skill("vet"), skill("profile"), skill("civilian")],
    );
    expect(result.militarySupply).toBe(2);
    expect(result.nonMilitarySupply).toBe(1);
    expect(result.militarySupply + result.nonMilitarySupply).toBe(result.knownSupply);
    expect(result.relevantCandidateIds).toHaveLength(3);
  });

  it("P/Q — credentials are documented and clearance stays candidate-reported", () => {
    const result = analyze(
      [
        person("licensed", {
          credentials: [{ name: "EPA 608", status: "active" }],
          clearance: { level: "secret", status: "reported_active", humanVerified: false },
        }),
        person("expired", { credentials: [{ name: "EPA 608", status: "expired" }] }),
      ],
      [skill("licensed"), skill("expired")],
      {
        calculatedAt: asOf,
        demandQuantity: 2,
        demandHorizon: "future",
        requiredSkills: [{ skillId, name: "Electrical Troubleshooting" }],
        requiredCredentialText: "EPA 608",
        requiredClearance: "secret",
      },
    );
    expect(result.credentialFit).toBe(1);
    expect(result.credentialGap).toBe(1);
    expect(result.clearanceFit).toBe(1);
    expect(result.clearanceLabel).toMatch(/candidate-reported/i);
    expect(result.clearanceLabel).toMatch(/not a verified clearance/i);
  });

  it("S — a planner without PII access does not receive contact details", () => {
    const hidden = presentSupplyCandidate({
      id: "p1",
      name: "Avery Quinn",
      email: "avery@example.com",
      phone: "555-0100",
      compensationExpectations: "120000",
    }, true, false);
    expect(hidden?.name).toBe("Avery Quinn");
    expect(hidden?.email).toBeNull();
    expect(hidden?.phone).toBeNull();
    expect(hidden?.compensationExpectations).toBeNull();
    expect(hidden).not.toHaveProperty("resumeFileId");
    expect(presentSupplyCandidate({ id: "p1", name: "Avery Quinn" }, false, false)).toBeNull();
  });

  it("T — recruiter permissions are not broadened", () => {
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("workforce.write");
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("workforce.analyze");
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("workforce.approve");
    expect(ROLE_PERMISSIONS["workforce-consultant"]).not.toContain("candidate_pii.read");
    expect(ROLE_PERMISSIONS["workforce-consultant"]).toContain("workforce.read");
  });

  it("U/V — the gap has an as-of time and future demand is not an opening", () => {
    const result = analyze([person("p1")], [skill("p1")], {
      calculatedAt: asOf,
      demandQuantity: 15,
      demandHorizon: "future",
      demandSource: "workforce_plan",
      requiredSkills: [{ skillId, name: "Electrical Troubleshooting" }],
      jobs: [],
    });
    expect(result.calculatedAt).toBe(asOf.toISOString());
    expect(result.source).toBe("workforceos_stored_records");
    expect(result.demandHorizon).toBe("future");
    expect(result.currentOpenings).toBe(0);
    expect(result.narrative).toMatch(/not an instruction to hire/i);
    expect(result.narrative).not.toMatch(/you need to hire/i);
  });

  it("counts a critical role only from the documented threshold", () => {
    const people = Array.from({ length: 4 }, (_, index) => person(`p${index}`));
    const result = analyze(people, people.map((row) => skill(row.id)), {
      calculatedAt: asOf,
      demandQuantity: 20,
      demandHorizon: "future",
      requiredSkills: [{ skillId, name: "Electrical Troubleshooting" }],
    });
    expect(result.health).toBe("critical");
    expect(result.healthReason).toMatch(/25%/);
  });

  it("groups a job family without counting one person twice", () => {
    const summary = summarizeJobFamilies([
      {
        roleId: "r1",
        title: "Instrumentation Technician",
        jobFamilyId: "family-1",
        jobFamilyName: "Instrumentation & Controls",
        freeTextJobFamily: null,
        demandQuantity: 10,
        candidateIds: ["p1", "p2"],
        activePipelineCandidateIds: ["p1"],
        placedCandidateIds: [],
        health: "gap",
      },
      {
        roleId: "r2",
        title: "Controls Technician",
        jobFamilyId: "family-1",
        jobFamilyName: "Instrumentation & Controls",
        freeTextJobFamily: null,
        demandQuantity: 5,
        candidateIds: ["p2"],
        activePipelineCandidateIds: ["p2"],
        placedCandidateIds: ["p2"],
        health: "watch",
      },
      {
        roleId: "r3",
        title: "Misc technician",
        jobFamilyId: null,
        jobFamilyName: null,
        freeTextJobFamily: "misc techs",
        demandQuantity: 3,
        candidateIds: ["p9"],
        activePipelineCandidateIds: [],
        placedCandidateIds: [],
        health: "gap",
      },
    ]);
    expect(summary.families[0]).toMatchObject({
      knownSupply: 2,
      demand: 15,
      quantityGap: 13,
      activePipeline: 2,
      placements: 1,
      health: "gap",
    });
    expect(summary.unlinkedRoles).toHaveLength(1);
    expect(summary.unlinkedRoles[0]?.title).toBe("Misc technician");
    expect(summary.unlinkedRoles[0]?.freeTextJobFamily).toBe("misc techs");
  });

  it("W/X — this milestone does not call the matcher or send outreach", () => {
    const analysis = readFileSync("lib/workforce/pipeline-analysis.ts", "utf8");
    const supply = readFileSync("lib/workforce/pipeline-supply.ts", "utf8");
    const commands = readFileSync("lib/workforce/pipeline-commands.ts", "utf8");
    for (const source of [analysis, supply, commands]) {
      expect(source).not.toContain("evaluateOpportunityMatch");
      expect(source).not.toContain("confirmExternalSend");
      expect(source).not.toContain("markSentManually");
      expect(source).not.toContain("startEngagement");
    }
  });
});
