import { requireAppPermission } from "@/lib/auth/guard";
import { recruitingAnalytics } from "@/lib/repositories/recruiting-delivery";
import { MetricCard } from "@/components/ui/display";
import { Card, EmptyState, PageHeader, PageShell, RecordList, RecordRow, SectionHeader } from "../../_components/ui";

function ratio(value: number | null) {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

export default async function RecruitingAnalyticsPage() {
  const principal = await requireAppPermission("recruiting.analytics.read");
  const data = await recruitingAnalytics(principal.organizationId);

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Recruiting"
        title="Recruiting analytics"
        description="Live counts from your searches and placements. Industry benchmarks are not included."
      />
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <MetricCard label="Active searches" value={data.activeSearches} />
        <MetricCard label="Placements" value={data.placements} />
        <MetricCard label="Submission → interview" value={ratio(data.submissionToInterview)} />
        <MetricCard label="Offer acceptance" value={ratio(data.offerAcceptance)} />
      </div>
      <div className="mt-10">
        <SectionHeader title="Jobs by stage" />
      </div>
      <Card>
        <p className="text-sm text-muted-foreground">
          Draft {data.jobsByStage.draft} · Open {data.jobsByStage.open} · Hold {data.jobsByStage.onHold} · Filled{" "}
          {data.jobsByStage.filled} · Cancelled {data.jobsByStage.cancelled} · Closed {data.jobsByStage.closed}
        </p>
        <p className="mt-3 text-sm">
          Internal Talent Network utilization {ratio(data.internalTalentUtilization)}. Rediscovered utilization{" "}
          {ratio(data.rediscoveredUtilization)}.
        </p>
        <p className="mt-2 text-sm">
          Guarantees: {data.guarantees.active} active, {data.guarantees.expiringSoon} expiring soon,{" "}
          {data.guarantees.completed} completed.
        </p>
      </Card>
      <div className="mt-10">
        <SectionHeader title="In-app alerts" />
      </div>
      {data.alerts.length === 0 ? (
        <EmptyState title="No stalled-process alerts.">Alerts appear from current records only, not invented SLAs.</EmptyState>
      ) : (
        <RecordList>
          {data.alerts.map((alert) => (
            <RecordRow key={`${alert.code}-${alert.recordId}`} title={alert.title} />
          ))}
        </RecordList>
      )}
    </PageShell>
  );
}
