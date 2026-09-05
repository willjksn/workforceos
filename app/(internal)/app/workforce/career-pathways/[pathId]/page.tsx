import { notFound } from "next/navigation";

import { requireAppPermission } from "@/lib/auth/guard";
import { getCareerPath } from "@/lib/repositories/workforce";
import { PageHeader, PageShell } from "../../../_components/ui";
import { WorkforceSubnav } from "../../_components/workforce-subnav";

export default async function CareerPathwayDetailPage({
  params,
}: {
  params: Promise<{ pathId: string }>;
}) {
  const principal = await requireAppPermission("career_paths.read");
  const { pathId } = await params;
  const row = await getCareerPath(pathId, principal.organizationId);
  if (!row) notFound();
  return (
    <PageShell>
      <PageHeader eyebrow="Career pathway" title={row.path.name} description={row.path.description ?? "Sequential and lateral moves are supported."} />
      <WorkforceSubnav active="/app/workforce/career-pathways" />
      <ol className="mt-6 space-y-3">
        {row.levels.map((level) => (
          <li key={level.id} className="rounded-[8px] border border-card-border bg-card px-4 py-3">
            <p className="font-medium text-navy">{level.sequence}. {level.title}</p>
            <p className="text-sm text-muted-foreground">{level.experience ?? "Experience not specified"} · {level.expectedTimeMonths ?? "—"} months</p>
            {level.compensationBand ? <p className="text-sm">Compensation band (client-supplied): {level.compensationBand}</p> : null}
          </li>
        ))}
      </ol>
    </PageShell>
  );
}
