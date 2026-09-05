import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addContactAction,
  addLocationAction,
  addOpportunityAction,
  addSignalAction,
  createActivityAction,
} from "@/lib/actions/crm";
import { requireAppPermission } from "@/lib/auth/guard";
import { OPPORTUNITY_STAGES } from "@/lib/crm/stages";
import { getCompanyGraph, listActivities } from "@/lib/repositories/crm";
import { listJobs } from "@/lib/repositories/recruiting";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import {
  EmptyState,
  Field,
  PageHeader,
  PrimaryButton,
  TabNav,
  formatDate,
  formatLabel,
  inputClassName,
} from "../../_components/ui";

const CRM_TABS = ["overview", "contacts", "opportunities", "signals", "locations", "activity"] as const;
const PLACEHOLDER_TABS = ["jobs", "legal", "finance", "projects"] as const;

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const principal = await requireAppPermission("companies.read");
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const tab = [...CRM_TABS, ...PLACEHOLDER_TABS].includes(tabParam as never) ? tabParam! : "overview";
  const graph = await getCompanyGraph(id, principal.organizationId);
  if (!graph) notFound();
  const { company } = graph;
  const canWriteCompany = can(principal, "companies.write");
  const canWriteContacts = can(principal, "contacts.write");
  const canWriteOpps = can(principal, "opportunities.write");
  const activities = tab === "activity" || tab === "overview"
    ? await listActivities({ organizationId: principal.organizationId, companyId: company.id })
    : [];
  const jobs = tab === "jobs" && can(principal, "jobs.read")
    ? (await listJobs(principal.organizationId)).filter((row) => row.job.companyId === company.id)
    : [];

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "contacts", label: "Contacts" },
    { id: "opportunities", label: "Opportunities" },
    { id: "signals", label: "Signals" },
    { id: "locations", label: "Locations" },
    { id: "activity", label: "Activity" },
    { id: "jobs", label: "Jobs" },
    { id: "legal", label: "Legal" },
    { id: "finance", label: "Finance" },
    { id: "projects", label: "Projects" },
  ].map((item) => ({ ...item, href: `/app/companies/${company.id}?tab=${item.id}` }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title={company.name}
        description={`${company.companyType} · ${company.clientStatus} · relationship ${company.relationshipStrength}`}
      />
      <TabNav items={tabs} activeId={tab} />

      {tab === "overview" ? (
        <section className="mt-6">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Industry</dt>
              <dd>{company.industry ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Employees</dt>
              <dd>{company.employeeCount ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Annual revenue</dt>
              <dd>{company.annualRevenue ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Next action</dt>
              <dd>
                {company.nextAction ?? "—"}
                {company.nextActionAt ? ` · ${formatDate(company.nextActionAt)}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Military fit</dt>
              <dd>{company.militaryFitScore ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Workforce opportunity</dt>
              <dd>{company.workforceOpportunityScore ?? "—"}</dd>
            </div>
          </dl>
          {company.website ? (
            <p className="mt-4 text-sm">
              <a className="underline" href={company.website}>
                {company.website}
              </a>
            </p>
          ) : null}
          {company.notes ? <p className="mt-3 text-sm text-zinc-600">{company.notes}</p> : null}
          <p className="mt-4 text-xs text-zinc-500">
            Annual revenue is operating company size, not ownership or cap-table data.
          </p>
        </section>
      ) : null}

      {tab === "locations" ? (
        <section className="mt-6">
          <ul className="space-y-1 text-sm">
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
      ) : null}

      {tab === "contacts" ? (
        <section className="mt-6">
          <table className="w-full text-left text-sm">
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
                  <td className="py-2">
                    <Link className="underline" href={`/app/contacts/${contact.id}`}>
                      {contact.fullName}
                    </Link>
                  </td>
                  <td>{contact.title ?? "—"}</td>
                  <td>{contact.email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {canWriteContacts ? (
            <ActionForm action={addContactAction} className="mt-4 max-w-xl space-y-3">
              <input type="hidden" name="companyId" value={company.id} />
              <input type="hidden" name="returnTo" value={`/app/companies/${company.id}?tab=contacts`} />
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
      ) : null}

      {tab === "opportunities" ? (
        <section className="mt-6">
          <ul className="space-y-1 text-sm">
            {graph.opportunities.map((opportunity) => (
              <li key={opportunity.id}>
                <Link className="underline" href={`/app/opportunities/${opportunity.id}`}>
                  {opportunity.name}
                </Link>
                {` · ${formatLabel(opportunity.stage)}`}
                {opportunity.opportunityScore != null ? ` · ${opportunity.opportunityScore}` : ""}
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
                  {OPPORTUNITY_STAGES.map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </Field>
              <PrimaryButton>Add opportunity</PrimaryButton>
            </ActionForm>
          ) : null}
        </section>
      ) : null}

      {tab === "signals" ? (
        <section className="mt-6">
          <ul className="space-y-1 text-sm">
            {graph.signals.map((signal) => (
              <li key={signal.id}>
                {signal.title} · {formatLabel(signal.signalType)} · {formatLabel(signal.reviewStatus)}
              </li>
            ))}
          </ul>
          {canWriteOpps ? (
            <ActionForm action={addSignalAction} className="mt-4 max-w-xl space-y-3">
              <input type="hidden" name="companyId" value={company.id} />
              <input type="hidden" name="returnTo" value={`/app/companies/${company.id}?tab=signals`} />
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
      ) : null}

      {tab === "activity" ? (
        <section className="mt-6">
          {activities.length === 0 ? (
            <EmptyState>No activity recorded.</EmptyState>
          ) : (
            <ul className="space-y-2 text-sm">
              {activities.map((activity) => (
                <li key={activity.id}>
                  <span className="font-medium">{activity.subject}</span>
                  <span className="text-zinc-500">
                    {" "}
                    · {formatLabel(activity.activityType)} · {formatDate(activity.occurredAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canWriteCompany ? (
            <ActionForm action={createActivityAction} className="mt-4 max-w-xl space-y-3">
              <input type="hidden" name="companyId" value={company.id} />
              <input type="hidden" name="returnTo" value={`/app/companies/${company.id}?tab=activity`} />
              <Field label="Type" name="activityType">
                <select className={inputClassName} id="activityType" name="activityType" defaultValue="note">
                  <option value="note">note</option>
                  <option value="email">email</option>
                  <option value="phone">phone</option>
                  <option value="meeting">meeting</option>
                  <option value="research">research</option>
                </select>
              </Field>
              <Field label="Subject" name="subject">
                <input className={inputClassName} id="subject" name="subject" required />
              </Field>
              <Field label="Next action" name="nextAction">
                <input className={inputClassName} id="nextAction" name="nextAction" />
              </Field>
              <Field label="Follow up" name="followUpAt">
                <input className={inputClassName} id="followUpAt" name="followUpAt" type="datetime-local" />
              </Field>
              <PrimaryButton>Log activity</PrimaryButton>
            </ActionForm>
          ) : null}
        </section>
      ) : null}

      {tab === "jobs" ? (
        <section className="mt-6">
          {!can(principal, "jobs.read") ? (
            <p className="text-sm text-zinc-600">Not yet implemented in this phase.</p>
          ) : jobs.length === 0 ? (
            <EmptyState>No jobs linked to this company.</EmptyState>
          ) : (
            <ul className="space-y-1 text-sm">
              {jobs.map(({ job }) => (
                <li key={job.id}>
                  <Link className="underline" href={`/app/jobs/${job.id}`}>
                    {job.title}
                  </Link>
                  {` · ${job.status}`}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "legal" || tab === "finance" || tab === "projects" ? (
        <p className="mt-6 text-sm text-zinc-600">Not yet implemented in this phase.</p>
      ) : null}
    </main>
  );
}
