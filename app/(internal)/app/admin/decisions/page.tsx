import { requirePlatformAdmin } from "@/lib/auth/guard";
import { listDecisionLog } from "@/lib/repositories/platform";
import { EmptyState, PageHeader, PageShell } from "../../_components/ui";

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
        <ul className="mt-8 space-y-4 text-sm">
          {rows.map((decision) => (
            <li key={decision.id}>
              <p className="font-medium text-navy">
                {decision.code} — {decision.title}
              </p>
              <p className="mt-1 text-muted-foreground">{decision.decision}</p>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
