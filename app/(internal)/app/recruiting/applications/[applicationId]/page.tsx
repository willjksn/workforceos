import { notFound } from "next/navigation";

import {
  advanceApplicationAction,
  nurtureApplicationAction,
  rejectApplicationAction,
} from "@/lib/actions/hiring";
import { requireAppPermission } from "@/lib/auth/guard";
import { getApplicationDetail } from "@/lib/hiring/service";
import { ALLOWED_DISPOSITION_REASONS } from "@/lib/hiring/stages";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../../_components/action-form";
import { PageHeader, PageShell, PrimaryButton, formatLabel, inputClassName } from "../../../_components/ui";

export default async function ApplicationDetailPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const principal = await requireAppPermission("applications.read");
  const { applicationId } = await params;
  const detail = await getApplicationDetail(principal, applicationId);
  if (!detail) notFound();
  const canAdvance = can(principal, "applications.advance");
  const canReject = can(principal, "applications.reject");

  return (
    <PageShell wide>
      <PageHeader
        title={detail.candidate.fullName}
        description={`${detail.job.title} · ${formatLabel(detail.application.source)} · ${detail.application.appliedAt.toLocaleDateString()}`}
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4">
          <div className="border border-border bg-white p-4">
            <h2 className="font-medium">Application answers</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {detail.answers.map((answer) => (
                <div key={answer.id}>
                  <dt className="text-muted-foreground">{formatLabel(answer.questionKey)}</dt>
                  <dd>{answer.answer || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="border border-border bg-white p-4">
            <h2 className="font-medium">Stage history</h2>
            <ul className="mt-3 space-y-1 text-sm">
              {detail.history.map((item) => (
                <li key={item.id}>
                  {item.fromStage ?? "—"} → {item.toStage} · {item.createdAt.toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        </section>
        <aside className="space-y-4">
          <div className="border border-border bg-white p-4 text-sm">
            <p>Stage: {formatLabel(detail.application.currentStage)}</p>
            <p>Pipeline: {detail.application.pipeline}</p>
            {detail.backgroundChecks.length ? <p>Background: {detail.backgroundChecks[0]?.status}</p> : null}
            {detail.drugScreens.length ? <p>Drug screen: {detail.drugScreens[0]?.status}</p> : null}
          </div>
          {canAdvance ? (
            <ActionForm action={advanceApplicationAction}>
              <input type="hidden" name="applicationId" value={detail.application.id} />
              <select name="toStage" className={inputClassName}>
                <option value="recruiter_screen">Recruiter screen</option>
                <option value="interview">Interview</option>
                <option value="pre_employment">Pre-employment</option>
                <option value="offer">Offer</option>
              </select>
              <PrimaryButton>Advance</PrimaryButton>
            </ActionForm>
          ) : null}
          {canReject ? (
            <ActionForm action={rejectApplicationAction}>
              <input type="hidden" name="applicationId" value={detail.application.id} />
              <select name="reason" className={inputClassName}>
                {ALLOWED_DISPOSITION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {formatLabel(reason)}
                  </option>
                ))}
              </select>
              <PrimaryButton>Reject</PrimaryButton>
            </ActionForm>
          ) : null}
          <ActionForm action={nurtureApplicationAction}>
            <input type="hidden" name="applicationId" value={detail.application.id} />
            <PrimaryButton>Nurture</PrimaryButton>
          </ActionForm>
        </aside>
      </div>
    </PageShell>
  );
}
