import { requireAppPermission } from "@/lib/auth/guard";
import { financeOverview } from "@/lib/finance/engine";
import { moneyString } from "@/lib/finance/money";
import { MetricCard } from "@/components/ui/display";
import { EmptyState, PageHeader, PageShell, RecordList, RecordRow, formatDate, formatLabel } from "../_components/ui";
import { FinanceSubnav } from "./_components/finance-subnav";

export default async function FinanceOverviewPage() {
  const principal = await requireAppPermission("finance.read");
  const overview = await financeOverview(principal.organizationId);

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Finance"
        title="Operating finance"
        description="WorkforceOS owns billing schedules, invoice expectations, AR, and revenue events. QuickBooks remains the accounting ledger. Amounts come from stored contracts — they are never invented here."
      />
      <FinanceSubnav active="/app/finance" />
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Contracted revenue" value={moneyString(overview.contractedRevenue)} href="/app/contracts" />
        <MetricCard label="Invoiced" value={moneyString(overview.invoicedRevenue)} href="/app/finance/invoices" />
        <MetricCard label="Collected" value={moneyString(overview.collectedRevenue)} href="/app/finance/payments" />
        <MetricCard label="Outstanding AR" value={moneyString(overview.outstandingAr)} href="/app/finance/ar" />
        <MetricCard label="Recurring monthly" value={moneyString(overview.recurringMonthlyRevenue)} href="/app/finance/schedules" />
        <MetricCard label="Placement fees expected" value={moneyString(overview.placementFeesExpected)} href="/app/finance/revenue" />
        <MetricCard label="Upcoming billing events" value={overview.upcomingBillingEvents.length} href="/app/finance/schedules" />
        <MetricCard label="Overdue invoices" value={overview.overdueInvoices.length} href="/app/finance/ar" />
      </section>
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="section-title">Revenue by service</h2>
          {overview.revenueByService.length === 0 ? (
            <EmptyState title="No revenue events yet.">Service revenue appears after stored contract or placement terms create events.</EmptyState>
          ) : (
            <RecordList>
              {overview.revenueByService.map((row) => (
                <RecordRow key={row.service} title={row.service} meta={moneyString(row.amount)} />
              ))}
            </RecordList>
          )}
        </section>
        <section>
          <h2 className="section-title">Revenue by client</h2>
          {overview.revenueByClient.length === 0 ? (
            <EmptyState title="No invoiced clients yet." />
          ) : (
            <RecordList>
              {overview.revenueByClient.map((row) => (
                <RecordRow key={row.client} title={row.client} meta={moneyString(row.amount)} />
              ))}
            </RecordList>
          )}
        </section>
      </div>
      <section className="mt-10">
        <h2 className="section-title">Project economics</h2>
        {overview.projectEconomics.length === 0 ? (
          <EmptyState title="No engagement economics yet.">Costs are optional. This is not a cost-accounting system.</EmptyState>
        ) : (
          <RecordList>
            {overview.projectEconomics.map((row) => (
              <RecordRow
                key={row.project.id}
                href={`/app/projects/${row.project.id}`}
                title={row.project.name}
                meta={`Invoiced ${moneyString(row.invoiced)} · Collected ${moneyString(row.collected)} · Margin ${moneyString(row.grossMarginEstimate)}`}
              />
            ))}
          </RecordList>
        )}
      </section>
      <section className="mt-10">
        <h2 className="section-title">Upcoming billing events</h2>
        {overview.upcomingBillingEvents.length === 0 ? (
          <EmptyState title="No upcoming billing events." />
        ) : (
          <RecordList>
            {overview.upcomingBillingEvents.slice(0, 8).map((event) => (
              <RecordRow
                key={event.id}
                title={event.sourceMilestone ?? "Billing event"}
                meta={`${event.amount} · ${formatLabel(event.status)} · ${formatDate(event.expectedDate)}`}
              />
            ))}
          </RecordList>
        )}
      </section>
    </PageShell>
  );
}
