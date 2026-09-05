import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { getTalentPool } from "@/lib/repositories/talent";
import { can } from "@/lib/rbac/permissions";
import { PageHeader } from "../../../_components/ui";

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
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title={record.pool.name}
        description={`${record.pool.poolType} pool · ${record.pool.slug}`}
        actions={
          <Link className="rounded-full border px-4 py-2 text-sm" href="/app/talent/pools">
            All pools
          </Link>
        }
      />
      {record.pool.description ? (
        <p className="mt-3 text-sm text-zinc-600">{record.pool.description}</p>
      ) : null}
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">Candidate</th>
            <th>Title</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {record.members.map(({ candidate, membership }) => {
            const presented = presentCandidate(candidate, canReadPii);
            return (
              <tr key={membership.id} className="border-b">
                <td className="py-2">
                  <Link className="underline" href={`/app/talent/${candidate.id}`}>
                    {presented.fullName}
                  </Link>
                </td>
                <td>{presented.currentTitle ?? "—"}</td>
                <td>{membership.source}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
