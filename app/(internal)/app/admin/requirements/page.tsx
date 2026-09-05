import { getDb } from "@/db";
import { requirements } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/guard";
import { EmptyState, PageHeader, PageShell, RecordList, RecordRow, formatLabel } from "../../_components/ui";

export default async function RequirementsAdminPage() {
  await requirePlatformAdmin();
  const db = getDb();
  const rows = await db.select().from(requirements);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin / Internal"
        title="Requirements registry"
        description="This mirrors locked product requirements for engineering. It is not part of daily firm operations."
      />
      {rows.length === 0 ? (
        <EmptyState>No requirements are recorded.</EmptyState>
      ) : (
        <RecordList className="mt-6">
          {rows.map((row) => (
            <RecordRow
              key={row.id}
              title={`${row.code} — ${row.title}`}
              meta={`${formatLabel(row.module)} · ${formatLabel(row.status)}`}
            />
          ))}
        </RecordList>
      )}
    </PageShell>
  );
}
