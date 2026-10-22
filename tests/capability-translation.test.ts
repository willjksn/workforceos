import { describe, expect, it } from "vitest";

import {
  assertCapabilityReview,
  buildTranslationPrompt,
  countsTowardMatching,
  draftCapabilitySuggestions,
  explainOccupationFit,
  proposeCapabilitiesFromEvidence,
  rankOccupationsByCapabilities,
  type CatalogSkill,
  type OccupationCapabilityLink,
  type StoredCapability,
  type TranslationEvidence,
} from "../lib/military/capability-translation";
import { hiringManagerTranslation } from "../lib/military/translator";
import { scoreCandidateJobMatch } from "../lib/recruiting/matching";
import { ROLE_PERMISSIONS } from "../lib/rbac/permissions";

const skills: CatalogSkill[] = [
  { id: "inventory", slug: "inventory-control", name: "Inventory Control", competencyCluster: "Supply Chain & Logistics" },
  { id: "procurement", slug: "procurement-support", name: "Procurement Support", competencyCluster: "Supply Chain & Logistics" },
  { id: "warehouse", slug: "warehouse-operations", name: "Warehouse Operations", competencyCluster: "Supply Chain & Logistics" },
  { id: "hazmat", slug: "hazardous-material-controls", name: "Hazardous-Material Controls", competencyCluster: "Safety/Compliance" },
  { id: "erp", slug: "logistics-systems", name: "Logistics Systems", competencyCluster: "Supply Chain & Logistics" },
  { id: "planning", slug: "demand-supply-planning", name: "Demand and Supply Planning", competencyCluster: "Supply Chain & Logistics" },
  { id: "leadership", slug: "team-leadership", name: "Team Leadership", competencyCluster: "Leadership & Supervision" },
  { id: "troubleshooting", slug: "electronic-troubleshooting", name: "Electronic Troubleshooting", competencyCluster: "Electrical/Electronics" },
  { id: "radar", slug: "radar-systems", name: "Radar Systems", competencyCluster: "Electrical/Electronics" },
  { id: "instrumentation", slug: "instrumentation", name: "Instrumentation", competencyCluster: "Electrical/Electronics" },
  { id: "supply", slug: "supply-operations", name: "Supply Operations", competencyCluster: "Supply Chain & Logistics" },
  { id: "cyber", slug: "cyber-defense", name: "Cyber Defense", competencyCluster: "Cyber/IT" },
  { id: "it", slug: "it-operations", name: "IT Operations", competencyCluster: "Cyber/IT" },
  { id: "sourcing", slug: "strategic-sourcing", name: "Strategic Sourcing", competencyCluster: "Supply Chain & Logistics" },
];

function skillNames(slugs: string[]) {
  return proposeCapabilitiesFromEvidence({
    evidence: [],
    skills,
  }).map((row) => row.skillSlug);
  void slugs;
}

function namesFrom(evidence: TranslationEvidence[], links: OccupationCapabilityLink[] = [], tours: string[] = []) {
  return proposeCapabilitiesFromEvidence({
    evidence,
    skills,
    occupationLinks: links,
    tourOccupationIds: tours,
  }).map((row) => row.skillSlug).sort();
}

