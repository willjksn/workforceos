import { requireAppPermission } from "@/lib/auth/guard";
import { getHiringMetrics, listMissingScorecards } from "@/lib/hiring/service";
import { PageHeader, PageShell } from "../../_components/ui";
import { MetricCard } from "@/components/ui/display";

export default async function RecruitingWorkbenchPage() {
  const principal = await requireAppPermission("applications.read");
  const metrics = await getHiringMetrics(principal.organizationId);
  const missing = await listMissingScorecards(principal.organizationId);
  return (
    <PageShell wide>
      <PageHeader eyebrow="Recruiting" title="Recruiting Workbench" description="Queues for review, interviews, checks, offers, and onboarding." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard href="/app/recruiting/applications?view=needs_review" label="Needs review" value={metrics.awaitingReview} />
        <MetricCard href="/app/interviews" label="Interviews this week" value={metrics.interviewsThisWeek} />
        <MetricCard href="/app/recruiting/applications" label="Missing scorecards" value={missing.length} />
        <MetricCard href="/app/recruiting/applications" label="Background pending" value={metrics.backgroundPending} />
        <MetricCard href="/app/recruiting/applications" label="Drug screens pending" value={metrics.drugPending} />
        <MetricCard href="/app/offers" label="Offers outstanding" value={metrics.offersOutstanding} />
        <MetricCard href="/app/onboarding" label="New hires starting" value={metrics.newHiresStarting} />
        <MetricCard href="/app/onboarding" label="Onboarding overdue" value={metrics.onboardingAtRisk} />
      </div>
    </PageShell>
  );
}
