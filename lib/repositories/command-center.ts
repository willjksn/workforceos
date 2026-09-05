import { and, count, desc, eq, gte, inArray, isNull, lt, notInArray, or } from "drizzle-orm";

import { getDb } from "../../db";
import {
  activities,
  approvals,
  candidateDesignations,
  candidates,
  companies,
  jobs,
  opportunities,
  opportunitySignals,
  talentPools,
} from "../../db/schema";
import { CLOSED_OPPORTUNITY_STAGES } from "../crm/stages";

const STALE_DAYS = 14;
const FOLLOW_UP_WINDOW_DAYS = 14;
const REDISCOVERY_DAYS = 90;

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function startOfMonth(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

async function counted(
  query: Promise<Array<{ value: number }>>,
) {
  const [row] = await query;
  return Number(row?.value ?? 0);
}

export async function getCommandCenterSnapshot(organizationId: string) {
  const db = getDb();
  const staleBefore = daysAgo(STALE_DAYS);
  const followUpUntil = new Date(Date.now() + FOLLOW_UP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rediscoveryBefore = daysAgo(REDISCOVERY_DAYS);
  const monthStart = startOfMonth();
  const now = new Date();

  const companyScope = and(eq(companies.organizationId, organizationId), isNull(companies.archivedAt));
  const opportunityScope = and(
    eq(opportunities.organizationId, organizationId),
    isNull(opportunities.archivedAt),
  );
  const candidateScope = and(eq(candidates.organizationId, organizationId), isNull(candidates.archivedAt));

  const [
    activeProspects,
    activeClients,
    openOpportunities,
    highPriorityOpportunities,
    opportunitiesByStage,
    recentSignals,
    staleOpportunities,
    upcomingCompanyFollowUps,
    upcomingActivityFollowUps,
    candidateCount,
    candidatesAddedThisMonth,
    talentPoolCount,
    silverMedalistDesignations,
    availableNow,
    militaryTalent,
    profilesNeedingReview,
    rediscoveryDue,
    openJobs,
    priorityOpportunityRows,
    pendingApprovals,
    recentActivities,
    talentAttention,
  ] = await Promise.all([
    counted(
      db
        .select({ value: count() })
        .from(companies)
        .where(and(companyScope, eq(companies.clientStatus, "prospect"))),
    ),
    counted(
      db
        .select({ value: count() })
        .from(companies)
        .where(and(companyScope, eq(companies.clientStatus, "active"))),
    ),
    counted(
      db
        .select({ value: count() })
        .from(opportunities)
        .where(and(opportunityScope, notInArray(opportunities.stage, [...CLOSED_OPPORTUNITY_STAGES]))),
    ),
    counted(
      db
        .select({ value: count() })
        .from(opportunities)
        .where(
          and(
            opportunityScope,
            notInArray(opportunities.stage, [...CLOSED_OPPORTUNITY_STAGES]),
            or(eq(opportunities.scoreBand, "priority"), gte(opportunities.opportunityScore, 80)),
          ),
        ),
    ),
    db
      .select({ stage: opportunities.stage, value: count() })
      .from(opportunities)
      .where(opportunityScope)
      .groupBy(opportunities.stage),
    db
      .select({
        id: opportunitySignals.id,
        title: opportunitySignals.title,
        signalType: opportunitySignals.signalType,
        reviewStatus: opportunitySignals.reviewStatus,
        detectedAt: opportunitySignals.detectedAt,
        companyId: companies.id,
        companyName: companies.name,
      })
      .from(opportunitySignals)
      .innerJoin(companies, eq(opportunitySignals.companyId, companies.id))
      .where(and(eq(companies.organizationId, organizationId), isNull(companies.archivedAt)))
      .orderBy(desc(opportunitySignals.detectedAt))
      .limit(8),
    db
      .select({
        id: opportunities.id,
        name: opportunities.name,
        stage: opportunities.stage,
        updatedAt: opportunities.updatedAt,
        companyName: companies.name,
      })
      .from(opportunities)
      .innerJoin(companies, eq(opportunities.companyId, companies.id))
      .where(
        and(
          opportunityScope,
          notInArray(opportunities.stage, [...CLOSED_OPPORTUNITY_STAGES]),
          lt(opportunities.updatedAt, staleBefore),
        ),
      )
      .orderBy(opportunities.updatedAt)
      .limit(8),
    db
      .select({
        id: companies.id,
        name: companies.name,
        nextAction: companies.nextAction,
        nextActionAt: companies.nextActionAt,
      })
      .from(companies)
      .where(
        and(
          companyScope,
          gte(companies.nextActionAt, now),
          lt(companies.nextActionAt, followUpUntil),
        ),
      )
      .orderBy(companies.nextActionAt)
      .limit(8),
    db
      .select({
        id: activities.id,
        subject: activities.subject,
        nextAction: activities.nextAction,
        followUpAt: activities.followUpAt,
        companyId: activities.companyId,
      })
      .from(activities)
      .where(
        and(
          eq(activities.organizationId, organizationId),
          isNull(activities.archivedAt),
          gte(activities.followUpAt, now),
          lt(activities.followUpAt, followUpUntil),
        ),
      )
      .orderBy(activities.followUpAt)
      .limit(8),
    counted(db.select({ value: count() }).from(candidates).where(candidateScope)),
    counted(
      db
        .select({ value: count() })
        .from(candidates)
        .where(and(candidateScope, gte(candidates.createdAt, monthStart))),
    ),
    counted(
      db
        .select({ value: count() })
        .from(talentPools)
        .where(and(eq(talentPools.organizationId, organizationId), isNull(talentPools.archivedAt))),
    ),
    counted(
      db
        .select({ value: count() })
        .from(candidateDesignations)
        .innerJoin(candidates, eq(candidateDesignations.candidateId, candidates.id))
        .where(
          and(
            candidateScope,
            eq(candidateDesignations.designationType, "silver_medalist"),
            eq(candidateDesignations.active, true),
          ),
        ),
    ),
    counted(
      db
        .select({ value: count() })
        .from(candidates)
        .where(and(candidateScope, eq(candidates.availability, "available_now"))),
    ),
    counted(
      db
        .select({ value: count() })
        .from(candidates)
        .where(
          and(
            candidateScope,
            inArray(candidates.militaryStatus, ["veteran", "active_duty", "reserve", "national_guard"]),
          ),
        ),
    ),
    counted(
      db
        .select({ value: count() })
        .from(candidates)
        .where(and(candidateScope, isNull(candidates.lastProfileReviewAt))),
    ),
    counted(
      db
        .select({ value: count() })
        .from(candidates)
        .where(
          and(
            candidateScope,
            eq(candidates.doNotContact, false),
            or(isNull(candidates.lastContactedAt), lt(candidates.lastContactedAt, rediscoveryBefore)),
          ),
        ),
    ),
    counted(
      db
        .select({ value: count() })
        .from(jobs)
        .where(and(eq(jobs.organizationId, organizationId), isNull(jobs.archivedAt), eq(jobs.status, "open"))),
    ),
    db
      .select({
        id: opportunities.id,
        name: opportunities.name,
        opportunityScore: opportunities.opportunityScore,
        scoreBand: opportunities.scoreBand,
        serviceCode: opportunities.serviceCode,
        companyName: companies.name,
      })
      .from(opportunities)
      .innerJoin(companies, eq(opportunities.companyId, companies.id))
      .where(
        and(
          opportunityScope,
          notInArray(opportunities.stage, [...CLOSED_OPPORTUNITY_STAGES]),
          or(eq(opportunities.scoreBand, "priority"), gte(opportunities.opportunityScore, 80)),
        ),
      )
      .orderBy(desc(opportunities.opportunityScore))
      .limit(6),
    db
      .select({
        id: approvals.id,
        approvalType: approvals.approvalType,
        recordType: approvals.recordType,
        status: approvals.status,
        createdAt: approvals.createdAt,
      })
      .from(approvals)
      .where(and(eq(approvals.organizationId, organizationId), eq(approvals.status, "pending")))
      .orderBy(desc(approvals.createdAt))
      .limit(6),
    db
      .select({
        id: activities.id,
        subject: activities.subject,
        activityType: activities.activityType,
        occurredAt: activities.occurredAt,
      })
      .from(activities)
      .where(and(eq(activities.organizationId, organizationId), isNull(activities.archivedAt)))
      .orderBy(desc(activities.occurredAt))
      .limit(8),
    db
      .select({
        id: candidates.id,
        fullName: candidates.fullName,
        currentTitle: candidates.currentTitle,
        lastContactedAt: candidates.lastContactedAt,
        lastProfileReviewAt: candidates.lastProfileReviewAt,
      })
      .from(candidates)
      .where(
        and(
          candidateScope,
          or(isNull(candidates.lastProfileReviewAt), lt(candidates.lastContactedAt, rediscoveryBefore)),
        ),
      )
      .orderBy(candidates.fullName)
      .limit(6),
  ]);

  return {
    generatedAt: now,
    crm: {
      activeProspects,
      activeClients,
      openOpportunities,
      highPriorityOpportunities,
      opportunitiesByStage: Object.fromEntries(
        opportunitiesByStage.map((row) => [row.stage, Number(row.value)]),
      ) as Record<string, number>,
      recentSignals,
      staleOpportunities,
      upcomingFollowUps: [
        ...upcomingCompanyFollowUps.map((row) => ({
          id: row.id,
          href: `/app/companies/${row.id}`,
          label: row.name,
          nextAction: row.nextAction,
          at: row.nextActionAt,
        })),
        ...upcomingActivityFollowUps.map((row) => ({
          id: row.id,
          href: row.companyId ? `/app/companies/${row.companyId}` : "/app",
          label: row.subject,
          nextAction: row.nextAction,
          at: row.followUpAt,
        })),
      ].sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0)),
    },
    talent: {
      candidateCount,
      candidatesAddedThisMonth,
      talentPoolCount,
      silverMedalistDesignations,
      availableNow,
      militaryTalent,
      profilesNeedingReview,
      rediscoveryDue,
    },
    recruiting: {
      openJobs,
    },
    pendingApprovals,
    recentActivities,
    talentAttention,
    priorityOpportunities: priorityOpportunityRows,
  };
}
