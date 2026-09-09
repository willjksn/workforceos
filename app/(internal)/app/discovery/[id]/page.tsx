import { notFound } from "next/navigation";

import {
  approveDiscoveryAction,
  createSolutionPlanAction,
} from "@/lib/actions/delivery";
import { AcademyHelp } from "@/components/academy/academy-help";
import { ButtonLink } from "@/components/ui/button";
import { requireAppPermission } from "@/lib/auth/guard";
import { getDiscovery, listOpportunityCommercialPath, loadApprovedWorkflow } from "@/lib/delivery/engine";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import {
  Card,
  Field,
  PageHeader,
  PageShell,
  PrimaryButton,
  formatLabel,
  inputClassName,
} from "../../_components/ui";
import { StatusBadge } from "@/components/ui/display";

export default async function DiscoveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requireAppPermission("discovery.read");
  const { id } = await params;
  const row = await getDiscovery(id, principal.organizationId);
  if (!row) notFound();
  const workflow = await loadApprovedWorkflow(row.serviceCode);
  const answers = row.discovery.answers ?? {};
  const commercial = await listOpportunityCommercialPath(principal.organizationId, row.discovery.opportunityId);
  const existingPlan = commercial.plans[0];
  const canApprove = can(principal, "discovery.write") && row.discovery.status !== "approved";
  const canCreatePlan = can(principal, "solutions.write") && row.discovery.status === "approved" && !existingPlan;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Solutions / Discovery"
        title={row.discovery.title}
        description={`${row.companyName} · ${row.opportunityName} · ${row.serviceName}`}
        metadata={
          <StatusBadge tone={row.discovery.status === "approved" ? "success" : "navy"}>
            {formatLabel(row.discovery.status)}
          </StatusBadge>
        }
        actions={<AcademyHelp articleSlug="module-discovery" />}
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <p className="eyebrow">Problem statement</p>
          <p className="mt-2 text-sm">{row.discovery.problemStatement ?? "—"}</p>
        </Card>
        <Card>
          <p className="eyebrow">Business impact</p>
          <p className="mt-2 text-sm">{row.discovery.businessImpact ?? "—"}</p>
        </Card>
        <Card>
          <p className="eyebrow">Recommended service</p>
          <p className="mt-2 text-sm">{row.discovery.recommendedServiceCode}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Next: {row.discovery.recommendedNextServiceCode ?? "—"}
          </p>
        </Card>
        <Card>
          <p className="eyebrow">Human approval</p>
          <p className="mt-2 text-sm">{formatLabel(row.discovery.status)}</p>
        </Card>
      </div>
      <section className="mt-8">
        <h2 className="section-title">Workflow questions</h2>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          {(workflow.definition?.requiredDiscoveryInputs ?? []).map((question) => (
            <div key={question.key}>
              <dt className="text-muted-foreground">{question.label}</dt>
              <dd>{answers[question.key] ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </section>
      {canApprove ? (
        <ActionForm action={approveDiscoveryAction} className="mt-8">
          <input type="hidden" name="discoveryId" value={row.discovery.id} />
          <PrimaryButton>Approve discovery</PrimaryButton>
        </ActionForm>
      ) : null}
      {existingPlan && row.discovery.status === "approved" ? (
        <div className="mt-8">
          <ButtonLink href={`/app/solutions/${existingPlan.id}`} variant="primary">
            Open solution plan
          </ButtonLink>
        </div>
      ) : null}
      {canCreatePlan ? (
        <ActionForm action={createSolutionPlanAction} className="mt-8 max-w-xl space-y-3">
          <input type="hidden" name="discoveryId" value={row.discovery.id} />
          <Field label="Plan title" name="title">
            <input className={inputClassName} id="title" name="title" defaultValue={`${row.serviceName} solution plan`} />
          </Field>
          <Field label="Recommended price" name="recommendedPrice">
            <input className={inputClassName} id="recommendedPrice" name="recommendedPrice" defaultValue={workflow.version.minPrice ?? ""} />
          </Field>
          <Field label="Pricing override reason" name="overrideReason">
            <input className={inputClassName} id="overrideReason" name="overrideReason" />
          </Field>
          <PrimaryButton>Create solution plan</PrimaryButton>
        </ActionForm>
      ) : null}
    </PageShell>
  );
}
