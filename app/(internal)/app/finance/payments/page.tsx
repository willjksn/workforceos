import { recordPaymentAction } from "@/lib/actions/finance";
import { requireAppPermission } from "@/lib/auth/guard";
import { listInvoices, listPayments } from "@/lib/finance/engine";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { DataTable, EmptyState, Field, PageHeader, PageShell, PrimaryButton, formatDate, formatLabel, inputClassName } from "../../_components/ui";
import { FinanceSpine } from "@/components/ia/finance-spine";
import { FinanceSubnav } from "../_components/finance-subnav";

export default async function PaymentsPage() {
  const principal = await requireAppPermission("payments.read");
  const rows = await listPayments(principal.organizationId);
  const openInvoices = can(principal, "payments.write")
    ? (await listInvoices(principal.organizationId)).filter((row) => !["paid", "void"].includes(row.invoice.status))
    : [];

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Finance"
        title="Payments"
        description="Recorded payments against invoices. Do not store bank account or card numbers here."
      />
      <FinanceSpine activeHref="/app/finance/payments" />
      <FinanceSubnav active="/app/finance/payments" />
      {can(principal, "payments.write") && openInvoices.length > 0 ? (
        <ActionForm action={recordPaymentAction} className="mt-6 grid max-w-xl gap-3">
          <Field label="Invoice" name="invoiceId">
            <select className={inputClassName} id="invoiceId" name="invoiceId" required>
              {openInvoices.map((row) => (
                <option key={row.invoice.id} value={row.invoice.id}>
                  {row.invoice.invoiceNumber} · {row.companyName} · balance {row.invoice.balanceDue}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount" name="amount">
            <input className={inputClassName} id="amount" name="amount" required />
          </Field>
          <Field label="Method summary" name="methodSummary">
            <input className={inputClassName} id="methodSummary" name="methodSummary" placeholder="ACH / check / wire" />
          </Field>
          <Field label="External transaction reference" name="externalTransactionReference">
            <input className={inputClassName} id="externalTransactionReference" name="externalTransactionReference" />
          </Field>
          <PrimaryButton>Record payment reference</PrimaryButton>
        </ActionForm>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState title="No payments recorded." />
      ) : (
        <DataTable columns={["Invoice", "Client", "Amount", "Date", "Method", "Source", "Reconciliation"]}>
          {rows.map((row) => (
            <tr key={row.payment.id}>
              <td>{row.invoiceNumber}</td>
              <td>{row.companyName ?? "—"}</td>
              <td>{row.payment.amount}</td>
              <td>{formatDate(row.payment.paymentDate)}</td>
              <td>{row.payment.methodSummary ?? "—"}</td>
              <td>{row.payment.sourceSystem}</td>
              <td>{formatLabel(row.payment.reconciliationStatus)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
