import { MetricCard, ScoreBadge } from "@/components/ui/display";
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
import { getCommandCenterSnapshot } from "@/lib/repositories/command-center";
import { can } from "@/lib/rbac/permissions";

export default async function CommandCenterPage() {
  const principal = await requireCurrentPrincipal();
  const snapshot = await getCommandCenterSnapshot(principal.organizationId);
  const canOpportunities = can(principal, "opportunities.read");
  const canCandidates = can(principal, "candidates.read");
  const canJobs = can(principal, "jobs.read");
  const pipelineHint =
    Object.entries(snapshot.crm.opportunitiesByStage)
      .map(([stage, value]) => `${value} ${formatLabel(stage)}`)
      .join(" · ") || "No stages recorded";

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="WorkforceOS / Executive view"
        title="Workforce Command Center"
        description="Live operating snapshot from PostgreSQL. Counts are stored records, not estimates."
        metadata={`${principal.roleSlugs.join(", ") || "no roles"} · ${snapshot.generatedAt.toLocaleString()}`}
      />

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {canOpportunities ? (
          <MetricCard
            href="/app/opportunities"
            label="Pipeline"
            value={Object.values(snapshot.crm.opportunitiesByStage).reduce((sum, value) => sum + value, 0)}
            hint={pipelineHint}
          />
        ) : null}
        {canOpportunities ? (
          <MetricCard href="/app/opportunities" label="Active opportunities" value={snapshot.crm.openOpportunities} />
        ) : null}
        {canJobs ? (
          <MetricCard href="/app/jobs" label="Active searches" value={snapshot.recruiting.openJobs} />
        ) : null}
        {canCandidates ? (
          <MetricCard href="/app/talent" label="Talent Network" value={snapshot.talent.candidateCount} />
        ) : null}
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {canOpportunities ? (
          <section>
            <SectionHeader title="Priority opportunities" />
            {snapshot.priorityOpportunities.length === 0 ? (
              <EmptyState title="No priority opportunities.">
                Opportunities scoring 80 or classified as Priority will appear here.
              </EmptyState>
            ) : (
              <RecordList>
                {snapshot.priorityOpportunities.map((opportunity) => (
                  <RecordRow
                    key={opportunity.id}
                    href={`/app/opportunities/${opportunity.id}`}
                    title={opportunity.name}
                    meta={`${opportunity.companyName}${opportunity.serviceCode ? ` · ${formatLabel(opportunity.serviceCode)}` : ""}`}
                    trailing={<ScoreBadge score={opportunity.opportunityScore} band={opportunity.scoreBand} />}
                  />
                ))}
              </RecordList>
            )}
          </section>
        ) : null}

        {canOpportunities ? (
          <section>
            <SectionHeader title="Recent workforce signals" />
            {snapshot.crm.recentSignals.length === 0 ? (
              <EmptyState title="No workforce signals detected yet.">
                Signals added manually or identified by future WorkforceOS intelligence services will appear here.
              </EmptyState>
            ) : (
              <RecordList>
                {snapshot.crm.recentSignals.map((signal) => (
                  <RecordRow
                    key={signal.id}
                    href="/app/signals"
                    title={signal.title}
                    meta={`${signal.companyName} · ${formatLabel(signal.reviewStatus)} · ${formatDate(signal.detectedAt)}`}
                  />
                ))}
              </RecordList>
            )}
          </section>
        ) : null}

        {canCandidates ? (
          <section>
            <SectionHeader title="Talent requiring attention" />
            {snapshot.talentAttention.length === 0 ? (
              <EmptyState title="No talent records need attention.">
                Profiles without a recent review or contact will appear here.
              </EmptyState>
            ) : (
              <RecordList>
                {snapshot.talentAttention.map((candidate) => (
                  <RecordRow
                    key={candidate.id}
                    href={`/app/talent/${candidate.id}`}
                    title={candidate.fullName}
                    meta={`${candidate.currentTitle ?? "No title"} · last contact ${formatDate(candidate.lastContactedAt)}`}
                  />
                ))}
              </RecordList>
            )}
          </section>
        ) : null}

        <section>
          <SectionHeader title="Pending approvals" />
          {snapshot.pendingApprovals.length === 0 ? (
            <EmptyState title="No pending approvals.">
              Material AI and client-facing outputs that require human review will appear here.
            </EmptyState>
          ) : (
            <RecordList>
              {snapshot.pendingApprovals.map((approval) => (
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
      </div>

      <section className="mt-10">
        <SectionHeader title="Recent activity" />
        {snapshot.recentActivities.length === 0 ? (
          <EmptyState title="No recent activity.">
            Notes, meetings, and status changes will appear as they are logged.
          </EmptyState>
        ) : (
          <RecordList>
            {snapshot.recentActivities.map((activity) => (
              <RecordRow
                key={activity.id}
                title={activity.subject}
                meta={`${formatLabel(activity.activityType)} · ${formatDate(activity.occurredAt)}`}
              />
            ))}
          </RecordList>
        )}
      </section>
    </PageShell>
  );
}
