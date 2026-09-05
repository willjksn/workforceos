import Link from "next/link";
import { notFound } from "next/navigation";

import {
  completeInternalSearchAction,
  preserveSilverMedalistAction,
  runInternalSearchAction,
  updatePipelineAction,
} from "@/lib/actions/recruiting";
import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { externalSourcingBlocked } from "@/lib/recruiting/internal-search";
import { getJobWorkspace } from "@/lib/repositories/recruiting";
import { getServiceBundle } from "@/lib/repositories/services";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { PageHeader, PrimaryButton, inputClassName } from "../../_components/ui";

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
  const searchProject = workspace.searchProjects[0] ?? null;
  const internalComplete = Boolean(searchProject?.internalSearchCompletedAt);
  const blocked = !searchProject || externalSourcingBlocked(searchProject.internalSearchCompletedAt);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title={workspace.job.title}
        description={`${workspace.companyName ?? "No company"} · ${workspace.job.status}`}
      />
      {workspace.job.description ? (
        <p className="mt-3 text-sm text-zinc-600">{workspace.job.description}</p>
      ) : null}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Professional Search workflow</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Steps are loaded from the approved service version in the database.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
          {(workflow?.workflows ?? []).map((step) => (
            <li key={step.id}>
              {step.name}
              {step.requiresHumanApproval ? " (human approval required)" : ""}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Internal Talent Network search</h2>
        {searchProject ? (
          <p className="mt-2 text-sm">
            Search project: {searchProject.name}.{" "}
            {internalComplete
              ? `Completed ${searchProject.internalSearchCompletedAt?.toISOString()}`
              : "Not marked complete. External sourcing stays blocked."}
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-600">
            This job is missing an internal search project. Running search will create one.
          </p>
        )}
        {blocked ? (
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
            External sourcing is blocked until internal search is run and marked complete.
          </p>
        ) : (
          <p className="mt-2 text-sm">Internal search complete. External sourcing is still not enabled in this phase.</p>
        )}
        {canWrite ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <ActionForm action={runInternalSearchAction}>
              <input type="hidden" name="jobId" value={workspace.job.id} />
              <PrimaryButton>Search Talent Network</PrimaryButton>
            </ActionForm>
            {searchProject && !internalComplete ? (
              <ActionForm action={completeInternalSearchAction}>
                <input type="hidden" name="jobId" value={workspace.job.id} />
                <input type="hidden" name="searchProjectId" value={searchProject.id} />
                <button className="rounded-full border px-4 py-2 text-sm" type="submit">
                  Mark internal search complete
                </button>
              </ActionForm>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Job-specific matches</h2>
        {workspace.matches.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">No internal matches yet. Run Talent Network search.</p>
        ) : (
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-2">Candidate</th>
                <th>Score</th>
                <th>Explanation</th>
                <th>Pipeline</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {workspace.matches.map(({ match, candidate }) => {
                const presented = presentCandidate(candidate, canReadPii);
                return (
                  <tr key={match.id} className="border-b align-top">
                    <td className="py-2">
                      <Link className="underline" href={`/app/talent/${candidate.id}`}>
                        {presented.fullName}
                      </Link>
                    </td>
                    <td>{match.score}</td>
                    <td className="max-w-xs">{match.explanation}</td>
                    <td>
                      {canWrite ? (
                        <ActionForm action={updatePipelineAction} className="flex gap-2">
                          <input type="hidden" name="jobId" value={workspace.job.id} />
                          <input type="hidden" name="matchId" value={match.id} />
                          <select
                            className={inputClassName}
                            name="pipelineStatus"
                            defaultValue={match.pipelineStatus}
                          >
                            <option value="sourced">sourced</option>
                            <option value="screened">screened</option>
                            <option value="submitted">submitted</option>
                            <option value="interviewing">interviewing</option>
                            <option value="offered">offered</option>
                            <option value="placed">placed</option>
                            <option value="declined">declined</option>
                            <option value="withdrawn">withdrawn</option>
                          </select>
                          <button className="text-sm underline" type="submit">
                            Save
                          </button>
                        </ActionForm>
                      ) : (
                        match.pipelineStatus
                      )}
                    </td>
                    <td>
                      {can(principal, "candidates.write") ? (
                        <ActionForm action={preserveSilverMedalistAction}>
                          <input type="hidden" name="jobId" value={workspace.job.id} />
                          <input type="hidden" name="candidateId" value={candidate.id} />
                          <button className="text-sm underline" type="submit">
                            Keep in silver medalists
                          </button>
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
    </main>
  );
}
