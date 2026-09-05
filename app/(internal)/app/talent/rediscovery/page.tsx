import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { listRediscoveryCandidates } from "@/lib/repositories/talent";
import { can } from "@/lib/rbac/permissions";
import { DataTable, EmptyState, PageHeader, PageShell, formatDate } from "../../_components/ui";

export default async function RediscoveryPage() {
  const principal = await requireAppPermission("candidates.read");
  const canReadPii = can(principal, "candidate_pii.read");
  const rows = (await listRediscoveryCandidates(principal.organizationId)).map((candidate) =>
    presentCandidate(candidate, canReadPii),
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Talent Network / Rediscovery"
        title="Rediscovery"
        description="Candidates not contacted in 90 days, excluding do-not-contact records."
      />
      {rows.length === 0 ? (
        <EmptyState title="No rediscovery queue right now.">
          People appear here when they have not been contacted in 90 days and are still eligible to reach.
        </EmptyState>
      ) : (
        <DataTable columns={["Name", "Title", "Last contacted"]}>
          {rows.map((candidate) => (
            <tr key={candidate.id}>
              <td>
                <Link className="font-medium text-navy" href={`/app/talent/${candidate.id}`}>
                  {candidate.fullName}
                </Link>
              </td>
              <td>{candidate.currentTitle ?? "—"}</td>
              <td>{formatDate(candidate.lastContactedAt)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