describe("M3 capability translation", () => {
  it("A — Navy LS evidence becomes multiple capabilities, not one civilian title", () => {
    const proposals = proposeCapabilitiesFromEvidence({
      evidence: [
        { id: "d1", type: "military_duty", text: "Maintained material accountability and inventory control for shipboard stock" },
        { id: "d2", type: "military_duty", text: "Coordinated vendor coordination, procurement, and warehouse operations" },
        { id: "e1", type: "military_equipment", text: "Used an ERP logistics system" },
        { id: "l1", type: "leadership", text: "Supervised 6 direct reports" },
      ],
      skills,
      tourOccupationIds: ["ls"],
    });
    const slugs = proposals.map((row) => row.skillSlug).sort();
    expect(slugs).toEqual([
      "inventory-control",
      "logistics-systems",
      "procurement-support",
      "team-leadership",
      "warehouse-operations",
    ]);
    expect(proposals.every((row) => row.reviewStatus === "pending" && row.employerFacing === false)).toBe(true);
    expect(proposals.find((row) => row.skillSlug === "inventory-control")?.evidence.length).toBeGreaterThan(0);
    expect(skillNames([])).toEqual([]);
  });

  it("B — Navy ET evidence becomes electronics and instrumentation capabilities", () => {
    expect(namesFrom([
      { id: "d1", type: "military_duty", text: "Maintained radar equipment, diagnosed faults, and calibrated instrumentation" },
    ])).toEqual(["electronic-troubleshooting", "instrumentation", "radar-systems"]);
  });

  it("C — Army logistics evidence becomes supply and logistics capabilities", () => {
    expect(namesFrom([
      { id: "d1", type: "military_duty", text: "Ran unit supply and the supply room accountability" },
    ])).toEqual(["supply-operations", "warehouse-operations"]);
  });

  it("D — Air Force cyber evidence becomes cyber capabilities", () => {
    expect(namesFrom([
      { id: "d1", type: "military_duty", text: "Performed cyber defense and network defense on base information systems" },
    ])).toEqual(["cyber-defense"]);
  });

  it("E — the same occupation with different duties yields different profiles", () => {
    const links: OccupationCapabilityLink[] = [
      {
        id: "map-1",
        militaryOccupationId: "ls",
        skillId: "inventory",
        reviewStatus: "approved",
        evidenceReference: "material accountability",
        mappingQuality: "development_fixture",
      },
    ];
    const logistics = namesFrom(
      [{ id: "d1", type: "military_duty", text: "Maintained material accountability and inventory control" }],
      links,
      ["ls"],
    );
    const galley = namesFrom(
      [{ id: "d2", type: "military_duty", text: "Prepared meals for the crew" }],
      links,
      ["ls"],
    );
    expect(logistics).toContain("inventory-control");
    expect(galley).toEqual([]);
  });

  it("F — an AI suggestion stays pending and is not employer-facing", async () => {
    const drafted = await draftCapabilitySuggestions({
      evidence: [{ id: "d1", type: "military_duty", text: "Ordered stock for the division" }],
      skills,
      complete: async () => ({
        text: JSON.stringify({
          capabilities: [
            {
              skillSlug: "strategic-sourcing",
              evidenceIds: ["d1"],
              citation: "Model suggestion from the duty. Not approved.",
              confidence: 42,
            },
          ],
        }),
        provider: "test",
        model: "test-model",
      }),
    });
    const sourcing = drafted.proposals.find((row) => row.skillSlug === "strategic-sourcing");
    expect(sourcing?.basis).toBe("inferred");
    expect(sourcing?.reviewStatus).toBe("pending");
    expect(sourcing?.employerFacing).toBe(false);
    expect(drafted.usedDeterministicFallback).toBe(false);
  });

  it("G — a human-approved capability supports a civilian occupation", () => {
    const capabilities: StoredCapability[] = [
      {
        skillId: "inventory",
        skillSlug: "inventory-control",
        skillName: "Inventory Control",
        basis: "explicit",
        reviewStatus: "approved",
        evidence: [{ evidenceId: "d1", evidenceType: "military_duty", citation: "Documented military duty: inventory control" }],
      },
      {
        skillId: "erp",
        skillSlug: "logistics-systems",
        skillName: "Logistics Systems",
        basis: "explicit",
        reviewStatus: "approved",
        evidence: [{ evidenceId: "e1", evidenceType: "military_equipment", citation: "Documented military equipment: ERP logistics system" }],
      },
    ];
    const fits = rankOccupationsByCapabilities({
      occupations: [
        {
          occupationId: "mat",
          title: "Materials Management",
          jobFamilies: ["Supply Chain"],
          occupationSkills: [
            { skillId: "inventory", name: "Inventory Control" },
            { skillId: "erp", name: "Logistics Systems" },
            { skillId: "sourcing", name: "Strategic Sourcing" },
          ],
        },
      ],
      capabilities,
    });
    expect(fits).toHaveLength(1);
    expect(fits[0]?.employerFacing).toBe(true);
    expect(fits[0]?.supporting.map((row) => row.skillName).sort()).toEqual(["Inventory Control", "Logistics Systems"]);
  });

  it("H — a rejected capability is excluded from employer-facing translation", () => {
    const fit = explainOccupationFit({
      occupationId: "mat",
      title: "Materials Management",
      occupationSkills: [{ skillId: "inventory", name: "Inventory Control" }],
      capabilities: [
        {
          skillId: "inventory",
          skillSlug: "inventory-control",
          skillName: "Inventory Control",
          basis: "inferred",
          reviewStatus: "rejected",
          evidence: [{ evidenceId: "d1", evidenceType: "military_duty", citation: "Rejected draft" }],
        },
      ],
    });
    expect(fit.employerFacing).toBe(false);
    expect(fit.supporting).toEqual([]);
  });

  it("I — the explanation cites evidence and names gaps", () => {
    const fit = explainOccupationFit({
      occupationId: "mat",
      title: "Materials Management",
      jobFamilies: ["Supply Chain"],
      occupationSkills: [
        { skillId: "inventory", name: "Inventory Control" },
        { skillId: "sourcing", name: "Strategic Sourcing" },
      ],
      capabilities: [
        {
          skillId: "inventory",
          skillSlug: "inventory-control",
          skillName: "Inventory Control",
          basis: "explicit",
          reviewStatus: "approved",
          evidence: [{ evidenceId: "d1", evidenceType: "military_duty", citation: "Documented military duty: material accountability" }],
        },
      ],
    });
    expect(fit.why).toContain("Inventory Control");
    expect(fit.supporting[0]?.citations[0]).toContain("material accountability");
    expect(fit.gaps).toContain("No direct strategic sourcing experience documented.");
    expect(fit.jobFamilies).toEqual(["Supply Chain"]);
  });

  it("J — no evidence does not fabricate a person-specific capability", () => {
    const links: OccupationCapabilityLink[] = skills.map((skill) => ({
      id: `map-${skill.id}`,
      militaryOccupationId: "ls",
      skillId: skill.id,
      reviewStatus: "approved" as const,
      evidenceReference: "general logistics duties",
      mappingQuality: "development_fixture",
    }));
    expect(proposeCapabilitiesFromEvidence({ evidence: [], skills, occupationLinks: links, tourOccupationIds: ["ls"] })).toEqual([]);
    expect(proposeCapabilitiesFromEvidence({
      evidence: [{ id: "c1", type: "clearance", text: "Secret clearance" }],
      skills,
      occupationLinks: links,
      tourOccupationIds: ["ls"],
    })).toEqual([]);
  });

  it("K — existing occupation-to-title mappings stay readable and pending titles stay hidden", () => {
    const view = hiringManagerTranslation({
      branch: "navy",
      occupationCode: "LS",
      occupationTitle: "Logistics Specialist",
      transferableSkillNames: ["Inventory Control"],
      civilianRoles: [
        { title: "Supply Chain Specialist", explanation: "Stored title mapping", reviewStatus: "approved", source: "development_fixture" },
        { title: "Unreviewed title", explanation: "Draft", reviewStatus: "pending" },
      ],
    });
    expect(view.roles.map((role) => role.title)).toEqual(["Supply Chain Specialist"]);
    expect(view.civilianTranslation.strongAlignment).toEqual(["Inventory Control"]);
  });

  it("L — recruiter permissions are unchanged", () => {
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("opportunities.read");
    expect(ROLE_PERMISSIONS.recruiter).toContain("candidates.write");
    expect(ROLE_PERMISSIONS.recruiter).toContain("military.read");
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("military.review");
  });

  it("N — translation does not add a candidate-job rank", () => {
    const before = scoreCandidateJobMatch({
      jobTitle: "Materials Manager",
      jobSkillNames: ["Inventory Control"],
      candidateName: "Fixture Sailor",
      experienceTitles: [],
      candidateSkillNames: ["Inventory Control"],
      militaryOccupationTitle: "Logistics Specialist",
      militarySkillNames: ["Inventory Control"],
    });
    const after = scoreCandidateJobMatch({
      jobTitle: "Materials Manager",
      jobSkillNames: ["Inventory Control"],
      candidateName: "Fixture Sailor",
      experienceTitles: [],
      candidateSkillNames: ["Inventory Control"],
      militaryOccupationTitle: "Logistics Specialist",
      militarySkillNames: ["Inventory Control"],
    });
    expect(after).toEqual(before);
    expect(countsTowardMatching(null)).toBe(true);
    expect(countsTowardMatching("resume")).toBe(true);
    expect(countsTowardMatching("capability_translation")).toBe(false);
    const fit = explainOccupationFit({
      occupationId: "mat",
      title: "Materials Management",
      occupationSkills: [],
      capabilities: [],
    });
    expect(fit).not.toHaveProperty("rankScore");
    expect(fit).not.toHaveProperty("overall");
  });

  it("rejects agent self-approval and strips restricted PII from model context", () => {
    expect(() =>
      assertCapabilityReview({
        actorType: "agent",
        originatingAgentId: "agent-1",
        reviewerUserId: "user-1",
        nextStatus: "approved",
      }),
    ).toThrow(/cannot approve/);
    const prompt = buildTranslationPrompt({
      occupationLabel: "Navy LS",
      evidence: [{ id: "d1", type: "military_duty", text: "Email sailor@example.test and call 555-010-0199 about $85000 inventory" }],
      skills,
    });
    expect(prompt).not.toContain("sailor@example.test");
    expect(prompt).not.toContain("555-010-0199");
    expect(prompt).not.toContain("$85000");
    expect(prompt).toContain("d1");
  });

  it("drops model output that invents a skill or omits evidence", async () => {
    const drafted = await draftCapabilitySuggestions({
      evidence: [{ id: "d1", type: "military_duty", text: "Prepared meals for the crew" }],
      skills,
      complete: async () => ({
        text: JSON.stringify({
          capabilities: [
            { skillSlug: "not-a-skill", evidenceIds: ["d1"], citation: "Invented" },
            { skillSlug: "inventory-control", evidenceIds: [], citation: "No evidence" },
            { skillSlug: "inventory-control", evidenceIds: ["missing"], citation: "Bad citation" },
          ],
        }),
        provider: "test",
        model: "test-model",
      }),
    });
    expect(drafted.proposals).toEqual([]);
    expect(drafted.usedDeterministicFallback).toBe(true);
  });

  it("uses deterministic pending drafts when the provider fails", async () => {
    const drafted = await draftCapabilitySuggestions({
      evidence: [{ id: "d1", type: "military_duty", text: "Maintained inventory control" }],
      skills,
      complete: async () => {
        throw new Error("provider unavailable");
      },
    });
    expect(drafted.usedDeterministicFallback).toBe(true);
    expect(drafted.proposals.map((row) => row.skillSlug)).toEqual(["inventory-control"]);
    expect(drafted.proposals[0]?.reviewStatus).toBe("pending");
  });

  it("does not copy a pending occupation mapping onto a person", () => {
    const proposals = proposeCapabilitiesFromEvidence({
      evidence: [{ id: "d1", type: "military_duty", text: "Ordered stock for the division" }],
      skills,
      tourOccupationIds: ["ls"],
      occupationLinks: [
        {
          id: "map-1",
          militaryOccupationId: "ls",
          skillId: "sourcing",
          reviewStatus: "pending",
          evidenceReference: "ordered stock",
          mappingQuality: "development_fixture",
        },
      ],
    });
    expect(proposals.find((row) => row.skillSlug === "strategic-sourcing")).toBeUndefined();
  });
});
