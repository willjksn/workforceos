import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { listMilitaryInstallations } from "@/lib/repositories/military";
import { PageHeader, PageShell, formatLabel } from "../../_components/ui";
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
      <form action="/app/military/installations" className="mt-6 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Installation or state" className="w-full max-w-md rounded-[6px] border border-border px-3 py-2 text-sm" />
        <button className="rounded-[6px] border border-navy px-4 py-2 text-sm" type="submit">Search</button>
      </form>
      <table className="mt-4 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">Installation</th>
            <th>Branch</th>
            <th>City / state</th>
            <th>Coordinates</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border">
              <td className="py-2">
                <Link className="underline" href={`/app/military/installations/${row.id}`}>{row.name}</Link>
              </td>
              <td>{row.branch ? formatLabel(row.branch) : "—"}</td>
              <td>{[row.city, row.region].filter(Boolean).join(", ") || "—"}</td>
              <td>{row.latitude && row.longitude ? `${row.latitude}, ${row.longitude}` : "not recorded"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  );
}
