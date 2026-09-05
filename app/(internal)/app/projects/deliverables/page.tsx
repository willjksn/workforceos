import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { listDeliverables } from "@/lib/delivery/engine";
import { DataTable, EmptyState, PageHeader, PageShell, formatDate, formatLabel } from "../../_components/ui";

export default async function DeliverablesPage() {
  const principal = await requireAppPermission("deliverables.read");
  const rows = await listDeliverables(principal.organizationId);

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Projects"
        title="Deliverables"
        description="Client-facing deliverables require human approval before delivery."
      />
      {rows.length === 0 ? (
        <EmptyState title="No deliverables recorded.">Deliverables are created from the service project template.</EmptyState>
      ) : (
        <DataTable columns={["Deliverable", "Project", "Status", "Due"]}>
          {rows.map((row) => (
            <tr key={row.deliverable.id}>
              <td>{row.deliverable.name}</td>
              <td>
                <Link className="font-medium text-navy" href={`/app/projects/${row.project.id}`}>
                  {row.project.name}
                </Link>
              </td>
              <td>{formatLabel(row.deliverable.status)}</td>
              <td>{formatDate(row.deliverable.dueDate)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
