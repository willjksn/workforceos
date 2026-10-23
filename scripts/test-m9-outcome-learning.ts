import "./load-env";

import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { getDb } from "../db";
import {
  auditEvents,
  candidateJobMatchFactors,
  candidateJobMatches,
  candidateSkillEvidence,
  candidateSkills,
  candidates,
  companies,
  jobFamilies,
  jobRequirements,
  jobs,
  militaryOccupationSkills,
  militaryOccupations,
  opportunityEngagements,
  organizations,
  outcomeLearningRecommendations,
  skills,
  users,
} from "../db/schema";
import { loadOutcomeReport } from "../lib/outcome-learning/load";
import { recordRecommendationReview, reviewStoredRecommendation } from "../lib/outcome-learning/review";
import { assertDevSeedAllowed } from "../lib/seed/guards";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  assertDevSeedAllowed();
  const branch = process.env.NEON_BRANCH ?? "";
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";
  if (branch !== "development" || /prod/i.test(branch) || /prod/i.test(url) || process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing the M9 outcome learning test outside the Neon development branch.");
  }

  const db = getDb();
  const suffix = randomUUID().slice(0, 8);
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  const companyA = randomUUID();
  const companyB = randomUUID();
  const familyId = randomUUID();
  const plcId = randomUUID();
  const electricalId = randomUUID();
  const pendingSkillId = randomUUID();
  const occupationId = randomUUID();
  const mappingId = randomUUID();
  const clientJob = randomUUID();
  const publicJob = randomUUID();
  const otherJob = randomUUID();
  const licenseId = randomUUID();
  const familyRequirementId = randomUUID();
  const now = new Date();
  const recent = new Date(now.getTime() - 2 * 86_400_000);
  const older = new Date(now.getTime() - 8 * 86_400_000);
  const followUp = new Date(now.getTime() - 86_400_000);

  const clientCandidateIds = Array.from({ length: 18 }, () => randomUUID());
  const publicCandidateIds = Array.from({ length: 5 }, () => randomUUID());
  const otherCandidateIds = Array.from({ length: 6 }, () => randomUUID());
  const clientMatchIds = clientCandidateIds.map(() => randomUUID());
  const publicMatchIds = publicCandidateIds.map(() => randomUUID());
  const otherMatchIds = otherCandidateIds.map(() => randomUUID());
  const ignoredMatch = randomUUID();
  const ignoredCandidate = randomUUID();

  async function cleanup() {
    const orgs = [orgA, orgB];
    const people = [...clientCandidateIds, ...publicCandidateIds, ...otherCandidateIds, ignoredCandidate];
    await db.delete(outcomeLearningRecommendations).where(inArray(outcomeLearningRecommendations.organizationId, orgs));
    await db.delete(auditEvents).where(inArray(auditEvents.organizationId, orgs));
    await db.delete(candidateSkillEvidence).where(inArray(candidateSkillEvidence.organizationId, orgs));
    await db.delete(candidateJobMatchFactors).where(inArray(candidateJobMatchFactors.organizationId, orgs));
    await db.delete(opportunityEngagements).where(inArray(opportunityEngagements.organizationId, orgs));
    await db.delete(candidateJobMatches).where(inArray(candidateJobMatches.organizationId, orgs));
    await db.delete(jobRequirements).where(inArray(jobRequirements.organizationId, orgs));
    await db.delete(candidateSkills).where(inArray(candidateSkills.organizationId, orgs));
    await db.delete(jobs).where(inArray(jobs.organizationId, orgs));
    await db.delete(candidates).where(inArray(candidates.id, people));
    await db.delete(companies).where(inArray(companies.organizationId, orgs));
    await db.delete(users).where(inArray(users.organizationId, orgs));
    await db.delete(organizations).where(inArray(organizations.id, orgs));
    await db.delete(militaryOccupationSkills).where(eq(militaryOccupationSkills.id, mappingId));
    await db.delete(militaryOccupations).where(eq(militaryOccupations.id, occupationId));
    await db.delete(skills).where(inArray(skills.id, [plcId, electricalId, pendingSkillId]));
    await db.delete(jobFamilies).where(eq(jobFamilies.id, familyId));
  }

  try {
    await db.insert(organizations).values([
      { id: orgA, name: "M9 Outcome A", slug: `m9-a-${suffix}` },
      { id: orgB, name: "M9 Outcome B", slug: `m9-b-${suffix}` },
    ]);
    await db.insert(users).values([
      { id: userA, organizationId: orgA, email: `m9-a-${suffix}@workforceos.test`, fullName: "M9 Reviewer A", status: "active" },
      { id: userB, organizationId: orgB, email: `m9-b-${suffix}@workforceos.test`, fullName: "M9 Reviewer B", status: "active" },
    ]);
    await db.insert(companies).values([
      { id: companyA, organizationId: orgA, name: "Harbor Instruments", clientStatus: "active" },
      { id: companyB, organizationId: orgB, name: "Other Harbor", clientStatus: "active" },
    ]);
    await db.insert(jobFamilies).values({ id: familyId, slug: `m9-instrumentation-${suffix}`, name: "Instrumentation & Controls" });
    await db.insert(skills).values([
      { id: plcId, slug: `m9-plc-${suffix}`, name: "PLC Programming" },
      { id: electricalId, slug: `m9-electrical-${suffix}`, name: "Electrical Troubleshooting" },
      { id: pendingSkillId, slug: `m9-pending-${suffix}`, name: "Unapproved Capability" },
    ]);
    await db.insert(militaryOccupations).values({
      id: occupationId,
      branch: "navy",
      classificationType: "rating",
      code: `EM-${suffix}`,
      title: "Electrician's Mate",
    });
    await db.insert(militaryOccupationSkills).values({
      id: mappingId,
      militaryOccupationId: occupationId,
      skillId: electricalId,
      reviewStatus: "pending",
      origin: "reference_data",
    });
    await db.insert(jobs).values([
      { id: clientJob, organizationId: orgA, companyId: companyA, title: "Instrumentation technician", status: "open", jobContextType: "client" },
      { id: publicJob, organizationId: orgA, companyId: companyA, title: "Public instrumentation", status: "open", jobContextType: "monitored_public" },
      { id: otherJob, organizationId: orgB, companyId: companyB, title: "Other org role", status: "open", jobContextType: "client" },
    ]);
    await db.insert(jobRequirements).values([
      {
        id: familyRequirementId,
        organizationId: orgA,
        jobId: clientJob,
        kind: "job_family",
        requirementType: "required",
        label: "Instrumentation & Controls",
        requirementSource: "recruiter_entry",
        reviewStatus: "approved",
      },
      {
        id: licenseId,
        organizationId: orgA,
        jobId: clientJob,
        kind: "license",
        requirementType: "required",
        label: "State electrician license",
        requirementSource: "recruiter_entry",
        reviewStatus: "approved",
      },
      {
        organizationId: orgA,
        jobId: publicJob,
        kind: "job_family",
        requirementType: "required",
        label: "Instrumentation & Controls",
        requirementSource: "recruiter_entry",
        reviewStatus: "approved",
      },
    ]);

    const clientOutcomes = [
      ...Array.from({ length: 6 }, () => "no_fit" as const),
      "interview",
      "interview",
      "placed",
      "no_response",
      "declined",
      ...Array.from({ length: 5 }, () => "interested" as const),
      "developmental",
      "developmental",
    ];
    await db.insert(candidates).values([
      ...clientCandidateIds.map((id, index) => ({
        id,
        organizationId: orgA,
        fullName: `M9 Client ${index}`,
        email: `m9-client-${index}-${suffix}@workforceos.test`,
        phone: "704-555-0199",
        compensationExpectations: "hidden",
        militaryStatus: index < 6 ? "veteran" as const : "none" as const,
        consentStatus: "granted" as const,
      })),
      ...publicCandidateIds.map((id, index) => ({
        id,
        organizationId: orgA,
        fullName: `M9 Public ${index}`,
        email: `m9-public-${index}-${suffix}@workforceos.test`,
        militaryStatus: "none" as const,
        consentStatus: "granted" as const,
      })),
      ...otherCandidateIds.map((id, index) => ({
        id,
        organizationId: orgB,
        fullName: `M9 Other ${index}`,
        email: `m9-other-${index}-${suffix}@workforceos.test`,
        militaryStatus: "veteran" as const,
        consentStatus: "granted" as const,
      })),
      { id: ignoredCandidate, organizationId: orgA, fullName: "No current", email: `m9-none-${suffix}@workforceos.test`, militaryStatus: "none" as const, consentStatus: "granted" as const },
    ]);

    await db.insert(candidateJobMatches).values([
      ...clientMatchIds.map((id, index) => ({
        id,
        organizationId: orgA,
        candidateId: clientCandidateIds[index]!,
        jobId: clientJob,
        score: "81.00",
        matchCategory: clientOutcomes[index] === "developmental" ? "developmental_match" as const : index >= 11 && index < 16 ? "possible_match" as const : "strong_match" as const,
        freshness: "current" as const,
        recruiterDisposition: "viable" as const,
        lastCalculatedAt: recent,
      })),
      ...publicMatchIds.map((id, index) => ({
        id,
        organizationId: orgA,
        candidateId: publicCandidateIds[index]!,
        jobId: publicJob,
        score: "77.00",
        matchCategory: "strong_match" as const,
        freshness: "current" as const,
        recruiterDisposition: "viable" as const,
        lastCalculatedAt: older,
      })),
      ...otherMatchIds.map((id, index) => ({
        id,
        organizationId: orgB,
        candidateId: otherCandidateIds[index]!,
        jobId: otherJob,
        score: "90.00",
        matchCategory: "strong_match" as const,
        freshness: "current" as const,
        recruiterDisposition: "viable" as const,
        lastCalculatedAt: recent,
      })),
      {
        id: ignoredMatch,
        organizationId: orgA,
        candidateId: ignoredCandidate,
        jobId: clientJob,
        score: "10.00",
        matchCategory: "no_current_match" as const,
        freshness: "current" as const,
        lastCalculatedAt: recent,
      },
    ]);

    const engagementRows = [
      ...clientMatchIds.flatMap((matchId, index) => {
        const outcome = clientOutcomes[index];
        if (outcome === "developmental") return [];
        const status = outcome === "no_fit"
          ? "no_fit"
          : outcome === "interview"
            ? "interview"
            : outcome === "placed"
              ? "placed"
              : outcome === "no_response"
                ? "contacted"
                : outcome === "declined"
                  ? "withdrawn"
                  : "interested";
        return [{
          organizationId: orgA,
          matchId,
          candidateId: clientCandidateIds[index]!,
          jobId: clientJob,
          companyId: companyA,
          mode: "authorized_routing" as const,
          status,
          ownerUserId: userA,
          employerResponse: outcome === "no_fit"
            ? "not_a_fit" as const
            : outcome === "no_response"
              ? "no_response" as const
              : outcome === "interested"
                ? "interested" as const
                : null,
          candidateResponse: outcome === "declined" ? "declined" as const : null,
          openedAt: recent,
          lastActivityAt: recent,
        }];
      }),
      ...publicMatchIds.map((matchId, index) => ({
        organizationId: orgA,
        matchId,
        candidateId: publicCandidateIds[index]!,
        jobId: publicJob,
        companyId: companyA,
        mode: "public_outreach" as const,
        status: "contacted",
        ownerUserId: userA,
        employerResponse: "no_response" as const,
        openedAt: older,
        lastActivityAt: older,
        nextFollowUpAt: followUp,
      })),
      ...otherMatchIds.map((matchId, index) => ({
        organizationId: orgB,
        matchId,
        candidateId: otherCandidateIds[index]!,
        jobId: otherJob,
        companyId: companyB,
        mode: "authorized_routing" as const,
        status: "placed",
        ownerUserId: userB,
        openedAt: recent,
        lastActivityAt: recent,
      })),
    ];
    await db.insert(opportunityEngagements).values(engagementRows);

    const noFitMatches = clientMatchIds.slice(0, 6);
    await db.insert(candidateJobMatchFactors).values(noFitMatches.flatMap((matchId) => ([
      {
        organizationId: orgA,
        matchId,
        factorGroup: "documented_gap",
        dimension: "capability",
        label: "PLC Programming",
      },
      {
        organizationId: orgA,
        matchId,
        factorGroup: "documented_gap",
        dimension: "credential",
        label: "State electrician license",
      },
    ])));

    const skillRows = clientCandidateIds.slice(0, 9).map((candidateId) => ({
      id: randomUUID(),
      organizationId: orgA,
      candidateId,
      skillId: electricalId,
      reviewStatus: "approved" as const,
      capabilityBasis: "explicit" as const,
    }));
    const pendingRow = {
      id: randomUUID(),
      organizationId: orgA,
      candidateId: clientCandidateIds[8]!,
      skillId: pendingSkillId,
      reviewStatus: "pending" as const,
      capabilityBasis: "inferred" as const,
    };
    await db.insert(candidateSkills).values([...skillRows, pendingRow]);
    await db.insert(candidateSkillEvidence).values(skillRows.map((row) => ({
      organizationId: orgA,
      candidateSkillId: row.id,
      evidenceType: "occupation_mapping" as const,
      citation: "Navy EM tour notes",
      source: "recruiter" as const,
      militaryOccupationSkillId: mappingId,
    })));

    const before = await db.select().from(candidateJobMatches).where(eq(candidateJobMatches.id, clientMatchIds[0]!));
    const report = await loadOutcomeReport({ organizationId: orgA, window: "90d", now });
    const strongClient = report.matchPerformance.find((item) => item.category === "strong_match" && item.context === "client_routing");
    const possible = report.matchPerformance.find((item) => item.category === "possible_match" && item.context === "client_routing");
    const developmental = report.matchPerformance.find((item) => item.category === "developmental_match" && item.context === "client_routing");
    const publicStrong = report.matchPerformance.find((item) => item.category === "strong_match" && item.context === "public_outreach");
    assert(strongClient, "A. Strong Match performance is missing.");
    assert(strongClient.sample === 11, `A. Expected 11 Strong Matches, saw ${strongClient.sample}.`);
    assert(strongClient.interview.denominator === 11, "A. Interview rate is missing its denominator.");
    assert(strongClient.interview.numerator === 2, `G. Expected 2 interviews, saw ${strongClient.interview.numerator}.`);
    assert(strongClient.placement.numerator === 1, "F. Placement was not counted.");
    assert(strongClient.noFit.numerator === 6, `E. Expected 6 Not a Fit outcomes, saw ${strongClient.noFit.numerator}.`);
    assert(strongClient.noResponse.numerator === 1, "C. No response was not kept separate.");
    assert(strongClient.candidateDeclined.numerator === 1, "D. Candidate decline was not kept separate.");
    assert(possible?.sample === 5, "B. Possible Match was not analyzed separately.");
    assert(developmental?.sample === 2 && developmental.band === "insufficient", "N. A sample under 5 was not marked insufficient.");
    assert(publicStrong?.sample === 5 && publicStrong.noResponse.numerator === 5, "H. Public outreach was mixed into client routing.");
    assert(!report.capabilitySignals.some((item) => item.skillName === "Unapproved Capability"), "J. A pending capability became learning evidence.");
    assert(report.capabilitySignals.some((item) => item.skillName === "Electrical Troubleshooting"), "K. An approved capability was missing.");
    const gap = report.factorSignals.find((item) => item.label === "PLC Programming");
    assert(gap && gap.numerator === 6 && gap.denominator >= 5, "O. The PLC gap did not surface with its count.");
    const mapping = report.mappingSignals.find((item) => item.mappingId === mappingId);
    assert(mapping && mapping.noFit === 6 && mapping.reviewStatus === "pending", "L. Mapping counts were missing or the status was changed in the read model.");
    const license = report.requirementSignals.find((item) => item.requirementId === licenseId);
    assert(license && license.gapNoFit === 6 && license.reviewStatus === "approved", "M. The requirement signal was missing or its status changed.");
    const recommendation = report.recommendations.find((item) => item.observedPattern.includes("PLC Programming"));
    assert(recommendation, "P. No PLC recommendation was drafted.");
    assert(recommendation.sampleCount >= 5, "P. Recommendation sample is missing.");
    assert(recommendation.observedPattern.includes("the last 90 days"), "P. Recommendation window is missing.");
    assert(recommendation.sourceRecords.includes("candidate_job_match_factors"), "P. Recommendation source is missing.");
    assert(!JSON.stringify(report).includes(`m9-client-0-${suffix}@workforceos.test`), "S. Aggregate report included an email address.");
    assert(!JSON.stringify(report).includes("704-555-0199"), "S. Aggregate report included a phone number.");
    assert(!JSON.stringify(report).includes("hidden"), "S. Aggregate report included compensation.");
    const military = report.funnels.find((item) => item.context === "client_routing" && item.program === "military");
    const other = report.funnels.find((item) => item.context === "client_routing" && item.program === "other");
    assert(military && other, "I. Military and other Talent Network funnels were not both present.");
    assert(!("candidateId" in military), "I. A program funnel carried a candidate ranking.");

    const saved = await recordRecommendationReview({
      organizationId: orgA,
      actorUserId: userA,
      timeWindow: "90d",
      windowStart: new Date(report.windowStart ?? now.toISOString()),
      windowEnd: new Date(report.windowEnd),
      reviewState: "accepted_as_note",
      reviewNote: "Noted for the instrumentation conversation.",
      draft: recommendation,
    });
    assert(saved?.reviewState === "accepted_as_note", "P. The recommendation was not stored.");
    const [after] = await db.select().from(candidateJobMatches).where(eq(candidateJobMatches.id, clientMatchIds[0]!));
    assert(after?.matchCategory === before[0]?.matchCategory && after?.score === before[0]?.score, "Q. Accepting a recommendation changed the match.");
    const [mappingAfter] = await db.select().from(militaryOccupationSkills).where(eq(militaryOccupationSkills.id, mappingId));
    assert(mappingAfter?.reviewStatus === "pending", "L. Mapping review status changed.");
    const [licenseAfter] = await db.select().from(jobRequirements).where(eq(jobRequirements.id, licenseId));
    assert(licenseAfter?.reviewStatus === "approved", "M. Requirement status changed.");
    const [audit] = await db.select().from(auditEvents).where(eq(auditEvents.recordId, saved.id));
    assert(audit?.action === "outcome_recommendation.accepted_as_note", "Audit row missing.");

    const foreign = await recordRecommendationReview({
      organizationId: orgB,
      actorUserId: userB,
      timeWindow: "90d",
      windowStart: null,
      windowEnd: now,
      reviewState: "reviewing",
      reviewNote: null,
      draft: {
        ...recommendation,
        recommendationType: "INSUFFICIENT_DATA",
        subjectKey: `foreign-${suffix}`,
        sampleCount: 1,
        evidenceBand: "insufficient",
      },
    });
    assert(foreign, "Org B recommendation insert failed.");
    const leaked = await reviewStoredRecommendation({
      organizationId: orgA,
      actorUserId: userA,
      recommendationId: foreign.id,
      reviewState: "dismissed",
    });
    assert(leaked === null, "R. Another organization's recommendation was reviewable.");
    const orgBReport = await loadOutcomeReport({ organizationId: orgB, window: "90d", now });
    const orgBPlacements = orgBReport.matchPerformance.find((item) => item.category === "strong_match" && item.context === "client_routing");
    assert(orgBPlacements?.placement.numerator === 6, "R. Org B placements were not isolated.");
    assert(strongClient.placement.numerator === 1, "R. Org A placement count included another organization.");

    console.log("M9 outcome learning smoke passed.");
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
