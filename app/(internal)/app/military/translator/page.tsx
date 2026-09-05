import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import {
  listMilitaryOccupations,
  reverseSearchCivilianToMilitary,
  translatorView,
} from "@/lib/repositories/military";
import {
  Card,
  EmptyState,
  FilterBar,
  PageHeader,
  PageShell,
  RecordList,
  RecordRow,
  SearchForm,
  SectionHeader,
  formatLabel,
  inputClassName,
} from "../../_components/ui";
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
      <div className="mt-8">
        <SectionHeader title="Mode A · Military to civilian" />
      </div>
      <FilterBar>
        <form className="flex flex-wrap gap-2" action="/app/military/translator">
          <select
            name="occupationId"
            defaultValue={occupationId ?? navyEm?.id ?? ""}
            className={`${inputClassName} max-w-xl`}
          >
            {occupations.map((occupation) => (
              <option key={occupation.id} value={occupation.id}>
                {formatLabel(occupation.branch)} {occupation.code} · {occupation.title}
              </option>
            ))}
          </select>
          <button className="rounded-[6px] border border-navy bg-surface px-4 py-2 text-sm font-medium text-navy" type="submit">
            Translate
          </button>
        </form>
      </FilterBar>
      {selected ? (
        <Card className="mt-4">
          <pre className="whitespace-pre-wrap font-sans text-sm">{selected.hiringManager.militaryExperience}</pre>
          <p className="mt-3 text-sm">Overall alignment: {selected.hiringManager.civilianTranslation.overallAlignment}</p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {selected.hiringManager.roles.map((role) => (
              <li key={role.title}>
                {role.title} — {role.explanation}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            <Link className="font-medium text-navy underline decoration-border underline-offset-4 hover:decoration-teal" href={`/app/military/occupations/${selected.bundle.occupation.id}`}>
              Open occupation record
            </Link>
          </p>
        </Card>
      ) : (
        <EmptyState title="Choose a military occupation.">
          Translation is assembled from stored mappings. Unreviewed drafts are not hiring-manager copy.
        </EmptyState>
      )}
      <div className="mt-10">
        <SectionHeader title="Mode B · Civilian to military" />
      </div>
      <FilterBar>
        <SearchForm
          action="/app/military/translator"
          q={reverse}
          queryName="reverse"
          placeholder="Civilian role, e.g. Electrical Technician"
          className=""
          submitLabel="Reverse search"
        />
      </FilterBar>
      {reverseHits.length === 0 ? (
        reverse?.trim() ? (
          <EmptyState title="No stored reverse mappings.">Results come from reviewed mappings only.</EmptyState>
        ) : null
      ) : (
        <RecordList className="mt-4">
          {reverseHits.map((row) => (
            <RecordRow
              key={row.mapping.id}
              href={`/app/military/occupations/${row.military.id}`}
              title={`${row.civilian.title} → ${row.military.branch} ${row.military.code}`}
              meta={`${formatLabel(row.mapping.reviewStatus)}${row.mapping.explanation ? ` · ${row.mapping.explanation}` : ""}`}
            />
          ))}
        </RecordList>
      )}
    </PageShell>
  );
}
