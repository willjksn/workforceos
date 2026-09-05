import "./load-env";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { getDb } from "../db";
import {
  agents,
  auditEvents,
  candidateJobMatches,
  candidates,
  civilianOccupations,
  interviews,
  jobSkills,
  jobs,
  militaryCivilianMappings,
  offers,
  placementGuarantees,
  placements,
  searchProjects,
  submissions,
} from "../db/schema";
import {
  CANDIDATE_ID,
  COMPANY_ID,
  INTERNAL_ORG_ID,
  USER_IDS,
} from "../db/seed/constants";
import { seedFoundation } from "../db/seed";
import { assertHumanMappingReview } from "../lib/military/review";
import { presentCandidate } from "../lib/privacy/present-candidate";
import { ROLE_PERMISSIONS, can, type Principal } from "../lib/rbac/permissions";
import { canOpenExternalSourcing } from "../lib/recruiting/external-sourcing";
import { guaranteeDates } from "../lib/recruiting/guarantees";
import {
  createDraftAgentMapping,
  getMilitaryOccupationBundle,
  reverseSearchCivilianToMilitary,
  reviewMilitaryMapping,
} from "../lib/repositories/military";
import {
  completeInternalSearch,
  createJobWithInternalSearch,
  runInternalTalentSearch,
  setJobStatus,
  updateMatchPipelineStatus,
} from "../lib/repositories/recruiting";
import {
  createInterview,
  createOffer,
  createPlacementFromOffer,
  createSubmission,
  setOfferStatus,
  submitCandidateToClient,
} from "../lib/repositories/recruiting-delivery";
import { archiveCandidate } from "../lib/repositories/talent";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readerPrincipal(): Principal {
  return {
    id: USER_IDS.readOnly,
    status: "active",
    organizationId: INTERNAL_ORG_ID,
    roleSlugs: ["read-only"],
    permissions: new Set(ROLE_PERMISSIONS["read-only"]),
  };
}

