import "./load-env";

import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { getDb } from "../db";
import {
  auditEvents,
  candidateJobMatches,
  candidateSkills,
  candidates,
  companies,
  jobRequirements,
  jobSkills,
  jobs,
  organizations,
  skills,
  users,
} from "../db/schema";
import { ROLE_PERMISSIONS } from "../lib/rbac/permissions";
import {
  OpportunityMatchError,
  draftJobRequirements,
  listCandidateOpportunityMatches,
  listJobTalentMatches,
  recalculateCandidateOpportunities,
  recalculateJobTalent,
  setMatchDisposition,
} from "../lib/recruiting/opportunity-matching";
import { assertDevSeedAllowed } from "../lib/seed/guards";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  assertDevSeedAllowed();
  const branch = process.env.NEON_BRANCH ?? "";
  if (/prod/i.test(branch) || process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing the M5 opportunity matching test against production.");
  }

  const db = getDb();
  const suffix = randomUUID().slice(0, 8);
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userA = randomUUID();
  const companyA = randomUUID();
  const candidateA = randomUUID();
  const candidateB = randomUUID();
  const skillId = randomUUID();
  const jobA = randomUUID();
  const jobB = randomUUID();
  const closedJob = randomUUID();

  async function cleanup() {
    const jobIds = [jobA, jobB, closedJob];
    await db.delete(candidateJobMatches).where(inArray(candidateJobMatches.jobId, jobIds));
    await db.delete(jobRequirements).where(inArray(jobRequirements.organizationId, [orgA, orgB]));
    await db.delete(jobSkills).where(inArray(jobSkills.jobId, jobIds));
    await db.delete(jobs).where(inArray(jobs.organizationId, [orgA, orgB]));
    await db.delete(candidateSkills).where(inArray(candidateSkills.organizationId, [orgA, orgB]));
    await db.delete(candidates).where(inArray(candidates.organizationId, [orgA, orgB]));
    await db.delete(companies).where(inArray(companies.organizationId, [orgA, orgB]));
    await db.delete(auditEvents).where(inArray(auditEvents.organizationId, [orgA, orgB]));
    await db.delete(skills).where(eq(skills.id, skillId));
    await db.delete(users).where(inArray(users.organizationId, [orgA, orgB]));
    await db.delete(organizations).where(inArray(organizations.id, [orgA, orgB]));
  }

  try {
    await db.insert(organizations).values([
      { id: orgA, name: "M5 Match A", slug: `m5-a-${suffix}` },
      { id: orgB, name: "M5 Match B", slug: `m5-b-${suffix}` },
    ]);
    await db.insert(users).values({
      id: userA,
      organizationId: orgA,
      email: `m5-${suffix}@workforceos.test`,
      fullName: "M5 Operator",
      status: "active",
    });
    await db.insert(companies).values({ id: companyA, organizationId: orgA, name: "Harbor Instruments" });
    await db.insert(skills).values({
      id: skillId,
      slug: `m5-calibration-${suffix}`,
      name: "Calibration",
      source: "development_fixture",
      sourceVersion: "m5-smoke",
    });
    await db.insert(candidates).values([
      { id: candidateA, organizationId: orgA, fullName: "Navy ET Fixture", city: "Norfolk", relocationWillingness: "willing" },
      { id: candidateB, organizationId: orgB, fullName: "Other Tenant", city: "Austin" },
    ]);
    await db.insert(candidateSkills).values({
      organizationId: orgA,
      candidateId: candidateA,
      skillId,
      capabilityBasis: "explicit",
      reviewStatus: "approved",
      humanVerified: true,
      evidenceSummary: "Calibration equipment",
    });
    await db.insert(jobs).values([
      {
        id: jobA,
        organizationId: orgA,
        companyId: companyA,
        title: "Instrumentation Technician",
        status: "open",
        jobContextType: "monitored_public",
        locationLabel: "Charlotte",
        description: "Perform calibration and instrumentation troubleshooting. Secret clearance is not listed.",
        contentHash: "m5-hash-1",
        sourceUrl: "https://jobs.example.test/instrumentation",
      },
      {
        id: jobB,
        organizationId: orgB,
        title: "Other Tenant Technician",
        status: "open",
        jobContextType: "client",
      },
      {
        id: closedJob,
        organizationId: orgA,
        companyId: companyA,
        title: "Closed Public Technician",
        status: "closed",
        jobContextType: "monitored_public",
        closedAt: new Date(),
      },
    ]);
    await db.insert(jobSkills).values([
      { jobId: jobA, skillId, requirementType: "required", reviewStatus: "approved", requirementSource: "recruiter_entry" },
      { jobId: closedJob, skillId, requirementType: "required", reviewStatus: "approved", requirementSource: "recruiter_entry" },
    ]);

    console.log("Q — cross-tenant candidate is not loaded");
    let rejected = false;
    try {
      await recalculateCandidateOpportunities({ organizationId: orgA, actorUserId: userA, candidateId: candidateB });
    } catch (error) {
      rejected = error instanceof OpportunityMatchError;
    }
    assert(rejected, "organization A cannot calculate matches for organization B");

    console.log("A/R — candidate and job calculations share one result");
    const candidateRun = await recalculateCandidateOpportunities({
      organizationId: orgA,
      actorUserId: userA,
      candidateId: candidateA,
    });
    assert(candidateRun.persisted >= 1, "open job was persisted");
    const opportunities = await listCandidateOpportunityMatches(orgA, candidateA);
    assert(opportunities.some((row) => row.jobId === jobA), "open job is a current opportunity");
    assert(!opportunities.some((row) => row.jobId === closedJob), "closed job is not a current opportunity");
    assert(!opportunities.some((row) => row.jobId === jobB), "other tenant job is absent");
    const fromJob = await recalculateJobTalent({ organizationId: orgA, actorUserId: userA, jobId: jobA });
    assert(fromJob.persisted >= 1, "job calculation persisted the same candidate");
    const talent = await listJobTalentMatches(orgA, jobA);
    const card = talent.find((row) => row.candidateId === candidateA);
    const opportunity = opportunities.find((row) => row.jobId === jobA);
    assert(card && opportunity && card.category === opportunity.category, "both directions share the category");
    assert(card.contextLabel === "Public opportunity", "public job is not labeled as a client");
    assert(card.explanation.includes("Calibration"), "explanation names the aligned capability");

    console.log("S — description hash change marks the match stale");
    await db.update(jobs).set({ contentHash: "m5-hash-2", updatedAt: new Date() }).where(eq(jobs.id, jobA));
    const stale = await listCandidateOpportunityMatches(orgA, candidateA);
    const staleCard = stale.find((row) => row.jobId === jobA);
    assert(staleCard?.freshness === "stale", "changed job content is stale");

    console.log("J — reopened job can be calculated again");
    await db.update(jobs).set({ status: "open", closedAt: null, updatedAt: new Date() }).where(eq(jobs.id, closedJob));
    await recalculateCandidateOpportunities({ organizationId: orgA, actorUserId: userA, candidateId: candidateA });
    const reopened = await listCandidateOpportunityMatches(orgA, candidateA);
    assert(reopened.some((row) => row.jobId === closedJob), "reopened job is eligible");

    console.log("disposition does not change the category");
    const target = reopened.find((row) => row.jobId === jobA);
    assert(target, "instrumentation match still exists");
    const beforeCategory = target.category;
    await setMatchDisposition({
      organizationId: orgA,
      actorUserId: userA,
      matchId: target.matchId,
      disposition: "needs_information",
    });
    const [stored] = await db.select().from(candidateJobMatches).where(eq(candidateJobMatches.id, target.matchId));
    assert(stored.matchCategory === beforeCategory, "disposition leaves the calculated category");
    assert(stored.recruiterDisposition === "needs_information", "disposition is stored");

    console.log("pending draft does not become an approved requirement");
    await db.update(jobs).set({
      description: "Must have Secret clearance and 5 years of calibration experience.",
      updatedAt: new Date(),
    }).where(eq(jobs.id, jobA));
    const drafted = await draftJobRequirements({ organizationId: orgA, actorUserId: userA, jobId: jobA });
    assert(drafted.drafted >= 1, "deterministic draft was stored");
    const pending = await db.select().from(jobRequirements).where(eq(jobRequirements.jobId, jobA));
    assert(pending.every((row) => row.reviewStatus === "pending"), "drafts stay pending");
    assert(pending.every((row) => row.sourceText), "drafts cite source text");

    console.log("recruiter still lacks opportunities.read");
    assert(!ROLE_PERMISSIONS.recruiter.includes("opportunities.read"), "recruiter lacks opportunities.read");

    const audits = await db.select().from(auditEvents).where(eq(auditEvents.organizationId, orgA));
    assert(audits.some((row) => row.action === "match.recalculated"), "recalculation is audited");
    assert(audits.some((row) => row.action === "match.disposition_set"), "disposition is audited");
    console.log("M5 Neon development smoke passed");
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
