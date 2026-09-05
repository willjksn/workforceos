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
        description="Structural templates only. Language is not attorney-approved unless the attorney-approved flag is set."
      />
      {rows.length === 0 ? (
        <EmptyState title="No templates seeded.">Seed the launch catalog to load placeholder templates.</EmptyState>
      ) : (
        <DataTable columns={["Template", "Type", "Version", "Status", "Attorney approved"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="font-medium text-navy">{row.name}</td>
              <td>{formatLabel(row.templateType)}</td>
              <td>{row.version}</td>
              <td>
                <StatusBadge>{formatLabel(row.status)}</StatusBadge>
              </td>
              <td>{row.attorneyApproved ? "Yes" : "No"}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
