import { createOfferAction, updateInterviewAction } from "@/lib/actions/recruiting";
import { buttonClassName } from "@/components/ui/button";
import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { listInterviews } from "@/lib/repositories/recruiting-delivery";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../_components/action-form";
import {
  DataTable,
  EmptyState,
  PageHeader,
  PageShell,
  StatusBadge,
  formatDate,
  formatLabel,
  inputClassName,
} from "../_components/ui";

export default async function InterviewsPage() {
  const principal = await requireAppPermission("interviews.read");
  const rows = await listInterviews(principal.organizationId);
  const canWrite = can(principal, "interviews.write");
  const canOffer = can(principal, "offers.write");
  const canReadPii = can(principal, "candidate_pii.read");
  const now = new Date();

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Recruiting"
        title="Interviews"
        description="Multiple interviews per candidate and job are kept as history. Completed interviews without client feedback show a stalled warning."
      />
      {rows.length === 0 ? (
        <EmptyState title="No interviews recorded.">
          Schedule an interview from a submission. History is kept; completed rows without client feedback stall here.
        </EmptyState>
      ) : (
        <DataTable columns={["Candidate", "Job", "Stage", "When", "Status", "Feedback"]}>
          {rows.map((row) => {
            const presented = presentCandidate(row.candidate, canReadPii);
            const overdue =
              row.interview.status === "completed" &&
              !row.interview.clientFeedback &&
              row.interview.clientFeedbackDueAt &&
              row.interview.clientFeedbackDueAt < now;
            return (
              <tr key={row.interview.id} className="align-top">
                <td>{presented.fullName}</td>
                <td>{row.job.title}</td>
                <td>{row.interview.stage ?? "—"}</td>
                <td>{formatDate(row.interview.scheduledFor)}</td>
                <td>
                  <StatusBadge tone={overdue ? "warning" : "navy"}>{formatLabel(row.interview.status)}</StatusBadge>
                </td>
                <td>
                  {overdue ? <p className="text-warning">Client feedback overdue</p> : row.interview.clientFeedback ?? "—"}
                  {canWrite ? (
                    <ActionForm action={updateInterviewAction} className="mt-2 space-y-2">
                      <input type="hidden" name="interviewId" value={row.interview.id} />
                      <select className={inputClassName} name="status" defaultValue={row.interview.status}>
                        <option value="scheduled">scheduled</option>
                        <option value="completed">completed</option>
                        <option value="cancelled">cancelled</option>
                        <option value="no_show">no_show</option>
                      </select>
                      <textarea
                        className={inputClassName}
                        name="clientFeedback"
                        placeholder="Client feedback"
                        defaultValue={row.interview.clientFeedback ?? ""}
                      />
                      <button className={buttonClassName("ghost")} type="submit">
                        Save
                      </button>
                    </ActionForm>
                  ) : null}
                  {canOffer && row.interview.status === "completed" ? (
                    <ActionForm action={createOfferAction} className="mt-2 flex gap-2">
                      <input type="hidden" name="candidateId" value={row.candidate.id} />
                      <input type="hidden" name="jobId" value={row.job.id} />
                      <input className={inputClassName} name="baseSalary" placeholder="Base salary" />
                      <button className={buttonClassName("ghost")} type="submit">
                        Record offer
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
