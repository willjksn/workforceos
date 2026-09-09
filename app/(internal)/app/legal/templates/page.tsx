import { requireAppPermission } from "@/lib/auth/guard";
import { listLegalTemplates } from "@/lib/delivery/engine";
import { DataTable, EmptyState, PageHeader, PageShell, formatLabel } from "../../_components/ui";
import { StatusBadge } from "@/components/ui/display";

export default async function LegalTemplatesPage() {
  await requireAppPermission("legal.read");
  const rows = await listLegalTemplates();

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Legal & Contracts"
        title="Templates"
        description="Structural templates. The Attorney-approved label appears only when counsel has recorded approval on the template."
      />
      {rows.length === 0 ? (
        <EmptyState title="No templates seeded.">Seed the launch catalog to load placeholder templates.</EmptyState>
      ) : (
        <DataTable columns={["Template", "Type", "Version", "Status", "Legal review"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="font-medium text-navy">{row.name}</td>
              <td>{formatLabel(row.templateType)}</td>
              <td>{row.version}</td>
              <td>
                <StatusBadge>{formatLabel(row.status)}</StatusBadge>
              </td>
              <td>
                {row.attorneyApproved ? (
                  <StatusBadge tone="success">Attorney-approved</StatusBadge>
                ) : (
                  <span className="text-muted-foreground">Placeholder — not attorney-reviewed</span>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
