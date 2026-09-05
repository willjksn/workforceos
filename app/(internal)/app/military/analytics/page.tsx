import { requireAppPermission } from "@/lib/auth/guard";
import { listBridgeTraining, listMilitaryOccupations } from "@/lib/repositories/military";
import { MetricCard } from "@/components/ui/display";
import { PageHeader, PageShell } from "../../_components/ui";
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
      <ul className="mt-6 text-sm text-muted-foreground">
        {Object.entries(byBranch).map(([branch, count]) => (
          <li key={branch}>{branch}: {count}</li>
        ))}
      </ul>
    </PageShell>
  );
}
