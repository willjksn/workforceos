import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { listSilverMedalists } from "@/lib/repositories/talent";
import { can } from "@/lib/rbac/permissions";
import { EmptyState, PageHeader, PageShell, RecordList, RecordRow } from "../../_components/ui";

export default async function SilverMedalistsPage() {
  const principal = await requireAppPermission("candidates.read");
  const canReadPii = can(principal, "candidate_pii.read");
  const rows = (await listSilverMedalists(principal.organizationId)).map((candidate) =>
    presentCandidate(candidate, canReadPii),
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Talent Network / Rediscovery"
        title="Silver Medalists"
        description="Strong prior applicants remain rediscoverable. This is a designation, not a duplicate candidate."
      />
      {rows.length === 0 ? (
        <EmptyState title="No silver medalists recorded.">
          Designate a strong prior applicant from the candidate record. They stay one person in the Talent Network.
        </EmptyState>
      ) : (
        <RecordList className="mt-6">
          {rows.map((candidate) => (
            <RecordRow
              key={candidate.id}
              href={`/app/talent/${candidate.id}`}
              title={candidate.fullName}
              meta={candidate.currentTitle ?? undefined}
            />
          ))}
        </RecordList>
      )}
    </PageShell>
  );
}
