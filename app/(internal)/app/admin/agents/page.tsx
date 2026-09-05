import { getDb } from "@/db";
import { agents } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/guard";
import { requirePermission } from "@/lib/rbac/permissions";
import { DataTable, EmptyState, PageHeader, PageShell, StatusBadge, formatLabel } from "../../_components/ui";

export default async function AgentsAdminPage() {
  const principal = await requirePlatformAdmin();
  requirePermission(principal, "agents.read");
  const db = getDb();
  const rows = await db.select().from(agents);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin / Internal"
        title="Agent registry"
        description="This is a backend registry, not an operating screen. Agents stay disabled until a later phase."
      />
      {rows.length === 0 ? (
        <EmptyState>No agents are registered.</EmptyState>
      ) : (
        <DataTable columns={["Name", "Status"]}>
            {rows.map((agent) => (
              <tr key={agent.id}>
                <td>{agent.name}</td>
                <td>
                  <StatusBadge tone={agent.status === "disabled" ? "neutral" : "warning"}>
                    {formatLabel(agent.status)}
                  </StatusBadge>
                </td>
              </tr>
            ))}
        </DataTable>
      )}
    </PageShell>
  );
}
