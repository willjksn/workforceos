import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createSubmissionAction,
  saveScreeningAction,
  updatePipelineAction,
} from "@/lib/actions/recruiting";
import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { PIPELINE_STAGES, normalizePipelineStage } from "@/lib/recruiting/pipeline";
import { getJobWorkspace } from "@/lib/repositories/recruiting";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../../_components/action-form";
import { Field, PageHeader, PageShell, formatLabel, inputClassName } from "../../../_components/ui";
import { StatusBadge } from "@/components/ui/display";

export default async function JobPipelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requireAppPermission("jobs.read");
  const { id } = await params;
  const workspace = await getJobWorkspace(id, principal.organizationId);
  if (!workspace) notFound();
  const canWrite = can(principal, "jobs.write");
  const canReadPii = can(principal, "candidate_pii.read");
  const canSubmit = can(principal, "submissions.write");

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Candidate pipeline"
        title={workspace.job.title}
        description="Human advancement is required. Scores explain job-specific fit and never auto-reject a candidate."
      />
      {PIPELINE_STAGES.filter((stage) => !["rejected", "withdrawn"].includes(stage)).map((stage) => {
        const rows = workspace.matches.filter((row) => normalizePipelineStage(row.match.pipelineStatus) === stage);
        return (
          <section key={stage} className="mt-8">
            <h2 className="section-title">{formatLabel(stage)}</h2>
            {rows.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">None in this stage.</p>
            ) : (
              <div className="mt-3 grid gap-3">
                {rows.map(({ match, candidate }) => {
                  const presented = presentCandidate(candidate, canReadPii);
                  return (
                    <article key={match.id} className="rounded-[8px] border border-card-border bg-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Link className="font-medium text-navy" href={`/app/talent/${candidate.id}`}>
                            {presented.fullName}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {candidate.currentTitle ?? "Title not recorded"} · {candidate.city ?? candidate.region ?? "Location not recorded"}
                          </p>
                        </div>
                        <StatusBadge tone="teal">{match.score}</StatusBadge>
                      </div>
                      <p className="mt-2 text-sm">{match.strengths || match.explanation}</p>
                      {match.gaps ? <p className="mt-1 text-xs text-muted-foreground">{match.gaps}</p> : null}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {candidate.availability} · source {match.source ?? "internal"} · {candidate.militaryStatus !== "none" && candidate.militaryStatus !== "unknown" ? "military background" : "civilian"}
                      </p>
                      {canWrite ? (
                        <div className="mt-3 flex flex-wrap gap-3">
                          <ActionForm action={updatePipelineAction} className="flex gap-2">
                            <input type="hidden" name="jobId" value={workspace.job.id} />
                            <input type="hidden" name="matchId" value={match.id} />
                            <select className={inputClassName} name="pipelineStatus" defaultValue={normalizePipelineStage(match.pipelineStatus)}>
                              {PIPELINE_STAGES.map((item) => (
                                <option key={item} value={item}>{item}</option>
                              ))}
                            </select>
                            <button className="text-sm underline" type="submit">Move</button>
                          </ActionForm>
                          {canSubmit ? (
                            <ActionForm action={createSubmissionAction}>
                              <input type="hidden" name="jobId" value={workspace.job.id} />
                              <input type="hidden" name="candidateId" value={candidate.id} />
                              <input type="hidden" name="matchId" value={match.id} />
                              <button className="text-sm underline" type="submit">Prepare submission</button>
                            </ActionForm>
                          ) : null}
                        </div>
                      ) : null}
                      {canWrite && stage === "screening" ? (
                        <ActionForm action={saveScreeningAction} className="mt-3 grid gap-2 sm:grid-cols-2">
                          <input type="hidden" name="jobId" value={workspace.job.id} />
                          <input type="hidden" name="matchId" value={match.id} />
                          <Field label="Motivation" name="motivation">
                            <input className={inputClassName} name="motivation" id={`motivation-${match.id}`} />
                          </Field>
                          <Field label="Availability" name="availability">
                            <input className={inputClassName} name="availability" id={`availability-${match.id}`} />
                          </Field>
                          <Field label="Recruiter assessment" name="recruiterAssessment">
                            <textarea className={inputClassName} name="recruiterAssessment" id={`assessment-${match.id}`} rows={2} />
                          </Field>
                          <button className="text-sm underline" type="submit">Save screening</button>
                        </ActionForm>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </PageShell>
  );
}
