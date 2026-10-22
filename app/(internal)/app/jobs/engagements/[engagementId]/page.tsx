import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addEmployerContactAction,
  candidateResponseAction,
  closeEngagementAction,
  confirmSendAction,
  followUpAction,
  formalSubmissionAction,
  interviewAction,
  markSentAction,
  outreachEngagementAction,
  recordResponseAction,
  referEngagementAction,
  routeEngagementAction,
  stateAction,
} from "@/lib/actions/opportunity-engagement";
import { requireAnyAppPermission } from "@/lib/auth/guard";
import { can } from "@/lib/rbac/permissions";
import { resendWiringStatus } from "@/lib/integrations/credentials";
import { getEngagementDetail, listEmployerContacts } from "@/lib/recruiting/opportunity-engagement";
import { ActionForm } from "../../../_components/action-form";
import { PageHeader, PageShell, PrimaryButton, formatLabel, inputClassName } from "../../../_components/ui";

export default async function EngagementDetailPage({
  params,
}: {
  params: Promise<{ engagementId: string }>;
}) {
  const principal = await requireAnyAppPermission(["jobs.read", "candidates.read"]);
  const { engagementId } = await params;
  const detail = await getEngagementDetail(principal.organizationId, engagementId);
  if (!detail) notFound();
  const canWrite = can(principal, "jobs.write") || can(principal, "candidates.write");
  const contacts = canWrite
    ? await listEmployerContacts(principal.organizationId, detail.companyId, null)
    : [];
  const draft = detail.messages[0] ?? null;
  const email = resendWiringStatus();
  const emailLabel = email.configured ? "CONFIGURED" : "NOT CONFIGURED";
  const summary = detail.summary;
  return (
    <PageShell>
      <PageHeader
        eyebrow={summary.publicLabel ?? summary.contextLabel}
        title={`${summary.candidateName} · ${summary.jobTitle}`}
        description="Match category and workflow status are separate. Nothing is sent unless you confirm it."
      />
      <p className="mt-3 text-sm">
        <Link className="underline" href={`/app/talent/${summary.candidateId}`}>Candidate</Link>
        {" · "}
        <Link className="underline" href={`/app/jobs/${summary.jobId}`}>Job</Link>
        {" · "}
        <Link className="underline" href="/app/jobs/engagements">Follow-ups</Link>
      </p>
      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Status</dt><dd>{formatLabel(summary.status)}</dd></div>
        <div><dt className="text-muted-foreground">Owner</dt><dd>{summary.ownerName ?? "Unassigned"}</dd></div>
        <div><dt className="text-muted-foreground">Match</dt><dd>{summary.matchCategory ? formatLabel(summary.matchCategory) : "Not calculated"}</dd></div>
        <div><dt className="text-muted-foreground">Company</dt><dd>{summary.companyName ?? "No company"}</dd></div>
        <div><dt className="text-muted-foreground">Contact</dt><dd>{summary.contactName ?? "No contact yet"}</dd></div>
        <div><dt className="text-muted-foreground">Last activity</dt><dd>{summary.lastActivityAt.toISOString().slice(0, 10)}</dd></div>
        <div><dt className="text-muted-foreground">Next follow-up</dt><dd>{summary.nextFollowUpAt ? summary.nextFollowUpAt.toISOString().slice(0, 10) : "None"}</dd></div>
        <div><dt className="text-muted-foreground">Waiting on</dt><dd>{summary.waitingOn}</dd></div>
        <div><dt className="text-muted-foreground">Aging</dt><dd>{summary.agingDays} days</dd></div>
        <div><dt className="text-muted-foreground">Employer response</dt><dd>{summary.employerResponse ? formatLabel(summary.employerResponse) : "None"}</dd></div>
        <div><dt className="text-muted-foreground">Candidate response</dt><dd>{summary.candidateResponse ? formatLabel(summary.candidateResponse) : "None"}</dd></div>
        <div><dt className="text-muted-foreground">Consent</dt><dd>{formatLabel(detail.consentStatus)}</dd></div>
        <div><dt className="text-muted-foreground">Email provider</dt><dd>{emailLabel}{email.configured ? "" : " — copy the draft or mark it sent manually"}</dd></div>
      </dl>

      {canWrite ? (
        <div className="mt-8 space-y-6">
          {detail.authorizedRoute ? (
            <ActionForm action={routeEngagementAction} className="space-y-3 rounded-[8px] border border-card-border p-4">
              <h2 className="font-medium text-navy">Route to authorized reviewer</h2>
              <input type="hidden" name="engagementId" value={detail.engagement.id} />
              <label className="block text-sm">Reviewer
                <select className={`mt-1 ${inputClassName}`} name="contactId" required>
                  <option value="">Choose a company contact</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>{contact.fullName}{contact.title ? ` · ${contact.title}` : ""}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">Recruiter note
                <input className={`mt-1 ${inputClassName}`} name="note" />
              </label>
              <PrimaryButton>Prepare talent review</PrimaryButton>
            </ActionForm>
          ) : (
            <p className="rounded-[8px] border border-card-border p-4 text-sm text-muted-foreground">
              {summary.publicLabel ?? "This job"} has no authorized employer route. Use employer outreach. A company record is not a client route.
            </p>
          )}

          <ActionForm action={outreachEngagementAction} className="space-y-3 rounded-[8px] border border-card-border p-4">
            <h2 className="font-medium text-navy">Start employer outreach</h2>
            <p className="text-sm text-muted-foreground">This does not call the employer a client and does not submit the candidate.</p>
            <input type="hidden" name="engagementId" value={detail.engagement.id} />
            <label className="block text-sm">Contact
              <select className={`mt-1 ${inputClassName}`} name="contactId" required>
                <option value="">Choose a company contact</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>{contact.fullName}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">Recruiter note
              <input className={`mt-1 ${inputClassName}`} name="note" />
            </label>
            <PrimaryButton>Prepare outreach</PrimaryButton>
          </ActionForm>

          {detail.companyId ? (
            <ActionForm action={addEmployerContactAction} className="space-y-3 rounded-[8px] border border-card-border p-4">
              <h2 className="font-medium text-navy">{detail.authorizedRoute ? "Add a company contact" : "Add a public business contact"}</h2>
              <p className="text-sm text-muted-foreground">Saved on the existing company contact. This does not look up or enrich an address.</p>
              <input type="hidden" name="engagementId" value={detail.engagement.id} />
              <input type="hidden" name="companyId" value={detail.companyId} />
              <label className="block text-sm">Name
                <input className={`mt-1 ${inputClassName}`} name="fullName" required />
              </label>
              <label className="block text-sm">Title
                <input className={`mt-1 ${inputClassName}`} name="title" />
              </label>
              <label className="block text-sm">Email
                <input className={`mt-1 ${inputClassName}`} name="email" />
              </label>
              <label className="block text-sm">Phone
                <input className={`mt-1 ${inputClassName}`} name="phone" />
              </label>
              <PrimaryButton>Save contact</PrimaryButton>
            </ActionForm>
          ) : null}

          {draft ? (
            <section className="rounded-[8px] border border-card-border p-4">
              <h2 className="font-medium text-navy">Draft</h2>
              <p className="mt-1 text-sm text-muted-foreground">{draft.subject} · {formatLabel(draft.deliveryState)} · select the text to copy it</p>
              <textarea className={`mt-3 min-h-40 ${inputClassName}`} readOnly value={draft.body ?? ""} />
              <div className="mt-3 flex flex-wrap gap-3">
                <ActionForm action={confirmSendAction}>
                  <input type="hidden" name="engagementId" value={detail.engagement.id} />
                  <label className="flex items-center gap-2 text-sm">
                    <input name="confirmSend" type="checkbox" value="yes" />
                    I confirm this external send
                  </label>
                  <PrimaryButton>Send if email is configured</PrimaryButton>
                </ActionForm>
                <ActionForm action={markSentAction}>
                  <input type="hidden" name="engagementId" value={detail.engagement.id} />
                  <label className="flex items-center gap-2 text-sm">
                    <input name="confirmManual" type="checkbox" value="yes" />
                    I sent this myself
                  </label>
                  <button className="rounded-[6px] border border-border px-3 py-2 text-sm" type="submit">Mark sent manually</button>
                </ActionForm>
              </div>
            </section>
          ) : null}

          <ActionForm action={recordResponseAction} className="space-y-3">
            <h2 className="font-medium text-navy">Employer response</h2>
            <input type="hidden" name="engagementId" value={detail.engagement.id} />
            <select className={inputClassName} name="response" required>
              <option value="interested">Interested</option>
              <option value="possible_future_fit">Possible future fit</option>
              <option value="not_a_fit">Not a fit</option>
              <option value="refer_to_another_manager">Refer to another manager</option>
              <option value="needs_more_information">Needs more information</option>
              <option value="no_response">No response</option>
            </select>
            <label className="block text-sm">Who responded
              <input className={`mt-1 ${inputClassName}`} name="respondedBy" />
            </label>
            <label className="block text-sm">Notes
              <input className={`mt-1 ${inputClassName}`} name="note" />
            </label>
            <PrimaryButton>Save response</PrimaryButton>
          </ActionForm>

          <ActionForm action={referEngagementAction} className="space-y-3">
            <h2 className="font-medium text-navy">Refer to another contact</h2>
            <input type="hidden" name="engagementId" value={detail.engagement.id} />
            <select className={inputClassName} name="contactId" required>
              <option value="">Choose the next contact</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>{contact.fullName}</option>
              ))}
            </select>
            <label className="block text-sm">What the reviewer said
              <input className={`mt-1 ${inputClassName}`} name="note" />
            </label>
            <PrimaryButton>Keep history and open the next route</PrimaryButton>
          </ActionForm>

          <ActionForm action={candidateResponseAction} className="space-y-3">
            <h2 className="font-medium text-navy">Candidate response</h2>
            <input type="hidden" name="engagementId" value={detail.engagement.id} />
            <select className={inputClassName} name="response">
              <option value="informed">Informed</option>
              <option value="interested">Interested</option>
              <option value="declined">Declined</option>
              <option value="needs_information">Needs information</option>
            </select>
            <label className="block text-sm">Note
              <input className={`mt-1 ${inputClassName}`} name="note" />
            </label>
            <PrimaryButton>Save candidate response</PrimaryButton>
          </ActionForm>

          <ActionForm action={stateAction} className="space-y-3">
            <h2 className="font-medium text-navy">Workflow state</h2>
            <input type="hidden" name="engagementId" value={detail.engagement.id} />
            <select className={inputClassName} name="status">
              <option value="acknowledged">Acknowledged</option>
              <option value="reviewing">Reviewing</option>
              <option value="needs_follow_up">Needs follow-up</option>
              <option value="needs_information">Needs information</option>
              <option value="no_fit">No fit</option>
            </select>
            <PrimaryButton>Update state</PrimaryButton>
          </ActionForm>

          <ActionForm action={followUpAction} className="space-y-3">
            <input type="hidden" name="engagementId" value={detail.engagement.id} />
            <label className="block text-sm">Next follow-up
              <input className={`mt-1 ${inputClassName}`} name="nextFollowUpAt" type="date" required />
            </label>
            <label className="block text-sm">Next action
              <input className={`mt-1 ${inputClassName}`} name="nextAction" />
            </label>
            <PrimaryButton>Save follow-up</PrimaryButton>
          </ActionForm>

          <ActionForm action={interviewAction} className="space-y-3">
            <h2 className="font-medium text-navy">Interview</h2>
            <input type="hidden" name="engagementId" value={detail.engagement.id} />
            <label className="block text-sm">Scheduled for, optional
              <input className={`mt-1 ${inputClassName}`} name="scheduledFor" type="datetime-local" />
            </label>
            <PrimaryButton>Record interview step</PrimaryButton>
          </ActionForm>

          {detail.engagement.mode === "authorized_routing" ? (
            <ActionForm action={formalSubmissionAction} className="space-y-3">
              <input type="hidden" name="engagementId" value={detail.engagement.id} />
              <label className="flex items-center gap-2 text-sm">
                <input name="confirmSubmission" type="checkbox" value="yes" />
                Record a formal candidate submission
              </label>
              <PrimaryButton>Record submission</PrimaryButton>
            </ActionForm>
          ) : null}

          {summary.status === "no_fit" ? (
            <p className="text-sm text-muted-foreground">
              Not a fit does not close the person. Refer to another contact, return to opportunity matching, or mark no current action.
            </p>
          ) : null}

          <ActionForm action={closeEngagementAction} className="space-y-3">
            <input type="hidden" name="engagementId" value={detail.engagement.id} />
            <label className="block text-sm">Close reason
              <input className={`mt-1 ${inputClassName}`} name="reason" required />
            </label>
            <button className="rounded-[6px] border border-border px-3 py-2 text-sm" type="submit">Close engagement</button>
          </ActionForm>
        </div>
      ) : null}

      <section className="mt-10">
        <h2 className="font-medium text-navy">Timeline</h2>
        <ol className="mt-3 space-y-3 text-sm">
          {detail.routes.map((route) => (
            <li key={route.id}>
              Route {route.sequence} · {formatLabel(route.kind)}
              {route.responseStatus ? ` · ${formatLabel(route.responseStatus)}` : ""}
              {route.sentAt ? ` · sent ${route.sentAt.toISOString().slice(0, 10)}` : " · not sent"}
            </li>
          ))}
          {detail.events.map((event) => (
            <li key={event.id} className="text-muted-foreground">
              {event.occurredAt.toISOString().slice(0, 16).replace("T", " ")} · {formatLabel(event.eventType)}
              {event.fromStatus ? ` · ${formatLabel(event.fromStatus)}` : ""}
              {event.toStatus ? ` → ${formatLabel(event.toStatus)}` : ""}
            </li>
          ))}
        </ol>
      </section>
    </PageShell>
  );
}
