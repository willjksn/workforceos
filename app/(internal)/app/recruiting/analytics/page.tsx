import { requireAppPermission } from "@/lib/auth/guard";
import { recruitingAnalytics } from "@/lib/repositories/recruiting-delivery";
import { MetricCard } from "@/components/ui/display";
import { PageHeader, PageShell } from "../../_components/ui";

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
        description="Live PostgreSQL counts only. No fabricated benchmarks."
      />
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <MetricCard label="Active searches" value={data.activeSearches} />
        <MetricCard label="Placements" value={data.placements} />
        <MetricCard label="Submission → interview" value={ratio(data.submissionToInterview)} />
        <MetricCard label="Offer acceptance" value={ratio(data.offerAcceptance)} />
      </div>
      <h2 className="mt-10 section-title">Jobs by stage</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Draft {data.jobsByStage.draft} · Open {data.jobsByStage.open} · Hold {data.jobsByStage.onHold} · Filled {data.jobsByStage.filled} · Cancelled {data.jobsByStage.cancelled} · Closed {data.jobsByStage.closed}
      </p>
      <p className="mt-4 text-sm">Internal Talent Network utilization {ratio(data.internalTalentUtilization)}. Rediscovered utilization {ratio(data.rediscoveredUtilization)}.</p>
      <p className="mt-2 text-sm">Guarantees: {data.guarantees.active} active, {data.guarantees.expiringSoon} expiring soon, {data.guarantees.completed} completed.</p>
      <h2 className="mt-10 section-title">In-app alerts</h2>
      {data.alerts.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No stalled-process alerts from current records.</p>
      ) : (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {data.alerts.map((alert) => (
            <li key={`${alert.code}-${alert.recordId}`}>{alert.title}</li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
