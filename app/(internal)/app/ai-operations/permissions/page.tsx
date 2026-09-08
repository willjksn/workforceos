import { requireAppPermission } from "@/lib/auth/guard";
import { listAgentPermissionRows } from "@/lib/ai/engine";
import { PageHeader, PageShell, RecordList, RecordRow, formatLabel } from "../../_components/ui";
import { AiSubnav } from "../_components/ai-subnav";

export default async function AgentPermissionsPage() {
  const principal = await requireAppPermission("agents.manage");
  const rows = await listAgentPermissionRows(principal.organizationId);
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="AI Operations"
        title="Agent Permissions"
        description="Agent scope is the intersection of registered agent permissions and the invoking human. Agents cannot read unrelated candidate PII or secrets."
      />
      <AiSubnav active="/app/ai-operations/permissions" />
      <RecordList>
        {rows.map(({ agent, permissions }) => (
          <RecordRow
            key={agent.id}
            title={`${agent.name} · autonomy ${agent.autonomyLevel} · ${formatLabel(agent.status)}`}
            meta={permissions.join(", ") || "No permissions seeded"}
          />
        ))}
      </RecordList>
    </PageShell>
  );
}
