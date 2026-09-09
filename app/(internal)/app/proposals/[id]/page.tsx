import { notFound } from "next/navigation";

import { approveProposalAction, createContractPackageAction, sendProposalAction, submitProposalForReviewAction } from "@/lib/actions/delivery";
import { AcademyHelp } from "@/components/academy/academy-help";
import { ConceptNote } from "@/components/ia/concept-note";
import { FinanceSpine } from "@/components/ia/finance-spine";
import { ButtonLink } from "@/components/ui/button";
import { requireAppPermission } from "@/lib/auth/guard";
import { getProposalBundle, listOpportunityCommercialPath } from "@/lib/delivery/engine";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { Card, PageHeader, PageShell, PrimaryButton, formatLabel } from "../../_components/ui";
import { StatusBadge } from "@/components/ui/display";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requireAppPermission("proposals.read");
  const { id } = await params;
  const bundle = await getProposalBundle(id, principal.organizationId);
  if (!bundle) notFound();
  const current = bundle.versions[0];
  const commercial = await listOpportunityCommercialPath(principal.organizationId, bundle.proposal.opportunityId);
  const existingContract = commercial.contracts[0];
  const showCreateContract =
    can(principal, "contracts.write") &&
    bundle.proposal.status === "accepted" &&
    !existingContract &&
    bundle.proposal.companyId;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Proposals"
        title={bundle.proposal.title}
        description={`${bundle.companyName} · version ${bundle.proposal.currentVersionNumber}`}
        metadata={
          <StatusBadge tone={bundle.proposal.status === "approved" || bundle.proposal.status === "accepted" ? "success" : "navy"}>
            {formatLabel(bundle.proposal.status)}
          </StatusBadge>
        }
        actions={<AcademyHelp articleSlug="module-proposals" />}
      />
      <ConceptNote concept="solutionVsProposalVsSow" />
      {current?.pricing || current?.pricingAmount ? <FinanceSpine activeHref="/app/proposals" /> : null}
      {current ? (
        <article className="mt-6 space-y-5 rounded-[8px] border border-card-border bg-card p-6 shadow-[var(--shadow-sm)]">
          <p className="eyebrow">PierOne Partners</p>
          {[
            ["Executive summary", current.executiveSummary],
            ["Client problem", current.clientProblem],
            ["Recommended solution", current.recommendedSolution],
            ["Scope", current.scope],
            ["Deliverables", current.deliverables],
            ["Timeline", current.timeline],
            ["Client responsibilities", current.clientResponsibilities],
            ["PierOne responsibilities", current.firmResponsibilities],
            ["KPIs", current.kpis],
            ["Pricing", current.pricing ?? current.pricingAmount],
            ["Payment terms", current.paymentTerms],
            ["Assumptions", current.assumptions],
            ["Exclusions", current.exclusions],
            ["Next steps", current.nextSteps],
          ].map(([label, value]) => (
            <section key={label}>
              <h2 className="section-title">{label}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{value || "—"}</p>
            </section>
          ))}
        </article>
      ) : (
        <Card className="mt-6">No proposal version recorded.</Card>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        HTML proposal is stored for PDF-ready export. Sent proposals are not overwritten; material changes create a new version.
      </p>
      {current?.htmlBody ? (
        <a
          className="mt-3 inline-flex text-sm font-medium text-teal"
          download={`${bundle.proposal.title.replaceAll(" ", "-").toLowerCase()}.html`}
          href={`data:text/html;charset=utf-8,${encodeURIComponent(current.htmlBody)}`}
        >
          Download HTML export
        </a>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        {can(principal, "proposals.write") && bundle.proposal.status === "draft" ? (
          <ActionForm action={submitProposalForReviewAction}>
            <input type="hidden" name="proposalId" value={bundle.proposal.id} />
            <PrimaryButton>Submit for internal review</PrimaryButton>
          </ActionForm>
        ) : null}
        {can(principal, "proposals.approve") && bundle.proposal.status === "internal_review" ? (
          <ActionForm action={approveProposalAction}>
            <input type="hidden" name="proposalId" value={bundle.proposal.id} />
            <PrimaryButton>Approve proposal</PrimaryButton>
          </ActionForm>
        ) : null}
        {can(principal, "proposals.write") && bundle.proposal.status === "approved" ? (
          <ActionForm action={sendProposalAction}>
            <input type="hidden" name="proposalId" value={bundle.proposal.id} />
            <PrimaryButton>Send to client</PrimaryButton>
          </ActionForm>
        ) : null}
        {showCreateContract ? (
          <ActionForm action={createContractPackageAction}>
            <input type="hidden" name="serviceCode" value={bundle.serviceCode} />
            <input type="hidden" name="companyId" value={bundle.proposal.companyId} />
            <input type="hidden" name="opportunityId" value={bundle.proposal.opportunityId} />
            <input type="hidden" name="proposalId" value={bundle.proposal.id} />
            <input type="hidden" name="solutionPlanId" value={bundle.proposal.solutionPlanId} />
            <PrimaryButton>Create contract / SOW</PrimaryButton>
          </ActionForm>
        ) : null}
        {bundle.proposal.status === "accepted" && existingContract ? (
          <ButtonLink href={`/app/contracts/${existingContract.id}`} variant="primary">
            Open contract / SOW
          </ButtonLink>
        ) : null}
      </div>
      {bundle.proposal.status === "draft" || bundle.proposal.status === "internal_review" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Send is available after internal review and human approval.
        </p>
      ) : null}
    </PageShell>
  );
}
