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

const STATUS_GROUPS: Record<string, { label: string; statuses: readonly string[] }> = {
  started: {
    label: "Engagements started",
    statuses: ["ready_for_review", "ready_for_outreach", "routed", "contacted"],
  },
  interview: { label: "Interviews", statuses: ["interview"] },
  reviewing: { label: "Reviewing", statuses: ["reviewing"] },
  no_fit: { label: "No Fit", statuses: ["no_fit"] },
};

export default async function EngagementQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string; waiting?: string; status?: string; view?: string }>;
}) {
  const principal = await requireAnyAppPermission(["jobs.read", "candidates.read"]);
  const { bucket, waiting, status, view } = await searchParams;
  const selected = BUCKETS.find((item) => item.id === bucket);
  const statusGroup = status ? STATUS_GROUPS[status] : undefined;
  const employerReview = view === "employer_review";
  const waitingDays = waiting && /^\d+$/.test(waiting) ? Number(waiting) : null;
  const loaded = await listEngagementQueue(principal.organizationId, null);
  const rows = loaded.filter((row) => {
    if (waitingDays != null && row.agingDays <= waitingDays) return false;
    if (statusGroup && !statusGroup.statuses.includes(row.status)) return false;
    if (employerReview && row.status !== "reviewing" && !row.buckets.includes("employer_responded")) return false;
    return true;
  });
  const focused = Boolean(statusGroup || employerReview);
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Talent"
        title="Follow-ups"
        description="Active routes and outreach. A scheduled check can raise an alert. It does not email anyone."
      />
      <JobsSubnav active="/app/jobs/engagements" />
      {selected ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Showing {selected.label}. <Link className="underline" href="/app/jobs/engagements">All follow-ups</Link>
        </p>
      ) : null}
      {focused ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Showing {employerReview ? "Employer reviewing" : statusGroup?.label}. <Link className="underline" href="/app/jobs/engagements">All follow-ups</Link>
        </p>
      ) : null}
      {waitingDays != null ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Showing engagements waiting more than {waitingDays} days. Aging uses the last activity time.
        </p>
      ) : null}
      <div className="mt-6 space-y-8">
        {focused ? (
          <section>
            <h2 className="text-sm font-medium text-navy">{employerReview ? "Employer reviewing" : statusGroup?.label}</h2>
            {rows.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No items need attention.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {rows.map((row) => (
                  <li key={row.id}>
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
        ) : null}
        {selected || focused ? null : (
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
        )}
        {(focused ? [] : selected ? [selected] : BUCKETS).map((bucket) => {
          const items = rows.filter((row) => row.buckets.includes(bucket.id));
          return (
            <section key={bucket.id}>
              <h2 className="text-sm font-medium text-navy">{bucket.label}</h2>
              {items.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{selected ? "No items need attention." : "None."}</p>
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
