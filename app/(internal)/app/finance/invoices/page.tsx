import { createInvoiceAction } from "@/lib/actions/finance";
import { requireAppPermission } from "@/lib/auth/guard";
import { listBillingEvents } from "@/lib/delivery/engine";
import { listInvoices } from "@/lib/finance/engine";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { DataTable, EmptyState, Field, PageHeader, PageShell, PrimaryButton, formatDate, formatLabel, inputClassName } from "../../_components/ui";
import { FinanceSubnav } from "../_components/finance-subnav";

export default async function InvoicesPage() {
  const principal = await requireAppPermission("invoices.read");
  const rows = await listInvoices(principal.organizationId);
  const events = can(principal, "invoices.write")
    ? (await listBillingEvents(principal.organizationId)).filter((row) => !row.event.invoiceId)
    : [];

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Finance"
        title="Invoices"
        description="Operating invoice records. QuickBooks remains the accounting ledger."
      />
      <FinanceSubnav active="/app/finance/invoices" />
      {can(principal, "invoices.write") && events.length > 0 ? (
        <ActionForm action={createInvoiceAction} className="mt-6 max-w-md space-y-3">
          <Field label="Create from billing event" name="billingEventId">
            <select className={inputClassName} id="billingEventId" name="billingEventId" required>
              {events.map((row) => (
                <option key={row.event.id} value={row.event.id}>
                  {row.event.sourceMilestone} · {row.companyName ?? "Client"} · {row.event.amount}
                </option>
              ))}
            </select>
          </Field>
          <PrimaryButton>Create invoice expectation</PrimaryButton>
        </ActionForm>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState title="No invoices.">Create an invoice from a billing event after contract terms exist.</EmptyState>
      ) : (
        <DataTable className="mt-6" columns={["Number", "Client", "Amount", "Balance", "Issued", "Due", "Status", "Payment"]}>
          {rows.map((row) => (
            <tr key={row.invoice.id}>
              <td>{row.invoice.invoiceNumber}</td>
              <td>{row.companyName ?? "—"}</td>
              <td>{row.invoice.amount}</td>
              <td>{row.invoice.balanceDue}</td>
              <td>{formatDate(row.invoice.issuedDate)}</td>
              <td>{formatDate(row.invoice.dueDate)}</td>
              <td>{formatLabel(row.invoice.status)}</td>
              <td>{row.invoice.paymentStatus}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
