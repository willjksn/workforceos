import { MetricCard } from "@/components/ui/display";
import {
  EmptyState,
  PageHeader,
  PageShell,
  RecordList,
  RecordRow,
  SectionHeader,
  formatDate,
  formatLabel,
} from "@/components/ui/page";
import { requireCurrentPrincipal } from "@/lib/auth/session";
import { moneyString } from "@/lib/finance/money";
import { can } from "@/lib/rbac/permissions";
import { getExecutiveCommandCenter } from "@/lib/reporting/executive";
import { evaluateOperationalAlerts } from "@/lib/alerts/evaluate";

function money(value: number) {
  return `$${moneyString(value)}`;
}

function ratio(value: number | null) {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

export default async function CommandCenterPage() {
  const principal = await requireCurrentPrincipal();
  const snapshot = await getExecutiveCommandCenter(principal.organizationId);
  const alerts = can(principal, "alerts.read") || can(principal, "reports.read")
    ? await evaluateOperationalAlerts(principal.organizationId)
    : [];
  const canOpportunities = can(principal, "opportunities.read");
  const canCandidates = can(principal, "candidates.read");
  const canJobs = can(principal, "jobs.read");
  const canFinance = can(principal, "finance.read");

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="WorkforceOS / Executive view"
        title="Workforce Command Center"
        description="Live operating snapshot from PostgreSQL. Counts and amounts are stored records, not estimates."
        metadata={`${principal.roleSlugs.join(", ") || "no roles"} · ${snapshot.generatedAt.toLocaleString()}`}
      />

      {canFinance ? (
        <section className="mt-8">
          <SectionHeader title="Business" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard href="/app/reports/business" label="Contracted revenue" value={money(snapshot.business.contractedRevenue)} />
            <MetricCard href="/app/finance/invoices" label="Invoiced" value={money(snapshot.business.invoiced)} />
            <MetricCard href="/app/finance/ar" label="Collected" value={money(snapshot.business.collected)} />
            <MetricCard href="/app/finance/schedules" label="MRR" value={money(snapshot.business.mrr)} />
            <MetricCard href="/app/finance/ar" label="AR" value={money(snapshot.business.ar)} />
            <MetricCard href="/app/opportunities" label="Pipeline value" value={money(snapshot.business.pipelineValue)} />
            <MetricCard href="/app/reports/sales" label="Win rate" value={ratio(snapshot.business.winRate)} />
          </div>
        </section>
      ) : null}

      {canOpportunities ? (
        <section className="mt-8">
          <SectionHeader title="Sales" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard href="/app/opportunities" label="Priority opportunities" value={snapshot.sales.priorityOpportunities.length} />
            <MetricCard href="/app/opportunities" label="Stale opportunities" value={snapshot.sales.staleOpportunities.length} />
            <MetricCard href="/app/discovery" label="Discovery" value={snapshot.sales.discovery} />
            <MetricCard href="/app/proposals" label="Proposals" value={snapshot.sales.proposals} />
            <MetricCard href="/app/contracts" label="Contracts pending" value={snapshot.sales.contractsPending} />
          </div>
        </section>
      ) : null}

      {canJobs ? (
        <section className="mt-8">
          <SectionHeader title="Recruiting" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard href="/app/jobs" label="Active searches" value={snapshot.recruiting.activeSearches} />
            <MetricCard href="/app/reports/recruiting" label="Time to shortlist" value={snapshot.recruiting.timeToShortlistDays ?? "—"} hint="Days when both search dates exist" />
            <MetricCard href="/app/reports/recruiting" label="Time to fill" value={snapshot.recruiting.timeToFillDays ?? "—"} hint="Days when start date exists" />
            <MetricCard href="/app/submissions" label="Submissions" value={snapshot.recruiting.submissions} />
            <MetricCard href="/app/interviews" label="Interviews" value={snapshot.recruiting.interviews} />
            <MetricCard href="/app/offers" label="Offers" value={snapshot.recruiting.offers} />
            <MetricCard href="/app/placements" label="Placements" value={snapshot.recruiting.placements} />
            <MetricCard href="/app/guarantees" label="Guarantee risk" value={snapshot.recruiting.guaranteeRisk} />
          </div>
        </section>
      ) : null}

      {canCandidates ? (
        <section className="mt-8">
          <SectionHeader title="Talent Network" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard href="/app/talent" label="Total candidates" value={snapshot.talent.totalCandidates} />
            <MetricCard href="/app/talent" label="Available now" value={snapshot.talent.availableNow} />
            <MetricCard href="/app/talent/silver-medalists" label="Silver medalists" value={snapshot.talent.silverMedalists} />
            <MetricCard href="/app/talent/pools" label="Talent pool health" value={snapshot.talent.talentPoolHealth} />
            <MetricCard href="/app/talent/rediscovery" label="Rediscovery candidates" value={snapshot.talent.rediscoveryCandidates} />
            <MetricCard href="/app/military/candidates" label="Military candidates" value={snapshot.talent.militaryCandidates} />
          </div>
        </section>
      ) : null}

      {can(principal, "workforce.read") ? (
        <section className="mt-8">
          <SectionHeader title="Workforce" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard href="/app/workforce/assessments" label="Assessments in progress" value={snapshot.workforce.assessmentsInProgress} />
            <MetricCard href="/app/workforce/gaps" label="Critical workforce gaps" value={snapshot.workforce.criticalGaps} />
            <MetricCard href="/app/workforce/pipelines" label="Pipeline capacity" value={snapshot.workforce.pipelineCapacity} hint="Pipelines currently at risk" />
            <MetricCard href="/app/workforce" label="Workforce risks" value={snapshot.workforce.workforceRisks} />
            <MetricCard href="/app/admin/approvals" label="Recommendations awaiting approval" value={snapshot.workforce.recommendationsAwaitingApproval} />
          </div>
        </section>
      ) : null}

      {can(principal, "projects.read") ? (
        <section className="mt-8">
          <SectionHeader title="Projects" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard href="/app/projects?filter=active" label="Active" value={snapshot.projects.active} />
            <MetricCard href="/app/projects?filter=at_risk" label="At risk" value={snapshot.projects.atRisk} />
            <MetricCard href="/app/projects/deliverables" label="Overdue deliverables" value={snapshot.projects.overdueDeliverables} />
            <MetricCard href="/app/projects" label="Upcoming milestones" value={snapshot.projects.upcomingMilestones.length} />
          </div>
        </section>
      ) : null}

      {can(principal, "agents.read") ? (
        <section className="mt-8">
          <SectionHeader title="AI" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard href="/app/ai-operations/review" label="Pending reviews" value={snapshot.ai.pendingReviews} />
            <MetricCard href="/app/ai-operations/failures" label="Failed runs" value={snapshot.ai.failedRuns} />
            <MetricCard href="/app/ai-operations/costs" label="Usage / cost" value={money(snapshot.ai.usageCost)} />
          </div>
        </section>
      ) : null}

      {can(principal, "integrations.read") || canFinance ? (
        <section className="mt-8">
          <SectionHeader title="Integrations" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard href="/app/integrations" label="Failed syncs" value={snapshot.integrations.failedSyncs} />
            <MetricCard href="/app/integrations" label="Unhealthy providers" value={snapshot.integrations.unhealthyProviders} />
          </div>
        </section>
      ) : null}

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {canOpportunities ? (
          <section>
            <SectionHeader title="Priority opportunities" />
            {snapshot.sales.priorityOpportunities.length === 0 ? (
              <EmptyState title="No priority opportunities.">Opportunities scoring 80 or classified as Priority will appear here.</EmptyState>
            ) : (
              <RecordList>
                {snapshot.sales.priorityOpportunities.map((opportunity) => (
                  <RecordRow
                    key={opportunity.id}
                    href={`/app/opportunities/${opportunity.id}`}
                    title={opportunity.name}
                    meta={`${opportunity.companyName}${opportunity.serviceCode ? ` · ${formatLabel(opportunity.serviceCode)}` : ""}`}
                  />
                ))}
              </RecordList>
            )}
          </section>
        ) : null}

        {alerts.length > 0 ? (
          <section>
            <SectionHeader title="Operational alerts" />
            <RecordList>
              {alerts.slice(0, 8).map((alert) => (
                <RecordRow key={`${alert.code}-${alert.recordId}`} href={alert.href} title={alert.title} meta={`${formatLabel(alert.domain)} · ${alert.severity}`} />
              ))}
            </RecordList>
          </section>
        ) : (
          <section>
            <SectionHeader title="Pending approvals" />
            {snapshot.base.pendingApprovals.length === 0 ? (
              <EmptyState title="No pending approvals.">Material AI and client-facing outputs that require human review will appear here.</EmptyState>
            ) : (
              <RecordList>
                {snapshot.base.pendingApprovals.map((approval) => (
                  <RecordRow
                    key={approval.id}
                    href="/app/admin/approvals"
                    title={formatLabel(approval.approvalType)}
                    meta={`${approval.recordType} · ${formatDate(approval.createdAt)}`}
                  />
                ))}
              </RecordList>
            )}
          </section>
        )}
      </div>
    </PageShell>
  );
}
