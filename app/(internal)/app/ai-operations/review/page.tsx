import { requireAppPermission } from "@/lib/auth/guard";
import { canDecideReview, listReviewQueue } from "@/lib/ai/review";
import { decideReviewAction } from "@/lib/actions/ai";
import { ActionForm } from "../../_components/action-form";
import {
  EmptyState,
  PageHeader,
  PageShell,
  PrimaryButton,
  StatusBadge,
  formatLabel,
  inputClassName,
} from "../../_components/ui";
import { formatCitations } from "@/lib/ai/citations";
import { AiSubnav } from "../_components/ai-subnav";

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const principal = await requireAppPermission("agents.read");
  const { category } = await searchParams;
  const rows = await listReviewQueue(principal.organizationId, category);

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Review Queue"
        title="Review Queue"
        description="Material agent drafts wait here. Approve, reject, or request changes. Cost, prompt, and provider admin live under Admin → AI & Automation."
      />
      <AiSubnav active="/app/ai-operations/review" />
      {rows.length === 0 ? (
        <EmptyState title="Nothing in the review queue.">Candidate submissions, mappings, proposals, and other material outputs appear when an agent requires a human.</EmptyState>
      ) : (
        <div className="mt-8 space-y-4">
          {rows.map(({ output, agent, approval, usedFallback }) => (
            <article key={output.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {agent.name} · {formatLabel(output.reviewCategory ?? output.outputType)}
                  </p>
                  <h2 className="mt-1 text-base font-medium text-navy">{output.summary}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Confidence {output.confidence ?? "not numeric"} · {output.provider ?? "heuristic"} / {output.model ?? "n/a"}
                    {usedFallback ? " · fallback used" : ""}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Citations: {formatCitations(output.sourceReferences) ?? "None recorded"}
                  </p>
                  {output.assumptions ? <p className="mt-2 text-sm">{output.assumptions}</p> : null}
                </div>
                <StatusBadge tone="warning">{formatLabel(approval?.status ?? output.status)}</StatusBadge>
              </div>
              {canDecideReview(principal, output.reviewCategory) && approval?.status === "pending" ? (
                <ActionForm action={decideReviewAction} className="mt-4 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="outputId" value={output.id} />
                  <select name="decision" className={`${inputClassName} max-w-xs`} defaultValue="approved">
                    <option value="approved">Approve</option>
                    <option value="rejected">Reject</option>
                    <option value="changes_requested">Request changes</option>
                  </select>
                  <input name="notes" className={inputClassName} placeholder="Notes" />
                  <PrimaryButton>Record decision</PrimaryButton>
                </ActionForm>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
