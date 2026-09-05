import Link from "next/link";
import { notFound } from "next/navigation";

import { requireCurrentPrincipal } from "@/lib/auth/session";
import { getServiceBundle } from "@/lib/repositories/services";
import { AuthorizationError, can } from "@/lib/rbac/permissions";
import { PageHeader } from "../../_components/ui";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const principal = await requireCurrentPrincipal();
  if (!can(principal, "solutions.read") && !can(principal, "jobs.read")) {
    throw new AuthorizationError("Missing permission: solutions.read");
  }
  const { code } = await params;
  const bundle = await getServiceBundle(code);
  if (!bundle) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title={bundle.service.name}
        description={bundle.service.description ?? "Launch service"}
        actions={
          bundle.service.code === "professional-search" ? (
            <Link className="rounded-full border px-4 py-2 text-sm" href="/app/jobs">
              Open jobs
            </Link>
          ) : undefined
        }
      />
      <p className="mt-3 text-sm text-zinc-600">
        Version {bundle.approvedVersion?.version ?? "none"} · {bundle.approvedVersion?.reviewStatus ?? "missing"}
      </p>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Approved workflow</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm">
          {bundle.workflows.map((step) => (
            <li key={step.id}>
              <div className="font-medium">{step.name}</div>
              <p className="text-zinc-600">{step.instructions}</p>
              {step.requiresHumanApproval ? (
                <p className="mt-1">Human approval required before this step is complete.</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
      {bundle.plans.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Solution plans</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {bundle.plans.map(({ plan, opportunity }) => (
              <li key={plan.id}>
                {plan.title} · {plan.status} · opportunity {opportunity.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
