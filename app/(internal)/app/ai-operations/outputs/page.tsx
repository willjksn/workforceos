import { requireAppPermission } from "@/lib/auth/guard";
import { listAgentOutputs } from "@/lib/ai/engine";
import { EmptyState, PageHeader, PageShell, RecordList, RecordRow, formatLabel } from "../../_components/ui";
import { AiSubnav } from "../_components/ai-subnav";

export default async function AgentOutputsPage() {
  const principal = await requireAppPermission("agents.manage");
  const rows = await listAgentOutputs(principal.organizationId);
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="AI Operations"
        title="Agent Outputs"
        description="Drafts and recommendations with provenance: model, sources, confidence, missing data, and assumptions."
      />
      <AiSubnav active="/app/ai-operations/outputs" />
      {rows.length === 0 ? (
        <EmptyState title="No outputs recorded." />
      ) : (
        <RecordList>
          {rows.map(({ output, agent }) => (
            <RecordRow
              key={output.id}
              title={output.summary}
              meta={`${agent.name} · ${formatLabel(output.status)} · ${output.confidence ?? "no numeric confidence"}`}
            />
          ))}
        </RecordList>
      )}
    </PageShell>
  );
}
