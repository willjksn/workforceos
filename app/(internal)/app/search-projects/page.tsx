import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { listSearchProjects } from "@/lib/repositories/recruiting";
import { DataTable, EmptyState, PageHeader, PageShell, StatusBadge, formatLabel } from "../_components/ui";

export default async function SearchProjectsPage() {
  const principal = await requireAppPermission("search_projects.read");
  const rows = await listSearchProjects(principal.organizationId);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Recruiting"
        title="Search projects"
        description="Each job has an internal-first search project. Strategy is client-facing only after human approval."
      />
      {rows.length === 0 ? (
        <EmptyState title="No search projects yet.">
          Activating a job creates an Internal Talent Network search project before any external sourcing hook.
        </EmptyState>
      ) : (
        <DataTable columns={["Project", "Job", "Company", "Status", "Internal search"]}>
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
      )}
    </PageShell>
  );
}
