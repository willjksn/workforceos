import Link from "next/link";

import { AcademyHelp } from "@/components/academy/academy-help";
import { ConceptNote } from "@/components/ia/concept-note";
import { requireAppPermission } from "@/lib/auth/guard";
import { listLegalTemplates } from "@/lib/delivery/engine";
import { LEGAL_TEMPLATE_LIST_DESCRIPTION, legalTemplateUseLabel } from "@/lib/legal/labels";
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
        description={LEGAL_TEMPLATE_LIST_DESCRIPTION}
        actions={<AcademyHelp articleSlug="contracts" />}
      />
      <ConceptNote concept="templateVsAgreementVsContract" />
      {rows.length === 0 ? (
        <EmptyState title="No templates yet.">Ask an administrator to load the launch catalog if this environment is empty.</EmptyState>
      ) : (
        <DataTable columns={["Template", "Type", "Version", "Use status"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link className="font-medium text-navy" href={`/app/legal/templates/${row.id}`}>
                  {row.name}
                </Link>
              </td>
              <td>{formatLabel(row.templateType)}</td>
              <td>{row.version}</td>
              <td>
                {row.attorneyApproved ? (
                  <StatusBadge tone="success">{legalTemplateUseLabel(true)}</StatusBadge>
                ) : (
                  <StatusBadge tone="warning">{legalTemplateUseLabel(false)}</StatusBadge>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
