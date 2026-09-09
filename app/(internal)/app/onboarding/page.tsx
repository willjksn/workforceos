import { completeOnboardingTaskAction } from "@/lib/actions/hiring";
import { requireAppPermission } from "@/lib/auth/guard";
import { getHiringMetrics, listOnboardingQueue } from "@/lib/hiring/service";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../_components/action-form";
import { PageHeader, PageShell, PrimaryButton, formatLabel } from "../_components/ui";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ issued?: string }>;
}) {
  const principal = await requireAppPermission("onboarding.read");
  const { issued } = await searchParams;
  const metrics = await getHiringMetrics(principal.organizationId);
  const queue = await listOnboardingQueue(principal);
  const canComplete = can(principal, "onboarding.complete");

  return (
    <PageShell>
      <PageHeader
        eyebrow="Hiring"
        title="Onboarding"
        description="ATS hire onboarding. Distinct from PierOne staff Academy onboarding at /app/academy/onboarding. New hires can complete their own tasks at /onboarding/access with a signed token."
      />
      {issued ? <p className="mt-3 text-sm text-teal">Hire access link issued: {issued}</p> : null}
      <p className="mt-4 text-sm">New hires starting: {metrics.newHiresStarting}</p>
      <p className="text-sm">Overdue onboarding tasks: {metrics.onboardingAtRisk}</p>
      <div className="mt-8 space-y-6">
        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground">No onboarding instances yet. Start onboarding from an application.</p>
        ) : (
          queue.map((row) => (
            <section key={row.instance.id} className="border border-border bg-white p-4">
              <h2 className="font-medium">
                {row.candidate.fullName} · {row.job.title}
              </h2>
              <p className="text-sm text-muted-foreground">
                Start {row.instance.startDate ?? "—"} · {formatLabel(row.instance.status)}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {row.tasks.map((task) => (
                  <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                    <span>
                      {task.title} · {formatLabel(task.status)} · {task.ownerRole}
                      {task.dueAt ? ` · due ${task.dueAt.toLocaleDateString()}` : ""}
                    </span>
                    {canComplete && task.status !== "completed" ? (
                      <ActionForm action={completeOnboardingTaskAction}>
                        <input type="hidden" name="taskId" value={task.id} />
                        <PrimaryButton>Complete</PrimaryButton>
                      </ActionForm>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </PageShell>
  );
}
