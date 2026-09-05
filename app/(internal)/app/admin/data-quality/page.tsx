import { requireAppPermission } from "@/lib/auth/guard";
import { evaluateDataQuality } from "@/lib/data-quality/evaluate";
import { Card } from "@/components/ui/display";
import { PageHeader, PageShell, StatusBadge } from "../../_components/ui";

export default async function DataQualityPage() {
  const principal = await requireAppPermission("data_quality.read");
  const flags = await evaluateDataQuality(principal.organizationId);
  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="Data quality"
        description="Completeness and freshness flags only. These are not performance or quality-of-hire scores."
      />
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {flags.map((flag) => (
          <a key={flag.code} href={flag.href}>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-navy">{flag.title}</p>
                <StatusBadge tone={flag.count > 0 ? "warning" : "success"}>{flag.count}</StatusBadge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{flag.note}</p>
            </Card>
          </a>
        ))}
      </div>
    </PageShell>
  );
}
