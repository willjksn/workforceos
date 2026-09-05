import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { listDeliveryProjects } from "@/lib/delivery/engine";
import { DataTable, EmptyState, PageHeader, PageShell, formatLabel } from "../_components/ui";
import { StatusBadge } from "@/components/ui/display";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const principal = await requireAppPermission("projects.read");
  const { filter } = await searchParams;
  const rows = await listDeliveryProjects(principal.organizationId, filter);

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Projects"
        title={filter ? `${formatLabel(filter)} projects` : "Delivery projects"}
        description="Delivery projects are created from an approved solution plan, service workflow, and executed contract. Search projects stay under Recruiting."
      />
      {rows.length === 0 ? (
        <EmptyState title="No delivery projects in this view.">
          Create a project from an approved plan after contract execution.
        </EmptyState>
      ) : (
        <DataTable columns={["Project", "Client", "Service", "Status", "Health", "Value"]}>
          {rows.map((row) => (
            <tr key={row.project.id}>
              <td>
                <Link className="font-medium text-navy" href={`/app/projects/${row.project.id}`}>
                  {row.project.name}
                </Link>
              </td>
              <td>{row.companyName ?? "—"}</td>
              <td>{row.serviceName ?? "—"}</td>
              <td>
                <StatusBadge
                  tone={
                    row.project.status === "at_risk"
                      ? "warning"
                      : row.project.status === "completed"
                        ? "success"
                        : "navy"
                  }
                >
                  {formatLabel(row.project.status)}
                </StatusBadge>
              </td>
              <td>{formatLabel(row.project.health)}</td>
              <td>{row.project.contractValue ?? "—"}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
