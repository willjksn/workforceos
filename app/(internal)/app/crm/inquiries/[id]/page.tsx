import Link from "next/link";
import { notFound } from "next/navigation";

import { convertInquiryAction, updateInquiryStatusAction } from "@/lib/actions/inquiries";
import { requireAppPermission } from "@/lib/auth/guard";
import { getWebsiteInquiry } from "@/lib/inquiries/service";
import { displayServiceName } from "@/lib/services/labels";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../../_components/action-form";
import {
  Field,
  PageHeader,
  PageShell,
  PrimaryButton,
  StatusBadge,
  formatLabel,
  inputClassName,
} from "../../../_components/ui";

export default async function WebsiteInquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requireAppPermission("opportunities.read");
  const { id } = await params;
  const inquiry = await getWebsiteInquiry(principal.organizationId, id);
  if (!inquiry) notFound();
  const canWrite = can(principal, "opportunities.write");

  return (
    <PageShell>
      <PageHeader
        eyebrow="CRM / Website intake"
        title={`${inquiry.companyName}`}
        description={`${inquiry.firstName} ${inquiry.lastName} · ${inquiry.email}`}
        metadata={
          <StatusBadge tone={inquiry.status === "new" ? "warning" : "navy"}>
            {formatLabel(inquiry.status)}
          </StatusBadge>
        }
      />
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Service interest</dt>
          <dd className="mt-1">{displayServiceName(inquiry.serviceInterest)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Submitted</dt>
          <dd className="mt-1">{inquiry.submittedAt.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Source</dt>
          <dd className="mt-1">
            {inquiry.source}
            {inquiry.subsource ? ` / ${inquiry.subsource}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Company match</dt>
          <dd className="mt-1">{formatLabel(inquiry.companyMatchStatus)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Challenge</dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm leading-6">{inquiry.challenge}</dd>
        </div>
      </dl>
      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        {inquiry.companyId ? (
          <Link className="text-navy underline" href={`/app/companies/${inquiry.companyId}`}>
            Open company
          </Link>
        ) : null}
        {inquiry.contactId ? (
          <Link className="text-navy underline" href={`/app/contacts/${inquiry.contactId}`}>
            Open contact
          </Link>
        ) : null}
        {inquiry.opportunityId ? (
          <Link className="text-navy underline" href={`/app/opportunities/${inquiry.opportunityId}`}>
            Open opportunity
          </Link>
        ) : null}
      </div>
      {canWrite ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <ActionForm action={updateInquiryStatusAction} className="space-y-3">
            <input type="hidden" name="inquiryId" value={inquiry.id} />
            <Field label="Status" name="status">
              <select className={inputClassName} id="status" name="status" defaultValue={inquiry.status}>
                <option value="new">New</option>
                <option value="reviewing">Reviewing</option>
                <option value="qualified">Qualified</option>
                <option value="discovery_requested">Discovery requested</option>
                <option value="nurture">Nurture</option>
                <option value="closed">Closed</option>
              </select>
            </Field>
            <PrimaryButton>Update status</PrimaryButton>
          </ActionForm>
          {!inquiry.opportunityId ? (
            <ActionForm action={convertInquiryAction} className="space-y-3">
              <input type="hidden" name="inquiryId" value={inquiry.id} />
              <p className="text-sm text-muted-foreground">
                Conversion creates an opportunity at stage Identified. It does not send anything to the requester.
              </p>
              <PrimaryButton>Convert to opportunity</PrimaryButton>
            </ActionForm>
          ) : null}
        </div>
      ) : null}
    </PageShell>
  );
}
