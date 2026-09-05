import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { clientNeedInstallationTargets, occupationInstallationMap, listMilitaryOccupations } from "@/lib/repositories/military";
import { PageHeader, PageShell, formatLabel } from "../../_components/ui";
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
      <form className="mt-6 flex flex-wrap gap-2" action="/app/military/installation-mapping">
        <select name="occupationId" defaultValue={occupationId ?? ""} className="rounded-[6px] border border-border px-3 py-2 text-sm">
          <option value="">Military occupation</option>
          {occupations.map((occupation) => (
            <option key={occupation.id} value={occupation.id}>{occupation.code} · {occupation.title}</option>
          ))}
        </select>
        <input name="civilian" defaultValue={civilian} placeholder="Civilian job, e.g. Industrial Electrical Technician" className="min-w-[16rem] rounded-[6px] border border-border px-3 py-2 text-sm" />
        <button className="rounded-[6px] border border-navy px-4 py-2 text-sm" type="submit">Map</button>
      </form>
      {occupationMap ? (
        <section className="mt-8">
          <h2 className="section-title">{occupationMap.occupation.title}</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-2">Installation</th>
                <th>Presence</th>
                <th>Why</th>
                <th>Review</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {occupationMap.installations.map((row) => (
                <tr key={row.link.id} className="border-b border-border">
                  <td className="py-2">
                    <Link className="underline" href={`/app/military/installations/${row.installation.id}`}>{row.installation.name}</Link>
                  </td>
                  <td>{row.relevance}</td>
                  <td>{row.why ?? "—"}</td>
                  <td>{formatLabel(row.reviewStatus)}</td>
                  <td>{row.source ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {targets.length > 0 ? (
        <section className="mt-10">
          <h2 className="section-title">Client need targeting</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-2">Military occupation</th>
                <th>Installation</th>
                <th>Rank score</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((row) => (
                <tr key={`${row.military.id}-${row.installation.id}`} className="border-b border-border">
                  <td className="py-2">{row.military.code} · {row.military.title}</td>
                  <td>{row.installation.name}</td>
                  <td>{Math.round(row.rankScore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </PageShell>
  );
}
