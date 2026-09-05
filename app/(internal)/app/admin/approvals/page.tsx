import { desc } from "drizzle-orm";

import { getDb } from "@/db";
import { approvals } from "@/db/schema";
import { requireCurrentPrincipal } from "@/lib/auth/session";
import { DataTable, EmptyState, PageHeader, PageShell, StatusBadge, formatLabel } from "../../_components/ui";

export default async function ApprovalsAdminPage() {
  await requireCurrentPrincipal();
  const db = getDb();
  const rows = await db.select().from(approvals).orderBy(desc(approvals.createdAt)).limit(50);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="Approvals"
        description="Material AI drafts and client-facing outputs wait here for a person. Agents cannot approve their own work."
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
