import { requirePlatformAdmin } from "@/lib/auth/guard";
import { listDecisionLog } from "@/lib/repositories/platform";
import { EmptyState, PageHeader, PageShell, RecordList, RecordRow } from "../../_components/ui";

export default async function AdminDecisionsPage() {
  await requirePlatformAdmin();
  const rows = await listDecisionLog();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin / Internal"
        title="Architecture decisions"
        description="This mirrors the engineering decision log. It is not an operating screen for client or talent work."
      />
      {rows.length === 0 ? (
        <EmptyState>No decisions recorded.</EmptyState>
      ) : (
        <RecordList className="mt-6">
          {rows.map((decision) => (
            <RecordRow key={decision.id} title={`${decision.code} — ${decision.title}`} meta={decision.decision} />
          ))}
        </RecordList>
      )}
    </PageShell>
  );
}
