import Link from "next/link";

import { requireCurrentPrincipal } from "@/lib/auth/session";
import { getCommandCenterSnapshot } from "@/lib/repositories/command-center";
import { can } from "@/lib/rbac/permissions";
import { EmptyState, MetricCard, PageHeader, formatDate, formatLabel } from "./_components/ui";

export default async function CommandCenterPage() {
  const principal = await requireCurrentPrincipal();
  const snapshot = await getCommandCenterSnapshot(principal.organizationId);
  const canCompanies = can(principal, "companies.read");
  const canOpportunities = can(principal, "opportunities.read");
  const canCandidates = can(principal, "candidates.read");
  const canJobs = can(principal, "jobs.read");

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        title="Command Center"
        description="Live operating snapshot from PostgreSQL. Counts are not estimates."
      />
      <p className="mt-2 text-xs text-zinc-500">
        {principal.roleSlugs.join(", ") || "no roles"} · generated {snapshot.generatedAt.toLocaleString()}
      </p>

      {canCompanies || canOpportunities ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">CRM</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {canCompanies ? (
              <>
                <MetricCard href="/app/companies" label="Active prospects" value={snapshot.crm.activeProspects} />
                <MetricCard href="/app/companies" label="Active clients" value={snapshot.crm.activeClients} />
              </>
            ) : null}
            {canOpportunities ? (
              <>
                <MetricCard href="/app/opportunities" label="Open opportunities" value={snapshot.crm.openOpportunities} />
                <MetricCard
                  href="/app/opportunities?scoreBand=priority"
                  label="High priority"
                  value={snapshot.crm.highPriorityOpportunities}
                />
              </>
            ) : null}
          </div>
          {canOpportunities ? (
            <>
              <h3 className="mt-6 text-sm font-semibold">Pipeline by stage</h3>
              {Object.keys(snapshot.crm.opportunitiesByStage).length === 0 ? (
                <EmptyState>No opportunities recorded yet.</EmptyState>
              ) : (
                <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                  {Object.entries(snapshot.crm.opportunitiesByStage).map(([stage, count]) => (
                    <li key={stage} className="flex justify-between rounded border px-3 py-2">
                      <Link className="underline" href={`/app/opportunities?stage=${stage}`}>
                        {formatLabel(stage)}
                      </Link>
                      <span>{count}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold">Recent signals</h3>
                  {snapshot.crm.recentSignals.length === 0 ? (
                    <EmptyState>No signals detected.</EmptyState>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm">
                      {snapshot.crm.recentSignals.map((signal) => (
                        <li key={signal.id}>
                          <Link className="underline" href="/app/signals">
                            {signal.title}
                          </Link>
                          <span className="text-zinc-500">
                            {" "}
                            · {signal.companyName} · {formatLabel(signal.reviewStatus)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Stale opportunities (14+ days)</h3>
                  {snapshot.crm.staleOpportunities.length === 0 ? (
                    <EmptyState>No stale open opportunities.</EmptyState>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm">
                      {snapshot.crm.staleOpportunities.map((opportunity) => (
                        <li key={opportunity.id}>
                          <Link className="underline" href={`/app/opportunities/${opportunity.id}`}>
                            {opportunity.name}
                          </Link>
                          <span className="text-zinc-500">
                            {" "}
                            · {opportunity.companyName} · {formatDate(opportunity.updatedAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <h3 className="mt-6 text-sm font-semibold">Upcoming follow-ups</h3>
              {snapshot.crm.upcomingFollowUps.length === 0 ? (
                <EmptyState>No follow-ups scheduled in the next 14 days.</EmptyState>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {snapshot.crm.upcomingFollowUps.map((item) => (
                    <li key={item.id}>
                      <Link className="underline" href={item.href}>
                        {item.label}
                      </Link>
                      <span className="text-zinc-500">
                        {" "}
                        · {item.nextAction ?? "follow up"} · {formatDate(item.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </section>
      ) : null}

      {canCandidates ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Talent Network</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard href="/app/talent" label="Candidates" value={snapshot.talent.candidateCount} />
            <MetricCard href="/app/talent" label="Added this month" value={snapshot.talent.candidatesAddedThisMonth} />
            <MetricCard href="/app/talent/pools" label="Talent pools" value={snapshot.talent.talentPoolCount} />
            <MetricCard
              href="/app/talent/silver-medalists"
              label="Silver medalists"
              value={snapshot.talent.silverMedalistDesignations}
            />
            <MetricCard href="/app/talent/search?availability=available_now" label="Available now" value={snapshot.talent.availableNow} />
            <MetricCard href="/app/talent" label="Military talent" value={snapshot.talent.militaryTalent} />
            <MetricCard href="/app/talent" label="Profiles needing review" value={snapshot.talent.profilesNeedingReview} />
            <MetricCard href="/app/talent/rediscovery" label="Rediscovery due" value={snapshot.talent.rediscoveryDue} />
          </div>
        </section>
      ) : null}

      {canJobs ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Recruiting</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard href="/app/jobs" label="Open jobs" value={snapshot.recruiting.openJobs} />
          </div>
        </section>
      ) : null}
    </main>
  );
}
