import { notFound } from "next/navigation";

import { createDeliveryProjectAction, executeContractAction } from "@/lib/actions/delivery";
import { ConceptNote } from "@/components/ia/concept-note";
import { FinanceSpine } from "@/components/ia/finance-spine";
import { ButtonLink } from "@/components/ui/button";
import { requireAppPermission } from "@/lib/auth/guard";
import { getContract, listOpportunityCommercialPath } from "@/lib/delivery/engine";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { Card, Field, PageHeader, PageShell, PrimaryButton, formatDate, formatLabel, inputClassName } from "../../_components/ui";
import { StatusBadge } from "@/components/ui/display";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requireAppPermission("contracts.read");
  const { id } = await params;
  const bundle = await getContract(id, principal.organizationId);
  if (!bundle) notFound();
  const { contract } = bundle;
  const commercial = contract.opportunityId
    ? await listOpportunityCommercialPath(principal.organizationId, contract.opportunityId)
    : { projects: [] as Array<{ id: string }> };
  const existingProject = commercial.projects[0];
  const showCreateProject =
    can(principal, "projects.write") &&
    contract.status === "executed" &&
    !existingProject &&
    Boolean(contract.solutionPlanId);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Legal & Contracts"
        title={contract.title}
        description={`${bundle.companyName} · ${formatLabel(contract.contractType)}`}
        metadata={
          <StatusBadge tone={contract.status === "executed" ? "success" : "navy"}>
            {formatLabel(contract.status)}
          </StatusBadge>
        }
      />
      <ConceptNote concept="templateVsAgreementVsContract" />
      <FinanceSpine activeHref="/app/contracts" />
      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Signature</dt>
          <dd>{formatLabel(contract.signatureStatus)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Value</dt>
          <dd>{contract.contractValue ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Executed</dt>
          <dd>{formatDate(contract.executionDate)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Expires</dt>
          <dd>{formatDate(contract.expirationDate)}</dd>
        </div>
      </dl>
      <Card className="mt-6">
        <p className="eyebrow">Statement of work / body</p>
        <p className="mt-2 whitespace-pre-wrap text-sm">{contract.sow ?? "—"}</p>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        E-sign uses a DocuSign-ready adapter. Credentials are not required for Phase 4; manual execution is available.
      </p>
      {can(principal, "contracts.approve") && contract.status !== "executed" ? (
        <ActionForm action={executeContractAction} className="mt-6 max-w-md space-y-3">
          <input type="hidden" name="contractId" value={contract.id} />
          <Field label="Signer name" name="signerName">
            <input className={inputClassName} id="signerName" name="signerName" required />
          </Field>
          <PrimaryButton>Mark executed (manual)</PrimaryButton>
        </ActionForm>
      ) : null}
      {showCreateProject && contract.solutionPlanId ? (
        <ActionForm action={createDeliveryProjectAction} className="mt-6">
          <input type="hidden" name="solutionPlanId" value={contract.solutionPlanId} />
          <input type="hidden" name="contractId" value={contract.id} />
          <PrimaryButton>Create delivery project</PrimaryButton>
        </ActionForm>
      ) : null}
      {contract.status === "executed" && existingProject ? (
        <div className="mt-6">
          <ButtonLink href={`/app/projects/${existingProject.id}`} variant="primary">
            Open delivery project
          </ButtonLink>
        </div>
      ) : null}
    </PageShell>
  );
}
