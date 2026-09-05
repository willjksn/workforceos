import Link from "next/link";

import { addOpportunityAction } from "@/lib/actions/crm";
import { requireAppPermission } from "@/lib/auth/guard";
import { LAUNCH_SERVICE_CODES, OPPORTUNITY_STAGES } from "@/lib/crm/stages";
import { listCompaniesForSelect, listOpportunitiesFiltered } from "@/lib/repositories/crm";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../_components/action-form";
import { EmptyState, Field, PageHeader, PrimaryButton, formatLabel, inputClassName } from "../_components/ui";

const SCORE_BANDS = ["priority", "active_qualified", "nurture", "monitor"] as const;

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string; scoreBand?: string }>;
}) {
  const principal = await requireAppPermission("opportunities.read");
  const { q, stage, scoreBand } = await searchParams;
  const stageFilter = OPPORTUNITY_STAGES.includes(stage as (typeof OPPORTUNITY_STAGES)[number]) ? stage : undefined;
  const scoreBandFilter = SCORE_BANDS.includes(scoreBand as (typeof SCORE_BANDS)[number]) ? scoreBand : undefined;
  const rows = await listOpportunitiesFiltered(principal.organizationId, {
    query: q,
    stage: stageFilter,
    scoreBand: scoreBandFilter,
  });
  const companies = can(principal, "opportunities.write")
    ? await listCompaniesForSelect(principal.organizationId)
    : [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        title="Opportunities"
        description="Commercial pipeline for the five launch services. Scores are stored, not invented at render time."
      />
      <form action="/app/opportunities" className="mt-6 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search opportunity or company" className={`${inputClassName} max-w-md`} />
        <select name="stage" defaultValue={stage ?? ""} className={`${inputClassName} max-w-xs`}>
          <option value="">All stages</option>
          {OPPORTUNITY_STAGES.map((value) => (
            <option key={value} value={value}>
              {formatLabel(value)}
            </option>
          ))}
        </select>
        <select name="scoreBand" defaultValue={scoreBand ?? ""} className={`${inputClassName} max-w-xs`}>
          <option value="">All score bands</option>
          {SCORE_BANDS.map((value) => (
            <option key={value} value={value}>
              {formatLabel(value)}
            </option>
          ))}
        </select>
        <button className="rounded border px-4 py-2 text-sm" type="submit">
          Filter
        </button>
      </form>
      {rows.length === 0 ? (
        <EmptyState>No opportunities match.</EmptyState>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2">Opportunity</th>
              <th>Company</th>
              <th>Stage</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ opportunity, companyName }) => (
              <tr key={opportunity.id} className="border-b">
                <td className="py-2">
                  <Link className="underline" href={`/app/opportunities/${opportunity.id}`}>
                    {opportunity.name}
                  </Link>
                </td>
                <td>{companyName}</td>
                <td>{formatLabel(opportunity.stage)}</td>
                <td>
                  {opportunity.opportunityScore ?? "—"}
                  {opportunity.scoreBand ? ` · ${formatLabel(opportunity.scoreBand)}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {can(principal, "opportunities.write") ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Add opportunity</h2>
          <ActionForm action={addOpportunityAction} className="mt-4 max-w-xl space-y-3">
            <Field label="Company" name="companyId">
              <select className={inputClassName} id="companyId" name="companyId" required defaultValue="">
                <option value="" disabled>
                  Select company
                </option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Name" name="name">
              <input className={inputClassName} id="name" name="name" required />
            </Field>
            <Field label="Stage" name="stage">
              <select className={inputClassName} id="stage" name="stage" defaultValue="identified">
                {OPPORTUNITY_STAGES.map((value) => (
                  <option key={value} value={value}>
                    {formatLabel(value)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Service" name="serviceCode">
              <select className={inputClassName} id="serviceCode" name="serviceCode" defaultValue="">
                <option value="">Unspecified</option>
                {LAUNCH_SERVICE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {formatLabel(code)}
                  </option>
                ))}
              </select>
            </Field>
            <PrimaryButton>Create opportunity</PrimaryButton>
          </ActionForm>
        </section>
      ) : null}
    </main>
  );
}
