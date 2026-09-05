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

export default async function ReverseSearchPage({
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
        title="Reverse search"
        description="Civilian role → stored military occupations. Compatibility, gaps, and installations come from reviewed mappings, not invented shortcuts."
      />
      <MilitarySubnav active="/app/military/reverse" />
      <FilterBar>
        <SearchForm
          action="/app/military/reverse"
          q={reverse}
          queryName="reverse"
          placeholder="Civilian role, e.g. Electrical Technician"
          className=""
        />
      </FilterBar>
      {hits.length === 0 ? (
        <EmptyState title={reverse?.trim() ? "No stored mappings match that civilian role." : "Enter a civilian occupation."}>
          Compatibility and gaps come from reviewed mappings, not invented shortcuts.
        </EmptyState>
      ) : (
        <DataTable columns={["Civilian", "Military", "Compatibility", "Gaps", "Review", "Source"]}>
          {hits.map((row) => (
            <tr key={row.mapping.id} className="align-top">
              <td>{row.civilian.title}</td>
              <td>
                <Link className="font-medium text-navy" href={`/app/military/occupations/${row.military.id}`}>
                  {formatLabel(row.military.branch)} {row.military.code} · {row.military.title}
                </Link>
              </td>
              <td>{row.mapping.compatibilityScore ?? "—"}</td>
              <td className="max-w-xs">{row.mapping.gaps ?? "—"}</td>
              <td>
                <StatusBadge>{formatLabel(row.mapping.reviewStatus)}</StatusBadge>
              </td>
              <td>{row.mapping.source ?? "—"}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
