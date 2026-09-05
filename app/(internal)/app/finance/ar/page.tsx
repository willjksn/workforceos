import { requireAppPermission } from "@/lib/auth/guard";
import { accountsReceivableView } from "@/lib/finance/engine";
import { DataTable, EmptyState, PageHeader, PageShell, formatDate, formatLabel } from "../../_components/ui";
import { FinanceSubnav } from "../_components/finance-subnav";

export default async function AccountsReceivablePage() {
  const principal = await requireAppPermission("finance.read");
  const rows = await accountsReceivableView(principal.organizationId);

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Finance"
        title="Accounts receivable"
        description="Operating AR view. Aging buckets: current, 1–30, 31–60, 61–90, 90+."
      />
      <FinanceSubnav active="/app/finance/ar" />
      {rows.length === 0 ? (
        <EmptyState title="No outstanding invoices." />
      ) : (
        <DataTable columns={["Client", "Invoice", "Amount", "Due", "Days", "Bucket", "Next action", "Dispute"]}>
          {rows.map((row) => (
            <tr key={row.invoice.id}>
              <td>{row.companyName ?? "—"}</td>
              <td>{row.invoice.invoiceNumber}</td>
              <td>{row.invoice.balanceDue}</td>
              <td>{formatDate(row.invoice.dueDate)}</td>
              <td>{row.daysOutstanding}</td>
              <td>{formatLabel(row.agingBucket ?? "current")}</td>
              <td>{row.nextAction ?? "—"}</td>
              <td>{row.disputeStatus ?? "—"}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
