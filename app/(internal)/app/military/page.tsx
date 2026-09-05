import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import {
  listMilitaryOccupations,
  reverseSearchCivilianToMilitary,
} from "@/lib/repositories/military";
import { PageHeader } from "../_components/ui";

const BRANCHES = [
  "army",
  "navy",
  "air_force",
  "marine_corps",
  "coast_guard",
  "space_force",
] as const;

export default async function MilitaryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; branch?: string; reverse?: string }>;
}) {
  await requireAppPermission("military.read");
  const { q, branch, reverse } = await searchParams;
  const reverseQuery = reverse?.trim() ?? "";
  const occupations = await listMilitaryOccupations(q, branch);
  const reverseHits = reverseQuery ? await reverseSearchCivilianToMilitary(reverseQuery) : [];

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Military talent translation"
        description="Query approved military-to-civilian mappings. Do not improvise occupation rules. Reverse search starts from a civilian role."
        actions={
          <Link
            className="rounded-full border px-4 py-2 text-sm"
            href="/app/services/military-talent-opportunity-assessment"
          >
            MTOA service
          </Link>
        }
      />

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Military occupations</h2>
        <form action="/app/military" className="mt-4 flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search code or title"
            className="w-full max-w-md rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          />
          <select
            name="branch"
            defaultValue={branch ?? ""}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          >
            <option value="">All branches</option>
            {BRANCHES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button className="rounded border px-4 py-2 text-sm" type="submit">
            Search
          </button>
        </form>
        {occupations.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">No military occupations match.</p>
        ) : (
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-2">Code</th>
                <th>Title</th>
                <th>Branch</th>
                <th>Classification</th>
              </tr>
            </thead>
            <tbody>
              {occupations.map((occupation) => (
                <tr key={occupation.id} className="border-b">
                  <td className="py-2">
                    <Link className="underline" href={`/app/military/${occupation.id}`}>
                      {occupation.code}
                    </Link>
                  </td>
                  <td>{occupation.title}</td>
                  <td>{occupation.branch}</td>
                  <td>{occupation.classificationType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Reverse civilian-to-military search</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Enter a civilian occupation title or code. Results come from stored mappings, not a live model.
        </p>
        <form action="/app/military" className="mt-3 flex gap-2">
          <input
            name="reverse"
            defaultValue={reverseQuery}
            placeholder="Civilian title or code"
            className="w-full max-w-md rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          />
          <button className="rounded border px-4 py-2 text-sm" type="submit">
            Reverse search
          </button>
        </form>
        {reverseQuery && reverseHits.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">No stored civilian mappings match.</p>
        ) : null}
        {reverseHits.length > 0 ? (
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-2">Civilian role</th>
                <th>Military occupation</th>
                <th>Explanation</th>
              </tr>
            </thead>
            <tbody>
              {reverseHits.map((row) => (
                <tr key={row.mapping.id} className="border-b align-top">
                  <td className="py-2">
                    {row.civilian.title}
                    {row.civilian.code ? ` (${row.civilian.code})` : ""}
                  </td>
                  <td>
                    <Link className="underline" href={`/app/military/${row.military.id}`}>
                      {row.military.branch} {row.military.code} · {row.military.title}
                    </Link>
                  </td>
                  <td className="max-w-sm">{row.mapping.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </main>
  );
}
