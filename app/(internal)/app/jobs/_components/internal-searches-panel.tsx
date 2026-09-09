import Link from "next/link";

import { listSearchProjects } from "@/lib/repositories/recruiting";
import { DataTable, EmptyState, StatusBadge, formatLabel } from "../../_components/ui";

export async function InternalSearchesPanel({ organizationId }: { organizationId: string }) {
  const rows = await listSearchProjects(organizationId);

  return rows.length === 0 ? (
    <EmptyState title="No internal searches yet.">
      Activating a job creates an Internal Talent Network search before any external sourcing hook.
    </EmptyState>
  ) : (
    <DataTable columns={["Search", "Job", "Company", "Status", "Internal search"]}>
      {rows.map((row) => (
        <tr key={row.project.id}>
          <td>
            <Link className="font-medium text-navy" href={`/app/search-projects/${row.project.id}`}>
              {row.project.name}
            </Link>
          </td>
          <td>{row.job.title}</td>
          <td>{row.companyName ?? "—"}</td>
          <td>
            <StatusBadge>{formatLabel(row.project.status)}</StatusBadge>
          </td>
          <td>{row.project.internalSearchCompletedAt ? "Complete" : "Required first"}</td>
        </tr>
      ))}
    </DataTable>
  );
}
