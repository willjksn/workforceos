import { requireAppPermission } from "@/lib/auth/guard";
import { listAutomation } from "@/lib/ai/engine";
import { EmptyState, PageHeader, PageShell, RecordList, RecordRow, formatLabel } from "../../_components/ui";
import { AiSubnav } from "../_components/ai-subnav";

export default async function AutomationPage() {
  const principal = await requireAppPermission("automations.read");
  const { rules, runs } = await listAutomation(principal.organizationId);
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="AI Operations"
        title="Automation Rules"
        description="Named event-driven rules only. This is not a no-code automation platform."
      />
      <AiSubnav active="/app/ai-operations/automation" />
      <h2 className="section-title mt-8">Rules</h2>
      {rules.length === 0 ? (
        <EmptyState title="No automation rules." />
      ) : (
        <RecordList>
          {rules.map((rule) => (
            <RecordRow
              key={rule.id}
              title={rule.name}
              meta={`${rule.eventName} → ${rule.actionKey} · ${formatLabel(rule.status)}`}
            />
          ))}
        </RecordList>
      )}
      <h2 className="section-title mt-10">Recent triggers</h2>
      {runs.length === 0 ? (
        <EmptyState title="No automation runs yet." />
      ) : (
        <RecordList>
          {runs.map((run) => (
            <RecordRow
              key={run.id}
              title={run.eventName}
              meta={`${formatLabel(run.status)} · ${run.resultSummary ?? run.errorDetail ?? ""}`}
            />
          ))}
        </RecordList>
      )}
    </PageShell>
  );
}
