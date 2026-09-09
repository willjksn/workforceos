import { and, count, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";

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

const ANALYTICS_EXCEPTION_LIMIT = 8;
const SUBMITTED_PIPELINES = ["submitted", "interview", "interviewing", "finalist", "offer", "offered", "placed"] as const;
const INTERVIEWED_PIPELINES = ["interview", "interviewing", "finalist", "offer", "offered", "placed"] as const;

async function counted(query: Promise<Array<{ value: number }>>) {
  const [row] = await query;
  return Number(row?.value ?? 0);
}

export async function recruitingAnalytics(organizationId: string) {
  const db = getDb();
  const orgJobs = and(eq(jobs.organizationId, organizationId), isNull(jobs.archivedAt));
  const now = new Date();
  const inactiveBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const followUpBefore = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const feedbackBefore = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const offerSoon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [
    jobStatusRows,
    ownerRows,
    matchTotal,
    submittedCount,
    interviewedCount,
    matchInternalUsed,
    rediscoveredCount,
    offeredCount,
    acceptedCount,
    placementCount,
    guaranteeRows,
    incompleteJobs,
    inactiveJobs,
    stalledMatches,
    stalledSubs,
    overdueInterviews,
    expiringOffers,
    riskGuarantees,
  ] = await Promise.all([
    db.select({ status: jobs.status, value: count() }).from(jobs).where(orgJobs).groupBy(jobs.status),
    db
      .select({ owner: jobs.searchOwnerUserId, value: count() })
      .from(jobs)
      .where(orgJobs)
      .groupBy(jobs.searchOwnerUserId),
    counted(
      db
        .select({ value: count() })
        .from(candidateJobMatches)
        .innerJoin(jobs, eq(candidateJobMatches.jobId, jobs.id))
        .where(eq(jobs.organizationId, organizationId)),
    ),
    counted(
      db
        .select({ value: count() })
        .from(candidateJobMatches)
        .innerJoin(jobs, eq(candidateJobMatches.jobId, jobs.id))
        .where(and(eq(jobs.organizationId, organizationId), inArray(candidateJobMatches.pipelineStatus, SUBMITTED_PIPELINES))),
    ),
    counted(
      db
        .select({ value: count() })
        .from(candidateJobMatches)
        .innerJoin(jobs, eq(candidateJobMatches.jobId, jobs.id))
        .where(and(eq(jobs.organizationId, organizationId), inArray(candidateJobMatches.pipelineStatus, INTERVIEWED_PIPELINES))),
    ),
    counted(
      db
        .select({ value: count() })
        .from(candidateJobMatches)
        .innerJoin(jobs, eq(candidateJobMatches.jobId, jobs.id))
        .where(
          and(
            eq(jobs.organizationId, organizationId),
            eq(candidateJobMatches.source, "internal_talent_network"),
            sql`${candidateJobMatches.pipelineStatus} <> 'identified'`,
          ),
        ),
    ),
    counted(
      db
        .select({ value: count() })
        .from(candidateJobMatches)
        .innerJoin(jobs, eq(candidateJobMatches.jobId, jobs.id))
        .where(and(eq(jobs.organizationId, organizationId), eq(candidateJobMatches.pipelineStatus, "rediscovered"))),
    ),
    counted(
      db
        .select({ value: count() })
        .from(offers)
        .innerJoin(jobs, eq(offers.jobId, jobs.id))
        .where(and(eq(jobs.organizationId, organizationId), inArray(offers.status, ["extended", "accepted", "declined"]))),
    ),
    counted(
      db
        .select({ value: count() })
        .from(offers)
        .innerJoin(jobs, eq(offers.jobId, jobs.id))
        .where(and(eq(jobs.organizationId, organizationId), eq(offers.status, "accepted"))),
    ),
    counted(
      db
        .select({ value: count() })
        .from(placements)
        .innerJoin(jobs, eq(placements.jobId, jobs.id))
        .where(eq(jobs.organizationId, organizationId)),
    ),
    db
      .select({ status: placementGuarantees.status, value: count() })
      .from(placementGuarantees)
      .innerJoin(placements, eq(placementGuarantees.placementId, placements.id))
      .innerJoin(jobs, eq(placements.jobId, jobs.id))
      .where(eq(jobs.organizationId, organizationId))
      .groupBy(placementGuarantees.status),
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        status: jobs.status,
        lastActivityAt: jobs.lastActivityAt,
        createdAt: jobs.createdAt,
        companyId: jobs.companyId,
        locationLabel: jobs.locationLabel,
        compensationMin: jobs.compensationMin,
        compensationMax: jobs.compensationMax,
      })
      .from(jobs)
      .where(
        and(
          orgJobs,
          or(isNull(jobs.companyId), isNull(jobs.locationLabel), and(isNull(jobs.compensationMin), isNull(jobs.compensationMax))),
        ),
      )
      .limit(ANALYTICS_EXCEPTION_LIMIT),
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        status: jobs.status,
        lastActivityAt: jobs.lastActivityAt,
        createdAt: jobs.createdAt,
        companyId: jobs.companyId,
        locationLabel: jobs.locationLabel,
        compensationMin: jobs.compensationMin,
        compensationMax: jobs.compensationMax,
      })
      .from(jobs)
      .where(
        and(
          orgJobs,
          inArray(jobs.status, ["open", "search_active"]),
          lte(sql`coalesce(${jobs.lastActivityAt}, ${jobs.createdAt})`, inactiveBefore),
        ),
      )
      .limit(ANALYTICS_EXCEPTION_LIMIT),
    db
      .select({
        id: candidateJobMatches.id,
        jobId: jobs.id,
        candidateName: candidates.fullName,
        pipelineStatus: candidateJobMatches.pipelineStatus,
        updatedAt: candidateJobMatches.updatedAt,
      })
      .from(candidateJobMatches)
      .innerJoin(jobs, eq(candidateJobMatches.jobId, jobs.id))
      .innerJoin(candidates, eq(candidateJobMatches.candidateId, candidates.id))
      .where(
        and(
          eq(jobs.organizationId, organizationId),
          inArray(candidateJobMatches.pipelineStatus, ["contacted", "interested", "screening"]),
          lte(candidateJobMatches.updatedAt, followUpBefore),
        ),
      )
      .limit(ANALYTICS_EXCEPTION_LIMIT),
    db
      .select({
        id: submissions.id,
        jobId: jobs.id,
        status: submissions.status,
        submittedAt: submissions.submittedAt,
      })
      .from(submissions)
      .innerJoin(jobs, eq(submissions.jobId, jobs.id))
      .where(
        and(
          eq(jobs.organizationId, organizationId),
          eq(submissions.status, "submitted"),
          lte(submissions.submittedAt, feedbackBefore),
        ),
      )
      .limit(ANALYTICS_EXCEPTION_LIMIT),
    db
      .select({
        id: interviews.id,
        jobId: jobs.id,
        status: interviews.status,
        completedAt: interviews.completedAt,
        clientFeedback: interviews.clientFeedback,
        clientFeedbackDueAt: interviews.clientFeedbackDueAt,
      })
      .from(interviews)
      .innerJoin(jobs, eq(interviews.jobId, jobs.id))
      .where(
        and(
          eq(jobs.organizationId, organizationId),
          eq(interviews.status, "completed"),
          isNull(interviews.clientFeedback),
          lte(interviews.clientFeedbackDueAt, now),
        ),
      )
      .limit(ANALYTICS_EXCEPTION_LIMIT),
    db
      .select({
        id: offers.id,
        jobId: jobs.id,
        status: offers.status,
        expirationDate: offers.expirationDate,
      })
      .from(offers)
      .innerJoin(jobs, eq(offers.jobId, jobs.id))
      .where(
        and(
          eq(jobs.organizationId, organizationId),
          eq(offers.status, "extended"),
          lte(offers.expirationDate, offerSoon.toISOString().slice(0, 10)),
        ),
      )
      .limit(ANALYTICS_EXCEPTION_LIMIT),
    db
      .select({
        id: placementGuarantees.id,
        status: placementGuarantees.status,
        endsOn: placementGuarantees.endsOn,
      })
      .from(placementGuarantees)
      .innerJoin(placements, eq(placementGuarantees.placementId, placements.id))
      .innerJoin(jobs, eq(placements.jobId, jobs.id))
      .where(
        and(
          eq(jobs.organizationId, organizationId),
          inArray(placementGuarantees.status, ["expiring_soon", "replacement_required"]),
        ),
      )
      .limit(ANALYTICS_EXCEPTION_LIMIT),
  ]);

  const byStatus = (status: string) => Number(jobStatusRows.find((row) => row.status === status)?.value ?? 0);
  const guaranteeCount = (status: string) => Number(guaranteeRows.find((row) => row.status === status)?.value ?? 0);
  const alertJobs = [...incompleteJobs, ...inactiveJobs].filter(
    (job, index, rows) => rows.findIndex((row) => row.id === job.id) === index,
  );

  return {
    activeSearches: byStatus("open") + byStatus("search_active"),
    jobsByStage: {
      draft: byStatus("draft"),
      open: byStatus("open") + byStatus("search_active"),
      onHold: byStatus("on_hold"),
      filled: byStatus("filled"),
      cancelled: byStatus("cancelled"),
      closed: byStatus("closed"),
    },
    submissionToInterview: submittedCount ? interviewedCount / submittedCount : null,
    interviewToOffer: interviewedCount ? offeredCount / interviewedCount : null,
    offerAcceptance: offeredCount ? acceptedCount / offeredCount : null,
    placements: placementCount,
    internalTalentUtilization: matchTotal ? matchInternalUsed / matchTotal : null,
    rediscoveredUtilization: matchTotal ? rediscoveredCount / matchTotal : null,
    recruiterWorkload: ownerRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.owner ?? "unassigned"] = Number(row.value);
      return acc;
    }, {}),
    guarantees: {
      active: guaranteeCount("active"),
      expiringSoon: guaranteeCount("expiring_soon"),
      completed: guaranteeCount("completed"),
      replacementRequired: guaranteeCount("replacement_required"),
    },
    alerts: stalledRecruitingAlerts({
      jobs: alertJobs.map((job) => ({
        id: job.id,
        title: job.title,
        status: job.status,
        lastActivityAt: job.lastActivityAt,
        createdAt: job.createdAt,
        intakeComplete: Boolean(job.companyId && job.locationLabel && (job.compensationMin || job.compensationMax)),
      })),
      matches: stalledMatches,
      submissions: stalledSubs,
      interviews: overdueInterviews,
      offers: expiringOffers.map((row) => ({
        ...row,
        expirationDate: row.expirationDate ? new Date(row.expirationDate) : null,
      })),
      guarantees: riskGuarantees.map((row) => ({
        ...row,
        endsOn: new Date(row.endsOn),
      })),
    }),
  };
}

