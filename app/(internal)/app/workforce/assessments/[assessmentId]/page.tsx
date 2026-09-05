import { notFound } from "next/navigation";

import {
  approvePlanAction,
  approveRecommendationAction,
  createRoadmapTasksAction,
  createScenarioAction,
  draftRecommendationAction,
  generateForecastAction,
  generatePlanAction,
  submitPlanAction,
  upsertBaselineAction,
} from "@/lib/actions/workforce";
import { requireAppPermission } from "@/lib/auth/guard";
import { getAssessmentGraph } from "@/lib/repositories/workforce";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../../_components/action-form";
import {
  Field,
  PageHeader,
  PageShell,
  PrimaryButton,
  SectionHeader,
  StatusBadge,
  formatLabel,
  inputClassName,
} from "../../../_components/ui";
import { WorkforceSubnav } from "../../_components/workforce-subnav";

export default async function WorkforceAssessmentDetailPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const principal = await requireAppPermission("workforce.read");
  const { assessmentId } = await params;
  const graph = await getAssessmentGraph(assessmentId, principal.organizationId);
  if (!graph) notFound();
  const canWrite = can(principal, "workforce.write");
  const canApprove = can(principal, "workforce.approve");
  const canForecast = can(principal, "forecasts.write");
  const canAnalyze = can(principal, "workforce.analyze");
  const latestPlan = graph.plans[0];

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Workforce assessment"
        title={graph.assessment.title}
        description={`${graph.company?.name ?? "Client"} · estimates only · human approval required for client-facing output`}
        metadata={
          <StatusBadge tone="navy">
            {formatLabel(graph.assessment.status)} · v{graph.assessment.versionNumber}
          </StatusBadge>
        }
      />
      <WorkforceSubnav active="/app/workforce/assessments" />

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[8px] border border-card-border bg-card px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Roles</p>
          <p className="mt-1 font-serif text-3xl text-navy">{graph.roles.length}</p>
        </div>
        <div className="rounded-[8px] border border-card-border bg-card px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Forecasts</p>
          <p className="mt-1 font-serif text-3xl text-navy">{graph.forecasts.length}</p>
        </div>
        <div className="rounded-[8px] border border-card-border bg-card px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Gaps</p>
          <p className="mt-1 font-serif text-3xl text-navy">{graph.gaps.length}</p>
        </div>
        <div className="rounded-[8px] border border-card-border bg-card px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Scenarios</p>
          <p className="mt-1 font-serif text-3xl text-navy">{graph.scenarios.length}</p>
        </div>
      </section>

      <SectionHeader title="Workforce roles" />
      <ul className="text-sm">
        {graph.roles.map((role) => (
          <li key={role.id}>
            {role.title} · headcount {role.currentHeadcount} · {formatLabel(role.criticality)}
            {role.isFixture ? " · fixture" : ""}
          </li>
        ))}
      </ul>

      {canWrite && graph.roles[0] ? (
        <ActionForm action={upsertBaselineAction} className="mt-6 max-w-xl space-y-3">
          <input type="hidden" name="assessmentId" value={graph.assessment.id} />
          <Field label="Role" name="roleId">
            <select className={inputClassName} id="roleId" name="roleId">
              {graph.roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Current headcount" name="currentHeadcount">
            <input className={inputClassName} id="currentHeadcount" name="currentHeadcount" type="number" min="0" required />
          </Field>
          <Field label="Vacancies" name="vacancies">
            <input className={inputClassName} id="vacancies" name="vacancies" type="number" min="0" defaultValue="0" />
          </Field>
          <Field label="Attrition % / year" name="attritionRatePercent">
            <input className={inputClassName} id="attritionRatePercent" name="attritionRatePercent" type="number" step="0.1" />
          </Field>
          <Field label="Retirement eligibility % / year" name="retirementEligibilityRatePercent">
            <input className={inputClassName} id="retirementEligibilityRatePercent" name="retirementEligibilityRatePercent" type="number" step="0.1" />
          </Field>
          <PrimaryButton>Save baseline</PrimaryButton>
        </ActionForm>
      ) : null}

      {canForecast ? (
        <ActionForm action={generateForecastAction} className="mt-4">
          <input type="hidden" name="assessmentId" value={graph.assessment.id} />
          <PrimaryButton>Generate 12/24/36-month forecast and gaps</PrimaryButton>
        </ActionForm>
      ) : null}

      <SectionHeader title="Gaps (estimates)" />
      <ul className="text-sm">
        {graph.gaps.slice(0, 12).map((gap) => (
          <li key={gap.id}>
            {gap.horizonMonths} months · demand {gap.demand} · supply {gap.supply} · gap {gap.gap} · {formatLabel(gap.severity)}
            {gap.isFixture ? " · fixture" : ""}
          </li>
        ))}
      </ul>

      {canAnalyze ? (
        <ActionForm action={draftRecommendationAction} className="mt-6">
          <input type="hidden" name="assessmentId" value={graph.assessment.id} />
          <input type="hidden" name="kind" value="analyst" />
          <PrimaryButton>Draft AI analyst recommendation</PrimaryButton>
        </ActionForm>
      ) : null}

      <ul className="mt-4 text-sm">
        {graph.recommendations.map((row) => (
          <li key={row.id}>
            {row.title} · {formatLabel(row.status)} · {row.generatedByModel ?? "human"}
            {canApprove && row.status === "pending_approval" ? (
              <ActionForm action={approveRecommendationAction} className="mt-2">
                <input type="hidden" name="recommendationId" value={row.id} />
                <input type="hidden" name="assessmentId" value={graph.assessment.id} />
                <PrimaryButton>Approve recommendation</PrimaryButton>
              </ActionForm>
            ) : null}
          </li>
        ))}
      </ul>

      {canWrite ? (
        <div className="mt-8 space-y-3">
          <ActionForm action={generatePlanAction}>
            <input type="hidden" name="assessmentId" value={graph.assessment.id} />
            <PrimaryButton>Generate Workforce Pipeline Plan</PrimaryButton>
          </ActionForm>
          {latestPlan ? (
            <>
              <ActionForm action={submitPlanAction}>
                <input type="hidden" name="planId" value={latestPlan.id} />
                <input type="hidden" name="assessmentId" value={graph.assessment.id} />
                <PrimaryButton>Submit plan for approval</PrimaryButton>
              </ActionForm>
              {canApprove ? (
                <ActionForm action={approvePlanAction}>
                  <input type="hidden" name="planId" value={latestPlan.id} />
                  <input type="hidden" name="assessmentId" value={graph.assessment.id} />
                  <PrimaryButton>Approve plan</PrimaryButton>
                </ActionForm>
              ) : null}
              <ActionForm action={createRoadmapTasksAction}>
                <input type="hidden" name="assessmentId" value={graph.assessment.id} />
                <PrimaryButton>Create roadmap project tasks</PrimaryButton>
              </ActionForm>
              {latestPlan.htmlBody ? (
                <iframe title="Workforce Pipeline Plan" className="mt-4 h-[480px] w-full rounded-[8px] border border-card-border bg-white" srcDoc={latestPlan.htmlBody} />
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {can(principal, "scenario_models.write") ? (
        <ActionForm action={createScenarioAction} className="mt-8 max-w-xl space-y-3">
          <input type="hidden" name="assessmentId" value={graph.assessment.id} />
          <Field label="Scenario name" name="name">
            <input className={inputClassName} id="name" name="name" required />
          </Field>
          <Field label="Growth delta %" name="growthDeltaPercent">
            <input className={inputClassName} id="growthDeltaPercent" name="growthDeltaPercent" type="number" defaultValue="0" />
          </Field>
          <Field label="Retirement delta %" name="retirementDeltaPercent">
            <input className={inputClassName} id="retirementDeltaPercent" name="retirementDeltaPercent" type="number" defaultValue="0" />
          </Field>
          <PrimaryButton>Create scenario</PrimaryButton>
        </ActionForm>
      ) : null}
    </PageShell>
  );
}
