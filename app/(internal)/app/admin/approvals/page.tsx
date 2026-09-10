import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { approvals } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/guard";
import { DataTable, EmptyState, PageHeader, PageShell, StatusBadge, formatLabel, ButtonLink } from "../../_components/ui";

export default async function ApprovalsAdminPage() {
  const principal = await requirePlatformAdmin();
  const db = getDb();
  const rows = await db
    .select()
    .from(approvals)
    .where(eq(approvals.organizationId, principal.organizationId))
    .orderBy(desc(approvals.createdAt))
    .limit(50);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="Approvals"
        description="Platform-admin list of stored approval rows for this organization. Operators review material AI on the Review Queue. Agents cannot approve their own work."
        actions={<ButtonLink href="/app/ai-operations/review">Review Queue</ButtonLink>}
      />
      {rows.length === 0 ? (
        <EmptyState title="Nothing waiting">
          When a recommendation or client-facing draft needs a human decision, it will appear here.
        </EmptyState>
      ) : (
        <DataTable columns={["What needs review", "Status", "Record"]}>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{formatLabel(row.approvalType)}</td>
                <td>
                  <StatusBadge tone={row.status === "pending" ? "warning" : row.status === "approved" ? "success" : "neutral"}>
                    {formatLabel(row.status)}
                  </StatusBadge>
                </td>
                <td className="text-muted-foreground">
                  {formatLabel(row.recordType)}
                </td>
              </tr>
            ))}
        </DataTable>
      )}
    </PageShell>
  );
}
