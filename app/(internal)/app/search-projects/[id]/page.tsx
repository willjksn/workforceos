import { notFound } from "next/navigation";

import { approveSearchStrategyAction, updateSearchProjectAction } from "@/lib/actions/recruiting";
import { requireAppPermission } from "@/lib/auth/guard";
import { getSearchProject } from "@/lib/repositories/recruiting";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { Field, PageHeader, PageShell, PrimaryButton, inputClassName } from "../../_components/ui";

export default async function SearchProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requireAppPermission("search_projects.read");
  const { id } = await params;
  const row = await getSearchProject(id, principal.organizationId);
  if (!row) notFound();
  const canWrite = can(principal, "search_projects.write");

  return (
    <PageShell>
      <PageHeader
        title={row.project.name}
        description={`${row.job.title} · ${row.companyName ?? "No company"}`}
      />
      <p className="mt-3 text-sm text-muted-foreground">
        Internal search {row.project.internalSearchCompletedAt ? "completed" : "not complete"}. Guarantee days and fee terms come from the search agreement, not invented defaults.
      </p>
      {canWrite ? (
        <ActionForm action={updateSearchProjectAction} className="mt-6 max-w-xl space-y-3">
          <input type="hidden" name="searchProjectId" value={row.project.id} />
          <Field label="Candidate profile" name="candidateProfile">
            <textarea className={inputClassName} name="candidateProfile" id="candidateProfile" rows={3} defaultValue={row.project.candidateProfile ?? ""} />
          </Field>
          <Field label="Target industries" name="targetIndustries">
            <input className={inputClassName} name="targetIndustries" id="targetIndustries" defaultValue={row.project.targetIndustries ?? ""} />
          </Field>
          <Field label="Target geography" name="targetGeography">
            <input className={inputClassName} name="targetGeography" id="targetGeography" defaultValue={row.project.targetGeography ?? ""} />
          </Field>
          <Field label="Boolean / search strategy" name="booleanStrategy">
            <textarea className={inputClassName} name="booleanStrategy" id="booleanStrategy" rows={3} defaultValue={row.project.booleanStrategy ?? ""} />
          </Field>
          <Field label="Guarantee days (from agreement)" name="guaranteeDays">
            <input className={inputClassName} name="guaranteeDays" id="guaranteeDays" type="number" min={1} defaultValue={row.project.guaranteeDays ?? ""} />
          </Field>
          <Field label="Fee percent" name="feePercent">
            <input className={inputClassName} name="feePercent" id="feePercent" defaultValue={row.project.feePercent ?? ""} />
          </Field>
          <Field label="Contract reference" name="contractReference">
            <input className={inputClassName} name="contractReference" id="contractReference" defaultValue={row.project.contractReference ?? ""} />
          </Field>
          <PrimaryButton>Save strategy</PrimaryButton>
        </ActionForm>
      ) : null}
      {canWrite && !row.project.strategyApprovedAt ? (
        <ActionForm action={approveSearchStrategyAction} className="mt-4">
          <input type="hidden" name="searchProjectId" value={row.project.id} />
          <button className="text-sm underline" type="submit">Human-approve strategy for client use</button>
        </ActionForm>
      ) : (
        <p className="mt-4 text-sm">Strategy approved {row.project.strategyApprovedAt?.toISOString() ?? "not yet"}.</p>
      )}
    </PageShell>
  );
}
