import Link from "next/link";

import { addSignalAction, convertSignalAction, reviewSignalAction } from "@/lib/actions/crm";
import { buttonClassName } from "@/components/ui/button";
import { requireAppPermission } from "@/lib/auth/guard";
import { LAUNCH_SERVICE_CODES } from "@/lib/crm/stages";
import { listCompaniesForSelect, listSignals } from "@/lib/repositories/crm";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../_components/action-form";
import {
  Card,
  CreatePanel,
  EmptyState,
  Field,
  FilterBar,
  PageHeader,
  PageShell,
  PrimaryButton,
  SearchForm,
  StatusBadge,
  formatDate,
  formatLabel,
  inputClassName,
} from "../_components/ui";

const REVIEW_STATUSES = ["draft", "pending_review", "approved", "dismissed", "converted"] as const;

function reviewTone(status: string) {
  if (status === "approved" || status === "converted") return "success" as const;
  if (status === "dismissed") return "neutral" as const;
  if (status === "pending_review") return "warning" as const;
  return "navy" as const;
}

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; reviewStatus?: string; companyId?: string }>;
}) {
  const principal = await requireAppPermission("opportunities.read");
  const { q, reviewStatus, companyId } = await searchParams;
  const rows = await listSignals(principal.organizationId, { query: q, reviewStatus, companyId });
  const companies = await listCompaniesForSelect(principal.organizationId);
  const canWrite = can(principal, "opportunities.write");

  return (
    <PageShell>
      <PageHeader
        eyebrow="CRM / Intelligence"
        title="Signals"
        description="Workforce and commercial triggers. Review before converting into an opportunity."
      />
      <FilterBar>
        <SearchForm action="/app/signals" q={q} placeholder="Search signal or company" className="" submitLabel="Filter">
          <select name="reviewStatus" defaultValue={reviewStatus ?? ""} className={`${inputClassName} max-w-xs`}>
            <option value="">All review statuses</option>
            {REVIEW_STATUSES.map((value) => (
              <option key={value} value={value}>
                {formatLabel(value)}
              </option>
            ))}
          </select>
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
        <EmptyState title="No signals match.">
          Adjust the filters, or add a signal if you have write access.
        </EmptyState>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map(({ signal, companyName, companyId: signalCompanyId }) => (
            <Card key={signal.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium text-navy">{signal.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <Link className="font-medium text-navy" href={`/app/companies/${signalCompanyId}`}>
                      {companyName}
                    </Link>
                    {` · ${formatLabel(signal.signalType)} · ${formatDate(signal.detectedAt)}`}
                  </p>
                </div>
                <StatusBadge tone={reviewTone(signal.reviewStatus)}>{formatLabel(signal.reviewStatus)}</StatusBadge>
              </div>
              {signal.details ? <p className="mt-3 text-sm">{signal.details}</p> : null}
              {signal.resultingOpportunityId ? (
                <p className="mt-3 text-sm">
                  Converted to{" "}
                  <Link className="font-medium text-navy underline decoration-border underline-offset-4 hover:decoration-teal" href={`/app/opportunities/${signal.resultingOpportunityId}`}>
                    opportunity
                  </Link>
                </p>
              ) : null}
              {canWrite && signal.reviewStatus !== "converted" ? (
                <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4">
                  <ActionForm action={reviewSignalAction} className="flex items-end gap-2">
                    <input type="hidden" name="signalId" value={signal.id} />
                    <input type="hidden" name="reviewStatus" value="approved" />
                    <PrimaryButton>Approve</PrimaryButton>
                  </ActionForm>
                  <ActionForm action={reviewSignalAction} className="flex items-end gap-2">
                    <input type="hidden" name="signalId" value={signal.id} />
                    <input type="hidden" name="reviewStatus" value="dismissed" />
                    <button className={buttonClassName("secondary")} type="submit">
                      Dismiss
                    </button>
                  </ActionForm>
                  <ActionForm action={convertSignalAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="signalId" value={signal.id} />
                    <Field label="Opportunity name" name={`name-${signal.id}`}>
                      <input
                        className={inputClassName}
                        id={`name-${signal.id}`}
                        name="name"
                        defaultValue={signal.title}
                        required
                      />
                    </Field>
                    <Field label="Service" name={`service-${signal.id}`}>
                      <select className={inputClassName} id={`service-${signal.id}`} name="serviceCode" defaultValue="">
                        <option value="">Unspecified</option>
                        {LAUNCH_SERVICE_CODES.map((code) => (
                          <option key={code} value={code}>
                            {formatLabel(code)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <PrimaryButton>Convert</PrimaryButton>
                  </ActionForm>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {canWrite ? (
        <CreatePanel title="Add signal">
          <ActionForm action={addSignalAction} className="max-w-xl space-y-3">
            <input type="hidden" name="returnTo" value="/app/signals" />
            <Field label="Company" name="companyId">
              <select className={inputClassName} id="companyId" name="companyId" required defaultValue="">
                <option value="" disabled>
                  Select company
                </option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title" name="title">
              <input className={inputClassName} id="title" name="title" required />
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
            <Field label="Details" name="details">
              <textarea className={inputClassName} id="details" name="details" rows={3} />
            </Field>
            <Field label="Evidence" name="evidence">
              <textarea className={inputClassName} id="evidence" name="evidence" rows={2} />
            </Field>
            <Field label="Source" name="source">
              <input className={inputClassName} id="source" name="source" />
            </Field>
            <PrimaryButton>Create signal</PrimaryButton>
          </ActionForm>
        </CreatePanel>
      ) : null}
    </PageShell>
  );
}
