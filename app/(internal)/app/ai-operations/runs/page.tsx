import { requireAppPermission } from "@/lib/auth/guard";
import { getAgentRun, listAgentRuns } from "@/lib/ai/engine";
import { retryRunAction } from "@/lib/actions/ai";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import {
  EmptyState,
  PageHeader,
  PageShell,
  PrimaryButton,
  RecordList,
  RecordRow,
  StatusBadge,
  formatDate,
  formatLabel,
} from "../../_components/ui";
import { AiSubnav } from "../_components/ai-subnav";

export default async function AgentRunsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const principal = await requireAppPermission("agents.manage");
  const { id } = await searchParams;
  const rows = await listAgentRuns(principal.organizationId);
  const detail = id ? await getAgentRun(principal.organizationId, id) : null;
  const canRetry = can(principal, "agents.manage");

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="AI Operations"
        title="Agent Runs"
        description="Every run records agent, task, workflow, model, cost, review state, and errors."
      />
      <AiSubnav active="/app/ai-operations/runs" />
      {detail ? (
        <section className="mt-8 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title">{detail.agent.name} / {detail.run.taskKey}</h2>
            <StatusBadge tone={detail.run.status === "failed" ? "danger" : "navy"}>{formatLabel(detail.run.status)}</StatusBadge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {detail.run.provider} · {detail.run.model} · workflow {detail.run.workflowCode ?? "none"} {detail.run.workflowVersion ?? ""}
          </p>
          {detail.run.errorDetail ? <p className="mt-2 text-sm text-danger">{detail.run.errorDetail}</p> : null}
          {canRetry && detail.run.status === "failed" ? (
            <ActionForm action={retryRunAction} className="mt-3">
              <input type="hidden" name="runId" value={detail.run.id} />
              <PrimaryButton>Retry run</PrimaryButton>
            </ActionForm>
          ) : null}
        </section>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState title="No agent runs yet." />
      ) : (
        <RecordList>
          {rows.map(({ run, agent }) => (
            <RecordRow
              key={run.id}
              href={`/app/ai-operations/runs?id=${run.id}`}
              title={`${agent.name} · ${run.taskKey}`}
              meta={`${formatLabel(run.status)} · ${formatDate(run.startedAt)} · ${run.provider ?? "heuristic"}`}
            />
          ))}
        </RecordList>
      )}
    </PageShell>
  );
}
