import { and, count, eq, gte, inArray, isNull, lte, notInArray, or, sql } from "drizzle-orm";

import { getDb } from "../../db";
import {
  contracts,
  discoveries,
  integrationConnections,
  interviews,
  invoices,
  jobs,
  offers,
  opportunities,
  projectDeliverables,
  projects,
  proposals,
  submissions,
} from "../../db/schema";
import { CLOSED_OPPORTUNITY_STAGES } from "../crm/stages";
import { phase4CommandSnapshot } from "../delivery/engine";
import { financeCommandSnapshot } from "../finance/engine";
import { parseMoney } from "../finance/money";
import { countFailedIntegrationEvents } from "../integrations/retry";
import { getCommandCenterSnapshot } from "../repositories/command-center";
import { recruitingAnalytics } from "../repositories/recruiting-delivery";
import { getWorkforceCommandSnapshot } from "../repositories/workforce";
import { recruitingCycleTimes } from "./cycle-time";
import { getSkillBridgeMetrics } from "../skillbridge/service";
import { getHiringMetrics } from "../hiring/service";

async function counted(query: Promise<Array<{ value: number }>>) {
  const [row] = await query;
  return Number(row?.value ?? 0);
}

function money(rows: Array<{ value: string | number | null }>) {
  return rows.reduce((sum, row) => sum + (parseMoney(row.value) ?? 0), 0);
}

