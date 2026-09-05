import Link from "next/link";

import { createContactAction } from "@/lib/actions/crm";
import { requireAppPermission } from "@/lib/auth/guard";
import { listCompaniesForSelect, listContacts } from "@/lib/repositories/crm";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../_components/action-form";
import { EmptyState, Field, PageHeader, PrimaryButton, formatLabel, inputClassName } from "../_components/ui";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; companyId?: string }>;
}) {
  const principal = await requireAppPermission("contacts.read");
  const { q, companyId } = await searchParams;
  const rows = await listContacts(principal.organizationId, { query: q, companyId });
  const companies = await listCompaniesForSelect(principal.organizationId);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader eyebrow="CRM / Contacts" title="Contacts" description="Buyer and stakeholder contacts across prospect and client companies." />
      <form action="/app/contacts" className="mt-6 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, title, or email"
          className={`${inputClassName} max-w-md`}
        />
        <select name="companyId" defaultValue={companyId ?? ""} className={`${inputClassName} max-w-xs`}>
          <option value="">All companies</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        <button className="rounded border px-4 py-2 text-sm" type="submit">
          Filter
        </button>
      </form>
      {rows.length === 0 ? (
        <EmptyState>No contacts match.</EmptyState>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2">Name</th>
              <th>Title</th>
              <th>Company</th>
              <th>Relationship</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ contact, companies: linked }) => (
              <tr key={contact.id} className="border-b">
                <td className="py-2">
                  <Link className="underline" href={`/app/contacts/${contact.id}`}>
                    {contact.fullName}
                  </Link>
                </td>
                <td>{contact.title ?? "—"}</td>
                <td>{linked.map((item) => item.name).join(", ") || "—"}</td>
                <td>{formatLabel(contact.relationshipStrength)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {can(principal, "contacts.write") ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Add contact</h2>
          <ActionForm action={createContactAction} className="mt-4 max-w-xl space-y-3">
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
        </section>
      ) : null}
    </main>
  );
}
