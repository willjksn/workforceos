import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { listSilverMedalists } from "@/lib/repositories/talent";
import { can } from "@/lib/rbac/permissions";
import { EmptyState, PageHeader } from "../../_components/ui";

export default async function SilverMedalistsPage() {
  const principal = await requireAppPermission("candidates.read");
  const canReadPii = can(principal, "candidate_pii.read");
  const rows = (await listSilverMedalists(principal.organizationId)).map((candidate) =>
    presentCandidate(candidate, canReadPii),
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Silver Medalists"
        description="Strong prior applicants remain rediscoverable. This is a designation, not a duplicate candidate."
      />
      {rows.length === 0 ? (
        <EmptyState>No silver medalists recorded.</EmptyState>
      ) : (
        <ul className="mt-6 space-y-2 text-sm">
          {rows.map((candidate) => (
            <li key={candidate.id}>
              <Link className="underline" href={`/app/talent/${candidate.id}`}>
                {candidate.fullName}
              </Link>
              {candidate.currentTitle ? ` · ${candidate.currentTitle}` : ""}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
