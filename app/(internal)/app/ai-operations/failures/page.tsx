import { requireAppPermission } from "@/lib/auth/guard";
import { listAgentRuns } from "@/lib/ai/engine";
import { retryRunAction } from "@/lib/actions/ai";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { EmptyState, PageHeader, PageShell, PrimaryButton, RecordList, RecordRow } from "../../_components/ui";
import { AiSubnav } from "../_components/ai-subnav";

export default async function FailuresPage() {
  const principal = await requireAppPermission("agents.manage");
  const rows = await listAgentRuns(principal.organizationId, true);
  const canRetry = can(principal, "agents.manage");
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="AI Operations"
        title="Failures"
        description="Failed runs stay visible with error detail. Retry is manual. Repeated failures open a circuit breaker."
      />
      <AiSubnav active="/app/ai-operations/failures" />
      {rows.length === 0 ? (
        <EmptyState title="No failed runs." />
      ) : (
        <RecordList>
          {rows.map(({ run, agent }) => (
            <RecordRow
              key={run.id}
              title={`${agent.name} · ${run.taskKey}`}
              meta={run.errorDetail ?? "Failed"}
              trailing={
                canRetry ? (
                  <ActionForm action={retryRunAction}>
                    <input type="hidden" name="runId" value={run.id} />
                    <PrimaryButton>Retry</PrimaryButton>
                  </ActionForm>
                ) : null
              }
            />
          ))}
        </RecordList>
      )}
    </PageShell>
  );
}
