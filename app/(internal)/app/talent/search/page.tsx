import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { searchActiveCandidates } from "@/lib/repositories/talent";
import { can } from "@/lib/rbac/permissions";
import { EmptyState, PageHeader, formatLabel, inputClassName } from "../../_components/ui";

const AVAILABILITY = ["unknown", "available_now", "passive", "not_looking", "do_not_contact"] as const;

export default async function TalentSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; availability?: string }>;
}) {
  const principal = await requireAppPermission("candidates.read");
  const canReadPii = can(principal, "candidate_pii.read");
  const { q, availability } = await searchParams;
  const availabilityFilter = AVAILABILITY.includes(availability as (typeof AVAILABILITY)[number])
    ? (availability as (typeof AVAILABILITY)[number])
    : undefined;
  const rows = (await searchActiveCandidates(principal.organizationId, q, availabilityFilter)).map((candidate) =>
    presentCandidate(candidate, canReadPii),
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Talent Search"
        description="Search the internal Talent Network. Restricted PII is hidden without candidate_pii.read."
      />
      <form action="/app/talent/search" className="mt-6 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name or title" className={`${inputClassName} max-w-md`} />
        <select name="availability" defaultValue={availabilityFilter ?? ""} className={`${inputClassName} max-w-xs`}>
          <option value="">Any availability</option>
          {AVAILABILITY.map((value) => (
            <option key={value} value={value}>
              {formatLabel(value)}
            </option>
          ))}
        </select>
        <button className="rounded border px-4 py-2 text-sm" type="submit">
          Search
        </button>
      </form>
      {rows.length === 0 ? (
        <EmptyState>No candidates match.</EmptyState>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2">Name</th>
              <th>Title</th>
              <th>Availability</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((candidate) => (
              <tr key={candidate.id} className="border-b">
                <td className="py-2">
                  <Link className="underline" href={`/app/talent/${candidate.id}`}>
                    {candidate.fullName}
                  </Link>
                </td>
                <td>{candidate.currentTitle ?? "—"}</td>
                <td>{formatLabel(candidate.availability)}</td>
                <td>{candidate.emailHidden ? "hidden" : (candidate.email ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
