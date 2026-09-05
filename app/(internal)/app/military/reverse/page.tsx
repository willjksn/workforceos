import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { reverseSearchCivilianToMilitary } from "@/lib/repositories/military";
import { PageHeader, PageShell, formatLabel } from "../../_components/ui";
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
      <form action="/app/military/reverse" className="mt-6 flex gap-2">
        <input
          name="reverse"
          defaultValue={reverse}
          placeholder="Civilian role, e.g. Electrical Technician"
          className="w-full max-w-md rounded-[6px] border border-border px-3 py-2 text-sm"
        />
        <button className="rounded-[6px] border border-navy px-4 py-2 text-sm" type="submit">
          Search
        </button>
      </form>
      {hits.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {reverse?.trim() ? "No stored mappings match that civilian role." : "Enter a civilian occupation to reverse-search."}
        </p>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2">Civilian</th>
              <th>Military</th>
              <th>Compatibility</th>
              <th>Gaps</th>
              <th>Review</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {hits.map((row) => (
              <tr key={row.mapping.id} className="border-b border-border align-top">
                <td className="py-2">{row.civilian.title}</td>
                <td>
                  <Link className="underline" href={`/app/military/occupations/${row.military.id}`}>
                    {formatLabel(row.military.branch)} {row.military.code} · {row.military.title}
                  </Link>
                </td>
                <td>{row.mapping.compatibilityScore ?? "—"}</td>
                <td className="max-w-xs">{row.mapping.gaps ?? "—"}</td>
                <td>{formatLabel(row.mapping.reviewStatus)}</td>
                <td>{row.mapping.source ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageShell>
  );
}
