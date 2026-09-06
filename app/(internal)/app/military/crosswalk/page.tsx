import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { reverseSearchCivilianToMilitary } from "@/lib/repositories/military";
import {
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  PageShell,
  SearchForm,
  StatusBadge,
  formatLabel,
} from "../../_components/ui";
import { MilitarySubnav } from "../_components/military-subnav";

export default async function CrosswalkPage({
  searchParams,
}: {
  searchParams: Promise<{ reverse?: string }>;
}) {
  await requireAppPermission("military.read");
  const { reverse } = await searchParams;
  const hits = reverse?.trim() ? await reverseSearchCivilianToMilitary(reverse) : [];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Military talent"
        title="Civilian crosswalk"
        description="Reverse lookup from a civilian occupation to stored military mappings. One civilian role can map to many military occupations."
      />
      <MilitarySubnav active="/app/military/crosswalk" />
      <FilterBar>
        <SearchForm
          action="/app/military/crosswalk"
          q={reverse}
          queryName="reverse"
          placeholder="Civilian title or code"
          className=""
        />
      </FilterBar>
      {hits.length === 0 ? (
        <EmptyState title={reverse?.trim() ? "No stored mappings match." : "Enter a civilian occupation."}>
          {reverse?.trim()
            ? "Results come from reviewed mappings, not guessed shortcuts."
            : "One civilian role can map to many military occupations."}
        </EmptyState>
      ) : (
        <DataTable columns={["Civilian", "Military", "Review", "Source"]}>
          {hits.map((row) => (
            <tr key={row.mapping.id}>
              <td>{row.civilian.title}</td>
              <td>
                <Link className="font-medium text-navy" href={`/app/military/occupations/${row.military.id}`}>
                  {formatLabel(row.military.branch)} {row.military.code}
                </Link>
              </td>
              <td>
                <StatusBadge>{formatLabel(row.mapping.reviewStatus)}</StatusBadge>
              </td>
              <td>{row.mapping.source ?? row.mapping.mappingQuality}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
