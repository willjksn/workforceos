import { notFound } from "next/navigation";

import { requireAppPermission } from "@/lib/auth/guard";
import { getMilitaryInstallation } from "@/lib/repositories/military";
import { PageHeader, PageShell, formatLabel } from "../../../_components/ui";
import { MilitarySubnav } from "../../_components/military-subnav";

export default async function InstallationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAppPermission("military.read");
  const { id } = await params;
  const bundle = await getMilitaryInstallation(id);
  if (!bundle) notFound();
  const { installation } = bundle;

  return (
    <PageShell>
      <PageHeader title={installation.name} description={`${installation.city ?? ""} ${installation.region ?? ""}`.trim()} />
      <MilitarySubnav active="/app/military/installations" />
      <p className="mt-4 text-sm">Source {installation.source ?? "development fixture"}. Coordinate source {installation.coordinateSource ?? "not recorded"}.</p>
      <p className="mt-2 text-sm text-muted-foreground">{installation.transitionRelevance ?? "Transition relevance not recorded."}</p>
      <h2 className="mt-8 section-title">Associated occupations</h2>
      <ul className="mt-3 list-disc pl-5 text-sm">
        {bundle.occupations.map(({ occupation, link }) => (
          <li key={link.id}>
            {formatLabel(occupation.branch)} {occupation.code} · {occupation.title} · {link.presenceLevel} · {formatLabel(link.reviewStatus)}
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
