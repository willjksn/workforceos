import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { listMilitaryOccupations } from "@/lib/repositories/military";
import { PageHeader, PageShell, formatLabel } from "../../_components/ui";
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
        description="Stored MOS, ratings, AFSC, and specialty records. Development fixtures are labeled and are not authoritative production extracts."
      />
      <MilitarySubnav active="/app/military/occupations" />
      <form action="/app/military/occupations" className="mt-6 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Code or title" className="w-full max-w-md rounded-[6px] border border-border px-3 py-2 text-sm" />
        <select name="branch" defaultValue={branch ?? ""} className="rounded-[6px] border border-border px-3 py-2 text-sm">
          <option value="">All branches</option>
          {BRANCHES.map((item) => (
            <option key={item} value={item}>{formatLabel(item)}</option>
          ))}
        </select>
        <button className="rounded-[6px] border border-navy px-4 py-2 text-sm" type="submit">Search</button>
      </form>
      <table className="mt-4 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">Code</th>
            <th>Title</th>
            <th>Branch</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {occupations.map((occupation) => (
            <tr key={occupation.id} className="border-b border-border">
              <td className="py-2">
                <Link className="text-navy underline" href={`/app/military/occupations/${occupation.id}`}>{occupation.code}</Link>
              </td>
              <td>{occupation.title}</td>
              <td>{formatLabel(occupation.branch)}</td>
              <td>{occupation.source ?? occupation.mappingQuality}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  );
}
