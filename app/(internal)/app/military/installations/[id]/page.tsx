import { requireAppPermission } from "@/lib/auth/guard";
import { getMilitaryInstallation } from "@/lib/repositories/military";
import { notFound } from "next/navigation";
import { EmptyState, PageHeader, PageShell, RecordList, RecordRow, StatusBadge, formatLabel } from "../../../_components/ui";
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
      <PageHeader
        eyebrow="Military talent"
        title={installation.name}
        description={`${[installation.city, installation.region].filter(Boolean).join(", ") || "Location not recorded"}`}
      />
      <MilitarySubnav active="/app/military/installations" />
      <p className="mt-4 text-sm text-muted-foreground">
        Source {installation.source ?? "development fixture"}. Coordinate source {installation.coordinateSource ?? "not recorded"}.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{installation.transitionRelevance ?? "Transition relevance not recorded."}</p>
      <h2 className="mt-8 section-title">Associated occupations</h2>
      {bundle.occupations.length === 0 ? (
        <EmptyState title="No occupations linked.">Presence is stored only when a mapping exists.</EmptyState>
      ) : (
        <RecordList>
          {bundle.occupations.map(({ occupation, link }) => (
            <RecordRow
              key={link.id}
              href={`/app/military/occupations/${occupation.id}`}
              title={`${formatLabel(occupation.branch)} ${occupation.code} · ${occupation.title}`}
              meta={formatLabel(link.presenceLevel)}
              trailing={<StatusBadge>{formatLabel(link.reviewStatus)}</StatusBadge>}
            />
          ))}
        </RecordList>
      )}
    </PageShell>
  );
}
