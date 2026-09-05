import { createInterviewAction, submitToClientAction } from "@/lib/actions/recruiting";
import { buttonClassName } from "@/components/ui/button";
import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { listSubmissions } from "@/lib/repositories/recruiting-delivery";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../_components/action-form";
import { DataTable, EmptyState, PageHeader, PageShell, StatusBadge, formatLabel } from "../_components/ui";

export default async function SubmissionsPage() {
  const principal = await requireAppPermission("submissions.read");
  const rows = await listSubmissions(principal.organizationId);
  const canApprove = can(principal, "submissions.approve");
  const canInterview = can(principal, "interviews.write");
  const canReadPii = can(principal, "candidate_pii.read");

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Recruiting"
        title="Submissions"
        description="A human recruiter must decide submission. Packets keep military translation and gaps visible."
      />
      {rows.length === 0 ? (
        <EmptyState title="No submissions recorded.">
          Client packets appear here after a recruiter prepares a submission from a job pipeline.
        </EmptyState>
      ) : (
        <DataTable columns={["Candidate", "Job", "Status", "Version", "Actions"]}>
          {rows.map((row) => {
            const presented = presentCandidate(row.candidate, canReadPii);
            return (
              <tr key={row.submission.id} className="align-top">
                <td>{presented.fullName}</td>
                <td>{row.job.title}</td>
                <td>
                  <StatusBadge>{formatLabel(row.submission.status)}</StatusBadge>
                </td>
                <td>{row.submission.version}</td>
                <td>
                  {canApprove && row.submission.status === "pending_approval" ? (
                    <ActionForm action={submitToClientAction}>
                      <input type="hidden" name="submissionId" value={row.submission.id} />
                      <button className={buttonClassName("ghost")} type="submit">
                        Submit to client
                      </button>
                    </ActionForm>
                  ) : null}
                  {canInterview ? (
                    <ActionForm action={createInterviewAction} className="mt-1">
                      <input type="hidden" name="candidateId" value={row.candidate.id} />
                      <input type="hidden" name="jobId" value={row.job.id} />
                      <input type="hidden" name="submissionId" value={row.submission.id} />
                      <input type="hidden" name="stage" value="first" />
                      <button className={buttonClassName("ghost")} type="submit">
                        Schedule interview
                      </button>
                    </ActionForm>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </PageShell>
  );
}