async function main() {
  await seedFoundation();
  const db = getDb();
  const created = {
    jobId: "",
    searchProjectId: "",
    matchId: "",
    submissionId: "",
    interviewIds: [] as string[],
    offerId: "",
    placementId: "",
    guaranteeId: "",
    mappingId: "",
    civilianId: "",
    archivedCandidateId: "",
  };

  try {
    console.log("TEST 1 — create job with intake and canonical skills");
    const requiredSkillId = "00000000-0000-4000-8100-000000000001";
    const preferredSkillId = "00000000-0000-4000-8100-000000000002";
    const createdJob = await createJobWithInternalSearch({
      organizationId: INTERNAL_ORG_ID,
      actorUserId: USER_IDS.recruiter,
      title: "Phase 3 Acceptance Electrician",
      companyId: COMPANY_ID,
      hiringManagerContactId: "00000000-0000-4000-8300-000000000001",
      locationLabel: "Harbor, NC",
      compensationMin: "70000",
      compensationMax: "90000",
      status: "open",
      skills: [
        { skillId: requiredSkillId, requirementType: "required", humanVerified: true },
        { skillId: preferredSkillId, requirementType: "preferred", humanVerified: true },
      ],
    });
    created.jobId = createdJob.job.id;
    created.searchProjectId = createdJob.searchProject.id;
    const skillRows = await db.select().from(jobSkills).where(eq(jobSkills.jobId, created.jobId));
    assert(createdJob.job.companyId === COMPANY_ID, "Job company missing");
    assert(createdJob.job.hiringManagerContactId, "Hiring manager missing");
    assert(createdJob.job.locationLabel === "Harbor, NC", "Location missing");
    assert(createdJob.job.compensationMin === "70000.00" || createdJob.job.compensationMin === "70000", "Compensation min missing");
    assert(skillRows.some((row) => row.requirementType === "required"), "Required skill missing");
    assert(skillRows.some((row) => row.requirementType === "preferred"), "Preferred skill missing");
    assert(createdJob.searchProject.name.includes("Internal Talent Network"), "Internal search project missing");

    console.log("TEST 2 — activate job; internal search before external sourcing");
    assert(canOpenExternalSourcing(createdJob.job.internalTalentSearchCompletedAt) === false, "External sourcing must start blocked");
    await setJobStatus({
      organizationId: INTERNAL_ORG_ID,
      actorUserId: USER_IDS.recruiter,
      jobId: created.jobId,
      status: "search_active",
    });
    await runInternalTalentSearch({
      organizationId: INTERNAL_ORG_ID,
      actorUserId: USER_IDS.recruiter,
      jobId: created.jobId,
    });
    const completed = await completeInternalSearch({
      organizationId: INTERNAL_ORG_ID,
      actorUserId: USER_IDS.recruiter,
      searchProjectId: created.searchProjectId,
      jobId: created.jobId,
    });
    assert(completed.internalSearchCompletedAt, "Internal search completion not recorded");
    assert(canOpenExternalSourcing(completed.internalSearchCompletedAt) === true, "External sourcing remains blocked after internal search");

    console.log("TEST 3 — existing candidate receives explainable component scores");
    const [match] = await db
      .select()
      .from(candidateJobMatches)
      .where(and(eq(candidateJobMatches.candidateId, CANDIDATE_ID), eq(candidateJobMatches.jobId, created.jobId)))
      .limit(1);
    assert(match, "Existing candidate did not receive a job-specific match");
    created.matchId = match.id;
    assert(match.skillsScore != null, "Skills component missing");
    assert(match.experienceScore != null, "Experience component missing");
    assert(match.explanation && match.explanation.length > 0, "Match explanation missing");
    assert(match.source === "internal_talent_network", "Match provenance should be internal Talent Network");

    console.log("TEST 4 — pipeline movement is audited");
    for (const stage of ["identified", "contacted", "screening", "qualified", "submitted"] as const) {
      await updateMatchPipelineStatus({
        organizationId: INTERNAL_ORG_ID,
        actorUserId: USER_IDS.recruiter,
        matchId: created.matchId,
        jobId: created.jobId,
        pipelineStatus: stage,
      });
    }
    const pipelineAudit = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.recordId, created.matchId));
    assert(pipelineAudit.length >= 5, "Expected audited pipeline movements");

    console.log("TEST 5 — submission requires human action");
    const submission = await createSubmission({
      organizationId: INTERNAL_ORG_ID,
      actorUserId: USER_IDS.recruiter,
      jobId: created.jobId,
      candidateId: CANDIDATE_ID,
      matchId: created.matchId,
      packet: { candidateSummary: "Phase 3 acceptance packet", recruiterCommentary: "Human prepared." },
    });
    created.submissionId = submission.id;
    assert(submission.status === "pending_approval", "Submission must start pending human action");
    const submitted = await submitCandidateToClient({
      organizationId: INTERNAL_ORG_ID,
      actorUserId: USER_IDS.recruiter,
      submissionId: submission.id,
    });
    assert(submitted.status === "submitted", "Human submit-to-client failed");
    assert(submitted.approvedByUserId === USER_IDS.recruiter, "Human approver missing");

    console.log("TEST 6 — two interviews without overwriting history");
    const first = await createInterview({
      organizationId: INTERNAL_ORG_ID,
      actorUserId: USER_IDS.recruiter,
      values: {
        candidateId: CANDIDATE_ID,
        jobId: created.jobId,
        submissionId: created.submissionId,
        stage: "screen",
        status: "completed",
      },
    });
    const second = await createInterview({
      organizationId: INTERNAL_ORG_ID,
      actorUserId: USER_IDS.recruiter,
      values: {
        candidateId: CANDIDATE_ID,
        jobId: created.jobId,
        submissionId: created.submissionId,
        stage: "hiring_manager",
        status: "scheduled",
      },
    });
    created.interviewIds = [first.id, second.id];
    const interviewRows = await db
      .select()
      .from(interviews)
      .where(and(eq(interviews.candidateId, CANDIDATE_ID), eq(interviews.jobId, created.jobId)));
    const acceptanceInterviews = interviewRows.filter((row) => created.interviewIds.includes(row.id));
    assert(acceptanceInterviews.length === 2, "Interview history was overwritten");
    assert(acceptanceInterviews[0].stage !== acceptanceInterviews[1].stage, "Distinct interview stages required");

    console.log("TEST 7 — create and accept offer");
    await db
      .update(searchProjects)
      .set({
        guaranteeDays: 90,
        feePercent: "25.00",
        contractReference: "phase3-acceptance-search-agreement",
        updatedAt: new Date(),
      })
      .where(eq(searchProjects.id, created.searchProjectId));
    const offer = await createOffer({
      organizationId: INTERNAL_ORG_ID,
      actorUserId: USER_IDS.recruiter,
      values: {
        candidateId: CANDIDATE_ID,
        jobId: created.jobId,
        searchProjectId: created.searchProjectId,
        baseSalary: "82000",
        status: "extended",
      },
    });
    created.offerId = offer.id;
    const accepted = await setOfferStatus({
      organizationId: INTERNAL_ORG_ID,
      actorUserId: USER_IDS.recruiter,
      offerId: offer.id,
      status: "accepted",
    });
    assert(accepted.status === "accepted", "Offer was not accepted");

    console.log("TEST 8 — placement from accepted offer");
    const startDate = new Date("2026-09-15T12:00:00.000Z");
    const placed = await createPlacementFromOffer({
      organizationId: INTERNAL_ORG_ID,
      actorUserId: USER_IDS.recruiter,
      offerId: offer.id,
      startDate,
    });
    created.placementId = placed.placement.id;
    created.guaranteeId = placed.guarantee.id;
    assert(placed.placement.offerId === offer.id, "Placement must reference the accepted offer");
    assert(placed.placement.guaranteeDays === 90, "Guarantee days must come from the search agreement");

    console.log("TEST 9 — guarantee dates calculate from agreement days");
    const window = guaranteeDates(startDate, 90);
    assert(placed.guarantee.startsOn === window.startsOn.toISOString().slice(0, 10), "Guarantee start mismatch");
    assert(placed.guarantee.endsOn === window.endsOn.toISOString().slice(0, 10), "Guarantee end mismatch");
    assert(window.endsOn.toISOString().slice(0, 10) === "2026-12-14", "90-day window should end 2026-12-14");

    console.log("TEST 10 — Navy EM fixture mappings");
    const navyEm = await getMilitaryOccupationBundle("EM", "navy");
    assert(navyEm, "Navy EM fixture missing");
    assert(navyEm.skills.length >= 10, `Expected 10+ skills, found ${navyEm.skills.length}`);
    assert(navyEm.civilianRoles.length >= 2, "Expected multiple civilian occupations");
    assert(navyEm.installations.length >= 2, "Expected multiple installations");

    console.log("TEST 11 — civilian electrical reverse search");
    const reverse = await reverseSearchCivilianToMilitary("Electrical Technician");
    assert(reverse.some((row) => row.military.code === "EM" && row.military.branch === "navy"), "Reverse search missed Navy EM");

    console.log("TEST 12 — mapping provenance is visible");
    const mapping = navyEm.civilianRoles.find((row) => row.mapping.reviewStatus === "approved") ?? navyEm.civilianRoles[0];
    assert(mapping.mapping.source, "Mapping source missing");
    assert(mapping.mapping.reviewStatus, "Mapping review status missing");
    assert(mapping.mapping.explanation, "Mapping explanation missing");
    assert(mapping.mapping.confidence != null, "Mapping confidence missing");

    console.log("TEST 13 — pending AI mapping cannot self-approve");
    const [agent] = await db.select().from(agents).limit(1);
    assert(agent, "Agent registry missing");
    created.civilianId = randomUUID();
    await db.insert(civilianOccupations).values({
      id: created.civilianId,
      title: "Phase 3 Disposable Civilian Role",
      code: `DEV-P3-${created.civilianId.slice(0, 8)}`,
      description: "Disposable occupation for mapping-review acceptance",
      onetSource: "development-fixture",
    });
    const draft = await createDraftAgentMapping({
      organizationId: INTERNAL_ORG_ID,
      originatingAgentId: agent.id,
      militaryOccupationId: navyEm.occupation.id,
      civilianOccupationId: created.civilianId,
      explanation: "AI draft created for acceptance. Must remain pending.",
    });
    created.mappingId = draft.id;
    assert(draft.reviewStatus === "pending", "Agent mapping must start pending");
    let agentBlocked = false;
    try {
      await reviewMilitaryMapping({
        organizationId: INTERNAL_ORG_ID,
        actorUserId: USER_IDS.recruiter,
        mappingId: draft.id,
        status: "approved",
        actorType: "agent",
      });
    } catch {
      agentBlocked = true;
    }
    assert(agentBlocked, "Agent was able to approve its own mapping");
    let threw = false;
    try {
      assertHumanMappingReview({
        actorType: "agent",
        originatingAgentId: agent.id,
        reviewerUserId: USER_IDS.recruiter,
        nextStatus: "approved",
      });
    } catch {
      threw = true;
    }
    assert(threw, "assertHumanMappingReview should reject agent approval");

    console.log("TEST 14 — human reviewer approves mapping with audit");
    const approved = await reviewMilitaryMapping({
      organizationId: INTERNAL_ORG_ID,
      actorUserId: USER_IDS.managingPartner,
      mappingId: draft.id,
      status: "approved",
      actorType: "human",
    });
    assert(approved.reviewStatus === "approved", "Human review failed");
    const reviewAudit = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.recordId, draft.id));
    assert(
      reviewAudit.some((event) => event.action === "military_mapping.reviewed"),
      "Mapping review was not audited",
    );

    console.log("TEST 15 — military candidate is not duplicated");
    const candidateRows = await db.select().from(candidates).where(eq(candidates.id, CANDIDATE_ID));
    assert(candidateRows.length === 1, "Military candidate must reuse the global candidate record");
    const emailRows = await db
      .select()
      .from(candidates)
      .where(eq(candidates.email, "taylor.ellis@talent.example.test"));
    assert(emailRows.length === 1, "Candidate email must remain unique");

    console.log("TEST 16 — archived candidate cannot be newly submitted");
    created.archivedCandidateId = randomUUID();
    await db.insert(candidates).values({
      id: created.archivedCandidateId,
      organizationId: INTERNAL_ORG_ID,
      fullName: "Phase 3 Archive Candidate",
      email: `phase3-archive-${created.archivedCandidateId}@example.test`,
      privacyClass: "restricted_pii",
    });
    await archiveCandidate(created.archivedCandidateId);
    let archiveBlocked = false;
    try {
      await createSubmission({
        organizationId: INTERNAL_ORG_ID,
        actorUserId: USER_IDS.recruiter,
        jobId: created.jobId,
        candidateId: created.archivedCandidateId,
        packet: { candidateSummary: "should fail" },
      });
    } catch (error) {
      archiveBlocked = error instanceof Error && /archived/i.test(error.message);
    }
    assert(archiveBlocked, "Archived candidate was submitted");

    console.log("TEST 17 — user without candidate_pii.read cannot see restricted fields");
    const reader = readerPrincipal();
    assert(can(reader, "candidate_pii.read") === false, "Read Only should lack candidate_pii.read");
    const hidden = presentCandidate(
      {
        fullName: "Taylor Ellis",
        email: "taylor.ellis@talent.example.test",
        phone: "555-0100",
        compensationExpectations: "82000",
      },
      can(reader, "candidate_pii.read"),
    );
    assert(hidden.email === null, "Email leaked without candidate_pii.read");
    assert(hidden.phone === null, "Phone leaked without candidate_pii.read");
    assert(hidden.compensationExpectations === null, "Compensation leaked without candidate_pii.read");

    console.log("Phase 3 acceptance passed");
  } finally {
    const dbCleanup = getDb();
    if (created.guaranteeId) {
      await dbCleanup.delete(placementGuarantees).where(eq(placementGuarantees.id, created.guaranteeId));
    }
    if (created.placementId) {
      await dbCleanup.delete(placements).where(eq(placements.id, created.placementId));
    }
    if (created.offerId) {
      await dbCleanup.delete(offers).where(eq(offers.id, created.offerId));
    }
    if (created.interviewIds.length) {
      for (const id of created.interviewIds) {
        await dbCleanup.delete(interviews).where(eq(interviews.id, id));
      }
    }
    if (created.submissionId) {
      await dbCleanup.delete(submissions).where(eq(submissions.id, created.submissionId));
    }
    if (created.jobId) {
      await dbCleanup.delete(candidateJobMatches).where(eq(candidateJobMatches.jobId, created.jobId));
      await dbCleanup.delete(jobSkills).where(eq(jobSkills.jobId, created.jobId));
      await dbCleanup.delete(searchProjects).where(eq(searchProjects.jobId, created.jobId));
      await dbCleanup.delete(jobs).where(eq(jobs.id, created.jobId));
    }
    if (created.mappingId) {
      await dbCleanup.delete(militaryCivilianMappings).where(eq(militaryCivilianMappings.id, created.mappingId));
    }
    if (created.civilianId) {
      await dbCleanup.delete(civilianOccupations).where(eq(civilianOccupations.id, created.civilianId));
    }
    if (created.archivedCandidateId) {
      await dbCleanup.delete(candidates).where(eq(candidates.id, created.archivedCandidateId));
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
