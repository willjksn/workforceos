import Link from "next/link";
import { notFound } from "next/navigation";

import {
  completeInternalSearchAction,
  preserveSilverMedalistAction,
  runInternalSearchAction,
  setJobStatusAction,
  updateJobAction,
  updatePipelineAction,
} from "@/lib/actions/recruiting";
import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { externalSourcingHook } from "@/lib/recruiting/external-sourcing";
import { PIPELINE_STAGES, normalizePipelineStage } from "@/lib/recruiting/pipeline";
import { getJobWorkspace, listCanonicalSkills } from "@/lib/repositories/recruiting";
import { getServiceBundle } from "@/lib/repositories/services";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { Field, PageHeader, PageShell, PrimaryButton, formatLabel, inputClassName } from "../../_components/ui";
import { Card, StatusBadge } from "@/components/ui/display";
import { ButtonLink } from "@/components/ui/button";
import { JobsSubnav } from "../_components/jobs-subnav";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requireAppPermission("jobs.read");
  const { id } = await params;
  const workspace = await getJobWorkspace(id, principal.organizationId);
  if (!workspace) notFound();
  const workflow = await getServiceBundle("professional-search");
  const canWrite = can(principal, "jobs.write");
  const canReadPii = can(principal, "candidate_pii.read");
  const skillCatalog = canWrite ? await listCanonicalSkills() : [];
  const searchProject = workspace.searchProjects[0] ?? null;
  const internalComplete = Boolean(
    workspace.job.internalTalentSearchCompletedAt ?? searchProject?.internalSearchCompletedAt,
  );
  const linkedin = externalSourcingHook({
    provider: "linkedin-recruiter",
    jobId: workspace.job.id,
    internalSearchCompletedAt: workspace.job.internalTalentSearchCompletedAt ?? searchProject?.internalSearchCompletedAt,
  });

  return (
    <PageShell wide>
      <PageHeader
        title={workspace.job.title}
        description={`${workspace.companyName ?? "No company"} · ${workspace.job.locationLabel ?? "Location not recorded"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {searchProject ? (
              <ButtonLink href={`/app/search-projects/${searchProject.id}`}>Internal search</ButtonLink>
            ) : null}
            <ButtonLink href={`/app/jobs/${workspace.job.id}/pipeline`}>Pipeline</ButtonLink>
          </div>
        }
      />
      <JobsSubnav active="/app/jobs" />
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge tone="navy">{formatLabel(workspace.job.status)}</StatusBadge>
        {workspace.job.priority ? <StatusBadge>{workspace.job.priority}</StatusBadge> : null}
        {workspace.hiringManagerName ? <span className="text-sm text-muted-foreground">HM {workspace.hiringManagerName}</span> : null}
      </div>
      {workspace.job.description ? <p className="mt-4 text-sm text-muted-foreground">{workspace.job.description}</p> : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Compensation</p>
          <p className="mt-2 font-serif text-2xl text-navy">
            {workspace.job.compensationMin || workspace.job.compensationMax
              ? `${workspace.job.compensationMin ?? "—"}–${workspace.job.compensationMax ?? "—"}`
              : "—"}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Internal matches</p>
          <p className="mt-2 font-serif text-2xl text-navy">{workspace.matches.length}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Reviewed / recommended</p>
          <p className="mt-2 font-serif text-2xl text-navy">
            {workspace.job.internalCandidatesReviewedCount ?? "—"} / {workspace.job.internalCandidatesRecommendedCount ?? "—"}
          </p>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="section-title">Skills</h2>
        <ul className="mt-3 text-sm">
          {workspace.skills.map((row) => (
            <li key={row.link.id}>
              {row.skill.name} · {formatLabel(row.link.requirementType)}
              {row.link.minimumYears != null ? ` · ${row.link.minimumYears}+ years` : ""}
            </li>
          ))}
        </ul>
      </section>

      {canWrite ? (
        <section className="mt-10 max-w-3xl">
          <h2 className="section-title">Edit job</h2>
          <ActionForm action={updateJobAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="jobId" value={workspace.job.id} />
            <input type="hidden" name="status" value={workspace.job.status} />
            <Field label="Title" name="title">
              <input className={inputClassName} name="title" id="title" defaultValue={workspace.job.title} required />
            </Field>
            <Field label="Location" name="locationLabel">
              <input className={inputClassName} name="locationLabel" id="locationLabel" defaultValue={workspace.job.locationLabel ?? ""} />
            </Field>
            <Field label="Compensation min" name="compensationMin">
              <input className={inputClassName} name="compensationMin" id="compensationMin" defaultValue={workspace.job.compensationMin ?? ""} />
            </Field>
            <Field label="Compensation max" name="compensationMax">
              <input className={inputClassName} name="compensationMax" id="compensationMax" defaultValue={workspace.job.compensationMax ?? ""} />
            </Field>
            <Field label="Priority" name="priority">
              <input className={inputClassName} name="priority" id="priority" defaultValue={workspace.job.priority} />
            </Field>
            <Field label="Military compatibility" name="militaryCompatibility">
              <input className={inputClassName} name="militaryCompatibility" id="militaryCompatibility" defaultValue={workspace.job.militaryCompatibility ?? ""} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description" name="description">
                <textarea className={inputClassName} name="description" id="description" rows={3} defaultValue={workspace.job.description ?? ""} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-navy">Canonical skills</p>
              <div className="mt-2 grid gap-2">
                {skillCatalog.slice(0, 12).map((skill) => {
                  const current = workspace.skills.find((row) => row.skill.id === skill.id);
                  return (
                    <label key={skill.id} className="flex items-center justify-between gap-3 text-sm">
                      <span>{skill.name}</span>
                      <span className="flex items-center gap-2">
                        <input type="hidden" name="skillId" value={skill.id} />
                        <select className={inputClassName} name="requirementType" defaultValue={current?.link.requirementType ?? ""}>
                          <option value="">Skip</option>
                          <option value="required">required</option>
                          <option value="preferred">preferred</option>
                          <option value="nice_to_have">nice to have</option>
                        </select>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="sm:col-span-2">
              <PrimaryButton>Save job</PrimaryButton>
            </div>
          </ActionForm>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="section-title">Internal Talent Network first</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {internalComplete
            ? "Internal search is complete. External provider hooks may be considered through the Integration Hub."
            : "External sourcing stays blocked until internal search is run and marked complete."}
        </p>
        <p className="mt-2 text-sm">
          LinkedIn Recruiter hook: {linkedin.allowed ? "available (not connected)" : linkedin.reason}
        </p>
        {canWrite ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <ActionForm action={runInternalSearchAction}>
              <input type="hidden" name="jobId" value={workspace.job.id} />
              <PrimaryButton>Search internal talent</PrimaryButton>
            </ActionForm>
            {searchProject && !internalComplete ? (
              <ActionForm action={completeInternalSearchAction}>
                <input type="hidden" name="jobId" value={workspace.job.id} />
                <input type="hidden" name="searchProjectId" value={searchProject.id} />
                <button className="rounded-[6px] border border-navy px-4 py-2 text-sm" type="submit">
                  Mark internal search complete
                </button>
              </ActionForm>
            ) : null}
            <ActionForm action={setJobStatusAction} className="flex gap-2">
              <input type="hidden" name="jobId" value={workspace.job.id} />
              <select className={inputClassName} name="status" defaultValue={workspace.job.status}>
                <option value="draft">draft</option>
                <option value="open">open</option>
                <option value="search_active">search_active</option>
                <option value="on_hold">on_hold</option>
                <option value="filled">filled</option>
                <option value="cancelled">cancelled</option>
                <option value="closed">closed</option>
              </select>
              <button className="text-sm underline" type="submit">Update status</button>
            </ActionForm>
          </div>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="section-title">Professional Search workflow</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
          {(workflow?.workflows ?? []).map((step) => (
            <li key={step.id}>
              {step.name}
              {step.requiresHumanApproval ? " (human approval required)" : ""}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="section-title">Job-specific matches</h2>
        <p className="mt-2 text-sm text-muted-foreground">Scores are for this job only. There is no universal candidate quality score.</p>
        {workspace.matches.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No internal matches yet. Run Talent Network search.</p>
        ) : (
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-2">Candidate</th>
                <th>Overall</th>
                <th>Skills / exp / mil</th>
                <th>Why</th>
                <th>Stage</th>
              </tr>
            </thead>
            <tbody>
              {workspace.matches.map(({ match, candidate }) => {
                const presented = presentCandidate(candidate, canReadPii);
                return (
                  <tr key={match.id} className="border-b border-border align-top">
                    <td className="py-2">
                      <Link className="text-navy underline" href={`/app/talent/${candidate.id}`}>
                        {presented.fullName}
                      </Link>
                    </td>
                    <td>{match.score}</td>
                    <td>{[match.skillsScore, match.experienceScore, match.militaryScore].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="max-w-sm">{match.explanation}</td>
                    <td>
                      {canWrite ? (
                        <ActionForm action={updatePipelineAction} className="flex gap-2">
                          <input type="hidden" name="jobId" value={workspace.job.id} />
                          <input type="hidden" name="matchId" value={match.id} />
                          <select className={inputClassName} name="pipelineStatus" defaultValue={normalizePipelineStage(match.pipelineStatus)}>
                            {PIPELINE_STAGES.map((stage) => (
                              <option key={stage} value={stage}>{stage}</option>
                            ))}
                          </select>
                          <button className="text-sm underline" type="submit">Save</button>
                        </ActionForm>
                      ) : (
                        normalizePipelineStage(match.pipelineStatus)
                      )}
                      {can(principal, "candidates.write") ? (
                        <ActionForm action={preserveSilverMedalistAction}>
                          <input type="hidden" name="jobId" value={workspace.job.id} />
                          <input type="hidden" name="candidateId" value={candidate.id} />
                          <button className="text-xs underline" type="submit">Keep as silver medalist</button>
                        </ActionForm>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </PageShell>
  );
}