export async function getExecutiveCommandCenter(organizationId: string) {
  const db = getDb();
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    base,
    delivery,
    finance,
    workforce,
    recruiting,
    cycleTimes,
    failedSyncCount,
    submissionCount,
    interviewCount,
    offerCount,
    contracted,
    invoiced,
    collected,
    ar,
    pipelineValue,
    won,
    closed,
    discoveriesOpen,
    proposalsOpen,
    contractsPending,
    activeProjects,
    atRiskProjects,
    overdueDeliverables,
    upcomingMilestones,
    unhealthyProviders,
    skillbridge,
    hiring,
  ] = await Promise.all([
    getCommandCenterSnapshot(organizationId),
    phase4CommandSnapshot(organizationId),
    financeCommandSnapshot(organizationId),
    getWorkforceCommandSnapshot(organizationId),
    recruitingAnalytics(organizationId),
    recruitingCycleTimes(organizationId),
    countFailedIntegrationEvents(organizationId),
    counted(
      db
        .select({ value: count() })
        .from(submissions)
        .innerJoin(jobs, eq(submissions.jobId, jobs.id))
        .where(eq(jobs.organizationId, organizationId)),
    ),
    counted(
      db
        .select({ value: count() })
        .from(interviews)
        .innerJoin(jobs, eq(interviews.jobId, jobs.id))
        .where(eq(jobs.organizationId, organizationId)),
    ),
    counted(
      db
        .select({ value: count() })
        .from(offers)
        .innerJoin(jobs, eq(offers.jobId, jobs.id))
        .where(eq(jobs.organizationId, organizationId)),
    ),
    db
      .select({ value: sql<string>`coalesce(sum(${contracts.contractValue}), 0)` })
      .from(contracts)
      .where(and(eq(contracts.organizationId, organizationId), eq(contracts.status, "executed"))),
    db
      .select({ value: sql<string>`coalesce(sum(${invoices.amount}), 0)` })
      .from(invoices)
      .where(eq(invoices.organizationId, organizationId)),
    db
      .select({ value: sql<string>`coalesce(sum(${invoices.amount} - ${invoices.balanceDue}), 0)` })
      .from(invoices)
      .where(eq(invoices.organizationId, organizationId)),
    db
      .select({ value: sql<string>`coalesce(sum(${invoices.balanceDue}), 0)` })
      .from(invoices)
      .where(and(eq(invoices.organizationId, organizationId), notInArray(invoices.status, ["paid", "void"]))),
    db
      .select({ value: sql<string>`coalesce(sum(${opportunities.valueAmount}), 0)` })
      .from(opportunities)
      .where(
        and(
          eq(opportunities.organizationId, organizationId),
          isNull(opportunities.archivedAt),
          notInArray(opportunities.stage, [...CLOSED_OPPORTUNITY_STAGES]),
        ),
      ),
    counted(
      db
        .select({ value: count() })
        .from(opportunities)
        .where(and(eq(opportunities.organizationId, organizationId), eq(opportunities.stage, "won"))),
    ),
    counted(
      db
        .select({ value: count() })
        .from(opportunities)
        .where(and(eq(opportunities.organizationId, organizationId), inArray(opportunities.stage, ["won", "lost"]))),
    ),
    counted(
      db
        .select({ value: count() })
        .from(discoveries)
        .where(and(eq(discoveries.organizationId, organizationId), inArray(discoveries.status, ["draft", "in_review"]))),
    ),
    counted(
      db
        .select({ value: count() })
        .from(proposals)
        .where(
          and(eq(proposals.organizationId, organizationId), inArray(proposals.status, ["draft", "internal_review", "sent"])),
        ),
    ),
    counted(
      db
        .select({ value: count() })
        .from(contracts)
        .where(
          and(
            eq(contracts.organizationId, organizationId),
            inArray(contracts.status, ["draft", "internal_review", "client_review", "sent_for_signature"]),
          ),
        ),
    ),
    counted(
      db
        .select({ value: count() })
        .from(projects)
        .where(and(eq(projects.organizationId, organizationId), eq(projects.status, "active"))),
    ),
    counted(
      db
        .select({ value: count() })
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, organizationId),
            or(eq(projects.status, "at_risk"), eq(projects.health, "at_risk")),
          ),
        ),
    ),
    counted(
      db
        .select({ value: count() })
        .from(projectDeliverables)
        .innerJoin(projects, eq(projectDeliverables.projectId, projects.id))
        .where(
          and(
            eq(projects.organizationId, organizationId),
            lte(projectDeliverables.dueDate, now),
            notInArray(projectDeliverables.status, ["delivered"]),
          ),
        ),
    ),
    db
      .select({
        id: projectDeliverables.id,
        name: projectDeliverables.name,
        dueDate: projectDeliverables.dueDate,
        projectId: projects.id,
      })
      .from(projectDeliverables)
      .innerJoin(projects, eq(projectDeliverables.projectId, projects.id))
      .where(
        and(
          eq(projects.organizationId, organizationId),
          gte(projectDeliverables.dueDate, now),
          lte(projectDeliverables.dueDate, soon),
        ),
      )
      .orderBy(projectDeliverables.dueDate)
      .limit(8),
    counted(
      db
        .select({ value: count() })
        .from(integrationConnections)
        .where(
          and(
            eq(integrationConnections.organizationId, organizationId),
            inArray(integrationConnections.status, ["error", "unhealthy"]),
          ),
        ),
    ),
    getSkillBridgeMetrics(organizationId),
    getHiringMetrics(organizationId),
  ]);

  return {
    generatedAt: now,
    business: {
      contractedRevenue: money(contracted),
      invoiced: money(invoiced),
      collected: money(collected),
      mrr: finance.monthlyRecurringRevenue,
      ar: money(ar),
      pipelineValue: money(pipelineValue),
      winRate: closed ? won / closed : null,
    },
    sales: {
      priorityOpportunities: base.priorityOpportunities,
      staleOpportunities: base.crm.staleOpportunities,
      discovery: discoveriesOpen,
      proposals: proposalsOpen,
      contractsPending,
    },
    recruiting: {
      activeSearches: recruiting.activeSearches,
      timeToShortlistDays: cycleTimes.timeToShortlistDays,
      timeToFillDays: cycleTimes.timeToFillDays,
      submissions: submissionCount,
      interviews: interviewCount,
      offers: offerCount,
      placements: recruiting.placements,
      guaranteeRisk: recruiting.guarantees.expiringSoon + recruiting.guarantees.replacementRequired,
      hiring,
    },
    talent: {
      totalCandidates: base.talent.candidateCount,
      availableNow: base.talent.availableNow,
      silverMedalists: base.talent.silverMedalistDesignations,
      talentPoolHealth: base.talent.talentPoolCount,
      rediscoveryCandidates: base.talent.rediscoveryDue,
      militaryCandidates: base.talent.militaryTalent,
    },
    workforce: {
      assessmentsInProgress: workforce.assessmentsInProgress.length,
      criticalGaps: workforce.criticalGaps.length,
      pipelineCapacity: workforce.pipelineCapacityRisk.length,
      workforceRisks: workforce.highRiskRoles.length,
      recommendationsAwaitingApproval: workforce.recommendationsAwaitingApproval.length,
    },
    projects: {
      active: activeProjects,
      atRisk: atRiskProjects,
      overdueDeliverables,
      upcomingMilestones,
    },
    integrations: {
      failedSyncs: failedSyncCount,
      unhealthyProviders,
    },
    skillbridge: {
      needsAttention: skillbridge.needsCandidateFollowUp + skillbridge.needsEmployerFollowUp,
      windowsOpeningSoon: skillbridge.windows90,
      noOpportunity: skillbridge.withoutOpportunity,
      employerFeedbackOverdue: skillbridge.needsEmployerFollowUp,
      skillbridgeActive: skillbridge.skillbridgeActive,
      conversionPending: skillbridge.conversionPending,
    },
    delivery,
    finance,
    base,
  };
}
