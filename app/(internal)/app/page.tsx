import Link from "next/link";

import { Card } from "@/components/ui/display";
import { PageHeader, PageShell, formatDate, formatLabel } from "@/components/ui/page";
import { ScoreBadge } from "@/components/ui/display";
import { requireCurrentPrincipal } from "@/lib/auth/session";
import { getCommandCenterSnapshot } from "@/lib/repositories/command-center";
import { can } from "@/lib/rbac/permissions";
import { EmptyState } from "./_components/ui";

export default async function CommandCenterPage() {
  const principal = await requireCurrentPrincipal();
  const snapshot = await getCommandCenterSnapshot(principal.organizationId);
  const canOpportunities = can(principal, "opportunities.read");
  const canCandidates = can(principal, "candidates.read");
  const canJobs = can(principal, "jobs.read");

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="WorkforceOS / Executive view"
        title="Workforce Command Center"
        description="Live operating snapshot from PostgreSQL. Counts are stored records, not estimates."
        metadata={`${principal.roleSlugs.join(", ") || "no roles"} · ${snapshot.generatedAt.toLocaleString()}`}
      />

      <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {canOpportunities ? (
          <Card>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Pipeline</p>
            <p className="mt-2 font-serif text-[34px] font-semibold text-navy">
              {Object.values(snapshot.crm.opportunitiesByStage).reduce((sum, value) => sum + value, 0)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {Object.entries(snapshot.crm.opportunitiesByStage)
                .map(([stage, value]) => `${value} ${formatLabel(stage)}`)
                .join(" · ") || "No stages recorded"}
            </p>
          </Card>
        ) : null}
        {canOpportunities ? (
          <Link href="/app/opportunities" className="block">
            <Card>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Active opportunities</p>
              <p className="mt-2 font-serif text-[34px] font-semibold text-navy">{snapshot.crm.openOpportunities}</p>
            </Card>
          </Link>
        ) : null}
        {canJobs ? (
          <Link href="/app/jobs" className="block">
            <Card>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Active searches</p>
              <p className="mt-2 font-serif text-[34px] font-semibold text-navy">{snapshot.recruiting.openJobs}</p>
            </Card>
          </Link>
        ) : null}
        {canCandidates ? (
          <Link href="/app/talent" className="block">
            <Card>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Talent Network</p>
              <p className="mt-2 font-serif text-[34px] font-semibold text-navy">{snapshot.talent.candidateCount}</p>
            </Card>
          </Link>
        ) : null}
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {canOpportunities ? (
          <section>
            <h2 className="section-title">Priority opportunities</h2>
            {snapshot.priorityOpportunities.length === 0 ? (
              <EmptyState title="No priority opportunities.">
                Opportunities scoring 80 or classified as Priority will appear here.
              </EmptyState>
            ) : (
              <ul className="mt-4 divide-y divide-border rounded-[8px] border border-card-border bg-card">
                {snapshot.priorityOpportunities.map((opportunity) => (
                  <li key={opportunity.id} className="px-4 py-3">
                    <Link href={`/app/opportunities/${opportunity.id}`} className="font-medium text-navy">
                      {opportunity.name}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {opportunity.companyName}
                      {opportunity.serviceCode ? ` · ${formatLabel(opportunity.serviceCode)}` : ""}
                    </p>
                    <div className="mt-2">
                      <ScoreBadge score={opportunity.opportunityScore} band={opportunity.scoreBand} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {canOpportunities ? (
          <section>
            <h2 className="section-title">Recent workforce signals</h2>
            {snapshot.crm.recentSignals.length === 0 ? (
              <EmptyState title="No workforce signals detected yet.">
                Signals added manually or identified by future WorkforceOS intelligence services will appear here.
              </EmptyState>
            ) : (
              <ul className="mt-4 divide-y divide-border rounded-[8px] border border-card-border bg-card">
                {snapshot.crm.recentSignals.map((signal) => (
                  <li key={signal.id} className="px-4 py-3 text-sm">
                    <Link href="/app/signals" className="font-medium text-navy">
                      {signal.title}
                    </Link>
                    <p className="text-muted-foreground">
                      {signal.companyName} · {formatLabel(signal.reviewStatus)} · {formatDate(signal.detectedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {canCandidates ? (
          <section>
            <h2 className="section-title">Talent requiring attention</h2>
            {snapshot.talentAttention.length === 0 ? (
              <EmptyState title="No talent records need attention.">
                Profiles without a recent review or contact will appear here.
              </EmptyState>
            ) : (
              <ul className="mt-4 divide-y divide-border rounded-[8px] border border-card-border bg-card">
                {snapshot.talentAttention.map((candidate) => (
                  <li key={candidate.id} className="px-4 py-3 text-sm">
                    <Link href={`/app/talent/${candidate.id}`} className="font-medium text-navy">
                      {candidate.fullName}
                    </Link>
                    <p className="text-muted-foreground">
                      {candidate.currentTitle ?? "No title"} · last contact {formatDate(candidate.lastContactedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <section>
          <h2 className="section-title">Pending approvals</h2>
          {snapshot.pendingApprovals.length === 0 ? (
            <EmptyState title="No pending approvals.">
              Material AI and client-facing outputs that require human review will appear here.
            </EmptyState>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-[8px] border border-card-border bg-card">
              {snapshot.pendingApprovals.map((approval) => (
                <li key={approval.id} className="px-4 py-3 text-sm">
                  <Link href="/app/admin/approvals" className="font-medium text-navy">
                    {approval.approvalType}
                  </Link>
                  <p className="text-muted-foreground">
                    {approval.recordType} · {formatDate(approval.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-10">
        <h2 className="section-title">Recent activity</h2>
        {snapshot.recentActivities.length === 0 ? (
          <EmptyState title="No recent activity.">
            Notes, meetings, and status changes will appear as they are logged.
          </EmptyState>
        ) : (
          <ol className="mt-4 space-y-3 rounded-[8px] border border-card-border bg-card p-4">
            {snapshot.recentActivities.map((activity) => (
              <li key={activity.id} className="border-l border-border pl-4 text-sm">
                <p className="font-medium text-navy">{activity.subject}</p>
                <p className="text-muted-foreground">
                  {formatLabel(activity.activityType)} · {formatDate(activity.occurredAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </PageShell>
  );
}
