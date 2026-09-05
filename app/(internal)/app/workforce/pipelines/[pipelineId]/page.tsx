import { notFound } from "next/navigation";

import { requireAppPermission } from "@/lib/auth/guard";
import { getTalentPipeline } from "@/lib/repositories/workforce";
import { PageHeader, PageShell, formatLabel } from "../../../_components/ui";
import { WorkforceSubnav } from "../../_components/workforce-subnav";

export default async function TalentPipelineDetailPage({
  params,
}: {
  params: Promise<{ pipelineId: string }>;
}) {
  const principal = await requireAppPermission("pipelines.read");
  const { pipelineId } = await params;
  const row = await getTalentPipeline(pipelineId, principal.organizationId);
  if (!row) notFound();
  return (
    <PageShell>
      <PageHeader
        eyebrow="Talent pipeline"
        title={row.pipeline.name}
        description={`${row.companyName} · ${row.roleTitle}. Planned capacity is not a promise of candidates without source evidence.`}
      />
      <WorkforceSubnav active="/app/workforce/pipelines" />
      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Source</dt><dd>{formatLabel(row.pipeline.sourceType)}</dd></div>
        <div><dt className="text-muted-foreground">Status</dt><dd>{formatLabel(row.pipeline.status)}</dd></div>
        <div><dt className="text-muted-foreground">Target / year</dt><dd>{row.pipeline.targetCandidatesPerYear}</dd></div>
        <div><dt className="text-muted-foreground">Conversion assumption</dt><dd>{row.pipeline.expectedConversionPercent ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">Time to ready</dt><dd>{row.pipeline.expectedTimeToReadyDays ?? "—"} days</dd></div>
        <div><dt className="text-muted-foreground">Budget assumption</dt><dd>{row.pipeline.budgetAssumption ?? "Not calculated without source data"}</dd></div>
      </dl>
    </PageShell>
  );
}
