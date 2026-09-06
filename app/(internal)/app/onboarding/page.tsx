import { requireAppPermission } from "@/lib/auth/guard";
import { getHiringMetrics } from "@/lib/hiring/service";
import { PageHeader, PageShell } from "../_components/ui";

export default async function OnboardingPage() {
  const principal = await requireAppPermission("onboarding.read");
  const metrics = await getHiringMetrics(principal.organizationId);
  return (
    <PageShell>
      <PageHeader
        eyebrow="Hiring"
        title="Onboarding"
        description="Template-driven new-hire tasks. This is not payroll, benefits, or a full HRIS."
      />
      <p className="mt-4 text-sm">New hires starting: {metrics.newHiresStarting}</p>
      <p className="text-sm">Overdue onboarding tasks: {metrics.onboardingAtRisk}</p>
    </PageShell>
  );
}
