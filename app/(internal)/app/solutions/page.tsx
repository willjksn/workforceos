import Link from "next/link";

import { AcademyHelp } from "@/components/academy/academy-help";
import { ConceptNote } from "@/components/ia/concept-note";
import { requireAppPermission } from "@/lib/auth/guard";
import { listSolutionPlans } from "@/lib/delivery/engine";
import { DataTable, EmptyState, PageHeader, PageShell, formatLabel } from "../_components/ui";
import { StatusBadge } from "@/components/ui/display";

export default async function SolutionsPage() {
  const principal = await requireAppPermission("solutions.read");
  const rows = await listSolutionPlans(principal.organizationId);

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Solutions"
        title="Solution plans"
        description="The internal recommended offer. Build the client proposal only after this plan is approved."
        actions={<AcademyHelp articleSlug="module-proposals" />}
      />
      <ConceptNote concept="solutionVsProposalVsSow" />
      {rows.length === 0 ? (
        <EmptyState title="No solution plans yet.">
          Create a plan from an approved discovery record on the opportunity path.
        </EmptyState>
      ) : (
        <DataTable columns={["Plan", "Company", "Service", "Version", "Status", "Price"]}>
          {rows.map((row) => (
            <tr key={row.plan.id}>
              <td>
                <Link className="font-medium text-navy" href={`/app/solutions/${row.plan.id}`}>
                  {row.plan.title}
                </Link>
              </td>
              <td>{row.companyName}</td>
              <td>{row.serviceName}</td>
              <td>{row.version}</td>
              <td>
                <StatusBadge tone={row.plan.status === "approved" ? "success" : "navy"}>
                  {formatLabel(row.plan.status)}
                </StatusBadge>
              </td>
              <td>{row.plan.approvedPrice ?? row.plan.recommendedPrice ?? "—"}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
