import Link from "next/link";

import { requireAnyAppPermission } from "@/lib/auth/guard";
import { listEmployerOpportunityCards } from "@/lib/skillbridge/service";
import { StatusBadge } from "@/components/ui/display";
import { EmptyState, PageHeader, PageShell, formatLabel } from "../../_components/ui";
import { MilitarySubnav } from "../_components/military-subnav";

export default async function EmployerOpportunitiesPage() {
  const principal = await requireAnyAppPermission(["skillbridge.read", "military.read"]);
  const rows = await listEmployerOpportunityCards(principal.organizationId);

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Military talent"
        title="Employer opportunities"
        description="Host-company and employer matching records for transitioning talent. PierOne facilitates the match; the employer/host company owns the opportunity. A public job posting is not required to begin matching."
      />
      <MilitarySubnav active="/app/military/opportunities" />
      <div className="mt-6 space-y-3">
        {rows.length === 0 ? (
          <EmptyState title="No employer opportunities yet.">
            Add an employer/host-company opportunity from a Transition Talent Profile. Matching can start before a public job is posted.
          </EmptyState>
        ) : (
          rows.map((row) => (
            <article key={row.opportunity.id} className="rounded-[8px] border border-card-border bg-card p-5 shadow-[var(--shadow-sm)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-xl text-navy">{row.hostCompanyName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Host company / employer
                    {row.roleTitle ? ` · ${row.roleTitle}` : ""}
                    {row.skillbridgeEligible ? " · SkillBridge-eligible" : ""}
                  </p>
                </div>
                <StatusBadge>{formatLabel(row.opportunity.stage)}</StatusBadge>
              </div>
              <p className="mt-3 text-sm text-navy">
                Transitioning talent:{" "}
                <Link className="underline" href={`/app/military/skillbridge/${row.profile.id}`}>
                  {row.candidateName}
                </Link>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{row.intermediaryNote}</p>
            </article>
          ))
        )}
      </div>
    </PageShell>
  );
}
