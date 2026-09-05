import { requireAppPermission } from "@/lib/auth/guard";
import { listBillingEvents } from "@/lib/delivery/engine";
import { DataTable, EmptyState, PageHeader, PageShell, formatDate, formatLabel } from "../_components/ui";

export default async function FinancePage() {
  const principal = await requireAppPermission("billing.read");
  const rows = await listBillingEvents(principal.organizationId);

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Finance"
        title="Billing triggers"
        description="Operational billing events only. This screen does not create QuickBooks invoices or store ownership data."
      />
      {rows.length === 0 ? (
        <EmptyState title="No billing events yet.">
          Placement, monthly, and milestone rules create triggers from projects and contracts.
        </EmptyState>
      ) : (
        <DataTable columns={["Milestone", "Client", "Project", "Amount", "Status", "Expected"]}>
          {rows.map((row) => (
            <tr key={row.event.id}>
              <td>{row.event.sourceMilestone}</td>
              <td>{row.companyName ?? "—"}</td>
              <td>{row.projectName ?? "—"}</td>
              <td>{row.event.amount}</td>
              <td>{formatLabel(row.event.status)}</td>
              <td>{formatDate(row.event.expectedDate)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
