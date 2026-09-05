import Link from "next/link";

import { createContactAction } from "@/lib/actions/crm";
import { requireAppPermission } from "@/lib/auth/guard";
import { listCompaniesForSelect, listContacts } from "@/lib/repositories/crm";
import { can } from "@/lib/rbac/permissions";
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

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; companyId?: string }>;
}) {
  const principal = await requireAppPermission("contacts.read");
  const { q, companyId } = await searchParams;
  const rows = await listContacts(principal.organizationId, { query: q, companyId });
  const companies = await listCompaniesForSelect(principal.organizationId);
  const canWrite = can(principal, "contacts.write");

  return (
    <PageShell>
      <PageHeader
        eyebrow="CRM / Contacts"
        title="Contacts"
        description="Buyer and stakeholder contacts across prospect and client companies."
      />
      <FilterBar>
        <SearchForm action="/app/contacts" q={q} placeholder="Search name, title, or email" className="" submitLabel="Filter">
          <select name="companyId" defaultValue={companyId ?? ""} className={`${inputClassName} max-w-xs`}>
            <option value="">All companies</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </SearchForm>
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState title="No contacts match.">
          Adjust the search, or add a contact if you have write access.
        </EmptyState>
      ) : (
        <DataTable columns={["Name", "Title", "Company", "Relationship"]}>
          {rows.map(({ contact, companies: linked }) => (
            <tr key={contact.id}>
              <td>
                <Link className="font-medium text-navy" href={`/app/contacts/${contact.id}`}>
                  {contact.fullName}
                </Link>
              </td>
              <td>{contact.title ?? "—"}</td>
              <td>{linked.map((item) => item.name).join(", ") || "—"}</td>
              <td>
                <StatusBadge tone={contact.relationshipStrength === "strategic" || contact.relationshipStrength === "strong" ? "teal" : "navy"}>
                  {formatLabel(contact.relationshipStrength)}
                </StatusBadge>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      {canWrite ? (
        <CreatePanel title="Add contact">
          <ActionForm action={createContactAction} className="max-w-xl space-y-3">
            <Field label="Full name" name="fullName">
              <input className={inputClassName} id="fullName" name="fullName" required />
            </Field>
            <Field label="Title" name="title">
              <input className={inputClassName} id="title" name="title" />
            </Field>
            <Field label="Email" name="email">
              <input className={inputClassName} id="email" name="email" type="email" />
            </Field>
            <Field label="Phone" name="phone">
              <input className={inputClassName} id="phone" name="phone" />
            </Field>
            <Field label="Company" name="companyId">
              <select className={inputClassName} id="companyId" name="companyId" defaultValue="">
                <option value="">None</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Department" name="department">
              <input className={inputClassName} id="department" name="department" />
            </Field>
            <Field label="Buyer persona" name="buyerPersona">
              <input className={inputClassName} id="buyerPersona" name="buyerPersona" />
            </Field>
            <PrimaryButton>Create contact</PrimaryButton>
          </ActionForm>
        </CreatePanel>
      ) : null}
    </PageShell>
  );
}
