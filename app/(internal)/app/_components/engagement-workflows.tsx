import Link from "next/link";

import { formatLabel } from "./ui";

export type EngagementWorkflowRow = {
  id: string;
  jobTitle: string;
  candidateName: string;
  companyName: string | null;
  contactName: string | null;
  ownerName: string | null;
  status: string;
  matchCategory: string | null;
  contextLabel: string;
  publicLabel: string | null;
  nextFollowUpAt: Date | null;
  lastActivityAt: Date;
  agingDays: number;
  employerResponse: string | null;
  waitingOn: string;
};

function when(value: Date | null) {
  if (!value) return "No follow-up date";
  return value.toISOString().slice(0, 10);
}

export function EngagementWorkflowList({
  rows,
  showCandidate = false,
}: {
  rows: EngagementWorkflowRow[];
  showCandidate?: boolean;
}) {
  if (!rows.length) return null;
  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-sm font-medium text-navy">Active opportunity workflows</h3>
      {rows.map((row) => (
        <article key={row.id} className="rounded-[8px] border border-card-border bg-card p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link className="font-medium text-navy underline" href={`/app/jobs/engagements/${row.id}`}>
                {showCandidate ? row.candidateName : row.jobTitle}
              </Link>
              <p className="text-muted-foreground">
                {row.publicLabel ?? row.contextLabel}
                {" · "}
                Match {row.matchCategory ? formatLabel(row.matchCategory) : "not calculated"}
                {" · "}
                Workflow {formatLabel(row.status)}
              </p>
            </div>
            <p className="text-muted-foreground">Aging {row.agingDays} days</p>
          </div>
          <p className="mt-2 text-muted-foreground">
            Owner {row.ownerName ?? "Unassigned"}
            {" · "}
            {row.companyName ?? "No company"}
            {row.contactName ? ` · ${row.contactName}` : ""}
            {" · "}
            {row.employerResponse ? formatLabel(row.employerResponse) : "No employer response"}
            {" · Waiting on "}
            {row.waitingOn}
            {" · Follow-up "}
            {when(row.nextFollowUpAt)}
            {" · Last activity "}
            {when(row.lastActivityAt)}
          </p>
        </article>
      ))}
    </div>
  );
}
