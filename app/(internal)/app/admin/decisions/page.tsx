import { requireAppPermission } from "@/lib/auth/guard";
import { listDecisionLog } from "@/lib/repositories/platform";
import { EmptyState, PageHeader } from "../../_components/ui";

export default async function AdminDecisionsPage() {
  await requireAppPermission("admin.roles");
  const rows = await listDecisionLog();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader title="Decisions" description="Architecture and product decisions mirrored from the decision log." />
      {rows.length === 0 ? (
        <EmptyState>No decisions recorded.</EmptyState>
      ) : (
        <ul className="mt-6 space-y-4 text-sm">
          {rows.map((decision) => (
            <li key={decision.id}>
              <p className="font-medium">
                {decision.code} — {decision.title}
              </p>
              <p className="text-zinc-600">{decision.decision}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
