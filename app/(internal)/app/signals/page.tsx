import Link from "next/link";

import { addSignalAction, convertSignalAction, reviewSignalAction } from "@/lib/actions/crm";
import { requireAppPermission } from "@/lib/auth/guard";
import { LAUNCH_SERVICE_CODES } from "@/lib/crm/stages";
import { listCompaniesForSelect, listSignals } from "@/lib/repositories/crm";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../_components/action-form";
import { EmptyState, Field, PageHeader, PrimaryButton, formatDate, formatLabel, inputClassName } from "../_components/ui";

const REVIEW_STATUSES = ["draft", "pending_review", "approved", "dismissed", "converted"] as const;

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
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        title="Signals"
        description="Workforce and commercial triggers. Review before converting into an opportunity."
      />
      <form action="/app/signals" className="mt-6 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search signal or company" className={`${inputClassName} max-w-md`} />
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
        <button className="rounded border px-4 py-2 text-sm" type="submit">
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState>No signals match.</EmptyState>
      ) : (
        <div className="mt-6 space-y-6">
          {rows.map(({ signal, companyName, companyId: signalCompanyId }) => (
            <article key={signal.id} className="rounded border p-4 text-sm">
              <h2 className="font-semibold">{signal.title}</h2>
              <p className="mt-1 text-zinc-600">
                <Link className="underline" href={`/app/companies/${signalCompanyId}`}>
                  {companyName}
                </Link>
                {` · ${formatLabel(signal.signalType)} · ${formatLabel(signal.reviewStatus)} · ${formatDate(signal.detectedAt)}`}
              </p>
              {signal.details ? <p className="mt-2">{signal.details}</p> : null}
              {signal.resultingOpportunityId ? (
                <p className="mt-2">
                  Converted to{" "}
                  <Link className="underline" href={`/app/opportunities/${signal.resultingOpportunityId}`}>
                    opportunity
                  </Link>
                </p>
              ) : null}
              {canWrite && signal.reviewStatus !== "converted" ? (
                <div className="mt-4 flex flex-wrap gap-4">
                  <ActionForm action={reviewSignalAction} className="flex items-end gap-2">
                    <input type="hidden" name="signalId" value={signal.id} />
                    <input type="hidden" name="reviewStatus" value="approved" />
                    <PrimaryButton>Approve</PrimaryButton>
                  </ActionForm>
                  <ActionForm action={reviewSignalAction} className="flex items-end gap-2">
                    <input type="hidden" name="signalId" value={signal.id} />
                    <input type="hidden" name="reviewStatus" value="dismissed" />
                    <button className="rounded border px-4 py-2 text-sm" type="submit">
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
            </article>
          ))}
        </div>
      )}

      {canWrite ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Add signal</h2>
          <ActionForm action={addSignalAction} className="mt-4 max-w-xl space-y-3">
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
        </section>
      ) : null}
    </main>
  );
}
