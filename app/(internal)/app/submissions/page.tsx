import { createInterviewAction, submitToClientAction } from "@/lib/actions/recruiting";
import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { listSubmissions } from "@/lib/repositories/recruiting-delivery";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../_components/action-form";
import { PageHeader, PageShell, formatLabel } from "../_components/ui";
import { StatusBadge } from "@/components/ui/display";

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
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">Candidate</th>
            <th>Job</th>
            <th>Status</th>
            <th>Version</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const presented = presentCandidate(row.candidate, canReadPii);
            return (
              <tr key={row.submission.id} className="border-b border-border align-top">
                <td className="py-2">{presented.fullName}</td>
                <td>{row.job.title}</td>
                <td><StatusBadge>{formatLabel(row.submission.status)}</StatusBadge></td>
                <td>{row.submission.version}</td>
                <td>
                  {canApprove && row.submission.status === "pending_approval" ? (
                    <ActionForm action={submitToClientAction}>
                      <input type="hidden" name="submissionId" value={row.submission.id} />
                      <button className="text-sm underline" type="submit">Submit to client</button>
                    </ActionForm>
                  ) : null}
                  {canInterview ? (
                    <ActionForm action={createInterviewAction} className="mt-1">
                      <input type="hidden" name="candidateId" value={row.candidate.id} />
                      <input type="hidden" name="jobId" value={row.job.id} />
                      <input type="hidden" name="submissionId" value={row.submission.id} />
                      <input type="hidden" name="stage" value="first" />
                      <button className="text-sm underline" type="submit">Schedule interview</button>
                    </ActionForm>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </PageShell>
  );
}
