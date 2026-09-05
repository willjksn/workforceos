import Link from "next/link";
import { notFound } from "next/navigation";

import { createActivityAction } from "@/lib/actions/crm";
import { requireAppPermission } from "@/lib/auth/guard";
import { getContactGraph } from "@/lib/repositories/crm";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { EmptyState, Field, PageHeader, PageShell, PrimaryButton, formatDate, formatLabel, inputClassName } from "../../_components/ui";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requireAppPermission("contacts.read");
  const { id } = await params;
  const graph = await getContactGraph(id, principal.organizationId);
  if (!graph) notFound();
  const { contact } = graph;

  return (
    <PageShell>
      <PageHeader
        title={contact.fullName}
        description={`${contact.title ?? "No title"} · ${formatLabel(contact.relationshipStrength)}`}
      />
      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{contact.email ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Phone</dt>
          <dd>{contact.phone ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Department</dt>
          <dd>{contact.department ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Buyer persona</dt>
          <dd>{contact.buyerPersona ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last contacted</dt>
          <dd>{formatDate(contact.lastContactedAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Do not contact</dt>
          <dd>{contact.doNotContact ? "yes" : "no"}</dd>
        </div>
      </dl>

      <section className="mt-10">
        <h2 className="section-title">Companies</h2>
        {graph.companies.length === 0 ? (
          <EmptyState>No company links.</EmptyState>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {graph.companies.map(({ company, link }) => (
              <li key={company.id}>
                <Link className="underline" href={`/app/companies/${company.id}`}>
                  {company.name}
                </Link>
                {link.isPrimary ? " (primary)" : ""}
                {link.roleTitle ? ` · ${link.roleTitle}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      {can(principal, "opportunities.read") ? (
        <section className="mt-10">
          <h2 className="section-title">Opportunities</h2>
          {graph.opportunities.length === 0 ? (
            <EmptyState>Not the primary contact on any opportunity.</EmptyState>
          ) : (
            <ul className="mt-3 space-y-1 text-sm">
              {graph.opportunities.map(({ opportunity, companyName }) => (
                <li key={opportunity.id}>
                  <Link className="underline" href={`/app/opportunities/${opportunity.id}`}>
                    {opportunity.name}
                  </Link>
                  {` · ${companyName} · ${formatLabel(opportunity.stage)}`}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="section-title">Activity</h2>
        {graph.activities.length === 0 ? (
          <EmptyState>No activity recorded.</EmptyState>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {graph.activities.map((activity) => (
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
        {can(principal, "companies.write") ? (
          <ActionForm action={createActivityAction} className="mt-4 max-w-xl space-y-3">
            <input type="hidden" name="contactId" value={contact.id} />
            <input type="hidden" name="companyId" value={graph.companies[0]?.company.id ?? ""} />
            <input type="hidden" name="returnTo" value={`/app/contacts/${contact.id}`} />
            <Field label="Type" name="activityType">
              <select className={inputClassName} id="activityType" name="activityType" defaultValue="note">
                <option value="note">note</option>
                <option value="email">email</option>
                <option value="phone">phone</option>
                <option value="meeting">meeting</option>
                <option value="outreach">outreach</option>
              </select>
            </Field>
            <Field label="Subject" name="subject">
              <input className={inputClassName} id="subject" name="subject" required />
            </Field>
            <Field label="Next action" name="nextAction">
              <input className={inputClassName} id="nextAction" name="nextAction" />
            </Field>
            <PrimaryButton>Log activity</PrimaryButton>
          </ActionForm>
        ) : null}
      </section>
    </PageShell>
  );
}
