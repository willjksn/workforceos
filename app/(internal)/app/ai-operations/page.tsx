import { requireAppPermission } from "@/lib/auth/guard";
import { commandCenterSnapshot } from "@/lib/ai/engine";
import { can } from "@/lib/rbac/permissions";
import { runAgentAction } from "@/lib/actions/ai";
import { MetricCard } from "@/components/ui/display";
import { ActionForm } from "../_components/action-form";
import {
  EmptyState,
  Field,
  PageHeader,
  PageShell,
  PrimaryButton,
  RecordList,
  RecordRow,
  formatLabel,
  inputClassName,
} from "../_components/ui";
import { OpenScoutButton } from "@/components/scout/scout-drawer";
import { AiSubnav } from "./_components/ai-subnav";

export default async function AiOperationsPage() {
  const principal = await requireAppPermission("agents.manage");
  const snapshot = await commandCenterSnapshot(principal.organizationId);
  const canRun = can(principal, "agents.manage");

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="AI Operations"
        title="AI administration"
        description="Agents draft and recommend on top of PostgreSQL, approved workflows, permissions, audit, and the Review Queue. They are not a second database and cannot approve their own material output. Chat lives in Scout — the labeled Scout control in the top bar, to the left of your profile."
        actions={<OpenScoutButton />}
      />
      <AiSubnav active="/app/ai-operations" />
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active agents" value={snapshot.enabledAgents.length} href="/app/ai-operations/permissions" />
        <MetricCard label="Runs today" value={snapshot.runsToday} href="/app/ai-operations/runs" />
        <MetricCard label="Pending reviews" value={snapshot.pendingReviews} href="/app/ai-operations/review" />
        <MetricCard label="Failures" value={snapshot.failures} href="/app/ai-operations/failures" />
        <MetricCard label="Est. cost today" value={`$${snapshot.estimatedCostToday.toFixed(4)}`} href="/app/ai-operations/costs" />
        <MetricCard label="Est. cost month" value={`$${snapshot.estimatedCostMonth.toFixed(4)}`} href="/app/ai-operations/costs" />
        <MetricCard label="Automations today" value={snapshot.automationsTriggeredToday} href="/app/ai-operations/automation" />
        <MetricCard label="Approval backlog" value={snapshot.approvalBacklog} href="/app/ai-operations/review" />
      </section>
      {canRun ? (
        <section className="mt-10">
          <h2 className="section-title">Run an approved agent</h2>
          <ActionForm action={runAgentAction} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Agent">
              <select name="agentSlug" className={inputClassName} defaultValue="account-intelligence-agent">
                {snapshot.enabledAgents.map((agent) => (
                  <option key={agent.id} value={agent.slug}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Task">
              <input name="taskKey" className={inputClassName} defaultValue="summarize_company" />
            </Field>
            <Field label="Record type">
              <input name="recordType" className={inputClassName} placeholder="company" />
            </Field>
            <Field label="Record ID">
              <input name="recordId" className={inputClassName} placeholder="UUID" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-4">
              <PrimaryButton>Run agent</PrimaryButton>
            </div>
          </ActionForm>
        </section>
      ) : null}
      <section className="mt-10">
        <h2 className="section-title">Recent outputs</h2>
        {snapshot.recentOutputs.length === 0 ? (
          <EmptyState title="No agent outputs yet.">Runs appear here with provenance after an agent executes.</EmptyState>
        ) : (
          <RecordList>
            {snapshot.recentOutputs.map(({ output, agent }) => (
              <RecordRow
                key={output.id}
                href="/app/ai-operations/outputs"
                title={output.summary}
                meta={`${agent.name} · ${formatLabel(output.outputType)} · ${output.provider ?? "heuristic"}`}
              />
            ))}
          </RecordList>
        )}
      </section>
    </PageShell>
  );
}
