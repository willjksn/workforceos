import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { listNurtureCandidates } from "@/lib/repositories/talent";
import { can } from "@/lib/rbac/permissions";
import { EmptyState, PageHeader, PageShell, RecordList, RecordRow } from "../../_components/ui";

export default async function NurturePage() {
  const principal = await requireAppPermission("candidates.read");
  const canReadPii = can(principal, "candidate_pii.read");
  const rows = (await listNurtureCandidates(principal.organizationId)).map(({ candidate }) =>
    presentCandidate(candidate, canReadPii),
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Talent Network / Rediscovery"
        title="Nurture"
        description="Candidates in the nurture pool. Membership does not duplicate the person."
      />
      {rows.length === 0 ? (
        <EmptyState title="No candidates in nurture.">
          Add someone to the nurture pool from their candidate record. They remain one Talent Network person.
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
