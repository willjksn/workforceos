import Link from "next/link";

import { createCompanyAction } from "@/lib/actions/crm";
import { requireAppPermission } from "@/lib/auth/guard";
import { listCompanies } from "@/lib/repositories/crm";
import { can } from "@/lib/rbac/permissions";
import { AcademyHelp } from "@/components/academy/academy-help";
import { ButtonLink } from "@/components/ui/button";
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
  SearchForm,
  StatusBadge,
  formatLabel,
  inputClassName,
} from "../_components/ui";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const principal = await requireAppPermission("companies.read");
  const { q } = await searchParams;
  const rows = await listCompanies(principal.organizationId, q);
  const canWrite = can(principal, "companies.write");

  return (
    <PageShell>
      <PageHeader
        eyebrow="CRM / Account intelligence"
        title="Companies"
        description="Understand client relationships, workforce signals, and revenue opportunities."
        actions={
          <>
            <AcademyHelp articleSlug="module-companies" />
            {canWrite ? <ButtonLink href="#add-company" variant="primary">Add company</ButtonLink> : null}
          </>
        }
      />
      <FilterBar>
        <SearchForm action="/app/companies" q={q} placeholder="Search company name" className="" />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState title="No companies match.">
          Search another name, or add a company if you have write access.
        </EmptyState>
      ) : (
        <DataTable columns={["Name", "Type", "Status", "Industry"]}>
          {rows.map((company) => (
            <tr key={company.id}>
              <td>
                <Link className="font-medium text-navy" href={`/app/companies/${company.id}`}>
                  {company.name}
                </Link>
              </td>
              <td>{formatLabel(company.companyType)}</td>
              <td>
                <StatusBadge tone={company.clientStatus === "active" ? "success" : "navy"}>
                  {formatLabel(company.clientStatus)}
                </StatusBadge>
              </td>
              <td>{company.industry ?? "—"}</td>
            </tr>
          ))}
        </DataTable>
      )}
      {canWrite ? (
        <CreatePanel id="add-company" title="Add company">
          <ActionForm action={createCompanyAction} className="max-w-xl space-y-3">
            <Field label="Name" name="name">
              <input className={inputClassName} id="name" name="name" required />
            </Field>
            <Field label="Type" name="companyType">
              <select className={inputClassName} id="companyType" name="companyType" defaultValue="prospect">
                <option value="prospect">prospect</option>
                <option value="client">client</option>
                <option value="partner">partner</option>
                <option value="other">other</option>
              </select>
            </Field>
            <Field label="Client status" name="clientStatus">
              <select className={inputClassName} id="clientStatus" name="clientStatus" defaultValue="prospect">
                <option value="prospect">prospect</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="former">former</option>
              </select>
            </Field>
            <Field label="Relationship" name="relationshipStrength">
              <select
                className={inputClassName}
                id="relationshipStrength"
                name="relationshipStrength"
                defaultValue="unknown"
              >
                <option value="unknown">unknown</option>
                <option value="weak">weak</option>
                <option value="moderate">moderate</option>
                <option value="strong">strong</option>
                <option value="strategic">strategic</option>
              </select>
            </Field>
            <Field label="Website" name="website">
              <input className={inputClassName} id="website" name="website" />
            </Field>
            <Field label="Industry" name="industry">
              <input className={inputClassName} id="industry" name="industry" />
            </Field>
            <Field label="Notes" name="notes">
              <textarea className={inputClassName} id="notes" name="notes" rows={3} />
            </Field>
            <PrimaryButton>Create company</PrimaryButton>
          </ActionForm>
        </CreatePanel>
      ) : null}
    </PageShell>
  );
}
