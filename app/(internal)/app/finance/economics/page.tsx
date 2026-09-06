import { requireAppPermission } from "@/lib/auth/guard";
import { engagementEconomics } from "@/lib/finance/engine";
import { moneyString } from "@/lib/finance/money";
import { DataTable, EmptyState, PageHeader, PageShell } from "../../_components/ui";
import { FinanceSubnav } from "../_components/finance-subnav";

export default async function EngagementEconomicsPage() {
  const principal = await requireAppPermission("finance.read");
  const rows = await engagementEconomics(principal.organizationId);

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Finance"
        title="Engagement economics"
        description="Contract value, invoiced, collected, optional delivery costs, and a gross margin estimate. This is operating economics, not a general ledger."
      />
      <FinanceSubnav active="/app/finance/economics" />
      {rows.length === 0 ? (
        <EmptyState title="No project economics yet." />
      ) : (
        <DataTable columns={["Project", "Contract value", "Expected", "Invoiced", "Collected", "Costs", "Write-offs", "Margin"]}>
          {rows.map((row) => (
            <tr key={row.project.id}>
              <td>{row.project.name}</td>
              <td>{moneyString(row.contractValue)}</td>
              <td>{moneyString(row.expectedRevenue)}</td>
              <td>{moneyString(row.invoiced)}</td>
              <td>{moneyString(row.collected)}</td>
              <td>{moneyString(row.directDeliveryCosts)}</td>
              <td>{moneyString(row.writeOffs)}</td>
              <td>{moneyString(row.grossMarginEstimate)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
