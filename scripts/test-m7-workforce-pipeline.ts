import "./load-env";

import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { getDb } from "../db";
import {
  auditEvents,
  candidateClearances,
  candidateCredentials,
  candidateJobMatches,
  candidateSkills,
  candidates,
  companies,
  companyLocations,
  educationPartners,
  interviews,
  jobFamilies,
  jobs,
  militaryOccupationSkills,
  militaryOccupations,
  opportunityEngagements,
  organizations,
  placements,
  skillbridgeProfiles,
  skills,
  users,
  workforceAssessments,
  workforceRoleCapabilityTexts,
  workforceRoleJobs,
  workforceRoleSkills,
  workforceRoles,
  workforceStrategyNotes,
} from "../db/schema";
import { CAPABILITY_TRANSLATION_SOURCE } from "../lib/military/capability-translation";
import { ROLE_PERMISSIONS } from "../lib/rbac/permissions";
import { assertDevSeedAllowed } from "../lib/seed/guards";
import { WorkforceError } from "../lib/workforce/errors";
import { addWorkforceCapabilityText, addWorkforceStrategyNote } from "../lib/workforce/pipeline-commands";
import { loadWorkforceRolePipeline } from "../lib/workforce/pipeline-supply";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function errorText(error: unknown) {
  const cause = error instanceof Error && "cause" in error ? error.cause : undefined;
  return `${error instanceof Error ? error.message : String(error)} ${cause instanceof Error ? cause.message : ""}`;
}

async function expectDatabaseReject(run: () => Promise<unknown>, message: string) {
  try {
    await run();
  } catch (error) {
    if (/23503|foreign key|violates/i.test(errorText(error))) return;
    console.error(error);
  }
  throw new Error(message);
}

