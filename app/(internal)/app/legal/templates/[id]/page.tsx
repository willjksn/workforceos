import { notFound } from "next/navigation";

import { AcademyHelp } from "@/components/academy/academy-help";
import { ConceptNote } from "@/components/ia/concept-note";
import { requireAppPermission } from "@/lib/auth/guard";
import { getLegalTemplate } from "@/lib/delivery/engine";
import { legalTemplateUseLabel } from "@/lib/legal/labels";
import { ButtonLink, Card, PageHeader, PageShell, formatDate, formatLabel } from "../../../_components/ui";
import { StatusBadge } from "@/components/ui/display";

export default async function LegalTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAppPermission("legal.read");
  const { id } = await params;
  const template = await getLegalTemplate(id);
  if (!template) notFound();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Legal & Contracts"
        title={template.name}
        description={
          template.attorneyApproved
            ? "Counsel recorded attorney approval on this version."
            : "This is stored draft language. It is not approved for client use."
        }
        metadata={
          <StatusBadge tone={template.attorneyApproved ? "success" : "warning"}>
            {legalTemplateUseLabel(template.attorneyApproved)}
          </StatusBadge>
        }
        actions={<AcademyHelp articleSlug="contracts" />}
      />
      <ConceptNote concept="templateVsAgreementVsContract" />
      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Type</dt>
          <dd>{formatLabel(template.templateType)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Version</dt>
          <dd>{template.version}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Jurisdiction</dt>
          <dd>{template.jurisdiction ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last legal review</dt>
          <dd>{formatDate(template.lastLegalReviewAt)}</dd>
        </div>
      </dl>
      <Card className="mt-6">
        <p className="eyebrow">Stored language</p>
        <p className="mt-2 whitespace-pre-wrap text-sm">{template.body ?? "No language stored yet."}</p>
      </Card>
      {template.notes ? (
        <Card className="mt-4">
          <p className="eyebrow">Internal notes</p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{template.notes}</p>
        </Card>
      ) : null}
      <div className="mt-6">
        <ButtonLink href="/app/legal/templates">All templates</ButtonLink>
      </div>
    </PageShell>
  );
}
