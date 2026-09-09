import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createActivityAction,
  scoreOpportunityAction,
  updateOpportunityStageAction,
} from "@/lib/actions/crm";
import { createContractPackageAction, createDeliveryProjectAction, createProposalAction } from "@/lib/actions/delivery";
import { AcademyHelp } from "@/components/academy/academy-help";
import { CommercialPath } from "@/components/ia/commercial-path";
import { ConceptNote } from "@/components/ia/concept-note";
import { requireAppPermission } from "@/lib/auth/guard";
import { SCORE_WEIGHTS } from "@/lib/crm/scoring";
import { OPPORTUNITY_STAGES } from "@/lib/crm/stages";
import { commercialPathSummary, resolveCommercialPrimaryCta } from "@/lib/delivery/commercial-path";
import { listOpportunityCommercialPath } from "@/lib/delivery/engine";
import { getOpportunityGraph } from "@/lib/repositories/crm";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { ButtonLink, EmptyState, Field, PageHeader, PageShell, PrimaryButton, formatDate, formatLabel, inputClassName } from "../../_components/ui";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requireAppPermission("opportunities.read");
  const { id } = await params;
  const graph = await getOpportunityGraph(id, principal.organizationId);
  if (!graph) notFound();
  const { opportunity, company, score } = graph;
  const canWrite = can(principal, "opportunities.write");
  const commercial = await listOpportunityCommercialPath(principal.organizationId, opportunity.id);
  const primary = resolveCommercialPrimaryCta(commercial, opportunity.id);
  const showPrimaryLink =
    primary.kind === "link" &&
    (primary.label !== "Start discovery" || can(principal, "discovery.write"));
  const showBuildProposal = primary.kind === "build_proposal" && can(principal, "proposals.write");
  const showCreateContract = primary.kind === "create_contract" && can(principal, "contracts.write") && Boolean(opportunity.serviceCode);
  const showCreateProject = primary.kind === "create_project" && can(principal, "projects.write") && Boolean(primary.planId);

  return (
    <PageShell>
      <PageHeader
        title={opportunity.name}
        description={`${formatLabel(opportunity.stage)} · ${company.name}`}
        actions={<AcademyHelp articleSlug="module-opportunities" />}
      />
      <ConceptNote concept="solutionVsProposalVsSow" />
      <p className="mt-3 text-sm">
        Company:{" "}
        <Link className="underline" href={`/app/companies/${company.id}`}>
          {company.name}
        </Link>
        {graph.primaryContact ? (
          <>
            {" "}
            · Contact:{" "}
            <Link className="underline" href={`/app/contacts/${graph.primaryContact.id}`}>
              {graph.primaryContact.fullName}
            </Link>
          </>
        ) : null}
      </p>
      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Service</dt>
          <dd>{formatLabel(opportunity.serviceCode)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Score</dt>
          <dd>
            {opportunity.opportunityScore ?? "—"}
            {opportunity.scoreBand ? ` · ${formatLabel(opportunity.scoreBand)}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Value</dt>
          <dd>{opportunity.valueAmount ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Owner</dt>
          <dd>{graph.ownerName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Target close</dt>
          <dd>{formatDate(opportunity.targetCloseDate)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Lost reason</dt>
          <dd>{opportunity.lostReason ?? "—"}</dd>
        </div>
      </dl>
      {opportunity.problemStatement ? (
        <p className="mt-4 text-sm text-muted-foreground">{opportunity.problemStatement}</p>
      ) : null}

      <section className="mt-10">
        <h2 className="section-title">Commercial path</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {commercialPathSummary()}. Scout may draft; it cannot approve or send.
        </p>
        <CommercialPath path={commercial} />
        <div className="mt-4 flex flex-wrap gap-3">
          {showPrimaryLink && primary.kind === "link" ? (
            <ButtonLink href={primary.href} variant="primary">
              {primary.label}
            </ButtonLink>
          ) : null}
          {showBuildProposal && primary.kind === "build_proposal" ? (
            <ActionForm action={createProposalAction}>
              <input type="hidden" name="solutionPlanId" value={primary.planId} />
              <PrimaryButton>Build proposal</PrimaryButton>
            </ActionForm>
          ) : null}
          {showCreateContract && primary.kind === "create_contract" && opportunity.serviceCode ? (
            <ActionForm action={createContractPackageAction}>
              <input type="hidden" name="serviceCode" value={opportunity.serviceCode} />
              <input type="hidden" name="companyId" value={company.id} />
              <input type="hidden" name="opportunityId" value={opportunity.id} />
              <input type="hidden" name="solutionPlanId" value={primary.planId} />
              <input type="hidden" name="proposalId" value={primary.proposalId} />
              <PrimaryButton>Create contract / SOW</PrimaryButton>
            </ActionForm>
          ) : null}
          {showCreateProject && primary.kind === "create_project" ? (
            <ActionForm action={createDeliveryProjectAction}>
              <input type="hidden" name="solutionPlanId" value={primary.planId} />
              <input type="hidden" name="contractId" value={primary.contractId} />
              <PrimaryButton>Create delivery project</PrimaryButton>
            </ActionForm>
          ) : null}
          {primary.kind === "none" ? <p className="text-sm text-muted-foreground">{primary.hint}</p> : null}
        </div>
        {commercial.discoveries.length === 0 && commercial.plans.length === 0 && commercial.proposals.length === 0 ? (
          <EmptyState>No discovery, plan, or proposal is linked yet.</EmptyState>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {commercial.discoveries.map((row) => (
              <li key={row.id}>
                <Link className="underline" href={`/app/discovery/${row.id}`}>
                  Discovery: {row.title}
                </Link>
                <span className="text-muted-foreground"> · {formatLabel(row.status)}</span>
              </li>
            ))}
            {commercial.plans.map((row) => (
              <li key={row.id}>
                <Link className="underline" href={`/app/solutions/${row.id}`}>
                  Solution plan: {row.title}
                </Link>
                <span className="text-muted-foreground"> · {formatLabel(row.status)}</span>
              </li>
            ))}
            {commercial.proposals.map((row) => (
              <li key={row.id}>
                <Link className="underline" href={`/app/proposals/${row.id}`}>
                  Proposal: {row.title}
                </Link>
                <span className="text-muted-foreground"> · {formatLabel(row.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canWrite ? (
        <section className="mt-10">
          <h2 className="section-title">Change stage</h2>
          <ActionForm action={updateOpportunityStageAction} className="mt-4 max-w-xl space-y-3">
            <input type="hidden" name="opportunityId" value={opportunity.id} />
            <Field label="Stage" name="stage">
              <select className={inputClassName} id="stage" name="stage" defaultValue={opportunity.stage}>
                {OPPORTUNITY_STAGES.map((value) => (
                  <option key={value} value={value}>
                    {formatLabel(value)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Lost reason" name="lostReason">
              <input className={inputClassName} id="lostReason" name="lostReason" defaultValue={opportunity.lostReason ?? ""} />
            </Field>
            <PrimaryButton>Save stage</PrimaryButton>
          </ActionForm>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="section-title">100-point score</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          ICP {SCORE_WEIGHTS.icpFit} · trigger {SCORE_WEIGHTS.triggerScore} · pain {SCORE_WEIGHTS.demonstratedPain} ·
          service {SCORE_WEIGHTS.serviceFit} · buyer {SCORE_WEIGHTS.buyerAccess} · timing {SCORE_WEIGHTS.timingBudget}.
        </p>
        {score ? (
          <p className="mt-2 text-sm">
            Calculated total {score.total}
            {score.overrideScore != null ? ` · override ${score.overrideScore}` : ""}
          </p>
        ) : (
          <EmptyState>No score recorded yet.</EmptyState>
        )}
        {canWrite ? (
          <ActionForm action={scoreOpportunityAction} className="mt-4 max-w-xl space-y-3">
            <input type="hidden" name="opportunityId" value={opportunity.id} />
            {(
              [
                ["icpFit", "ICP fit", SCORE_WEIGHTS.icpFit, score?.icpFit],
                ["triggerScore", "Trigger", SCORE_WEIGHTS.triggerScore, score?.triggerScore],
                ["demonstratedPain", "Demonstrated pain", SCORE_WEIGHTS.demonstratedPain, score?.demonstratedPain],
                ["serviceFit", "Service fit", SCORE_WEIGHTS.serviceFit, score?.serviceFit],
                ["buyerAccess", "Buyer access", SCORE_WEIGHTS.buyerAccess, score?.buyerAccess],
                ["timingBudget", "Timing / budget", SCORE_WEIGHTS.timingBudget, score?.timingBudget],
              ] as const
            ).map(([name, label, max, value]) => (
              <Field key={name} label={`${label} (max ${max})`} name={name}>
                <input
                  className={inputClassName}
                  id={name}
                  name={name}
                  type="number"
                  min={0}
                  max={max}
                  defaultValue={value ?? 0}
                />
              </Field>
            ))}
            <Field label="Override score" name="overrideScore">
              <input
                className={inputClassName}
                id="overrideScore"
                name="overrideScore"
                type="number"
                min={0}
                max={100}
                defaultValue={score?.overrideScore ?? ""}
              />
            </Field>
            <Field label="Override reason" name="overrideReason">
              <input className={inputClassName} id="overrideReason" name="overrideReason" defaultValue={score?.overrideReason ?? ""} />
            </Field>
            <PrimaryButton>Save score</PrimaryButton>
          </ActionForm>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="section-title">Converted signals</h2>
        {graph.signals.length === 0 ? (
          <EmptyState>No signals converted into this opportunity.</EmptyState>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {graph.signals.map((signal) => (
              <li key={signal.id}>
                {signal.title} · {formatLabel(signal.signalType)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="section-title">Activity</h2>
        {graph.activities.length === 0 ? (
          <EmptyState>No activity recorded.</EmptyState>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {graph.activities.map((activity) => (
              <li key={activity.id}>
                <span className="font-medium">{activity.subject}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {formatLabel(activity.activityType)} · {formatDate(activity.occurredAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {can(principal, "companies.write") ? (
          <ActionForm action={createActivityAction} className="mt-4 max-w-xl space-y-3">
            <input type="hidden" name="opportunityId" value={opportunity.id} />
            <input type="hidden" name="companyId" value={company.id} />
            <input type="hidden" name="returnTo" value={`/app/opportunities/${opportunity.id}`} />
            <Field label="Type" name="activityType">
              <select className={inputClassName} id="activityType" name="activityType" defaultValue="note">
                <option value="note">note</option>
                <option value="meeting">meeting</option>
                <option value="research">research</option>
                <option value="outreach">outreach</option>
              </select>
            </Field>
            <Field label="Subject" name="subject">
              <input className={inputClassName} id="subject" name="subject" required />
            </Field>
            <PrimaryButton>Log activity</PrimaryButton>
          </ActionForm>
        ) : null}
      </section>
    </PageShell>
  );
}
