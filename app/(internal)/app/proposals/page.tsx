import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { listProposals } from "@/lib/delivery/engine";
import { AcademyHelp } from "@/components/academy/academy-help";
import { DataTable, EmptyState, PageHeader, PageShell, formatLabel } from "../_components/ui";
import { StatusBadge } from "@/components/ui/display";

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const principal = await requireAppPermission("proposals.read");
  const { status } = await searchParams;
  const rows = await listProposals(principal.organizationId, status);

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Proposals"
        title={status ? `${formatLabel(status)} proposals` : "Proposals"}
        description="Proposals are generated from approved solution plans. Human approval is required before sending."
        actions={<AcademyHelp articleSlug="module-proposals" />}
      />
      {rows.length === 0 ? (
        <EmptyState title="No proposals in this view.">
          Generate a proposal from an approved solution plan.
        </EmptyState>
      ) : (
        <DataTable columns={["Proposal", "Client", "Service", "Status"]}>
          {rows.map((row) => (
            <tr key={row.proposal.id}>
              <td>
                <Link className="font-medium text-navy" href={`/app/proposals/${row.proposal.id}`}>
                  {row.proposal.title}
                </Link>
              </td>
              <td>{row.companyName}</td>
              <td>{formatLabel(row.serviceCode)}</td>
              <td>
                <StatusBadge tone={row.proposal.status === "approved" || row.proposal.status === "accepted" ? "success" : "navy"}>
                  {formatLabel(row.proposal.status)}
                </StatusBadge>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
