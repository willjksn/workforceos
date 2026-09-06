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
import { getCompanyWorkforceSnapshot } from "@/lib/repositories/workforce";
import { listJobs } from "@/lib/repositories/recruiting";
import { companyDeliverySnapshot } from "@/lib/delivery/engine";
import { companyFinanceSnapshot } from "@/lib/finance/engine";
import { moneyString } from "@/lib/finance/money";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import {
  EmptyState,
  Field,
  PageHeader,
  PageShell,
  PrimaryButton,
  StatusBadge,
  TabNav,
  formatDate,
  formatLabel,
  inputClassName,
} from "../../_components/ui";

const CRM_TABS = ["overview", "contacts", "opportunities", "signals", "locations", "activity"] as const;
const PLACEHOLDER_TABS = ["jobs", "legal", "finance", "projects", "talent", "workforce", "solutions", "proposals"] as const;

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
  const delivery =
    ["solutions", "proposals", "legal", "projects"].includes(tab)
      ? await companyDeliverySnapshot(company.id, principal.organizationId)
      : null;
  const finance =
    tab === "finance" && can(principal, "finance.read")
      ? await companyFinanceSnapshot(principal.organizationId, company.id)
      : null;
  const workforce =
    tab === "workforce" && can(principal, "workforce.read")
      ? await getCompanyWorkforceSnapshot(company.id, principal.organizationId)
      : null;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "contacts", label: "Contacts" },
    { id: "opportunities", label: "Opportunities" },
    { id: "signals", label: "Signals" },
    { id: "solutions", label: "Services" },
    { id: "proposals", label: "Proposals" },
    { id: "talent", label: "Talent" },
    { id: "workforce", label: "Workforce" },
    { id: "locations", label: "Locations" },
    { id: "activity", label: "Activity" },
    { id: "jobs", label: "Jobs" },
    { id: "legal", label: "Legal" },
    { id: "finance", label: "Finance" },
    { id: "projects", label: "Projects" },
  ].map((item) => ({ ...item, href: `/app/companies/${company.id}?tab=${item.id}` }));

  return (
    <PageShell>
      <PageHeader
        eyebrow="CRM / Company intelligence"
        title={company.name}
        description={[company.industry, graph.locations.find((row) => row.isPrimary)?.city ?? graph.locations[0]?.city]
          .filter(Boolean)
          .join(" · ") || `${company.companyType} · ${company.clientStatus}`}
        metadata={
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={company.clientStatus === "active" ? "success" : "navy"}>{company.clientStatus}</StatusBadge>
            <StatusBadge tone="neutral">relationship {company.relationshipStrength}</StatusBadge>
          </div>
        }
      />
      <TabNav items={tabs} activeId={tab} />

      {tab === "overview" ? (
        <section className="mt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[8px] border border-card-border bg-card px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Status</p>
              <p className="mt-1 font-medium text-navy">{company.clientStatus}</p>
            </div>
            <div className="rounded-[8px] border border-card-border bg-card px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Workforce opportunity</p>
              <p className="mt-1 font-serif text-3xl font-semibold text-navy">{company.workforceOpportunityScore ?? "—"}</p>
            </div>
            <div className="rounded-[8px] border border-card-border bg-card px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Military fit</p>
              <p className="mt-1 font-serif text-3xl font-semibold text-navy">{company.militaryFitScore ?? "—"}</p>
            </div>
            <div className="rounded-[8px] border border-card-border bg-card px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Relationship health</p>
              <p className="mt-1 font-medium text-navy">{company.relationshipStrength}</p>
            </div>
          </div>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Industry</dt>
              <dd>{company.industry ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Employees</dt>
              <dd>{company.employeeCount ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Annual revenue</dt>
              <dd>{company.annualRevenue ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Next action</dt>
              <dd>
                {company.nextAction ?? "—"}
                {company.nextActionAt ? ` · ${formatDate(company.nextActionAt)}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Military fit</dt>
              <dd>{company.militaryFitScore ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Workforce opportunity</dt>
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
          {company.notes ? <p className="mt-3 text-sm text-muted-foreground">{company.notes}</p> : null}
          <p className="mt-4 text-xs text-muted-foreground">
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
                  <span className="text-muted-foreground">
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
            <p className="text-sm text-muted-foreground">Not yet implemented in this phase.</p>
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

      {tab === "solutions" && delivery ? (
        <section className="mt-6 space-y-4 text-sm">
          <h2 className="section-title">Solution plans</h2>
          {delivery.plans.length === 0 ? <EmptyState>No solution plans.</EmptyState> : (
            <ul className="space-y-2">
              {delivery.plans.map((plan) => (
                <li key={plan.id}>
                  <Link className="font-medium text-navy" href={`/app/solutions/${plan.id}`}>{plan.title}</Link>
                  {` · ${plan.status}`}
                </li>
              ))}
            </ul>
          )}
          <h2 className="section-title">Expansion suggestions</h2>
          {delivery.expansions.length === 0 ? <p className="text-muted-foreground">None suggested.</p> : (
            <ul>
              {delivery.expansions.map((row) => (
                <li key={row.id}>{row.recommendedServiceCode} · {row.status}</li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "proposals" && delivery ? (
        <section className="mt-6 text-sm">
          {delivery.proposals.length === 0 ? <EmptyState>No proposals.</EmptyState> : (
            <ul className="space-y-2">
              {delivery.proposals.map((proposal) => (
                <li key={proposal.id}>
                  <Link className="font-medium text-navy" href={`/app/proposals/${proposal.id}`}>{proposal.title}</Link>
                  {` · ${proposal.status}`}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "legal" && delivery ? (
        <section className="mt-6 text-sm">
          {delivery.contracts.length === 0 ? <EmptyState>No contracts.</EmptyState> : (
            <ul className="space-y-2">
              {delivery.contracts.map((contract) => (
                <li key={contract.id}>
                  <Link className="font-medium text-navy" href={`/app/contracts/${contract.id}`}>{contract.title}</Link>
                  {` · ${contract.status}`}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "projects" && delivery ? (
        <section className="mt-6 text-sm">
          {delivery.projects.length === 0 ? <EmptyState>No delivery projects.</EmptyState> : (
            <ul className="space-y-2">
              {delivery.projects.map((project) => (
                <li key={project.id}>
                  <Link className="font-medium text-navy" href={`/app/projects/${project.id}`}>{project.name}</Link>
                  {` · ${project.status}`}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "finance" ? (
        <section className="mt-6 space-y-4 text-sm">
          {!finance ? (
            <p className="text-muted-foreground">Finance access requires finance.read.</p>
          ) : (
            <>
              <p>
                Contract value {moneyString(finance.contractValue)} · Invoiced {moneyString(finance.invoiced)} · Collected {moneyString(finance.collected)} · AR {moneyString(finance.ar)}
              </p>
              <div>
                <h2 className="section-title">Active billing schedules</h2>
                <ul>
                  {finance.activeSchedules.map((row) => (
                    <li key={row.id}>{row.name} · {row.billingType} · {row.amount ?? "—"}</li>
                  ))}
                  {finance.activeSchedules.length === 0 ? <li>None active.</li> : null}
                </ul>
              </div>
              <div>
                <h2 className="section-title">Revenue by service</h2>
                <ul>
                  {finance.revenueByService.map((row) => (
                    <li key={row.service}>{row.service} · {moneyString(row.amount)}</li>
                  ))}
                  {finance.revenueByService.length === 0 ? <li>None yet.</li> : null}
                </ul>
              </div>
              <div>
                <h2 className="section-title">Invoice history</h2>
                <ul>
                  {finance.invoices.map((row) => (
                    <li key={row.invoice.id}>{row.invoice.invoiceNumber} · {row.invoice.amount} · {row.invoice.status}</li>
                  ))}
                  {finance.invoices.length === 0 ? <li>No invoices.</li> : null}
                </ul>
              </div>
            </>
          )}
        </section>
      ) : null}

      {tab === "talent" ? (
        <p className="mt-6 text-sm text-muted-foreground">Not yet implemented in this phase.</p>
      ) : null}

      {tab === "workforce" ? (
        <section className="mt-6 space-y-6 text-sm">
          {!workforce ? (
            <p className="text-muted-foreground">Workforce access requires workforce.read.</p>
          ) : (
            <>
              <div>
                <h2 className="section-title">Assessments</h2>
                <ul>
                  {workforce.assessments.map((row) => (
                    <li key={row.id}>
                      <Link className="underline" href={`/app/workforce/assessments/${row.id}`}>{row.title}</Link>
                      {" · "}{row.status}
                    </li>
                  ))}
                  {workforce.assessments.length === 0 ? <li>None yet.</li> : null}
                </ul>
              </div>
              <div>
                <h2 className="section-title">Critical roles</h2>
                <ul>
                  {workforce.criticalRoles.map((role) => (
                    <li key={role.id}>{role.title} · {role.criticality} · headcount {role.currentHeadcount}</li>
                  ))}
                  {workforce.criticalRoles.length === 0 ? <li>None classified critical/high.</li> : null}
                </ul>
              </div>
              <div>
                <h2 className="section-title">Forecasts</h2>
                <ul>
                  {workforce.forecasts.slice(0, 8).map((row) => (
                    <li key={row.id}>{row.name} · {row.horizonMonths} mo · {row.status} · estimate only</li>
                  ))}
                  {workforce.forecasts.length === 0 ? <li>None generated.</li> : null}
                </ul>
              </div>
              <div>
                <h2 className="section-title">Military opportunity</h2>
                <p className="text-muted-foreground">Planning overlay uses stored military mappings. Open an assessment for occupation and installation counts. Candidate contact details are not shown here.</p>
              </div>
              <div>
                <h2 className="section-title">Gaps</h2>
                <ul>
                  {workforce.gaps.slice(0, 8).map((row) => (
                    <li key={row.gap.id}>{row.roleTitle} · {row.gap.horizonMonths} mo · gap {row.gap.gap}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="section-title">Pipelines / career paths / partners / risks</h2>
                <p>{workforce.pipelines.length} pipelines · {workforce.careerPaths.length} career paths · {workforce.educationPartners.length} education partners · {workforce.risks.length} risks</p>
              </div>
            </>
          )}
        </section>
      ) : null}
    </PageShell>
  );
}
