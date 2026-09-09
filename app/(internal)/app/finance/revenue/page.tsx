import { requireAppPermission } from "@/lib/auth/guard";
import { listRevenueEvents } from "@/lib/finance/engine";
import { DataTable, EmptyState, PageHeader, PageShell, formatDate, formatLabel } from "../../_components/ui";
import { FinanceSpine } from "@/components/ia/finance-spine";
import { FinanceSubnav } from "../_components/finance-subnav";

export default async function RevenueEventsPage() {
  const principal = await requireAppPermission("finance.read");
  const rows = await listRevenueEvents(principal.organizationId);

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Finance"
        title="Revenue events"
        description="Revenue reporting from contract and placement triggers. This is not a general ledger."
      />
      <FinanceSpine activeHref="/app/finance/revenue" />
      <FinanceSubnav active="/app/finance/revenue" />
      {rows.length === 0 ? (
        <EmptyState title="No revenue events." />
      ) : (
        <DataTable columns={["Source", "Client", "Trigger", "Amount", "Expected", "Actual", "Status", "Invoice"]}>
          {rows.map((row) => (
            <tr key={row.event.id}>
              <td>{row.event.source}</td>
              <td>{row.companyName ?? "—"}</td>
              <td>{formatLabel(row.event.triggerType)}</td>
              <td>{row.event.amount}</td>
              <td>{formatDate(row.event.expectedDate)}</td>
              <td>{formatDate(row.event.actualDate)}</td>
              <td>{formatLabel(row.event.status)}</td>
              <td>{row.event.invoiceId ? "Linked" : "—"}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
