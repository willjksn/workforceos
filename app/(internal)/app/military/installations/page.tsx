import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { listMilitaryInstallations } from "@/lib/repositories/military";
import {
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  PageShell,
  SearchForm,
  formatLabel,
} from "../../_components/ui";
import { MilitarySubnav } from "../_components/military-subnav";

export default async function InstallationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAppPermission("military.read");
  const { q } = await searchParams;
  const rows = await listMilitaryInstallations(q);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Military talent"
        title="Installations"
        description="List and geo fields only. Interactive map is deferred. Coordinates are stored only when a fixture source is recorded."
      />
      <MilitarySubnav active="/app/military/installations" />
      <FilterBar>
        <SearchForm action="/app/military/installations" q={q} placeholder="Installation or state" className="" />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState title="No installations match.">Try another name or state.</EmptyState>
      ) : (
        <DataTable columns={["Installation", "Branch", "City / state", "Coordinates"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link className="font-medium text-navy" href={`/app/military/installations/${row.id}`}>
                  {row.name}
                </Link>
              </td>
              <td>{row.branch ? formatLabel(row.branch) : "—"}</td>
              <td>{[row.city, row.region].filter(Boolean).join(", ") || "—"}</td>
              <td>{row.latitude && row.longitude ? `${row.latitude}, ${row.longitude}` : "not recorded"}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
