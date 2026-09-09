import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { listProposals } from "@/lib/delivery/engine";
import { AcademyHelp } from "@/components/academy/academy-help";
import { ConceptNote } from "@/components/ia/concept-note";
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
        description="Build a proposal from an approved solution plan, then draft → internal approval → send to the client. Do not start a second proposal factory from here."
        actions={<AcademyHelp articleSlug="module-proposals" />}
      />
      <ConceptNote concept="solutionVsProposalVsSow" />
      {rows.length === 0 ? (
        <EmptyState title="No proposals in this view.">
          Open the opportunity and use Build proposal after discovery and the solution plan are approved.
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
