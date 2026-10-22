import Link from "next/link";

import { requireAnyAppPermission } from "@/lib/auth/guard";
import { listEngagementQueue } from "@/lib/recruiting/opportunity-engagement";
import type { QueueBucket } from "@/lib/recruiting/engagement-policy";
import { PageHeader, PageShell, formatLabel } from "../../_components/ui";
import { JobsSubnav } from "../_components/jobs-subnav";

const BUCKETS: Array<{ id: QueueBucket; label: string }> = [
  { id: "needs_outreach", label: "Needs outreach" },
  { id: "follow_up_due", label: "Follow-up due" },
  { id: "overdue", label: "Overdue" },
  { id: "no_response", label: "No response" },
  { id: "employer_responded", label: "Employer responded" },
  { id: "candidate_response_needed", label: "Candidate response needed" },
  { id: "interview_next", label: "Interview next step" },
  { id: "referral_needs_routing", label: "Referral needs routing" },
  { id: "no_fit_needs_decision", label: "No fit needs a decision" },
];

export default async function EngagementQueuePage() {
  const principal = await requireAnyAppPermission(["jobs.read", "candidates.read"]);
  const rows = await listEngagementQueue(principal.organizationId, null);
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Talent"
        title="Follow-ups"
        description="Active routes and outreach. A scheduled check can raise an alert. It does not email anyone."
      />
      <JobsSubnav active="/app/jobs/engagements" />
      <div className="mt-6 space-y-8">
        <section>
          <h2 className="text-sm font-medium text-navy">Waiting</h2>
          {rows.filter((row) => row.buckets.length === 0).length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {rows.filter((row) => row.buckets.length === 0).map((row) => (
                <li key={`waiting-${row.id}`}>
                  <Link className="font-medium text-navy underline" href={`/app/jobs/engagements/${row.id}`}>
                    {row.candidateName} · {row.jobTitle}
                  </Link>
                  <span className="text-muted-foreground">
                    {" · "}
                    {row.ownerName ?? "Unassigned"}
                    {" · "}
                    {row.publicLabel ?? row.contextLabel}
                    {" · "}
                    {formatLabel(row.status)}
                    {" · aging "}
                    {row.agingDays}
                    {" days"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        {BUCKETS.map((bucket) => {
          const items = rows.filter((row) => row.buckets.includes(bucket.id));
          return (
            <section key={bucket.id}>
              <h2 className="text-sm font-medium text-navy">{bucket.label}</h2>
              {items.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">None.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {items.map((row) => (
                    <li key={`${bucket.id}-${row.id}`}>
                      <Link className="font-medium text-navy underline" href={`/app/jobs/engagements/${row.id}`}>
                        {row.candidateName} · {row.jobTitle}
                      </Link>
                      <span className="text-muted-foreground">
                        {" · "}
                        {row.publicLabel ?? row.contextLabel}
                        {" · "}
                        {row.ownerName ?? "Unassigned"}
                        {" · "}
                        {formatLabel(row.status)}
                        {" · aging "}
                        {row.agingDays}
                        {" days · waiting on "}
                        {row.waitingOn}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
