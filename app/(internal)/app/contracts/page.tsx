import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { listContracts } from "@/lib/delivery/engine";
import { DataTable, EmptyState, PageHeader, PageShell, formatDate, formatLabel } from "../_components/ui";
import { StatusBadge } from "@/components/ui/display";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const principal = await requireAppPermission("contracts.read");
  const { filter } = await searchParams;
  const rows = await listContracts(principal.organizationId, filter);

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Legal & Contracts"
        title={filter ? `${formatLabel(filter)} contracts` : "Contracts"}
        description="Service-specific packages. Documents are not auto-sent. Placeholder templates are not attorney-approved."
      />
      {rows.length === 0 ? (
        <EmptyState title="No contracts in this view.">
          Create a package from an approved solution plan.
        </EmptyState>
      ) : (
        <DataTable columns={["Contract", "Client", "Service", "Status", "Value", "Expires"]}>
          {rows.map((row) => (
            <tr key={row.contract.id}>
              <td>
                <Link className="font-medium text-navy" href={`/app/contracts/${row.contract.id}`}>
                  {row.contract.title}
                </Link>
              </td>
              <td>{row.companyName}</td>
              <td>{row.serviceName ?? "—"}</td>
              <td>
                <StatusBadge tone={row.contract.status === "executed" ? "success" : "navy"}>
                  {formatLabel(row.contract.status)}
                </StatusBadge>
              </td>
              <td>{row.contract.contractValue ?? "—"}</td>
              <td>{formatDate(row.contract.expirationDate)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
