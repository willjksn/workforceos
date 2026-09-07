import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm } from "../../../_components/action-form";
import {
  addSkillBridgeFollowUpAction,
  addSkillBridgeNoteAction,
  addSkillBridgeOpportunityAction,
  advanceSkillBridgeStageAction,
} from "@/lib/actions/skillbridge";
import { requireAnyAppPermission } from "@/lib/auth/guard";
import { can } from "@/lib/rbac/permissions";
import { getSkillBridgeDetail } from "@/lib/skillbridge/service";
import { findSkillBridgeMatches } from "@/lib/skillbridge/matching";
import { draftEmployerBrief, draftSkillBridgeMessage } from "@/lib/skillbridge/drafts";
import { getDb } from "@/db";
import { companies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PrimaryButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/display";
import { ResumeViewer } from "../../../_components/resume-viewer";
import { PageHeader, PageShell, formatDate, formatLabel } from "../../../_components/ui";
import { MilitarySubnav } from "../../_components/military-subnav";

const STAGES = [
  "candidate_identified",
  "initial_contact",
  "profile_complete",
  "opportunity_matching",
  "candidate_interested",
  "employer_submitted",
  "hiring_manager_review",
  "interview",
  "skillbridge_approval",
  "skillbridge_placement",
  "skillbridge_active",
  "conversion_review",
  "hired",
] as const;

export default async function SkillBridgeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requireAnyAppPermission(["skillbridge.read", "military.read"]);
  const { id } = await params;
  const canReadPii = can(principal, "candidate_pii.read");
  const canWrite = can(principal, "skillbridge.write");
  const detail = await getSkillBridgeDetail(id, principal.organizationId, canReadPii);
  if (!detail) notFound();
  const matches = await findSkillBridgeMatches({
    organizationId: principal.organizationId,
    profileId: id,
  });
  const db = getDb();
  const companyRows = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.organizationId, principal.organizationId));
  const draft = draftSkillBridgeMessage({
    kind: "follow_up",
    audience: "candidate",
    candidateName: detail.card.candidate.fullName,
    occupationTitle: detail.card.occupation?.title,
    locationPreference: detail.card.profile.preferredLocationPrimary,
    windowStart: detail.card.profile.skillbridgeWindowStart,
    windowEnd: detail.card.profile.skillbridgeWindowEnd,
    canReadPii,
  });
  const brief = draftEmployerBrief({
    candidateName: detail.card.candidate.fullName,
    occupationTitle: detail.card.occupation?.title,
    skills: detail.card.targetRoles.map((row) => row.roleTitle),
    windowStart: detail.card.profile.skillbridgeWindowStart,
    windowEnd: detail.card.profile.skillbridgeWindowEnd,
    locationPreference: detail.card.profile.preferredLocationPrimary,
    targetRole: detail.card.targetRoles[0]?.roleTitle,
  });

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="SkillBridge"
        title={detail.card.candidate.fullName}
        description="Same Talent Network candidate. SkillBridge dates and opportunities are operating records, not a second person."
        actions={
          <Link href={`/app/talent/${detail.card.candidate.id}`} className="text-sm text-navy underline">
            Open full candidate profile
          </Link>
        }
      />
      <MilitarySubnav active="/app/military/skillbridge" />

      <div className="mt-6 grid items-start gap-8 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <dl className="grid gap-3">
            <Item label="Branch / MOS" value={[detail.card.occupation?.branch, detail.card.occupation?.code ?? detail.card.profile.mosRateAfscDisplay].filter(Boolean).join(" · ")} />
            <Item label="Rank" value={detail.card.profile.rankTitle ?? detail.card.profile.payGrade} />
            <Item label="Installation" value={detail.card.installation?.name ?? detail.card.profile.currentDutyLocation} />
            <Item label="End of service" value={formatDate(detail.card.profile.endOfServiceDate)} />
            <Item label="Window start" value={formatDate(detail.card.profile.skillbridgeWindowStart)} />
            <Item label="Window end" value={formatDate(detail.card.profile.skillbridgeWindowEnd)} />
            <Item label="Preferred location" value={detail.card.profile.preferredLocationPrimary} />
            <Item label="Ideal employer" value={detail.card.profile.idealEmployer} />
            <Item label="Resume status" value={formatLabel(detail.card.profile.resumeStatus)} />
            <Item label="Last contact" value={formatDate(detail.card.profile.lastContactedAt)} />
            <Item label="Next action" value={detail.card.profile.nextAction} />
            <Item label="Next due" value={formatDate(detail.card.profile.nextActionDueAt)} />
          </dl>
          {detail.card.risks.length ? <p className="text-sm text-warning">{detail.card.risks.join(" · ")}</p> : null}
        </div>
        <section className="min-w-0">
          <h2 className="section-title">Resume</h2>
          {canReadPii && detail.resumeFile ? (
            <div className="mt-3">
              <ResumeViewer
                file={detail.resumeFile}
                meta={`${formatLabel(detail.card.profile.resumeStatus)} · ${formatDate(detail.resumeFile.createdAt)}`}
              />
            </div>
          ) : detail.card.candidate.currentResumeFileId || detail.card.profile.resumeStatus !== "missing" ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {canReadPii
                ? "Resume metadata is missing. Re-upload from this profile if the file cannot be opened."
                : "Resume on file is hidden without candidate_pii.read."}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No resume on file.</p>
          )}
        </section>
      </div>

      <section className="mt-10">
        <h2 className="section-title">Employer opportunities</h2>
        <div className="mt-3 space-y-3">
          {detail.opportunities.map((row) => (
            <div key={row.opportunity.id} className="rounded-[8px] border border-card-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-navy">{row.company.name}{row.job ? ` · ${row.job.title}` : ""}</p>
                <StatusBadge>{formatLabel(row.opportunity.stage)}</StatusBadge>
              </div>
              {canWrite ? (
                <ActionForm action={advanceSkillBridgeStageAction} className="mt-3 flex gap-2">
                  <input type="hidden" name="opportunityId" value={row.opportunity.id} />
                  <select name="toStage" className="rounded-[6px] border border-border px-2 py-1 text-sm" defaultValue={row.opportunity.stage}>
                    {STAGES.map((stage) => (
                      <option key={stage} value={stage}>{formatLabel(stage)}</option>
                    ))}
                  </select>
                  <PrimaryButton>Advance</PrimaryButton>
                </ActionForm>
              ) : null}
            </div>
          ))}
        </div>
        {canWrite ? (
          <ActionForm action={addSkillBridgeOpportunityAction} className="mt-4 max-w-xl space-y-3">
            <input type="hidden" name="profileId" value={id} />
            <label className="block text-sm">
              Company
              <select name="companyId" className="mt-1 w-full rounded-[6px] border border-border px-3 py-2" required>
                {companyRows.filter((row) => row).map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </label>
            <PrimaryButton>Add opportunity</PrimaryButton>
          </ActionForm>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="section-title">Stored job matches</h2>
        <p className="mt-1 text-sm text-muted-foreground">Explainable scores from the existing match architecture. Humans connect or submit.</p>
        <ul className="mt-3 space-y-2">
          {matches.map((match) => (
            <li key={match.jobId}>
              <Link href={match.href} className="text-navy underline">{match.jobTitle}</Link>
              <span className="text-sm text-muted-foreground"> · {match.companyName} · {match.overall}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="section-title">Timeline</h2>
          <ul className="mt-3 space-y-3">
            {detail.timeline.map((item) => (
              <li key={item.id} className="border-b border-border pb-3 text-sm">
                <p className="font-medium text-navy">{item.subject}</p>
                <p className="text-muted-foreground">{formatLabel(item.activityType)} · {formatDate(item.occurredAt)}</p>
              </li>
            ))}
            {detail.history.map((item) => (
              <li key={item.id} className="border-b border-border pb-3 text-sm">
                <p className="font-medium text-navy">Stage {formatLabel(item.fromStage ?? "new")} → {formatLabel(item.toStage)}</p>
                <p className="text-muted-foreground">{formatDate(item.changedAt)}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="section-title">Documents</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {detail.documents.map((row) => (
              <li key={row.document.id}>
                {canReadPii ? (
                  <a className="text-navy underline" href={`/api/files/${row.file.id}`}>
                    {row.file.filename}
                  </a>
                ) : (
                  <span>File on record</span>
                )}
                {" · "}
                {formatLabel(row.document.documentType)} · {formatDate(row.file.createdAt)} · {formatLabel(row.file.privacyClass)}
              </li>
            ))}
            {detail.documents.length === 0 ? <li className="text-muted-foreground">No files linked. Binaries stay in object storage.</li> : null}
          </ul>
        </div>
      </section>

      {canWrite ? (
        <section className="mt-10 grid gap-8 lg:grid-cols-2">
          <ActionForm action={addSkillBridgeFollowUpAction} className="space-y-3">
            <h2 className="section-title">Add follow-up</h2>
            <input type="hidden" name="profileId" value={id} />
            <input name="subject" className="w-full rounded-[6px] border border-border px-3 py-2" placeholder="Candidate check-in" required />
            <input name="days" type="number" defaultValue={7} className="w-full rounded-[6px] border border-border px-3 py-2" />
            <PrimaryButton>Save follow-up</PrimaryButton>
          </ActionForm>
          <ActionForm action={addSkillBridgeNoteAction} className="space-y-3">
            <h2 className="section-title">Internal note</h2>
            <input type="hidden" name="profileId" value={id} />
            <select name="kind" className="w-full rounded-[6px] border border-border px-3 py-2">
              <option value="follow_up">Follow-up</option>
              <option value="employer_feedback">Employer feedback</option>
              <option value="timing">Timing</option>
              <option value="resume">Resume</option>
              <option value="career_goal">Career goal</option>
              <option value="other">Other</option>
            </select>
            <textarea name="body" className="w-full rounded-[6px] border border-border px-3 py-2" rows={4} required />
            <PrimaryButton>Add note</PrimaryButton>
          </ActionForm>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="section-title">Draft check-in (human review)</h2>
        <p className="mt-2 whitespace-pre-wrap rounded-[8px] border border-card-border bg-card p-4 text-sm">{draft.body}</p>
        <h2 className="mt-8 section-title">Employer brief (human review)</h2>
        <pre className="mt-2 overflow-auto rounded-[8px] border border-card-border bg-card p-4 text-xs">{JSON.stringify(brief, null, 2)}</pre>
      </section>
    </PageShell>
  );
}

function Item({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-[8px] border border-card-border bg-card p-4">
      <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-navy">{value || "—"}</dd>
    </div>
  );
}
