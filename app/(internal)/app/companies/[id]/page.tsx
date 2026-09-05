import { notFound } from "next/navigation";

import {
  addContactAction,
  addLocationAction,
  addOpportunityAction,
  addSignalAction,
} from "@/lib/actions/crm";
import { requireAppPermission } from "@/lib/auth/guard";
import { getCompanyGraph } from "@/lib/repositories/crm";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { Field, PageHeader, PrimaryButton, inputClassName } from "../../_components/ui";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requireAppPermission("companies.read");
  const { id } = await params;
  const graph = await getCompanyGraph(id, principal.organizationId);
  if (!graph) notFound();
  const { company } = graph;
  const canWriteCompany = can(principal, "companies.write");
  const canWriteContacts = can(principal, "contacts.write");
  const canWriteOpps = can(principal, "opportunities.write");

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title={company.name}
        description={`${company.companyType} · ${company.clientStatus} · relationship ${company.relationshipStrength}`}
      />
      {company.website ? (
        <p className="mt-3 text-sm">
          <a className="underline" href={company.website}>
            {company.website}
          </a>
        </p>
      ) : null}
      {company.notes ? <p className="mt-3 text-sm text-zinc-600">{company.notes}</p> : null}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Locations</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {graph.locations.map((location) => (
            <li key={location.id}>
              {location.name}
              {location.city ? ` · ${location.city}` : ""}
              {location.region ? `, ${location.region}` : ""}
              {location.isPrimary ? " (primary)" : ""}
            </li>
          ))}
        </ul>
        {canWriteCompany ? (
          <ActionForm action={addLocationAction} className="mt-4 max-w-xl space-y-3">
            <input type="hidden" name="companyId" value={company.id} />
            <Field label="Location name" name="locationName">
              <input className={inputClassName} id="locationName" name="name" required />
            </Field>
            <Field label="City" name="locationCity">
              <input className={inputClassName} id="locationCity" name="city" />
            </Field>
            <Field label="Region" name="locationRegion">
              <input className={inputClassName} id="locationRegion" name="region" />
            </Field>
            <Field label="Country" name="locationCountry">
              <input className={inputClassName} id="locationCountry" name="country" />
            </Field>
            <PrimaryButton>Add location</PrimaryButton>
          </ActionForm>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Contacts</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2">Name</th>
              <th>Title</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {graph.contacts.map(({ contact }) => (
              <tr key={contact.id} className="border-b">
                <td className="py-2">{contact.fullName}</td>
                <td>{contact.title ?? "—"}</td>
                <td>{contact.email ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {canWriteContacts ? (
          <ActionForm action={addContactAction} className="mt-4 max-w-xl space-y-3">
            <input type="hidden" name="companyId" value={company.id} />
            <Field label="Full name" name="contactFullName">
              <input className={inputClassName} id="contactFullName" name="fullName" required />
            </Field>
            <Field label="Title" name="contactTitle">
              <input className={inputClassName} id="contactTitle" name="title" />
            </Field>
            <Field label="Email" name="contactEmail">
              <input className={inputClassName} id="contactEmail" name="email" type="email" />
            </Field>
            <PrimaryButton>Add contact</PrimaryButton>
          </ActionForm>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Opportunities</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {graph.opportunities.map((opportunity) => (
            <li key={opportunity.id}>
              {opportunity.name} · {opportunity.stage}
            </li>
          ))}
        </ul>
        {canWriteOpps ? (
          <ActionForm action={addOpportunityAction} className="mt-4 max-w-xl space-y-3">
            <input type="hidden" name="companyId" value={company.id} />
            <Field label="Opportunity name" name="opportunityName">
              <input className={inputClassName} id="opportunityName" name="name" required />
            </Field>
            <Field label="Stage" name="stage">
              <select className={inputClassName} id="stage" name="stage" defaultValue="identified">
                <option value="identified">identified</option>
                <option value="qualified">qualified</option>
                <option value="proposal">proposal</option>
                <option value="negotiation">negotiation</option>
                <option value="won">won</option>
                <option value="lost">lost</option>
                <option value="abandoned">abandoned</option>
              </select>
            </Field>
            <PrimaryButton>Add opportunity</PrimaryButton>
          </ActionForm>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Signals</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {graph.signals.map((signal) => (
            <li key={signal.id}>
              {signal.title} · {signal.signalType}
            </li>
          ))}
        </ul>
        {canWriteOpps ? (
          <ActionForm action={addSignalAction} className="mt-4 max-w-xl space-y-3">
            <input type="hidden" name="companyId" value={company.id} />
            <Field label="Signal title" name="signalTitle">
              <input className={inputClassName} id="signalTitle" name="title" required />
            </Field>
            <Field label="Type" name="signalType">
              <select className={inputClassName} id="signalType" name="signalType" defaultValue="hiring">
                <option value="hiring">hiring</option>
                <option value="expansion">expansion</option>
                <option value="layoff">layoff</option>
                <option value="funding">funding</option>
                <option value="leadership_change">leadership_change</option>
                <option value="workforce_need">workforce_need</option>
                <option value="other">other</option>
              </select>
            </Field>
            <PrimaryButton>Add signal</PrimaryButton>
          </ActionForm>
        ) : null}
      </section>
    </main>
  );
}
