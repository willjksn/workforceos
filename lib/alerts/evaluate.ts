import { and, eq, inArray, isNull, lt, lte, notInArray, or } from "drizzle-orm";

import { getDb } from "../../db";
import {
  agentRuns,
  approvals,
  integrationEvents,
  interviews,
  invoices,
  jobs,
  offers,
  opportunities,
  placementGuarantees,
  placements,
  projectRisks,
  projects,
  proposals,
  talentPipelines,
  workforceAssessments,
  workforceGaps,
} from "../../db/schema";
import { CLOSED_OPPORTUNITY_STAGES } from "../crm/stages";
import { listFailedIntegrationEvents } from "../integrations/retry";

export type OperationalAlert = {
  code: string;
  domain: string;
  title: string;
  href: string;
  recordId: string;
  severity: "warning" | "critical";
};

const STALE_MS = 14 * 24 * 60 * 60 * 1000;

export async function evaluateOperationalAlerts(organizationId: string): Promise<OperationalAlert[]> {
  const db = getDb();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_MS);
  const alerts: OperationalAlert[] = [];

  const staleOpps = await db
    .select()
    .from(opportunities)
    .where(
      and(
        eq(opportunities.organizationId, organizationId),
        isNull(opportunities.archivedAt),
        notInArray(opportunities.stage, [...CLOSED_OPPORTUNITY_STAGES]),
        lt(opportunities.updatedAt, staleBefore),
      ),
    );
  for (const row of staleOpps) {
    alerts.push({
      code: "stale_opportunity",
      domain: "sales",
      title: `Stale opportunity: ${row.name}`,
      href: `/app/opportunities/${row.id}`,
      recordId: row.id,
      severity: "warning",
    });
  }

  const agingProposals = await db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.organizationId, organizationId),
        inArray(proposals.status, ["sent", "viewed"]),
        lt(proposals.sentAt, new Date(now.getTime() - STALE_MS)),
      ),
    );
  for (const row of agingProposals) {
    alerts.push({
      code: "proposal_aging",
      domain: "sales",
      title: `Aging proposal: ${row.title}`,
      href: `/app/proposals/${row.id}`,
      recordId: row.id,
      severity: "warning",
    });
  }

  const quietJobs = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.organizationId, organizationId),
        isNull(jobs.archivedAt),
        inArray(jobs.status, ["open", "search_active"]),
        or(isNull(jobs.lastActivityAt), lt(jobs.lastActivityAt, staleBefore)),
      ),
    );
  for (const row of quietJobs) {
    alerts.push({
      code: "no_candidate_activity",
      domain: "recruiting",
      title: `No candidate activity: ${row.title}`,
      href: `/app/jobs/${row.id}`,
      recordId: row.id,
      severity: "warning",
    });
  }

  const overdueFeedback = await db
    .select({ interview: interviews, job: jobs })
    .from(interviews)
    .innerJoin(jobs, eq(interviews.jobId, jobs.id))
    .where(
      and(
        eq(jobs.organizationId, organizationId),
        isNull(interviews.clientFeedback),
        lte(interviews.clientFeedbackDueAt, now),
      ),
    );
  for (const row of overdueFeedback) {
    alerts.push({
      code: "overdue_client_feedback",
      domain: "recruiting",
      title: `Overdue client feedback: ${row.job.title}`,
      href: "/app/interviews",
      recordId: row.interview.id,
      severity: "warning",
    });
  }

  const openOffers = await db
    .select({ offer: offers, job: jobs })
    .from(offers)
    .innerJoin(jobs, eq(offers.jobId, jobs.id))
    .where(
      and(
        eq(jobs.organizationId, organizationId),
        inArray(offers.status, ["draft", "extended"]),
        lte(offers.expirationDate, now.toISOString().slice(0, 10)),
      ),
    );
  for (const row of openOffers) {
    alerts.push({
      code: "offer_expiring",
      domain: "recruiting",
      title: `Offer expiring: ${row.job.title}`,
      href: "/app/offers",
      recordId: row.offer.id,
      severity: "critical",
    });
  }

  const guarantees = await db
    .select({ guarantee: placementGuarantees, job: jobs })
    .from(placementGuarantees)
    .innerJoin(placements, eq(placementGuarantees.placementId, placements.id))
    .innerJoin(jobs, eq(placements.jobId, jobs.id))
    .where(and(eq(jobs.organizationId, organizationId), inArray(placementGuarantees.status, ["active", "expiring_soon"])));
  for (const row of guarantees) {
    const ends = new Date(row.guarantee.endsOn);
    if (ends.getTime() - now.getTime() <= STALE_MS) {
      alerts.push({
        code: "guarantee_expiring",
        domain: "recruiting",
        title: `Guarantee expiring: ${row.job.title}`,
        href: "/app/guarantees",
        recordId: row.guarantee.id,
        severity: "warning",
      });
    }
  }

  const criticalGaps = await db
    .select({ gap: workforceGaps, assessment: workforceAssessments })
    .from(workforceGaps)
    .innerJoin(workforceAssessments, eq(workforceGaps.assessmentId, workforceAssessments.id))
    .where(and(eq(workforceAssessments.organizationId, organizationId), eq(workforceGaps.severity, "critical")));
  for (const row of criticalGaps) {
    alerts.push({
      code: "critical_gap",
      domain: "workforce",
      title: `Critical workforce gap on ${row.assessment.title}`,
      href: "/app/workforce/gaps",
      recordId: row.gap.id,
      severity: "critical",
    });
  }

  const underCapacity = await db
    .select()
    .from(talentPipelines)
    .where(and(eq(talentPipelines.organizationId, organizationId), eq(talentPipelines.status, "at_risk")));
  for (const row of underCapacity) {
    alerts.push({
      code: "pipeline_under_capacity",
      domain: "workforce",
      title: `Pipeline under-capacity: ${row.name}`,
      href: `/app/workforce/pipelines/${row.id}`,
      recordId: row.id,
      severity: "warning",
    });
  }

  const overdueMilestones = await db
    .select()
    .from(projects)
    .where(and(eq(projects.organizationId, organizationId), eq(projects.status, "active"), lte(projects.endDate, now)));
  for (const row of overdueMilestones) {
    alerts.push({
      code: "overdue_milestone",
      domain: "projects",
      title: `Overdue project window: ${row.name}`,
      href: `/app/projects/${row.id}`,
      recordId: row.id,
      severity: "warning",
    });
  }

  const criticalRisks = await db
    .select({ risk: projectRisks, project: projects })
    .from(projectRisks)
    .innerJoin(projects, eq(projectRisks.projectId, projects.id))
    .where(
      and(
        eq(projects.organizationId, organizationId),
        eq(projectRisks.status, "open"),
        inArray(projectRisks.severity, ["critical", "high"]),
      ),
    );
  for (const row of criticalRisks) {
    alerts.push({
      code: "unresolved_critical_risk",
      domain: "projects",
      title: `Unresolved critical risk: ${row.project.name}`,
      href: `/app/projects/${row.project.id}`,
      recordId: row.risk.id,
      severity: "critical",
    });
  }

  const overdueInvoices = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.organizationId, organizationId), or(eq(invoices.status, "overdue"), lte(invoices.dueDate, now))));
  for (const row of overdueInvoices.filter((invoice) => !["paid", "void", "draft"].includes(invoice.status))) {
    alerts.push({
      code: "overdue_invoice",
      domain: "finance",
      title: `Overdue invoice ${row.invoiceNumber}`,
      href: "/app/finance/invoices",
      recordId: row.id,
      severity: "critical",
    });
  }

  const failedBilling = await db
    .select()
    .from(integrationEvents)
    .where(
      and(
        eq(integrationEvents.organizationId, organizationId),
        eq(integrationEvents.provider, "quickbooks"),
        inArray(integrationEvents.status, ["failed", "error"]),
      ),
    );
  for (const row of failedBilling) {
    alerts.push({
      code: "failed_billing_sync",
      domain: "finance",
      title: "Failed billing sync",
      href: "/app/integrations/quickbooks",
      recordId: row.id,
      severity: "critical",
    });
  }

  const failedAi = await db
    .select()
    .from(agentRuns)
    .where(and(eq(agentRuns.organizationId, organizationId), eq(agentRuns.status, "failed")));
  for (const row of failedAi.slice(0, 25)) {
    alerts.push({
      code: "failed_agent_run",
      domain: "ai",
      title: `Failed agent run: ${row.taskKey}`,
      href: "/app/ai-operations/failures",
      recordId: row.id,
      severity: "warning",
    });
  }

  const reviewBacklog = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.organizationId, organizationId), eq(approvals.status, "pending")));
  if (reviewBacklog.length > 0) {
    alerts.push({
      code: "review_backlog",
      domain: "ai",
      title: `${reviewBacklog.length} items in review backlog`,
      href: "/app/ai-operations/review",
      recordId: reviewBacklog[0].id,
      severity: "warning",
    });
  }

  const failedSyncs = await listFailedIntegrationEvents(organizationId);
  for (const row of failedSyncs) {
    alerts.push({
      code: "sync_failure",
      domain: "integrations",
      title: `Sync failure: ${row.provider}`,
      href: "/app/integrations",
      recordId: row.id,
      severity: "critical",
    });
  }

  return alerts;
}
