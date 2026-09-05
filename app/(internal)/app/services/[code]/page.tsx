import { notFound } from "next/navigation";

import {
  approveMtoaPlanAction,
  createMtoaPlanAction,
  createMtoaProjectAction,
} from "@/lib/actions/military";
import { requireCurrentPrincipal } from "@/lib/auth/session";
import { canCreateDeliveryProject, mappingIsClientFacingDraft, MTOA_SERVICE_CODE } from "@/lib/military/mtoa";
import { listOpportunities } from "@/lib/repositories/crm";
import { getServiceBundle, listProjectsForPlan } from "@/lib/repositories/services";
import { AuthorizationError, can } from "@/lib/rbac/permissions";
import { ButtonLink } from "@/components/ui/button";
import { ActionForm } from "../../_components/action-form";
import { Field, PageHeader, PageShell, PrimaryButton, inputClassName } from "../../_components/ui";

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
  const isMtoa = bundle.service.code === MTOA_SERVICE_CODE;
  const canWriteSolutions = can(principal, "solutions.write");
  const canWriteProjects = can(principal, "projects.write");
  const opportunities = isMtoa && canWriteSolutions
    ? await listOpportunities(principal.organizationId)
    : [];
  const plansWithProjects = await Promise.all(
    bundle.plans.map(async (row) => ({
      ...row,
      projects: await listProjectsForPlan(row.plan.id),
    })),
  );

  return (
    <PageShell>
      <PageHeader
        title={bundle.service.name}
        description={bundle.service.description ?? "Launch service"}
        actions={
          bundle.service.code === "professional-search" ? (
            <ButtonLink href="/app/jobs">Open jobs</ButtonLink>
          ) : isMtoa ? (
            <ButtonLink href="/app/military">Open translation</ButtonLink>
          ) : undefined
        }
      />
      <p className="mt-3 text-sm text-muted-foreground">
        Version {bundle.approvedVersion?.version ?? "none"} · {bundle.approvedVersion?.reviewStatus ?? "missing"}
      </p>
      <section className="mt-8">
        <h2 className="section-title">Approved workflow</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm">
          {bundle.workflows.map((step) => (
            <li key={step.id}>
              <div className="font-medium text-navy">{step.name}</div>
              <p className="text-muted-foreground">{step.instructions}</p>
              {step.requiresHumanApproval ? (
                <p className="mt-1">Human approval required before this step is complete.</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
      {plansWithProjects.length > 0 ? (
        <section className="mt-10">
          <h2 className="section-title">Solution plans</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {plansWithProjects.map(({ plan, opportunity, companyName, projects }) => (
              <li key={plan.id} className="rounded-[8px] border border-card-border bg-card p-4 shadow-[var(--shadow-sm)]">
                <div className="font-medium text-navy">{plan.title}</div>
                <p className="mt-1 text-muted-foreground">
                  {plan.status} · {companyName} · {opportunity.name}
                </p>
                {plan.summary ? <p className="mt-2">{plan.summary}</p> : null}
                {projects.length > 0 ? (
                  <ul className="mt-2 list-disc pl-5">
                    {projects.map((project) => (
                      <li key={project.id}>
                        Delivery project: {project.name} · {project.status}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-3">
                  {isMtoa && canWriteSolutions && mappingIsClientFacingDraft(plan.status) ? (
                    <ActionForm action={approveMtoaPlanAction}>
                      <input type="hidden" name="solutionPlanId" value={plan.id} />
                      <PrimaryButton>Approve plan</PrimaryButton>
                    </ActionForm>
                  ) : null}
                  {isMtoa && canWriteProjects && canCreateDeliveryProject(plan.status) && projects.length === 0 ? (
                    <ActionForm action={createMtoaProjectAction}>
                      <input type="hidden" name="solutionPlanId" value={plan.id} />
                      <button className="rounded-full border px-4 py-2 text-sm" type="submit">
                        Create delivery project
                      </button>
                    </ActionForm>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {isMtoa && canWriteSolutions ? (
        <section className="mt-10">
          <h2 className="section-title">Draft a solution plan</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Recommendations stay drafts until a human approves them. Agents cannot approve this output.
          </p>
          {opportunities.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Create a company opportunity first.</p>
          ) : (
            <ActionForm action={createMtoaPlanAction} className="mt-4 max-w-xl space-y-3">
              <Field label="Opportunity" name="opportunityId">
                <select className={inputClassName} id="opportunityId" name="opportunityId">
                  {opportunities.map(({ opportunity, companyName }) => (
                    <option key={opportunity.id} value={opportunity.id}>
                      {companyName} · {opportunity.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Title" name="title">
                <input className={inputClassName} id="title" name="title" required />
              </Field>
              <Field label="Summary" name="summary">
                <textarea className={inputClassName} id="summary" name="summary" rows={4} />
              </Field>
              <PrimaryButton>Create draft plan</PrimaryButton>
            </ActionForm>
          )}
        </section>
      ) : null}
    </PageShell>
  );
}
