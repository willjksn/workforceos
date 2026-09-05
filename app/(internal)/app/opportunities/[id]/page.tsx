import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createActivityAction,
  scoreOpportunityAction,
  updateOpportunityStageAction,
} from "@/lib/actions/crm";
import { requireAppPermission } from "@/lib/auth/guard";
import { SCORE_WEIGHTS } from "@/lib/crm/scoring";
import { OPPORTUNITY_STAGES } from "@/lib/crm/stages";
import { getOpportunityGraph } from "@/lib/repositories/crm";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { EmptyState, Field, PageHeader, PageShell, PrimaryButton, formatDate, formatLabel, inputClassName } from "../../_components/ui";

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

  return (
    <PageShell>
      <PageHeader
        title={opportunity.name}
        description={`${formatLabel(opportunity.stage)} · ${company.name}`}
      />
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
