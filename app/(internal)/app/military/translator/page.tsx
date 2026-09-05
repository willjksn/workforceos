import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import {
  listMilitaryOccupations,
  reverseSearchCivilianToMilitary,
  translatorView,
} from "@/lib/repositories/military";
import { PageHeader, PageShell, formatLabel } from "../../_components/ui";
import { Card } from "@/components/ui/display";
import { MilitarySubnav } from "../_components/military-subnav";

export default async function TranslatorPage({
  searchParams,
}: {
  searchParams: Promise<{ occupationId?: string; reverse?: string }>;
}) {
  await requireAppPermission("military.read");
  const { occupationId, reverse } = await searchParams;
  const occupations = await listMilitaryOccupations();
  const selected = occupationId ? await translatorView(occupationId) : null;
  const reverseHits = reverse?.trim() ? await reverseSearchCivilianToMilitary(reverse) : [];
  const navyEm = occupations.find((row) => row.code === "EM" && row.branch === "navy");

  return (
    <PageShell>
      <PageHeader
        eyebrow="Military talent"
        title="Skills translator"
        description="Military → civilian and civilian → military both read stored mappings. Unreviewed drafts are not hiring-manager copy."
      />
      <MilitarySubnav active="/app/military/translator" />
      <section className="mt-8">
        <h2 className="section-title">Mode A · Military to civilian</h2>
        <form className="mt-3 flex flex-wrap gap-2" action="/app/military/translator">
          <select name="occupationId" defaultValue={occupationId ?? navyEm?.id ?? ""} className="rounded-[6px] border border-border px-3 py-2 text-sm">
            {occupations.map((occupation) => (
              <option key={occupation.id} value={occupation.id}>
                {formatLabel(occupation.branch)} {occupation.code} · {occupation.title}
              </option>
            ))}
          </select>
          <button className="rounded-[6px] border border-navy px-4 py-2 text-sm" type="submit">Translate</button>
        </form>
        {selected ? (
          <Card className="mt-4">
            <pre className="whitespace-pre-wrap font-sans text-sm">{selected.hiringManager.militaryExperience}</pre>
            <p className="mt-3 text-sm">Overall alignment: {selected.hiringManager.civilianTranslation.overallAlignment}</p>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {selected.hiringManager.roles.map((role) => (
                <li key={role.title}>{role.title} — {role.explanation}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm">
              <Link className="underline" href={`/app/military/occupations/${selected.bundle.occupation.id}`}>Open occupation record</Link>
            </p>
          </Card>
        ) : null}
      </section>
      <section className="mt-10">
        <h2 className="section-title">Mode B · Civilian to military</h2>
        <form className="mt-3 flex gap-2" action="/app/military/translator">
          <input name="reverse" defaultValue={reverse} placeholder="Civilian role, e.g. Electrical Technician" className="w-full max-w-md rounded-[6px] border border-border px-3 py-2 text-sm" />
          <button className="rounded-[6px] border border-navy px-4 py-2 text-sm" type="submit">Reverse search</button>
        </form>
        {reverseHits.map((row) => (
          <p key={row.mapping.id} className="mt-3 text-sm">
            {row.civilian.title} → <Link className="underline" href={`/app/military/occupations/${row.military.id}`}>{row.military.branch} {row.military.code}</Link>
            {" "}· {formatLabel(row.mapping.reviewStatus)} · {row.mapping.explanation}
          </p>
        ))}
      </section>
    </PageShell>
  );
}
