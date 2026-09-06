import { requireAppPermission } from "@/lib/auth/guard";
import { listBillingSchedules } from "@/lib/finance/engine";
import { DataTable, EmptyState, PageHeader, PageShell, formatDate, formatLabel } from "../../_components/ui";
import { FinanceSubnav } from "../_components/finance-subnav";

export default async function BillingSchedulesPage() {
  await requireAppPermission("billing.read");
  const principal = await requireAppPermission("finance.read");
  const rows = await listBillingSchedules(principal.organizationId);

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Finance"
        title="Billing schedules"
        description="Billing schedules for fractional work, retainers, and milestones. Accounting IDs stay with the connected ledger."
      />
      <FinanceSubnav active="/app/finance/schedules" />
      {rows.length === 0 ? (
        <EmptyState title="No billing schedules.">Schedules are created from stored contract and service terms.</EmptyState>
      ) : (
        <DataTable columns={["Name", "Client", "Type", "Amount", "Trigger", "Recurrence", "Next", "Invoice", "Status"]}>
          {rows.map((row) => (
            <tr key={row.schedule.id}>
              <td>{row.schedule.name}</td>
              <td>{row.companyName ?? "—"}</td>
              <td>{formatLabel(row.schedule.billingType)}</td>
              <td>{row.schedule.amount ?? "—"}</td>
              <td>{row.schedule.dueTrigger ?? "—"}</td>
              <td>{row.schedule.recurrence ?? row.schedule.cadence}</td>
              <td>{formatDate(row.schedule.nextInvoiceDate ?? row.schedule.nextExpectedAt)}</td>
              <td>{row.schedule.invoiceStatus}</td>
              <td>{formatLabel(row.schedule.status)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
