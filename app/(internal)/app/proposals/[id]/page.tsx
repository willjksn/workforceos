import { notFound } from "next/navigation";

import { approveProposalAction, sendProposalAction } from "@/lib/actions/delivery";
import { requireAppPermission } from "@/lib/auth/guard";
import { getProposalBundle } from "@/lib/delivery/engine";
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

  return (
    <PageShell>
      <PageHeader
        eyebrow="Proposals"
        title={bundle.proposal.title}
        description={`${bundle.companyName} · version ${bundle.proposal.currentVersionNumber}`}
        metadata={
          <StatusBadge tone={bundle.proposal.status === "approved" ? "success" : "navy"}>
            {formatLabel(bundle.proposal.status)}
          </StatusBadge>
        }
      />
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
        {can(principal, "proposals.approve") && bundle.proposal.status === "draft" ? (
          <ActionForm action={approveProposalAction}>
            <input type="hidden" name="proposalId" value={bundle.proposal.id} />
            <PrimaryButton>Approve proposal</PrimaryButton>
          </ActionForm>
        ) : null}
        {can(principal, "proposals.write") ? (
          <ActionForm action={sendProposalAction}>
            <input type="hidden" name="proposalId" value={bundle.proposal.id} />
            <button className="rounded-full border px-4 py-2 text-sm" type="submit">
              Send proposal
            </button>
          </ActionForm>
        ) : null}
      </div>
    </PageShell>
  );
}
