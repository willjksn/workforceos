import Link from "next/link";

import { AcademyHelp } from "@/components/academy/academy-help";
import { ConceptNote } from "@/components/ia/concept-note";
import { FinanceSpine } from "@/components/ia/finance-spine";
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
        description="Consulting delivery after an executed contract. Internal searches stay on Jobs. SkillBridge is a pathway type, not a PierOne-owned program."
        actions={<AcademyHelp articleSlug="module-projects" />}
      />
      <ConceptNote concept="programVsProjectVsEngagement" />
      <FinanceSpine activeHref="/app/projects" />
      {rows.length === 0 ? (
        <EmptyState title="No delivery projects in this view.">
          Create a project from an executed contract.
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
