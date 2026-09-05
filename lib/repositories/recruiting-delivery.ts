import { and, desc, eq, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import {
  candidateJobMatches,
  candidates,
  companies,
  interviews,
  jobs,
  offers,
  placementGuarantees,
  placements,
  searchProjects,
  submissions,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { FinanceError, recordPlacementFeeEvent } from "../finance/engine";
import { stalledRecruitingAlerts } from "../recruiting/alerts";
import { guaranteeDates, guaranteeStatusOn, placementFeeFromTerms } from "../recruiting/guarantees";

export async function listSubmissions(organizationId: string) {
  const db = getDb();
  return db
    .select({ submission: submissions, candidate: candidates, job: jobs, companyName: companies.name })
    .from(submissions)
    .innerJoin(jobs, eq(submissions.jobId, jobs.id))
    .innerJoin(candidates, eq(submissions.candidateId, candidates.id))
    .leftJoin(companies, eq(jobs.companyId, companies.id))
    .where(and(eq(jobs.organizationId, organizationId), isNull(jobs.archivedAt)))
    .orderBy(desc(submissions.createdAt));
}

export async function createSubmission(input: {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  candidateId: string;
  matchId?: string | null;
  packet: Partial<typeof submissions.$inferInsert>;
}) {
  const db = getDb();
  const [candidate] = await db.select().from(candidates).where(eq(candidates.id, input.candidateId)).limit(1);
  if (!candidate || candidate.archivedAt) throw new Error("Archived candidates cannot be newly submitted");
  if (candidate.doNotContact) throw new Error("Do-not-contact candidates cannot be submitted");
  const [match] = input.matchId
    ? await db.select().from(candidateJobMatches).where(eq(candidateJobMatches.id, input.matchId)).limit(1)
    : [];
  const [row] = await db
    .insert(submissions)
    .values({
      candidateId: input.candidateId,
      jobId: input.jobId,
      matchId: input.matchId,
      submittedByUserId: input.actorUserId,
      status: "pending_approval",
      candidateSummary: input.packet.candidateSummary,
      relevantExperience: input.packet.relevantExperience,
      matchedRequirements: input.packet.matchedRequirements ?? match?.strengths,
      transferableSkills: input.packet.transferableSkills,
      militaryTranslation: input.packet.militaryTranslation,
      compensation: input.packet.compensation,
      availability: input.packet.availability,
      location: input.packet.location,
      identifiedGaps: input.packet.identifiedGaps ?? match?.gaps,
      recruiterCommentary: input.packet.recruiterCommentary,
      notes: input.packet.notes,
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "submission.created",
    recordType: "submission",
    recordId: row.id,
    after: { candidateId: row.candidateId, jobId: row.jobId, version: row.version },
  });
  return row;
}

export async function submitCandidateToClient(input: {
  organizationId: string;
  actorUserId: string;
  submissionId: string;
}) {
  const db = getDb();
  const [before] = await db.select().from(submissions).where(eq(submissions.id, input.submissionId)).limit(1);
  if (!before) throw new Error("Submission not found");
  const [after] = await db
    .update(submissions)
    .set({
      status: "submitted",
      submittedAt: new Date(),
      approvedByUserId: input.actorUserId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, input.submissionId))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "submission.submitted",
    recordType: "submission",
    recordId: after.id,
    before: { status: before.status },
    after: { status: after.status, submittedAt: after.submittedAt, submittedBy: input.actorUserId },
  });
  return after;
}

export async function listInterviews(organizationId: string) {
  const db = getDb();
  return db
    .select({ interview: interviews, candidate: candidates, job: jobs })
    .from(interviews)
    .innerJoin(jobs, eq(interviews.jobId, jobs.id))
    .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
    .where(eq(jobs.organizationId, organizationId))
    .orderBy(desc(interviews.scheduledFor));
}

