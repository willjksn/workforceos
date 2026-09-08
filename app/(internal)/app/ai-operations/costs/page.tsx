import { requireAppPermission } from "@/lib/auth/guard";
import { usageSummary } from "@/lib/ai/engine";
import { EmptyState, PageHeader, PageShell, RecordList, RecordRow } from "../../_components/ui";
import { AiSubnav } from "../_components/ai-subnav";
import { MetricCard } from "@/components/ui/display";

export default async function CostsPage() {
  const principal = await requireAppPermission("agents.manage");
  const usage = await usageSummary(principal.organizationId);
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="AI Operations"
        title="Costs & Usage"
        description="Token counts when the provider reports them, plus estimated cost by provider, model, and task. Daily and monthly agent limits block runaway loops."
      />
      <AiSubnav active="/app/ai-operations/costs" />
      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <MetricCard label="Today" value={`$${usage.dayCostUsd.toFixed(4)}`} />
        <MetricCard label="This month" value={`$${usage.monthCostUsd.toFixed(4)}`} />
      </section>
      {usage.events.length === 0 ? (
        <EmptyState title="No usage recorded yet." />
      ) : (
        <RecordList>
          {usage.events.slice(0, 40).map((event) => (
            <RecordRow
              key={event.id}
              title={`${event.provider} / ${event.model} / ${event.taskType}`}
              meta={`$${Number(event.estimatedCostUsd).toFixed(6)} · tokens ${event.inputTokens ?? "—"}/${event.outputTokens ?? "—"}`}
            />
          ))}
        </RecordList>
      )}
    </PageShell>
  );
}