async function main() {
  assertDevSeedAllowed();
  const branch = process.env.NEON_BRANCH ?? "";
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";
  if (branch !== "development" || /prod/i.test(branch) || /prod/i.test(url) || process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing the M7 workforce pipeline test outside the Neon development branch.");
  }

  const db = getDb();
  const suffix = randomUUID().slice(0, 8);
  const asOf = new Date("2026-10-22T12:00:00.000Z");
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userA = randomUUID();
  const companyA = randomUUID();
  const locationA = randomUUID();
  const familyId = randomUUID();
  const skillId = randomUUID();
  const roleId = randomUUID();
  const openJob = randomUUID();
  const activeJob = randomUUID();
  const closedJob = randomUUID();
  const approvedOccupation = randomUUID();
  const pendingOccupation = randomUUID();
  const ids = {
    veteran: randomUUID(),
    profile: randomUUID(),
    expired: randomUUID(),
    future: randomUUID(),
    norfolk: randomUUID(),
    translated: randomUUID(),
    pendingSkill: randomUUID(),
    fillerClosed: randomUUID(),
    fillerNoFit: randomUUID(),
    fillerPlaced: randomUUID(),
    fillerWeak: randomUUID(),
    fillerSoon: randomUUID(),
    archived: randomUUID(),
    deleted: randomUUID(),
    doNotContact: randomUUID(),
    pendingTranslation: randomUUID(),
    otherOrg: randomUUID(),
  };
  const matchIds = {
    veteran: randomUUID(),
    pending: randomUUID(),
    closed: randomUUID(),
    noFit: randomUUID(),
    placed: randomUUID(),
    weak: randomUUID(),
  };
  const roleB = randomUUID();
  const companyB = randomUUID();
  const jobB = randomUUID();
  const assessmentA = randomUUID();
  const assessmentB = randomUUID();
  const partnerA = randomUUID();
  const partnerB = randomUUID();
  const orgIds = [orgA, orgB];
  const candidateIds = Object.values(ids);

  async function cleanup() {
    await db.delete(opportunityEngagements).where(inArray(opportunityEngagements.organizationId, orgIds));
    await db.delete(interviews).where(inArray(interviews.candidateId, candidateIds));
    await db.delete(placements).where(inArray(placements.candidateId, candidateIds));
    await db.delete(candidateJobMatches).where(inArray(candidateJobMatches.organizationId, orgIds));
    await db.delete(workforceStrategyNotes).where(inArray(workforceStrategyNotes.organizationId, orgIds));
    await db.delete(workforceRoleCapabilityTexts).where(inArray(workforceRoleCapabilityTexts.roleId, [roleId, roleB]));
    await db.delete(workforceRoleJobs).where(inArray(workforceRoleJobs.organizationId, orgIds));
    await db.delete(workforceRoleSkills).where(inArray(workforceRoleSkills.roleId, [roleId, roleB]));
    await db.delete(workforceRoles).where(inArray(workforceRoles.organizationId, orgIds));
    await db.delete(workforceAssessments).where(inArray(workforceAssessments.organizationId, orgIds));
    await db.delete(educationPartners).where(inArray(educationPartners.organizationId, orgIds));
    await db.delete(jobs).where(inArray(jobs.organizationId, orgIds));
    await db.delete(candidateCredentials).where(inArray(candidateCredentials.candidateId, candidateIds));
    await db.delete(candidateClearances).where(inArray(candidateClearances.candidateId, candidateIds));
    await db.delete(candidateSkills).where(inArray(candidateSkills.organizationId, orgIds));
    await db.delete(skillbridgeProfiles).where(inArray(skillbridgeProfiles.organizationId, orgIds));
    await db.delete(candidates).where(inArray(candidates.organizationId, orgIds));
    await db.delete(companyLocations).where(eq(companyLocations.id, locationA));
    await db.delete(companies).where(inArray(companies.organizationId, orgIds));
    await db.delete(auditEvents).where(inArray(auditEvents.organizationId, orgIds));
    await db.delete(users).where(inArray(users.organizationId, orgIds));
    await db.delete(organizations).where(inArray(organizations.id, orgIds));
    await db.delete(militaryOccupationSkills).where(inArray(militaryOccupationSkills.militaryOccupationId, [approvedOccupation, pendingOccupation]));
    await db.delete(militaryOccupations).where(inArray(militaryOccupations.id, [approvedOccupation, pendingOccupation]));
    await db.delete(skills).where(eq(skills.id, skillId));
    await db.delete(jobFamilies).where(eq(jobFamilies.id, familyId));
  }

  try {
    await db.insert(organizations).values([
      { id: orgA, name: "M7 Pipeline A", slug: `m7-a-${suffix}` },
      { id: orgB, name: "M7 Pipeline B", slug: `m7-b-${suffix}` },
    ]);
    await db.insert(users).values({
      id: userA,
      organizationId: orgA,
      email: `m7-${suffix}@workforceos.test`,
      fullName: "M7 Planner",
      status: "active",
    });
    await db.insert(companies).values({
      id: companyA,
      organizationId: orgA,
      name: "Harbor Instruments",
      clientStatus: "active",
    });
    await db.insert(companyLocations).values({
      id: locationA,
      companyId: companyA,
      name: "Charlotte site",
      city: "Charlotte",
      region: "NC",
    });
    await db.insert(jobFamilies).values({
      id: familyId,
      slug: `m7-instrumentation-${suffix}`,
      name: "Instrumentation & Controls",
    });
    await db.insert(skills).values({
      id: skillId,
      slug: `m7-electrical-troubleshooting-${suffix}`,
      name: "Electrical Troubleshooting",
    });
    await db.insert(militaryOccupations).values([
      {
        id: approvedOccupation,
        branch: "navy",
        classificationType: "rating",
        code: `M7ET-${suffix}`,
        title: "Electronics Technician",
      },
      {
        id: pendingOccupation,
        branch: "army",
        classificationType: "mos",
        code: `M7PEND-${suffix}`,
        title: "Pending mechanic",
      },
    ]);
    await db.insert(militaryOccupationSkills).values([
      { militaryOccupationId: approvedOccupation, skillId, reviewStatus: "approved" },
      { militaryOccupationId: pendingOccupation, skillId, reviewStatus: "pending" },
    ]);
    await db.insert(workforceRoles).values({
      id: roleId,
      organizationId: orgA,
      companyId: companyA,
      title: "Instrumentation Technician",
      jobFamily: "Instrumentation shop",
      jobFamilyId: familyId,
      companyLocationId: locationA,
      demandQuantity: 20,
      demandHorizon: "future",
      planningHorizon: "0_90_days",
      demandSource: "workforce_plan",
      requiredClearanceLevel: "secret",
      minimumCredentials: "EPA 608",
    });
    await db.insert(workforceRoleSkills).values({
      roleId,
      skillId,
      requirementType: "required",
    });
    await db.insert(jobs).values([
      { id: openJob, organizationId: orgA, companyId: companyA, title: "Open instrumentation", status: "open" },
      { id: activeJob, organizationId: orgA, companyId: companyA, title: "Active instrumentation", status: "search_active" },
      { id: closedJob, organizationId: orgA, companyId: companyA, title: "Closed instrumentation", status: "closed", closedAt: asOf },
    ]);
    await db.insert(workforceRoleJobs).values([
      { organizationId: orgA, roleId, jobId: openJob, createdByUserId: userA },
      { organizationId: orgA, roleId, jobId: activeJob, createdByUserId: userA },
      { organizationId: orgA, roleId, jobId: closedJob, createdByUserId: userA },
    ]);

    const charlotte = { city: "Charlotte", region: "NC", availability: "available_now" as const };
    await db.insert(candidates).values([
      { id: ids.veteran, organizationId: orgA, fullName: "Veteran Charlotte", email: `vet-${suffix}@workforceos.test`, phone: "704-555-0101", compensationExpectations: "hidden", militaryStatus: "veteran", consentStatus: "granted", ...charlotte },
      { id: ids.profile, organizationId: orgA, fullName: "Profile Norfolk", militaryStatus: "none", city: "Norfolk", region: "VA", relocationWillingness: "no", availability: "available_now", consentStatus: "granted" },
      { id: ids.expired, organizationId: orgA, fullName: "Expired Credential", militaryStatus: "none", consentStatus: "granted", ...charlotte },
      { id: ids.future, organizationId: orgA, fullName: "Future Transition", militaryStatus: "veteran", consentStatus: "granted", ...charlotte },
      { id: ids.norfolk, organizationId: orgA, fullName: "Norfolk Civilian", militaryStatus: "none", city: "Norfolk", region: "VA", relocationWillingness: "no", availability: "unknown", consentStatus: "granted" },
      { id: ids.translated, organizationId: orgA, fullName: "Approved Translation", militaryStatus: "veteran", consentStatus: "granted", ...charlotte },
      { id: ids.pendingSkill, organizationId: orgA, fullName: "Explicit Pending", militaryStatus: "none", consentStatus: "granted", ...charlotte },
      { id: ids.fillerClosed, organizationId: orgA, fullName: "Filler Closed Match", militaryStatus: "none", consentStatus: "granted", ...charlotte },
      { id: ids.fillerNoFit, organizationId: orgA, fullName: "Filler No Fit", militaryStatus: "none", consentStatus: "granted", ...charlotte },
      { id: ids.fillerPlaced, organizationId: orgA, fullName: "Filler Placed", militaryStatus: "none", consentStatus: "granted", ...charlotte },
      { id: ids.fillerWeak, organizationId: orgA, fullName: "Filler Weak Match", militaryStatus: "none", consentStatus: "granted", ...charlotte },
      { id: ids.fillerSoon, organizationId: orgA, fullName: "Filler Soon", militaryStatus: "none", availability: "passive", city: "Charlotte", region: "NC", consentStatus: "granted" },
      { id: ids.archived, organizationId: orgA, fullName: "Archived", militaryStatus: "none", archivedAt: asOf, consentStatus: "granted", ...charlotte },
      { id: ids.deleted, organizationId: orgA, fullName: "Privacy Deleted", militaryStatus: "none", privacyDeletedAt: asOf, consentStatus: "withdrawn", ...charlotte },
      { id: ids.doNotContact, organizationId: orgA, fullName: "Do Not Contact", militaryStatus: "none", doNotContact: true, consentStatus: "granted", ...charlotte },
      { id: ids.pendingTranslation, organizationId: orgA, fullName: "Pending Translation", militaryStatus: "veteran", consentStatus: "granted", ...charlotte },
      { id: ids.otherOrg, organizationId: orgB, fullName: "Other Tenant", militaryStatus: "veteran", consentStatus: "granted", ...charlotte },
    ]);
    await db.insert(skillbridgeProfiles).values([
      { organizationId: orgA, candidateId: ids.profile },
      { organizationId: orgA, candidateId: ids.future, separationDate: new Date("2027-03-01T00:00:00.000Z") },
    ]);
    await db.insert(candidateCredentials).values([
      { organizationId: orgA, candidateId: ids.veteran, name: "EPA 608 Universal", status: "active" },
      { organizationId: orgA, candidateId: ids.expired, name: "EPA 608", status: "expired" },
    ]);
    await db.insert(candidateClearances).values({
      organizationId: orgA,
      candidateId: ids.veteran,
      clearanceLevel: "secret",
      clearanceStatus: "reported_active",
      humanVerified: false,
      source: "candidate",
    });

    const countable = [
      ids.veteran,
      ids.profile,
      ids.expired,
      ids.future,
      ids.norfolk,
      ids.translated,
      ids.pendingSkill,
      ids.fillerClosed,
      ids.fillerNoFit,
      ids.fillerPlaced,
      ids.fillerWeak,
      ids.fillerSoon,
      ids.archived,
      ids.deleted,
      ids.doNotContact,
    ];
    await db.insert(candidateSkills).values(countable.map((candidateId) => ({
      organizationId: orgA,
      candidateId,
      skillId,
      capabilityBasis: candidateId === ids.translated ? "inferred" as const : "explicit" as const,
      reviewStatus: candidateId === ids.pendingSkill ? "pending" as const : "approved" as const,
      source: candidateId === ids.translated ? CAPABILITY_TRANSLATION_SOURCE : "recruiter",
    })));
    await db.insert(candidateSkills).values({
      organizationId: orgA,
      candidateId: ids.pendingTranslation,
      skillId,
      capabilityBasis: "inferred",
      reviewStatus: "pending",
      source: CAPABILITY_TRANSLATION_SOURCE,
    });
    await db.insert(candidateSkills).values({
      organizationId: orgB,
      candidateId: ids.otherOrg,
      skillId,
      capabilityBasis: "explicit",
      reviewStatus: "approved",
      source: "recruiter",
    });

    await db.insert(candidateJobMatches).values([
      { id: matchIds.veteran, organizationId: orgA, candidateId: ids.veteran, jobId: openJob, score: "80.00", matchCategory: "strong_match", freshness: "current", recruiterDisposition: "viable" },
      { id: matchIds.pending, organizationId: orgA, candidateId: ids.pendingSkill, jobId: activeJob, score: "70.00", matchCategory: "possible_match", freshness: "current", recruiterDisposition: "viable" },
      { id: matchIds.closed, organizationId: orgA, candidateId: ids.fillerClosed, jobId: closedJob, score: "75.00", matchCategory: "strong_match", freshness: "current", recruiterDisposition: "viable" },
      { id: matchIds.noFit, organizationId: orgA, candidateId: ids.fillerNoFit, jobId: openJob, score: "82.00", matchCategory: "strong_match", freshness: "current", recruiterDisposition: "viable" },
      { id: matchIds.placed, organizationId: orgA, candidateId: ids.fillerPlaced, jobId: openJob, score: "88.00", matchCategory: "strong_match", freshness: "current", recruiterDisposition: "viable" },
      { id: matchIds.weak, organizationId: orgA, candidateId: ids.fillerWeak, jobId: openJob, score: "20.00", matchCategory: "no_current_match", freshness: "current", recruiterDisposition: "not_viable" },
    ]);
    await db.insert(opportunityEngagements).values([
      { organizationId: orgA, matchId: matchIds.veteran, candidateId: ids.veteran, jobId: openJob, companyId: companyA, status: "reviewing", ownerUserId: userA },
      { organizationId: orgA, matchId: matchIds.pending, candidateId: ids.pendingSkill, jobId: activeJob, companyId: companyA, status: "interview", ownerUserId: userA },
      { organizationId: orgA, matchId: matchIds.noFit, candidateId: ids.fillerNoFit, jobId: openJob, companyId: companyA, status: "no_fit", employerResponse: "not_a_fit", ownerUserId: userA },
      { organizationId: orgA, matchId: matchIds.placed, candidateId: ids.fillerPlaced, jobId: openJob, companyId: companyA, status: "placed", ownerUserId: userA },
    ]);
    await db.insert(interviews).values({
      candidateId: ids.pendingSkill,
      jobId: activeJob,
      status: "scheduled",
    });
    await db.insert(placements).values({
      candidateId: ids.fillerPlaced,
      jobId: openJob,
      companyId: companyA,
      status: "active",
    });

    const jobsBefore = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.organizationId, orgA));

    console.log("A–O — demand, distinct supply, military partition, exclusions");
    const loaded = await loadWorkforceRolePipeline({
      organizationId: orgA,
      roleId,
      calculatedAt: asOf,
      includeCandidateDetail: true,
      includePii: false,
    });
    const analysis = loaded.analysis;
    assert(analysis.demandQuantity === 20, "demand is 20");
    assert(analysis.knownSupply === 12, `known supply is 12, got ${analysis.knownSupply}`);
    assert(analysis.quantityGap === 8, `quantity gap is 8, got ${analysis.quantityGap}`);
    assert(analysis.militarySupply === 4, `military supply is 4, got ${analysis.militarySupply}`);
    assert(analysis.nonMilitarySupply === 8, `non-military supply is 8, got ${analysis.nonMilitarySupply}`);
    assert(analysis.militarySupply + analysis.nonMilitarySupply === analysis.knownSupply, "partition adds to known supply");
    assert(!analysis.relevantCandidateIds.includes(ids.pendingTranslation), "pending translation is excluded");
    assert(!analysis.relevantCandidateIds.includes(ids.archived), "archived candidate is excluded");
    assert(!analysis.relevantCandidateIds.includes(ids.deleted), "privacy-deleted candidate is excluded");
    assert(!analysis.relevantCandidateIds.includes(ids.doNotContact), "do-not-contact candidate is excluded");
    assert(!analysis.relevantCandidateIds.includes(ids.otherOrg), "other organization is excluded");
    assert(analysis.relevantCandidateIds.includes(ids.translated), "approved translation counts");
    assert(analysis.relevantCandidateIds.includes(ids.pendingSkill), "explicit pending skill counts");
    assert(analysis.relevantCandidateIds.includes(ids.profile), "military profile with status none counts once");
    assert(analysis.excludedArchived === 2, "archived and privacy-deleted are counted as excluded");
    assert(analysis.excludedDoNotContact === 1, "do-not-contact is counted as excluded");

    console.log("G/H — availability and location");
    assert(analysis.availability.available_now === 9, `available now is 9, got ${analysis.availability.available_now}`);
    assert(analysis.availability.available_soon === 1, "available soon is 1");
    assert(analysis.availability.future_transition === 1, "future transition is 1");
    assert(analysis.availability.unknown === 1, "unknown availability is 1");
    assert(analysis.availableByHorizon === 10, `available by horizon is 10, got ${analysis.availableByHorizon}`);
    assert(analysis.timingGap === 2, `timing gap is 2, got ${analysis.timingGap}`);
    assert(analysis.locationFit === 10, `location fit is 10, got ${analysis.locationFit}`);
    assert(analysis.locationConstrained === 2, `location constrained is 2, got ${analysis.locationConstrained}`);

    console.log("I/J/V — linked jobs, closed opening, future demand");
    assert(analysis.linkedJobs.length === 3, "role links to three jobs");
    assert(analysis.currentOpenings === 2, "closed job is not a current opening");
    assert(analysis.demandHorizon === "future", "role demand stays future");
    assert(analysis.planningDemandIsNotAJob === true, "planning demand is not a job");
    const jobsAfter = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.organizationId, orgA));
    assert(jobsAfter.length === jobsBefore.length, "reading the plan did not create a job");

    console.log("K/L/M — matches, engagements, and No Fit");
    assert(analysis.funnel.opportunityMatch === 5, `opportunity matches are 5, got ${analysis.funnel.opportunityMatch}`);
    assert(analysis.funnel.employerReviewing === 1, "one employer review");
    assert(analysis.funnel.interview === 1, "one interview");
    assert(analysis.funnel.placement === 1, "one placement");
    assert(analysis.funnel.noFit === 1, "one no-fit outcome");
    assert(analysis.activePipeline === 2, `active pipeline is 2, got ${analysis.activePipeline}`);
    const [noFitMatch] = await db.select().from(candidateJobMatches).where(eq(candidateJobMatches.id, matchIds.noFit));
    assert(noFitMatch?.matchCategory === "strong_match", "No Fit left the match category unchanged");
    assert(noFitMatch?.score === "82.00", "reading supply left the match score unchanged");

    console.log("N — occupation channels are not people");
    assert(analysis.militaryChannels.some((row) => row.code === `M7ET-${suffix}`), "approved occupation is a channel");
    assert(!analysis.militaryChannels.some((row) => row.code === `M7PEND-${suffix}`), "pending occupation is not a channel");
    assert(analysis.narrative.includes("A person interprets this"), "narrative stays decision support");
    assert(!/you need to hire/i.test(analysis.narrative), "narrative does not instruct a hire");

    console.log("P/Q/U — credential, clearance label, as-of");
    assert(analysis.credentialFit === 1, "only the active credential meets the requirement");
    assert(analysis.credentialGap === 11, `credential gap is 11, got ${analysis.credentialGap}`);
    assert(analysis.clearanceFit === 1, "only reported active secret meets clearance");
    assert(analysis.clearanceLabel?.includes("candidate-reported"), "clearance stays candidate-reported");
    assert(analysis.clearanceLabel?.includes("not a verified clearance"), "clearance is not called verified");
    assert(analysis.calculatedAt === asOf.toISOString(), "as-of timestamp is the calculation time");
    assert(analysis.source === "workforceos_stored_records", "source is stored records");

    console.log("R/S — tenant isolation and aggregate versus detail");
    let rejected = false;
    try {
      await loadWorkforceRolePipeline({ organizationId: orgB, roleId, calculatedAt: asOf });
    } catch (error) {
      rejected = error instanceof WorkforceError;
    }
    assert(rejected, "another organization cannot read this role");
    assert(loaded.candidates.length === 12, "candidate detail is present when requested");
    assert(loaded.candidates.every((row) => row.email == null && row.phone == null && row.compensationExpectations == null), "PII is stripped");
    const aggregate = await loadWorkforceRolePipeline({
      organizationId: orgA,
      roleId,
      calculatedAt: asOf,
      includeCandidateDetail: false,
    });
    assert(aggregate.candidates.length === 0, "aggregate read omits candidate rows");
    assert(aggregate.analysis.knownSupply === 12, "aggregate read still returns the count");

    console.log("T — recruiter permissions stay narrow");
    const recruiter = ROLE_PERMISSIONS.recruiter;
    const planner = ROLE_PERMISSIONS["workforce-consultant"];
    assert(recruiter.includes("workforce.read"), "recruiter can read workforce");
    assert(!recruiter.includes("workforce.write"), "recruiter cannot administer workforce plans");
    assert(!recruiter.includes("workforce.analyze"), "recruiter cannot analyze workforce plans");
    assert(!recruiter.includes("workforce.approve"), "recruiter cannot approve workforce plans");
    assert(planner.includes("workforce.write"), "planner can maintain a workforce plan");
    assert(!planner.includes("candidate_pii.read"), "planner does not receive candidate PII");

    console.log("B — a second skill row for the same person is rejected");
    let duplicateBlocked = false;
    try {
      await db.insert(candidateSkills).values({
        organizationId: orgA,
        candidateId: ids.veteran,
        skillId,
        capabilityBasis: "explicit",
        reviewStatus: "approved",
      });
    } catch (error) {
      const cause = error instanceof Error && "cause" in error ? error.cause : undefined;
      const text = `${error instanceof Error ? error.message : String(error)} ${cause instanceof Error ? cause.message : ""}`;
      duplicateBlocked = /candidate_skills_candidate_skill_uq|23505|duplicate key/i.test(text);
      if (!duplicateBlocked) console.error(error);
    }
    assert(duplicateBlocked, "duplicate capability row is rejected");
    const again = await loadWorkforceRolePipeline({ organizationId: orgA, roleId, calculatedAt: asOf });
    assert(again.analysis.knownSupply === 12, "supply stays one count per person");

    const [engagement] = await db.select().from(opportunityEngagements).where(eq(opportunityEngagements.matchId, matchIds.veteran));
    assert(engagement?.status === "reviewing", "reading supply did not change engagement status");

    console.log("A–G — strategy note and job-link tenant constraints");
    await db.insert(companies).values({ id: companyB, organizationId: orgB, name: "Other Harbor", clientStatus: "active" });
    await db.insert(jobs).values({ id: jobB, organizationId: orgB, companyId: companyB, title: "Other tenant job", status: "open" });
    await db.insert(workforceAssessments).values([
      { id: assessmentA, organizationId: orgA, companyId: companyA, title: "Assessment A" },
      { id: assessmentB, organizationId: orgB, companyId: companyB, title: "Assessment B" },
    ]);
    await db.insert(educationPartners).values([
      { id: partnerA, organizationId: orgA, name: "College A", partnerType: "community_college" },
      { id: partnerB, organizationId: orgB, name: "College B", partnerType: "community_college" },
    ]);
    await db.insert(workforceRoles).values({
      id: roleB,
      organizationId: orgB,
      companyId: companyB,
      title: "Other tenant role",
    });
    await expectDatabaseReject(
      () => db.insert(workforceStrategyNotes).values({
        organizationId: orgA,
        roleId: roleB,
        channel: "talent_network",
        note: "cross-tenant role",
      }),
      "organization A cannot store a strategy note for organization B's role",
    );
    const [sameRoleNote] = await db.insert(workforceStrategyNotes).values({
      organizationId: orgA,
      roleId,
      channel: "talent_network",
      note: "same organization",
    }).returning();
    assert(sameRoleNote?.id, "same-organization strategy note inserts");
    await expectDatabaseReject(
      () => db.insert(workforceStrategyNotes).values({
        organizationId: orgA,
        roleId,
        assessmentId: assessmentB,
        channel: "talent_network",
        note: "cross-tenant assessment",
      }),
      "organization A cannot attach organization B's assessment",
    );
    const [sameAssessment] = await db.insert(workforceStrategyNotes).values({
      organizationId: orgA,
      roleId,
      assessmentId: assessmentA,
      channel: "talent_network",
      note: "same assessment",
    }).returning();
    assert(sameAssessment?.assessmentId === assessmentA, "same-organization assessment is accepted");
    await expectDatabaseReject(
      () => db.insert(workforceStrategyNotes).values({
        organizationId: orgA,
        roleId,
        educationPartnerId: partnerB,
        channel: "education_partner",
        note: "cross-tenant partner",
      }),
      "organization A cannot attach organization B's education partner",
    );
    const [samePartner] = await db.insert(workforceStrategyNotes).values({
      organizationId: orgA,
      roleId,
      educationPartnerId: partnerA,
      channel: "education_partner",
      note: "same partner",
    }).returning();
    assert(samePartner?.educationPartnerId === partnerA, "same-organization education partner is accepted");

    const actor = { organizationId: orgA, userId: userA, roleSlugs: ["workforce-consultant"] };
    let serviceRoleRejected = false;
    try {
      await addWorkforceStrategyNote({ actor, roleId: roleB, channel: "talent_network", note: "service cross role" });
    } catch (error) {
      serviceRoleRejected = error instanceof WorkforceError;
    }
    assert(serviceRoleRejected, "service command rejects another organization's role");
    let servicePartnerRejected = false;
    try {
      await addWorkforceStrategyNote({
        actor,
        roleId,
        channel: "education_partner",
        note: "service cross partner",
        educationPartnerId: partnerB,
      });
    } catch (error) {
      servicePartnerRejected = error instanceof WorkforceError;
    }
    assert(servicePartnerRejected, "service command rejects another organization's education partner");

    await expectDatabaseReject(
      () => db.insert(workforceRoleJobs).values({
        organizationId: orgA,
        roleId,
        jobId: jobB,
      }),
      "organization A cannot link organization B's job",
    );
    const [capabilityText] = await db.insert(workforceRoleCapabilityTexts).values({
      roleId,
      sourceText: "Panel wiring",
    }).returning();
    assert(capabilityText?.roleId === roleId, "capability text inserts for the same organization's role");
    let capabilityRejected = false;
    try {
      await addWorkforceCapabilityText({ actor, roleId: roleB, sourceText: "other organization wording" });
    } catch (error) {
      capabilityRejected = error instanceof WorkforceError;
    }
    assert(capabilityRejected, "capability text for another organization's role is rejected");

    const afterConstraints = await loadWorkforceRolePipeline({ organizationId: orgA, roleId, calculatedAt: asOf });
    assert(afterConstraints.analysis.knownSupply === 12, "tenant constraints did not change known supply");
    assert(afterConstraints.analysis.quantityGap === 8, "tenant constraints did not change the quantity gap");
    assert(afterConstraints.analysis.militarySupply === 4, "tenant constraints did not change military supply");

    console.log("M7 development smoke passed.");
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
