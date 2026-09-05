import Link from "next/link";

import { createCompanyAction } from "@/lib/actions/crm";
import { requireAppPermission } from "@/lib/auth/guard";
import { listCompanies } from "@/lib/repositories/crm";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../_components/action-form";
import { StatusBadge } from "../_components/ui";
import { ButtonLink } from "@/components/ui/button";
import { Field, PageHeader, PrimaryButton, SearchForm, inputClassName } from "../_components/ui";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const principal = await requireAppPermission("companies.read");
  const { q } = await searchParams;
  const rows = await listCompanies(principal.organizationId, q);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        eyebrow="CRM / Account intelligence"
        title="Companies"
        description="Understand client relationships, workforce signals, and revenue opportunities."
        actions={can(principal, "companies.write") ? <ButtonLink href="#add-company" variant="primary">Add company</ButtonLink> : undefined}
      />
      <SearchForm action="/app/companies" q={q} placeholder="Search company name" />
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-600">No companies match.</p>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2">Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Industry</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((company) => (
              <tr key={company.id} className="border-b">
                <td className="py-2">
                  <Link className="font-medium text-navy" href={`/app/companies/${company.id}`}>
                    {company.name}
                  </Link>
                </td>
                <td>{company.companyType}</td>
                <td>
                  <StatusBadge tone={company.clientStatus === "active" ? "success" : "navy"}>
                    {company.clientStatus}
                  </StatusBadge>
                </td>
                <td>{company.industry ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {can(principal, "companies.write") ? (
        <section className="mt-10" id="add-company">
          <h2 className="section-title">Add company</h2>
          <ActionForm action={createCompanyAction} className="mt-4 max-w-xl space-y-3">
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
        </section>
      ) : null}
    </main>
  );
}
