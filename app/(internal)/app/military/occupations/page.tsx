import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { listMilitaryOccupations } from "@/lib/repositories/military";
import {
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  PageShell,
  SearchForm,
  StatusBadge,
  formatLabel,
  inputClassName,
} from "../../_components/ui";
import { MilitarySubnav } from "../_components/military-subnav";

const BRANCHES = ["army", "navy", "air_force", "marine_corps", "coast_guard", "space_force"] as const;

export default async function MilitaryOccupationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; branch?: string }>;
}) {
  await requireAppPermission("military.read");
  const { q, branch } = await searchParams;
  const occupations = await listMilitaryOccupations(q, branch);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Military talent"
        title="Occupation library"
        description="MOS, ratings, AFSC, and specialty records. Development samples are labeled and are not production extracts."
      />
      <MilitarySubnav active="/app/military/occupations" />
      <FilterBar>
        <SearchForm action="/app/military/occupations" q={q} placeholder="Code or title" className="">
          <select name="branch" defaultValue={branch ?? ""} className={`${inputClassName} max-w-xs`}>
            <option value="">All branches</option>
            {BRANCHES.map((item) => (
              <option key={item} value={item}>
                {formatLabel(item)}
              </option>
            ))}
          </select>
        </SearchForm>
      </FilterBar>
      {occupations.length === 0 ? (
        <EmptyState title="No occupations match.">Try another code, title, or branch.</EmptyState>
      ) : (
        <DataTable columns={["Code", "Title", "Branch", "Source"]}>
          {occupations.map((occupation) => (
            <tr key={occupation.id}>
              <td>
                <Link className="font-medium text-navy" href={`/app/military/occupations/${occupation.id}`}>
                  {occupation.code}
                </Link>
              </td>
              <td>{occupation.title}</td>
              <td>{formatLabel(occupation.branch)}</td>
              <td>
                <StatusBadge>{occupation.source ?? occupation.mappingQuality}</StatusBadge>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
