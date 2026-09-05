import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { clientNeedInstallationTargets, occupationInstallationMap, listMilitaryOccupations } from "@/lib/repositories/military";
import {
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  PageShell,
  SearchForm,
  SectionHeader,
  StatusBadge,
  formatLabel,
  inputClassName,
} from "../../_components/ui";
import { MilitarySubnav } from "../_components/military-subnav";

export default async function InstallationMappingPage({
  searchParams,
}: {
  searchParams: Promise<{ occupationId?: string; civilian?: string }>;
}) {
  await requireAppPermission("military.read");
  const { occupationId, civilian } = await searchParams;
  const occupations = await listMilitaryOccupations();
  const occupationMap = occupationId ? await occupationInstallationMap(occupationId) : null;
  const targets = civilian?.trim() ? await clientNeedInstallationTargets(civilian) : [];

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Military talent"
        title="Installation mapping"
        description="Occupation → likely installations, or civilian need → occupations → installations. Ranked from stored compatibility, presence, transition notes, and known candidate supply. Unsupported guesses are not shown."
      />
      <MilitarySubnav active="/app/military/installation-mapping" />
      <FilterBar>
        <SearchForm
          action="/app/military/installation-mapping"
          q={civilian}
          queryName="civilian"
          placeholder="Civilian job, e.g. Industrial Electrical Technician"
          className=""
          submitLabel="Map"
        >
          <select name="occupationId" defaultValue={occupationId ?? ""} className={`${inputClassName} max-w-xs`}>
            <option value="">Military occupation</option>
            {occupations.map((occupation) => (
              <option key={occupation.id} value={occupation.id}>
                {occupation.code} · {occupation.title}
              </option>
            ))}
          </select>
        </SearchForm>
      </FilterBar>
      {occupationMap ? (
        <section className="mt-8">
          <SectionHeader title={occupationMap.occupation.title} />
          {occupationMap.installations.length === 0 ? (
            <EmptyState title="No stored installation links.">Unsupported guesses are not shown.</EmptyState>
          ) : (
            <DataTable className="mt-4" columns={["Installation", "Presence", "Why", "Review", "Source"]}>
              {occupationMap.installations.map((row) => (
                <tr key={row.link.id}>
                  <td>
                    <Link className="font-medium text-navy" href={`/app/military/installations/${row.installation.id}`}>
                      {row.installation.name}
                    </Link>
                  </td>
                  <td>{row.relevance}</td>
                  <td>{row.why ?? "—"}</td>
                  <td>
                    <StatusBadge>{formatLabel(row.reviewStatus)}</StatusBadge>
                  </td>
                  <td>{row.source ?? "—"}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>
      ) : null}
      {targets.length > 0 ? (
        <section className="mt-10">
          <SectionHeader title="Client need targeting" />
          <DataTable className="mt-4" columns={["Military occupation", "Installation", "Rank score"]}>
            {targets.map((row) => (
              <tr key={`${row.military.id}-${row.installation.id}`}>
                <td>
                  {row.military.code} · {row.military.title}
                </td>
                <td>{row.installation.name}</td>
                <td>{Math.round(row.rankScore)}</td>
              </tr>
            ))}
          </DataTable>
        </section>
      ) : null}
      {!occupationMap && targets.length === 0 ? (
        <EmptyState title="Choose an occupation or civilian need.">
          Rankings come from stored compatibility, presence, transition notes, and known candidate supply.
        </EmptyState>
      ) : null}
    </PageShell>
  );
}
