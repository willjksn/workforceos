import Link from "next/link";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";
import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { getTalentPool } from "@/lib/repositories/talent";
import { can } from "@/lib/rbac/permissions";
import {
  DataTable,
  EmptyState,
  PageHeader,
  PageShell,
  formatLabel,
} from "../../../_components/ui";

export default async function TalentPoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requireAppPermission("candidates.read");
  const { id } = await params;
  const record = await getTalentPool(id, principal.organizationId);
  if (!record) notFound();
  const canReadPii = can(principal, "candidate_pii.read");

  return (
    <PageShell>
      <PageHeader
        eyebrow="Talent Network / Pool"
        title={record.pool.name}
        description={`${formatLabel(record.pool.poolType)} · ${record.pool.slug}`}
        actions={<ButtonLink href="/app/talent/pools">All pools</ButtonLink>}
      />
      {record.pool.description ? (
        <p className="mt-4 text-sm text-muted-foreground">{record.pool.description}</p>
      ) : null}
      {record.members.length === 0 ? (
        <EmptyState title="No candidates in this pool.">
          Membership does not duplicate the person. Add members from a candidate record.
        </EmptyState>
      ) : (
        <DataTable columns={["Candidate", "Title", "Source"]}>
          {record.members.map(({ candidate, membership }) => {
            const presented = presentCandidate(candidate, canReadPii);
            return (
              <tr key={membership.id}>
                <td>
                  <Link className="font-medium text-navy" href={`/app/talent/${candidate.id}`}>
                    {presented.fullName}
                  </Link>
                </td>
                <td>{presented.currentTitle ?? "—"}</td>
                <td>{formatLabel(membership.source)}</td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </PageShell>
  );
}
