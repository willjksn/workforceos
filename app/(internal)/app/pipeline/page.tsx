import { requireAppPermission } from "@/lib/auth/guard";
import { listJobs } from "@/lib/repositories/recruiting";
import {
  EmptyState,
  PageHeader,
  PageShell,
  RecordList,
  RecordRow,
  StatusBadge,
  formatLabel,
} from "../_components/ui";

export default async function PipelineIndexPage() {
  const principal = await requireAppPermission("jobs.read");
  const rows = await listJobs(principal.organizationId);
  const active = rows.filter((row) => ["open", "search_active"].includes(row.job.status));

  return (
    <PageShell>
      <PageHeader
        eyebrow="Recruiting"
        title="Candidate pipeline"
        description="Open each search to move candidates. Pipeline history is audited and never overwritten."
      />
      {active.length === 0 ? (
        <EmptyState title="No open searches.">
          Activate a job to start an Internal Talent Network search. Its pipeline will appear here.
        </EmptyState>
      ) : (
        <RecordList>
          {active.map((row) => (
            <RecordRow
              key={row.job.id}
              href={`/app/jobs/${row.job.id}/pipeline`}
              title={row.job.title}
              meta={`${row.activePipelineCount} in pipeline${row.companyName ? ` · ${row.companyName}` : ""}`}
              trailing={
                <StatusBadge tone={row.job.status === "search_active" ? "teal" : "navy"}>
                  {formatLabel(row.job.status)}
                </StatusBadge>
              }
            />
          ))}
        </RecordList>
      )}
    </PageShell>
  );
}
