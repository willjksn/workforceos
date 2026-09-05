import { getDb } from "@/db";
import { requirements } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/guard";
import { EmptyState, PageHeader, PageShell, formatLabel } from "../../_components/ui";

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
        <ul className="mt-8 space-y-4 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="border-b border-border pb-3">
              <p className="font-medium text-navy">
                {row.code} — {row.title}
              </p>
              <p className="mt-1 text-muted-foreground">
                {formatLabel(row.module)} · {formatLabel(row.status)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
