import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { reverseSearchCivilianToMilitary } from "@/lib/repositories/military";
import { PageHeader, PageShell, formatLabel } from "../../_components/ui";
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
      <form action="/app/military/crosswalk" className="mt-6 flex gap-2">
        <input name="reverse" defaultValue={reverse} placeholder="Civilian title or code" className="w-full max-w-md rounded-[6px] border border-border px-3 py-2 text-sm" />
        <button className="rounded-[6px] border border-navy px-4 py-2 text-sm" type="submit">Search</button>
      </form>
      <table className="mt-4 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">Civilian</th>
            <th>Military</th>
            <th>Review</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {hits.map((row) => (
            <tr key={row.mapping.id} className="border-b border-border">
              <td className="py-2">{row.civilian.title}</td>
              <td>
                <Link className="underline" href={`/app/military/occupations/${row.military.id}`}>
                  {formatLabel(row.military.branch)} {row.military.code}
                </Link>
              </td>
              <td>{formatLabel(row.mapping.reviewStatus)}</td>
              <td>{row.mapping.source ?? row.mapping.mappingQuality}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  );
}
