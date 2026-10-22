import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addCapabilityTextAction,
  addRoleSkillAction,
  addStrategyNoteAction,
  linkCapabilityTextAction,
  linkRoleJobAction,
  unlinkRoleJobAction,
  updateRoleDemandAction,
} from "@/lib/actions/workforce-pipeline";
import { requireAppPermission } from "@/lib/auth/guard";
import { listCanonicalSkills } from "@/lib/repositories/recruiting";
import { can } from "@/lib/rbac/permissions";
import { listJobFamilies, loadWorkforceRolePipeline } from "@/lib/workforce/pipeline-supply";
import { WorkforceError } from "@/lib/workforce/errors";
import { ActionForm } from "../../../_components/action-form";
import { Field, PageHeader, PageShell, PrimaryButton, formatLabel, inputClassName } from "../../../_components/ui";
import { WorkforceSubnav } from "../../_components/workforce-subnav";

export default async function WorkforceRolePipelinePage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const principal = await requireAppPermission("workforce.read");
  const { roleId } = await params;
  const includeDetail = can(principal, "candidates.read");
  const includePii = can(principal, "candidate_pii.read");
  let detail: Awaited<ReturnType<typeof loadWorkforceRolePipeline>>;
  try {
    detail = await loadWorkforceRolePipeline({
      organizationId: principal.organizationId,
      roleId,
      includeCandidateDetail: includeDetail,
      includePii,
    });
  } catch (error) {
    if (error instanceof WorkforceError) notFound();
    throw error;
  }
  const canWrite = can(principal, "workforce.write");
  const [skillOptions, families] = canWrite
    ? await Promise.all([listCanonicalSkills(), listJobFamilies()])
    : [[], []];
  const analysis = detail.analysis;
  const linkedIds = new Set(analysis.linkedJobs.map((job) => job.jobId));

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Workforce role"
        title={detail.role.title}
        description="Planning demand for this role. It is not a live job. Counts are WorkforceOS records as of the time below."
      />
      <WorkforceSubnav active="/app/workforce/roles" />
      <p className="mt-4 text-sm text-muted-foreground">
        Calculated {analysis.calculatedAt}. Source: stored WorkforceOS records. {analysis.healthReason}
      </p>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[8px] border border-card-border bg-card px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Modeled demand</p>
          <p className="mt-1 text-2xl text-navy">{analysis.demandQuantity}</p>
          <p className="text-sm text-muted-foreground">{formatLabel(analysis.demandHorizon)} · {analysis.planningHorizonLabel}</p>
        </article>
        <article className="rounded-[8px] border border-card-border bg-card px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Known supply</p>
          <p className="mt-1 text-2xl text-navy">{analysis.knownSupply}</p>
          <p className="text-sm text-muted-foreground">Military {analysis.militarySupply} · Other Talent Network {analysis.nonMilitarySupply}</p>
        </article>
        <article className="rounded-[8px] border border-card-border bg-card px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Quantity gap</p>
          <p className="mt-1 text-2xl text-navy">{analysis.quantityGap}</p>
          <p className="text-sm text-muted-foreground">Health {formatLabel(analysis.health)} · bottleneck {analysis.bottleneck}</p>
        </article>
        <article className="rounded-[8px] border border-card-border bg-card px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Active pipeline</p>
          <p className="mt-1 text-2xl text-navy">{analysis.activePipeline}</p>
          <p className="text-sm text-muted-foreground">Current openings {analysis.currentOpenings}</p>
        </article>
      </section>

      <section className="mt-8">
        <h2 className="font-medium text-navy">Capability demand</h2>
        <ul className="mt-2 text-sm">
          {analysis.capabilities.map((row) => (
            <li key={row.skillId}>
              {row.name}: {row.knownSupply} known, {row.missingAmongRelevant} of the relevant people lack it, quantity shortfall {row.quantityGap}
            </li>
          ))}
          {analysis.capabilities.length === 0 ? <li>No required skill is linked. Free text does not count until a person links a skill.</li> : null}
        </ul>
        {detail.capabilityTexts.length ? (
          <ul className="mt-2 text-sm text-muted-foreground">
            {detail.capabilityTexts.map((row) => (
              <li key={row.id}>{row.sourceText} · {formatLabel(row.reviewStatus)}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="font-medium text-navy">Known talent supply</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Available now {analysis.availability.available_now}. Available soon {analysis.availability.available_soon}. Future transition {analysis.availability.future_transition}. Not available {analysis.availability.not_available}. Unknown {analysis.availability.unknown}.
          Timing gap {analysis.timingGap}. Location constrained {analysis.locationConstrained}.
          {analysis.credentialRequired ? ` Credential gap ${analysis.credentialGap} from active documented credentials.` : " No credential requirement is modeled."}
          {analysis.clearanceRequired ? ` Clearance gap ${analysis.clearanceGap}. ${analysis.clearanceLabel ?? ""}` : " No clearance requirement is modeled."}
        </p>
        <p className="mt-2 text-sm">{analysis.narrative}</p>
        {includeDetail ? (
          <ul className="mt-3 text-sm">
            {detail.candidates.map((person) => (
              <li key={person.id}>
                <Link className="underline" href={`/app/talent/${person.id}`}>{person.name}</Link>
              </li>
            ))}
            {detail.candidates.length === 0 ? <li>No relevant candidate is stored.</li> : null}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Candidate names stay behind candidate access. This view shows counts only.</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-medium text-navy">Military occupation channels</h2>
        <p className="mt-1 text-sm text-muted-foreground">{analysis.referenceTalentPool} These are not added to the known-supply count.</p>
      </section>

      <section className="mt-8">
        <h2 className="font-medium text-navy">Current jobs</h2>
        <ul className="mt-2 text-sm">
          {analysis.linkedJobs.map((job) => (
            <li key={job.jobId}>
              <Link className="underline" href={`/app/jobs/${job.jobId}`}>{job.title ?? "Job"}</Link>
              {" "}· {formatLabel(job.status)}{job.currentOpening ? "" : " · retained, not a current opening"}
              {canWrite ? (
                <ActionForm action={unlinkRoleJobAction} className="inline">
                  <input type="hidden" name="roleId" value={detail.role.id} />
                  <input type="hidden" name="jobId" value={job.jobId} />
                  <button className="ml-2 underline" type="submit">Unlink</button>
                </ActionForm>
              ) : null}
            </li>
          ))}
          {analysis.linkedJobs.length === 0 ? <li>No live job is linked. Future demand stays on this role.</li> : null}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-medium text-navy">Pipeline</h2>
        <p className="mt-1 text-sm">
          Known {analysis.funnel.knownTalent}. Relevant capability {analysis.funnel.relevantCapability}. Stored matches {analysis.funnel.opportunityMatch}. Recruiter viable {analysis.funnel.recruiterViable}. Engagements {analysis.funnel.engagementStarted}. Employer reviewing {analysis.funnel.employerReviewing}. Interview {analysis.funnel.interview}. Placement {analysis.funnel.placement}. No fit {analysis.funnel.noFit}.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">No fit is an outcome. It does not change the match category.</p>
      </section>

      <section className="mt-8">
        <h2 className="font-medium text-navy">Pipeline strategy</h2>
        <ul className="mt-2 text-sm">
          {analysis.strategyOptions.map((option) => (
            <li key={option.channel}><span className="font-medium">{formatLabel(option.channel)}.</span> {option.reason}</li>
          ))}
        </ul>
        <ul className="mt-2 text-sm text-muted-foreground">
          {analysis.planningOnlyChannels.map((line) => <li key={line}>{line}</li>)}
        </ul>
        {detail.strategyNotes.length ? (
          <ul className="mt-3 text-sm">
            {detail.strategyNotes.map((note) => (
              <li key={note.id}>{formatLabel(note.channel)}: {note.note}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {canWrite ? (
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <ActionForm action={updateRoleDemandAction} className="space-y-3">
            <h2 className="font-medium text-navy">Demand</h2>
            <input type="hidden" name="roleId" value={detail.role.id} />
            <input type="hidden" name="companyLocationId" value={detail.role.companyLocationId ?? ""} />
            <Field label="Quantity" name="demandQuantity">
              <input className={inputClassName} id="demandQuantity" name="demandQuantity" type="number" min="0" defaultValue={detail.role.demandQuantity} />
            </Field>
            <Field label="Horizon" name="demandHorizon">
              <select className={inputClassName} id="demandHorizon" name="demandHorizon" defaultValue={detail.role.demandHorizon}>
                <option value="current">Current</option>
                <option value="evergreen">Evergreen</option>
                <option value="future">Future</option>
              </select>
            </Field>
            <Field label="Timing bucket" name="planningHorizon">
              <select className={inputClassName} id="planningHorizon" name="planningHorizon" defaultValue={detail.role.planningHorizon ?? ""}>
                <option value="">Not set</option>
                <option value="0_90_days">0–3 months</option>
                <option value="3_6_months">3–6 months</option>
                <option value="6_12_months">6–12 months</option>
                <option value="12_24_months">12–24 months</option>
              </select>
            </Field>
            <Field label="Source" name="demandSource">
              <select className={inputClassName} id="demandSource" name="demandSource" defaultValue={detail.role.demandSource}>
                <option value="workforce_plan">Workforce plan</option>
                <option value="manual_employer_need">Manual employer need</option>
                <option value="aggregated_role">Aggregated role</option>
                <option value="current_jobs">Current jobs rollup</option>
              </select>
            </Field>
            <Field label="Job family" name="jobFamilyId">
              <select className={inputClassName} id="jobFamilyId" name="jobFamilyId" defaultValue={detail.role.jobFamilyId ?? ""}>
                <option value="">Keep free text unlinked</option>
                {families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}
              </select>
            </Field>
            <Field label="Credential text" name="minimumCredentials">
              <input className={inputClassName} id="minimumCredentials" name="minimumCredentials" defaultValue={detail.role.minimumCredentials ?? ""} />
            </Field>
            <Field label="Clearance requirement" name="requiredClearanceLevel">
              <select className={inputClassName} id="requiredClearanceLevel" name="requiredClearanceLevel" defaultValue={detail.role.requiredClearanceLevel ?? ""}>
                <option value="">Not required</option>
                <option value="confidential">Confidential</option>
                <option value="secret">Secret</option>
                <option value="top_secret">Top secret</option>
                <option value="ts_sci">TS/SCI</option>
              </select>
            </Field>
            <PrimaryButton>Save demand</PrimaryButton>
          </ActionForm>
          <div className="space-y-8">
            <ActionForm action={addRoleSkillAction} className="space-y-3">
              <h2 className="font-medium text-navy">Link a skill</h2>
              <input type="hidden" name="roleId" value={detail.role.id} />
              <Field label="Skill" name="skillId">
                <select className={inputClassName} id="skillId" name="skillId" required>
                  {skillOptions.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
                </select>
              </Field>
              <Field label="Requirement" name="requirementType">
                <select className={inputClassName} id="requirementType" name="requirementType" defaultValue="required">
                  <option value="required">Required</option>
                  <option value="preferred">Preferred</option>
                  <option value="nice_to_have">Nice to have</option>
                </select>
              </Field>
              <PrimaryButton>Link skill</PrimaryButton>
            </ActionForm>
            <ActionForm action={addCapabilityTextAction} className="space-y-3">
              <h2 className="font-medium text-navy">Preserve unmatched wording</h2>
              <input type="hidden" name="roleId" value={detail.role.id} />
              <Field label="Source text" name="sourceText">
                <input className={inputClassName} id="sourceText" name="sourceText" required />
              </Field>
              <PrimaryButton>Save text for review</PrimaryButton>
            </ActionForm>
            {detail.capabilityTexts.filter((row) => row.reviewStatus !== "approved").map((row) => (
              <ActionForm key={row.id} action={linkCapabilityTextAction} className="space-y-3">
                <p className="text-sm">Link “{row.sourceText}” to a skill</p>
                <input type="hidden" name="roleId" value={detail.role.id} />
                <input type="hidden" name="textId" value={row.id} />
                <Field label="Skill" name={`skill-${row.id}`}>
                  <select className={inputClassName} id={`skill-${row.id}`} name="skillId" required>
                    {skillOptions.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
                  </select>
                </Field>
                <PrimaryButton>Approve link</PrimaryButton>
              </ActionForm>
            ))}
            <ActionForm action={linkRoleJobAction} className="space-y-3">
              <h2 className="font-medium text-navy">Link a live job</h2>
              <input type="hidden" name="roleId" value={detail.role.id} />
              <Field label="Job" name="jobId">
                <select className={inputClassName} id="jobId" name="jobId" required>
                  {detail.companyJobs.filter((job) => !linkedIds.has(job.id)).map((job) => (
                    <option key={job.id} value={job.id}>{job.title} · {formatLabel(job.status)}</option>
                  ))}
                </select>
              </Field>
              <PrimaryButton>Link job</PrimaryButton>
            </ActionForm>
            <ActionForm action={addStrategyNoteAction} className="space-y-3">
              <h2 className="font-medium text-navy">Record a strategy note</h2>
              <input type="hidden" name="roleId" value={detail.role.id} />
              <Field label="Channel" name="channel">
                <select className={inputClassName} id="channel" name="channel" defaultValue="military_talent_network">
                  <option value="military_talent_network">Military Talent Network</option>
                  <option value="talent_network">Talent Network</option>
                  <option value="targeted_campaign">Targeted campaign</option>
                  <option value="skillbridge_pathway">SkillBridge pathway</option>
                  <option value="education_partner">Education partner</option>
                  <option value="training_pathway">Training pathway</option>
                  <option value="evergreen_pool">Evergreen pool</option>
                  <option value="increase_sourcing">Increase sourcing</option>
                  <option value="review_requirements">Review requirements</option>
                </select>
              </Field>
              <Field label="Note" name="note">
                <textarea className={inputClassName} id="note" name="note" required />
              </Field>
              <PrimaryButton>Save note</PrimaryButton>
            </ActionForm>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
