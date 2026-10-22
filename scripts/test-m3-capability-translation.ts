import "./load-env";

import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";

import { getDb } from "../db";
import {
  auditEvents,
  candidateJobMatches,
  candidateMilitaryDuties,
  candidateMilitaryExperiences,
  candidateSkillEvidence,
  candidateSkills,
  candidates,
  civilianOccupationJobFamilies,
  civilianOccupations,
  jobFamilies,
  militaryCivilianMappings,
  militaryOccupationSkills,
  militaryOccupations,
  occupationSkills,
  organizations,
  skills,
  users,
} from "../db/schema";
import {
  draftCandidateCapabilities,
  reviewCandidateCapability,
  saveCapabilityDrafts,
  CapabilityProfileError,
} from "../lib/military-talent/capability-profile";
import {
  countsTowardMatching,
  explainOccupationFit,
  proposeCapabilitiesFromEvidence,
} from "../lib/military/capability-translation";
import { hiringManagerTranslation } from "../lib/military/translator";
import { ROLE_PERMISSIONS } from "../lib/rbac/permissions";
import { assertDevSeedAllowed } from "../lib/seed/guards";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  assertDevSeedAllowed();
  const branch = process.env.NEON_BRANCH ?? "";
  if (/prod/i.test(branch) || process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing the M3 capability translation test against production.");
  }

  const db = getDb();
  const suffix = randomUUID().slice(0, 8);
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userA = randomUUID();
  const candidateA = randomUUID();
  const candidateB = randomUUID();
  const occupationId = randomUUID();
  const otherOccupationId = randomUUID();
  const skillId = randomUUID();
  const civilianId = randomUUID();
  const createdSkillIds = [skillId];

  async function cleanup() {
    const skillRows = await db
      .select({ id: candidateSkills.id })
      .from(candidateSkills)
      .where(inArray(candidateSkills.organizationId, [orgA, orgB]));
    const skillRowIds = skillRows.map((row) => row.id);
    if (skillRowIds.length) {
      await db.delete(candidateSkillEvidence).where(inArray(candidateSkillEvidence.candidateSkillId, skillRowIds));
    }
    await db.delete(candidateSkills).where(inArray(candidateSkills.organizationId, [orgA, orgB]));
    await db.delete(candidateMilitaryDuties).where(inArray(candidateMilitaryDuties.organizationId, [orgA, orgB]));
    await db.delete(candidateMilitaryExperiences).where(inArray(candidateMilitaryExperiences.organizationId, [orgA, orgB]));
    await db.delete(candidateJobMatches).where(inArray(candidateJobMatches.candidateId, [candidateA, candidateB]));
    await db.delete(candidates).where(inArray(candidates.organizationId, [orgA, orgB]));
    await db.delete(militaryCivilianMappings).where(eq(militaryCivilianMappings.militaryOccupationId, occupationId));
    await db.delete(militaryOccupationSkills).where(inArray(militaryOccupationSkills.militaryOccupationId, [occupationId, otherOccupationId]));
    await db.delete(occupationSkills).where(eq(occupationSkills.occupationId, civilianId));
    await db.delete(civilianOccupationJobFamilies).where(eq(civilianOccupationJobFamilies.occupationId, civilianId));
    await db.delete(civilianOccupations).where(eq(civilianOccupations.id, civilianId));
    await db.delete(militaryOccupations).where(inArray(militaryOccupations.id, [occupationId, otherOccupationId]));
    await db.delete(skills).where(inArray(skills.id, createdSkillIds));
    await db.delete(auditEvents).where(inArray(auditEvents.organizationId, [orgA, orgB]));
    await db.delete(users).where(inArray(users.organizationId, [orgA, orgB]));
    await db.delete(organizations).where(inArray(organizations.id, [orgA, orgB]));
  }

  try {
    const [family] = await db.select().from(jobFamilies).where(eq(jobFamilies.slug, "supply-chain")).limit(1);
    assert(family, "job_families supply-chain vocabulary is present");

    await db.insert(organizations).values([
      { id: orgA, name: "M3 Translation A", slug: `m3-a-${suffix}` },
      { id: orgB, name: "M3 Translation B", slug: `m3-b-${suffix}` },
    ]);
    await db.insert(users).values({
      id: userA,
      organizationId: orgA,
      email: `m3-${suffix}@workforceos.test`,
      fullName: "M3 Reviewer",
      status: "active",
    });
    await db.insert(skills).values({
      id: skillId,
      slug: `m3-inventory-${suffix}`,
      name: "Inventory Control",
      source: "development_fixture",
      sourceVersion: "m3-smoke",
    });
    await db.insert(militaryOccupations).values([
      {
        id: occupationId,
        branch: "navy",
        classificationType: "rating",
        code: `LS${suffix}`,
        title: "Logistics Specialist",
        mappingQuality: "development_fixture",
        source: "development_fixture",
      },
      {
        id: otherOccupationId,
        branch: "army",
        classificationType: "mos",
        code: `92Y${suffix}`,
        title: "Unit Supply Specialist",
        mappingQuality: "development_fixture",
        source: "development_fixture",
      },
    ]);
    await db.insert(candidates).values([
      { id: candidateA, organizationId: orgA, fullName: "M3 Logistics Sailor", privacyClass: "restricted_pii" },
      { id: candidateB, organizationId: orgB, fullName: "M3 Other Org", privacyClass: "restricted_pii" },
    ]);
    const [tour] = await db
      .insert(candidateMilitaryExperiences)
      .values({
        organizationId: orgA,
        candidateId: candidateA,
        militaryOccupationId: occupationId,
        leadershipLevel: "Supervised a supply team",
        directReportsCount: 4,
      })
      .returning();
    const [otherTour] = await db
      .insert(candidateMilitaryExperiences)
      .values({
        organizationId: orgB,
        candidateId: candidateB,
        militaryOccupationId: otherOccupationId,
      })
      .returning();
    const [duty] = await db
      .insert(candidateMilitaryDuties)
      .values({
        organizationId: orgA,
        candidateMilitaryExperienceId: tour.id,
        title: "Inventory control",
        description: "Maintained material accountability and inventory control",
        source: "recruiter",
        humanVerified: true,
      })
      .returning();
    const [otherDuty] = await db
      .insert(candidateMilitaryDuties)
      .values({
        organizationId: orgB,
        candidateMilitaryExperienceId: otherTour.id,
        title: "Other tenant duty",
        source: "recruiter",
        humanVerified: true,
      })
      .returning();
    const [occupationSkill] = await db
      .insert(militaryOccupationSkills)
      .values({
        militaryOccupationId: occupationId,
        skillId,
        evidenceReference: "material accountability",
        source: "development_fixture",
        sourceVersion: "m3-smoke",
        reviewStatus: "approved",
        origin: "reference_data",
        mappingQuality: "development_fixture",
        confidence: 60,
      })
      .returning();
    await db.insert(civilianOccupations).values({
      id: civilianId,
      title: "Materials Management",
      code: `DEV-M3-${suffix}`,
      description: "Smoke fixture",
    });
    await db.insert(occupationSkills).values({ occupationId: civilianId, skillId });
    await db.insert(civilianOccupationJobFamilies).values({ occupationId: civilianId, jobFamilyId: family.id });
    await db.insert(militaryCivilianMappings).values({
      militaryOccupationId: occupationId,
      civilianOccupationId: civilianId,
      explanation: "Existing title mapping remains readable",
      reviewStatus: "approved",
      origin: "reference_data",
      mappingQuality: "development_fixture",
    });

    const catalog = [{ id: skillId, slug: "inventory-control", name: "Inventory Control", competencyCluster: "Supply Chain & Logistics" }];
    const evidence = [{ id: duty.id, type: "military_duty" as const, text: duty.description ?? duty.title }];
    const proposals = proposeCapabilitiesFromEvidence({
      evidence,
      skills: catalog,
      tourOccupationIds: [occupationId],
      occupationLinks: [
        {
          id: occupationSkill.id,
          militaryOccupationId: occupationId,
          skillId,
          reviewStatus: "approved",
          evidenceReference: occupationSkill.evidenceReference,
          mappingQuality: "development_fixture",
          confidence: 60,
        },
      ],
    });
    console.log("A — Navy LS evidence proposes inventory control, not only a title");
    assert(proposals.some((row) => row.skillName === "Inventory Control"), "inventory capability proposed");
    assert(proposals.every((row) => row.reviewStatus === "pending"), "drafts stay pending");
    assert(!proposals.some((row) => row.skillName === "Supply Chain Specialist"), "translation is not a single civilian title");

    const matchesBefore = await db.select({ id: candidateJobMatches.id }).from(candidateJobMatches).where(eq(candidateJobMatches.candidateId, candidateA));
    await saveCapabilityDrafts({
      organizationId: orgA,
      candidateId: candidateA,
      actorUserId: userA,
      proposals,
    });
    const stored = await db.select().from(candidateSkills).where(eq(candidateSkills.candidateId, candidateA));
    assert(stored.length === 1, "one candidate skill row for repeated evidence");
    assert(stored[0]?.reviewStatus === "pending", "saved capability is pending");
    assert(stored[0]?.source === "capability_translation", "translation source is marked");
    assert(countsTowardMatching(stored[0]?.source) === false, "translation rows do not count toward matching");
    const evidenceRows = await db.select().from(candidateSkillEvidence).where(eq(candidateSkillEvidence.candidateSkillId, stored[0].id));
    assert(evidenceRows.length >= 1, "evidence citation stored");
    console.log("I — evidence provenance is stored");
    assert(evidenceRows.some((row) => row.citation.toLowerCase().includes("inventory") || row.citation.toLowerCase().includes("accountability")), "citation names the evidence");

    console.log("F — provider draft stays pending");
    const drafted = await draftCandidateCapabilities({
      organizationId: orgA,
      candidateId: candidateA,
      actorUserId: userA,
    });
    assert(drafted.proposals.every((row) => row.reviewStatus === "pending" && row.employerFacing === false), "provider output is pending");
    const stillPending = await db.select().from(candidateSkills).where(eq(candidateSkills.id, stored[0].id));
    assert(stillPending[0]?.reviewStatus === "pending", "drafting again does not auto-approve");

    console.log("G — human approval is employer-facing");
    let agentRejected = false;
    try {
      await reviewCandidateCapability({
        organizationId: orgA,
        actorUserId: userA,
        candidateSkillId: stored[0].id,
        status: "approved",
        actorType: "agent",
      });
    } catch (error) {
      agentRejected = error instanceof Error && /cannot approve/.test(error.message);
    }
    assert(agentRejected, "originating-style agent approval is rejected");
    await reviewCandidateCapability({
      organizationId: orgA,
      actorUserId: userA,
      candidateSkillId: stored[0].id,
      status: "approved",
      actorType: "human",
      citation: "Documented military duty: material accountability and inventory control",
    });
    const approved = await db.select().from(candidateSkills).where(eq(candidateSkills.id, stored[0].id));
    assert(approved[0]?.reviewStatus === "approved" && approved[0]?.humanVerified === true, "human review approves the capability");
    const fit = explainOccupationFit({
      occupationId: civilianId,
      title: "Materials Management",
      jobFamilies: [family.name],
      occupationSkills: [
        { skillId, name: "Inventory Control" },
        { skillId: "missing-sourcing", name: "Strategic Sourcing" },
      ],
      capabilities: [
        {
          skillId,
          skillSlug: "inventory-control",
          skillName: "Inventory Control",
          basis: "explicit",
          reviewStatus: "approved",
          evidence: evidenceRows.map((row) => ({
            evidenceId: row.dutyId ?? row.id,
            evidenceType: row.evidenceType,
            citation: row.citation,
          })),
        },
      ],
    });
    assert(fit.employerFacing, "approved capability is employer-facing");
    assert(fit.why.includes("Inventory Control"), "explanation names the capability");
    assert(fit.gaps.some((gap) => gap.includes("strategic sourcing")), "gap stays explicit");

    console.log("H — rejected capability is excluded");
    await reviewCandidateCapability({
      organizationId: orgA,
      actorUserId: userA,
      candidateSkillId: stored[0].id,
      status: "rejected",
      actorType: "human",
    });
    const rejectedFit = explainOccupationFit({
      occupationId: civilianId,
      title: "Materials Management",
      occupationSkills: [{ skillId, name: "Inventory Control" }],
      capabilities: [
        {
          skillId,
          skillSlug: "inventory-control",
          skillName: "Inventory Control",
          basis: "explicit",
          reviewStatus: "rejected",
          evidence: [],
        },
      ],
    });
    assert(!rejectedFit.employerFacing, "rejected capability is not employer-facing");

    console.log("J — no evidence does not create a capability");
    const bareCandidate = randomUUID();
    await db.insert(candidates).values({
      id: bareCandidate,
      organizationId: orgA,
      fullName: "M3 No Evidence",
      privacyClass: "restricted_pii",
    });
    const emptyDraft = await draftCandidateCapabilities({
      organizationId: orgA,
      candidateId: bareCandidate,
      actorUserId: userA,
    });
    assert(emptyDraft.proposals.length === 0, "no evidence produces no proposals");
    const bareSkills = await db.select().from(candidateSkills).where(eq(candidateSkills.candidateId, bareCandidate));
    assert(bareSkills.length === 0, "no capability row was fabricated");

    console.log("K — title mappings remain readable");
    const [mapping] = await db
      .select()
      .from(militaryCivilianMappings)
      .where(eq(militaryCivilianMappings.militaryOccupationId, occupationId));
    const view = hiringManagerTranslation({
      branch: "navy",
      occupationCode: `LS${suffix}`,
      occupationTitle: "Logistics Specialist",
      transferableSkillNames: [],
      civilianRoles: [
        {
          title: "Materials Management",
          explanation: mapping.explanation,
          reviewStatus: mapping.reviewStatus,
        },
      ],
    });
    assert(view.roles.length === 1, "approved title mapping is still readable");

    console.log("L — recruiter permissions unchanged");
    assert(!ROLE_PERMISSIONS.recruiter.includes("opportunities.read"), "recruiter lacks opportunities.read");
    assert(ROLE_PERMISSIONS.recruiter.includes("candidates.write"), "recruiter keeps candidates.write");

    console.log("M — cross-tenant evidence is rejected by the database");
    let repoRejected = false;
    try {
      await saveCapabilityDrafts({
        organizationId: orgB,
        candidateId: candidateA,
        actorUserId: userA,
        proposals,
      });
    } catch (error) {
      repoRejected = error instanceof CapabilityProfileError;
    }
    assert(repoRejected, "repository rejects another organization's candidate");
    let rawSkillRejected = false;
    try {
      await db.execute(sql`
        insert into candidate_skills (
          organization_id, candidate_id, skill_id, capability_basis, review_status, human_verified
        ) values (
          ${orgB}::uuid, ${candidateA}::uuid, ${skillId}::uuid, 'explicit', 'pending', false
        )
      `);
    } catch {
      rawSkillRejected = true;
    }
    assert(rawSkillRejected, "database rejects a cross-organization candidate skill");
    let rawEvidenceRejected = false;
    try {
      await db.execute(sql`
        insert into candidate_skill_evidence (
          organization_id, candidate_skill_id, evidence_type, citation, source, duty_id
        ) values (
          ${orgA}::uuid, ${stored[0].id}::uuid, 'military_duty', 'wrong tenant duty', 'recruiter', ${otherDuty.id}::uuid
        )
      `);
    } catch {
      rawEvidenceRejected = true;
    }
    assert(rawEvidenceRejected, "database rejects cross-organization duty evidence");

    console.log("N — matching rows are unchanged");
    const matchesAfter = await db.select({ id: candidateJobMatches.id }).from(candidateJobMatches).where(eq(candidateJobMatches.candidateId, candidateA));
    assert(matchesAfter.length === matchesBefore.length, "translation did not write candidate job matches");

    const audits = await db.select().from(auditEvents).where(eq(auditEvents.organizationId, orgA));
    assert(audits.some((row) => row.action === "candidate_capability.reviewed"), "review is audited");
    console.log("M3 capability translation smoke passed");
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
