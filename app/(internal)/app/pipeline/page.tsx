import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { listJobs } from "@/lib/repositories/recruiting";
import { PageHeader, PageShell, formatLabel } from "../_components/ui";

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
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">Job</th>
            <th>Status</th>
            <th>Active pipeline</th>
          </tr>
        </thead>
        <tbody>
          {active.map((row) => (
            <tr key={row.job.id} className="border-b border-border">
              <td className="py-2">
                <Link className="text-navy underline" href={`/app/jobs/${row.job.id}/pipeline`}>
                  {row.job.title}
                </Link>
              </td>
              <td>{formatLabel(row.job.status)}</td>
              <td>{row.activePipelineCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  );
}
