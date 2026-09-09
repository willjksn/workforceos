import Link from "next/link";

import { addOpportunityAction } from "@/lib/actions/crm";
import { requireAppPermission } from "@/lib/auth/guard";
import { LAUNCH_SERVICE_CODES, OPPORTUNITY_STAGES } from "@/lib/crm/stages";
import { listCompaniesForSelect, listOpportunitiesFiltered } from "@/lib/repositories/crm";
import { can } from "@/lib/rbac/permissions";
import { AcademyHelp } from "@/components/academy/academy-help";
import { ActionForm } from "../_components/action-form";
import {
  CreatePanel,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  PageHeader,
  PageShell,
  PrimaryButton,
  ScoreBadge,
  SearchForm,
  StatusBadge,
  formatLabel,
  inputClassName,
} from "../_components/ui";

const SCORE_BANDS = ["priority", "active_qualified", "nurture", "monitor"] as const;

function stageTone(stage: string) {
  if (stage === "won" || stage === "closed_won") return "success" as const;
  if (stage === "lost" || stage === "closed_lost") return "neutral" as const;
  if (stage === "proposal" || stage === "verbal") return "teal" as const;
  return "navy" as const;
}

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
  const canWrite = can(principal, "opportunities.write");
  const companies = canWrite ? await listCompaniesForSelect(principal.organizationId) : [];

  return (
    <PageShell>
      <PageHeader
        eyebrow="CRM / Pipeline"
        title="Opportunities"
        description="Commercial pipeline for the five launch services. Path: Company → Opportunity → Discovery → Solution → Proposal → Contract → Project."
        actions={<AcademyHelp articleSlug="module-opportunities" />}
      />
      <FilterBar>
        <SearchForm action="/app/opportunities" q={q} placeholder="Search opportunity or company" className="" submitLabel="Filter">
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
        </SearchForm>
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState title="No opportunities match.">
          Adjust the filters, or add an opportunity if you have write access.
        </EmptyState>
      ) : (
        <DataTable columns={["Opportunity", "Company", "Stage", "Score"]}>
          {rows.map(({ opportunity, companyName }) => (
            <tr key={opportunity.id}>
              <td>
                <Link className="font-medium text-navy" href={`/app/opportunities/${opportunity.id}`}>
                  {opportunity.name}
                </Link>
              </td>
              <td>{companyName}</td>
              <td>
                <StatusBadge tone={stageTone(opportunity.stage)}>{formatLabel(opportunity.stage)}</StatusBadge>
              </td>
              <td>
                <ScoreBadge score={opportunity.opportunityScore} band={opportunity.scoreBand} />
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      {canWrite ? (
        <CreatePanel title="Add opportunity">
          <ActionForm action={addOpportunityAction} className="max-w-xl space-y-3">
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
        </CreatePanel>
      ) : null}
    </PageShell>
  );
}
