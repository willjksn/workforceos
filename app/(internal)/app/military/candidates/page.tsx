import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { listMilitaryCandidates } from "@/lib/repositories/military";
import { can } from "@/lib/rbac/permissions";
import { PageHeader, PageShell, formatLabel } from "../../_components/ui";
import { MilitarySubnav } from "../_components/military-subnav";

export default async function MilitaryCandidatesPage() {
  const principal = await requireAppPermission("military.read");
  const rows = await listMilitaryCandidates(principal.organizationId);
  const canReadPii = can(principal, "candidate_pii.read");

  return (
    <PageShell>
      <PageHeader
        eyebrow="Military talent"
        title="Military candidates"
        description="A filtered Talent Network view. These people are the same candidate records used in recruiting—not a separate military database."
      />
      <MilitarySubnav active="/app/military/candidates" />
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">Candidate</th>
            <th>Branch / occupation</th>
            <th>Rank</th>
            <th>Location</th>
            <th>Availability</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.candidate.id} className="border-b border-border">
              <td className="py-2">
                <Link className="underline" href={`/app/talent/${row.candidate.id}`}>
                  {presentCandidate(row.candidate, canReadPii).fullName}
                </Link>
              </td>
              <td>{formatLabel(row.occupation.branch)} {row.occupation.code}</td>
              <td>{row.experience.rank ?? row.experience.payGrade ?? "—"}</td>
              <td>{[row.candidate.city, row.candidate.region].filter(Boolean).join(", ") || "—"}</td>
              <td>{formatLabel(row.candidate.availability)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  );
}