export async function createInterview(input: {
  organizationId: string;
  actorUserId: string;
  values: typeof interviews.$inferInsert;
}) {
  const db = getDb();
  const [row] = await db.insert(interviews).values(input.values).returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "interview.created",
    recordType: "interview",
    recordId: row.id,
    after: { candidateId: row.candidateId, jobId: row.jobId, stage: row.stage },
  });
  return row;
}

export async function updateInterview(input: {
  organizationId: string;
  actorUserId: string;
  interviewId: string;
  values: Partial<typeof interviews.$inferInsert>;
}) {
  const db = getDb();
  const [before] = await db.select().from(interviews).where(eq(interviews.id, input.interviewId)).limit(1);
  if (!before) throw new Error("Interview not found");
  const [after] = await db
    .update(interviews)
    .set({ ...input.values, updatedAt: new Date() })
    .where(eq(interviews.id, input.interviewId))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "interview.updated",
    recordType: "interview",
    recordId: after.id,
    before: { status: before.status, outcome: before.outcome },
    after: { status: after.status, outcome: after.outcome },
  });
  return after;
}

export async function listOffers(organizationId: string) {
  const db = getDb();
  return db
    .select({ offer: offers, candidate: candidates, job: jobs })
    .from(offers)
    .innerJoin(jobs, eq(offers.jobId, jobs.id))
    .innerJoin(candidates, eq(offers.candidateId, candidates.id))
    .where(eq(jobs.organizationId, organizationId))
    .orderBy(desc(offers.createdAt));
}

export async function createOffer(input: {
  organizationId: string;
  actorUserId: string;
  values: typeof offers.$inferInsert;
}) {
  const db = getDb();
  const [row] = await db.insert(offers).values(input.values).returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "offer.created",
    recordType: "offer",
    recordId: row.id,
    after: { status: row.status, jobId: row.jobId, candidateId: row.candidateId },
  });
  return row;
}

export async function setOfferStatus(input: {
  organizationId: string;
  actorUserId: string;
  offerId: string;
  status: typeof offers.$inferInsert.status;
  declineReason?: string | null;
}) {
  const db = getDb();
  const [before] = await db.select().from(offers).where(eq(offers.id, input.offerId)).limit(1);
  if (!before) throw new Error("Offer not found");
  const [after] = await db
    .update(offers)
    .set({ status: input.status, declineReason: input.declineReason, updatedAt: new Date() })
    .where(eq(offers.id, input.offerId))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "offer.status",
    recordType: "offer",
    recordId: after.id,
    before: { status: before.status },
    after: { status: after.status },
  });
  return after;
}

export async function listPlacements(organizationId: string) {
  const db = getDb();
  return db
    .select({
      placement: placements,
      candidate: candidates,
      job: jobs,
      companyName: companies.name,
    })
    .from(placements)
    .innerJoin(jobs, eq(placements.jobId, jobs.id))
    .innerJoin(candidates, eq(placements.candidateId, candidates.id))
    .leftJoin(companies, eq(placements.companyId, companies.id))
    .where(eq(jobs.organizationId, organizationId))
    .orderBy(desc(placements.createdAt));
}

