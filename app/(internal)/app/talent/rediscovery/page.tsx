import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { listRediscoveryCandidates } from "@/lib/repositories/talent";
import { can } from "@/lib/rbac/permissions";
import { EmptyState, PageHeader, formatDate } from "../../_components/ui";

export default async function RediscoveryPage() {
  const principal = await requireAppPermission("candidates.read");
  const canReadPii = can(principal, "candidate_pii.read");
  const rows = (await listRediscoveryCandidates(principal.organizationId)).map((candidate) =>
    presentCandidate(candidate, canReadPii),
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Rediscovery"
        description="Candidates not contacted in 90 days, excluding do-not-contact records."
      />
      {rows.length === 0 ? (
        <EmptyState>No rediscovery queue right now.</EmptyState>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2">Name</th>
              <th>Title</th>
              <th>Last contacted</th>
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
                <td>{formatDate(candidate.lastContactedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
