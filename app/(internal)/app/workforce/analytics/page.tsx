import { requireAppPermission } from "@/lib/auth/guard";
import { getWorkforceCommandSnapshot, listWorkforceGaps } from "@/lib/repositories/workforce";
import { lookupLaborMarket, presentLaborMarketValue } from "@/lib/integrations/labor-market";
import { MetricCard } from "@/components/ui/display";
import { PageHeader, PageShell } from "../../_components/ui";
import { WorkforceSubnav } from "../_components/workforce-subnav";

export default async function WorkforceAnalyticsPage() {
  const principal = await requireAppPermission("workforce.read");
  const [command, gaps, bls] = await Promise.all([
    getWorkforceCommandSnapshot(principal.organizationId),
    listWorkforceGaps(principal.organizationId),
    lookupLaborMarket({ provider: "bls", metric: "employment_count", geography: "WV" }),
  ]);
  const labor = presentLaborMarketValue(bls);
  const totalGap = gaps.reduce((sum, row) => sum + row.gap.gap, 0);
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Workforce"
        title="Workforce analytics"
        description="Live PostgreSQL aggregates. External labor-market values are shown only when a configured source returns them."
      />
      <WorkforceSubnav active="/app/workforce/analytics" />
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Recorded gap headcount" value={totalGap} hint="Sum of stored gap rows" />
        <MetricCard label="Critical / high gaps" value={command.criticalGaps.length} />
        <MetricCard label="High-risk roles" value={command.highRiskRoles.length} />
        <MetricCard label="BLS employment" value={labor.display} hint={bls.notes} />
      </section>
    </PageShell>
  );
}