export async function createPlacementFromOffer(input: {
  organizationId: string;
  actorUserId: string;
  offerId: string;
  startDate: Date;
}) {
  const db = getDb();
  const [offer] = await db.select().from(offers).where(eq(offers.id, input.offerId)).limit(1);
  if (!offer) throw new Error("Offer not found");
  if (offer.status !== "accepted") throw new Error("Placement requires an accepted offer");
  const [job] = await db.select().from(jobs).where(eq(jobs.id, offer.jobId)).limit(1);
  if (!job) throw new Error("Job not found");
  const [project] = offer.searchProjectId
    ? await db.select().from(searchProjects).where(eq(searchProjects.id, offer.searchProjectId)).limit(1)
    : await db.select().from(searchProjects).where(eq(searchProjects.jobId, offer.jobId)).limit(1);
  const guaranteeDays = project?.guaranteeDays;
  if (guaranteeDays == null) {
    throw new Error("Guarantee days must come from the search agreement");
  }
  const salary = offer.baseSalary ? Number(offer.baseSalary) : null;
  const feePercent = project?.feePercent ? Number(project.feePercent) : null;
  const fee = placementFeeFromTerms({
    startingSalary: salary,
    feePercent,
    feeAmount: project?.feeAmount ? Number(project.feeAmount) : null,
  });
  const [placement] = await db
    .insert(placements)
    .values({
      candidateId: offer.candidateId,
      jobId: offer.jobId,
      companyId: job.companyId,
      searchProjectId: project?.id,
      offerId: offer.id,
      startDate: input.startDate,
      startingSalary: offer.baseSalary,
      feePercent: project?.feePercent,
      placementFee: fee != null ? String(fee) : null,
      guaranteeDays,
      status: "pending_start",
      billingEventQueuedAt: new Date(),
    })
    .returning();
  const window = guaranteeDates(input.startDate, guaranteeDays);
  const [guarantee] = await db
    .insert(placementGuarantees)
    .values({
      placementId: placement.id,
      searchProjectId: project?.id,
      guaranteeDays,
      startsOn: window.startsOn.toISOString().slice(0, 10),
      endsOn: window.endsOn.toISOString().slice(0, 10),
      status: guaranteeStatusOn(window.endsOn),
      sourceTerms: project?.contractReference ?? "search_project.guarantee_days",
    })
    .returning();
  await db.update(jobs).set({ status: "filled", lastActivityAt: new Date(), updatedAt: new Date() }).where(eq(jobs.id, job.id));
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "placement.created",
    recordType: "placement",
    recordId: placement.id,
    after: { candidateId: placement.candidateId, jobId: placement.jobId, fee: placement.placementFee },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "guarantee.created",
    recordType: "placement_guarantee",
    recordId: guarantee.id,
    after: { startsOn: guarantee.startsOn, endsOn: guarantee.endsOn, days: guarantee.guaranteeDays },
  });
  try {
    await recordPlacementFeeEvent({
      actor: { organizationId: input.organizationId, userId: input.actorUserId },
      placementId: placement.id,
    });
  } catch (error) {
    if (!(error instanceof FinanceError)) throw error;
  }
  return { placement, guarantee };
}

export async function listGuarantees(organizationId: string) {
  const db = getDb();
  return db
    .select({
      guarantee: placementGuarantees,
      placement: placements,
      candidate: candidates,
      job: jobs,
    })
    .from(placementGuarantees)
    .innerJoin(placements, eq(placementGuarantees.placementId, placements.id))
    .innerJoin(jobs, eq(placements.jobId, jobs.id))
    .innerJoin(candidates, eq(placements.candidateId, candidates.id))
    .where(eq(jobs.organizationId, organizationId))
    .orderBy(placementGuarantees.endsOn);
}

