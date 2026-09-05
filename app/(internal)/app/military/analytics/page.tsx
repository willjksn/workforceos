import { requireAppPermission } from "@/lib/auth/guard";
import { listBridgeTraining, listMilitaryOccupations } from "@/lib/repositories/military";
import { MetricCard } from "@/components/ui/display";
import { PageHeader, PageShell, RecordList, RecordRow, formatLabel } from "../../_components/ui";
import { MilitarySubnav } from "../_components/military-subnav";

export default async function MilitaryAnalyticsPage() {
  await requireAppPermission("military.read");
  const occupations = await listMilitaryOccupations();
  const bridge = await listBridgeTraining();
  const byBranch = occupations.reduce<Record<string, number>>((acc, row) => {
    acc[row.branch] = (acc[row.branch] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <PageShell>
      <PageHeader
        eyebrow="Military talent"
        title="Military analytics"
        description="Counts from stored occupation and mapping records only."
      />
      <MilitarySubnav active="/app/military/analytics" />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Occupations" value={occupations.length} />
        <MetricCard label="Bridge recommendations" value={bridge.length} />
        <MetricCard label="Navy records" value={byBranch.navy ?? 0} />
      </div>
      <RecordList className="mt-6">
        {Object.entries(byBranch).map(([branch, count]) => (
          <RecordRow key={branch} title={formatLabel(branch)} trailing={<span className="text-sm text-navy">{count}</span>} />
        ))}
      </RecordList>
    </PageShell>
  );
}
