import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { listSearchProjects } from "@/lib/repositories/recruiting";
import { PageHeader, PageShell, formatLabel } from "../_components/ui";
import { StatusBadge } from "@/components/ui/display";

export default async function SearchProjectsPage() {
  await requireAppPermission("search_projects.read");
  const principal = await requireAppPermission("search_projects.read");
  const rows = await listSearchProjects(principal.organizationId);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Recruiting"
        title="Search projects"
        description="Each job has an internal-first search project. Strategy is client-facing only after human approval."
      />
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">Project</th>
            <th>Job</th>
            <th>Company</th>
            <th>Status</th>
            <th>Internal search</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.project.id} className="border-b border-border">
              <td className="py-2">
                <Link className="text-navy underline" href={`/app/search-projects/${row.project.id}`}>
                  {row.project.name}
                </Link>
              </td>
              <td>{row.job.title}</td>
              <td>{row.companyName ?? "—"}</td>
              <td><StatusBadge>{formatLabel(row.project.status)}</StatusBadge></td>
              <td>{row.project.internalSearchCompletedAt ? "Complete" : "Required first"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  );
}