export async function recruitingAnalytics(organizationId: string) {
  const db = getDb();
  const jobRows = await db.select().from(jobs).where(and(eq(jobs.organizationId, organizationId), isNull(jobs.archivedAt)));
  const matchRows = await db
    .select({ match: candidateJobMatches, job: jobs, candidate: candidates })
    .from(candidateJobMatches)
    .innerJoin(jobs, eq(candidateJobMatches.jobId, jobs.id))
    .innerJoin(candidates, eq(candidateJobMatches.candidateId, candidates.id))
    .where(eq(jobs.organizationId, organizationId));
  const submissionRows = await listSubmissions(organizationId);
  const interviewRows = await listInterviews(organizationId);
  const offerRows = await listOffers(organizationId);
  const placementRows = await listPlacements(organizationId);
  const guaranteeRows = await listGuarantees(organizationId);

  const byStatus = (status: string) => jobRows.filter((job) => job.status === status).length;
  const submitted = matchRows.filter((row) => ["submitted", "interview", "interviewing", "finalist", "offer", "offered", "placed"].includes(row.match.pipelineStatus));
  const interviewed = matchRows.filter((row) => ["interview", "interviewing", "finalist", "offer", "offered", "placed"].includes(row.match.pipelineStatus));
  const offered = offerRows.filter((row) => ["extended", "accepted"].includes(row.offer.status) || row.offer.status === "declined");
  const accepted = offerRows.filter((row) => row.offer.status === "accepted");
  const internalUsed = matchRows.filter((row) => row.match.source === "internal_talent_network" && row.match.pipelineStatus !== "identified").length;
  const rediscovered = matchRows.filter((row) => row.match.pipelineStatus === "rediscovered").length;

  return {
    activeSearches: jobRows.filter((job) => ["open", "search_active"].includes(job.status)).length,
    jobsByStage: {
      draft: byStatus("draft"),
      open: byStatus("open") + byStatus("search_active"),
      onHold: byStatus("on_hold"),
      filled: byStatus("filled"),
      cancelled: byStatus("cancelled"),
      closed: byStatus("closed"),
    },
    submissionToInterview: submitted.length ? interviewed.length / submitted.length : null,
    interviewToOffer: interviewed.length ? offered.length / interviewed.length : null,
    offerAcceptance: offered.length ? accepted.length / offered.length : null,
    placements: placementRows.length,
    internalTalentUtilization: matchRows.length ? internalUsed / matchRows.length : null,
    rediscoveredUtilization: matchRows.length ? rediscovered / matchRows.length : null,
    recruiterWorkload: jobRows.reduce<Record<string, number>>((acc, job) => {
      const owner = job.searchOwnerUserId ?? "unassigned";
      acc[owner] = (acc[owner] ?? 0) + 1;
      return acc;
    }, {}),
    guarantees: {
      active: guaranteeRows.filter((row) => row.guarantee.status === "active").length,
      expiringSoon: guaranteeRows.filter((row) => row.guarantee.status === "expiring_soon").length,
      completed: guaranteeRows.filter((row) => row.guarantee.status === "completed").length,
      replacementRequired: guaranteeRows.filter((row) => row.guarantee.status === "replacement_required").length,
    },
    alerts: stalledRecruitingAlerts({
      jobs: jobRows.map((job) => ({
        id: job.id,
        title: job.title,
        status: job.status,
        lastActivityAt: job.lastActivityAt,
        createdAt: job.createdAt,
        intakeComplete: Boolean(job.companyId && job.locationLabel && (job.compensationMin || job.compensationMax)),
      })),
      matches: matchRows.map((row) => ({
        id: row.match.id,
        jobId: row.job.id,
        candidateName: row.candidate.fullName,
        pipelineStatus: row.match.pipelineStatus,
        updatedAt: row.match.updatedAt,
      })),
      submissions: submissionRows.map((row) => ({
        id: row.submission.id,
        jobId: row.job.id,
        status: row.submission.status,
        submittedAt: row.submission.submittedAt,
      })),
      interviews: interviewRows.map((row) => ({
        id: row.interview.id,
        jobId: row.job.id,
        status: row.interview.status,
        completedAt: row.interview.completedAt,
        clientFeedback: row.interview.clientFeedback,
        clientFeedbackDueAt: row.interview.clientFeedbackDueAt,
      })),
      offers: offerRows.map((row) => ({
        id: row.offer.id,
        jobId: row.job.id,
        status: row.offer.status,
        expirationDate: row.offer.expirationDate ? new Date(row.offer.expirationDate) : null,
      })),
      guarantees: guaranteeRows.map((row) => ({
        id: row.guarantee.id,
        status: row.guarantee.status,
        endsOn: new Date(row.guarantee.endsOn),
      })),
    }),
  };
}

