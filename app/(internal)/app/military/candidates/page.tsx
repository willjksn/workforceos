import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { listMilitaryCandidates } from "@/lib/repositories/military";
import { can } from "@/lib/rbac/permissions";
import { DataTable, EmptyState, PageHeader, PageShell, StatusBadge, formatLabel } from "../../_components/ui";
import { MilitarySubnav } from "../_components/military-subnav";

function availabilityTone(value: string) {
  if (value === "available_now") return "success" as const;
  if (value === "passive") return "teal" as const;
  if (value === "not_looking") return "warning" as const;
  if (value === "do_not_contact") return "danger" as const;
  return "neutral" as const;
}

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
      {rows.length === 0 ? (
        <EmptyState title="No military-linked candidates.">
          These people are the same Talent Network records used in recruiting—not a second database.
        </EmptyState>
      ) : (
        <DataTable columns={["Candidate", "Branch / occupation", "Rank", "Location", "Availability"]}>
          {rows.map((row) => (
            <tr key={row.candidate.id}>
              <td>
                <Link className="font-medium text-navy" href={`/app/talent/${row.candidate.id}`}>
                  {presentCandidate(row.candidate, canReadPii).fullName}
                </Link>
              </td>
              <td>
                {formatLabel(row.occupation.branch)} {row.occupation.code}
              </td>
              <td>{row.experience.rank ?? row.experience.payGrade ?? "—"}</td>
              <td>{[row.candidate.city, row.candidate.region].filter(Boolean).join(", ") || "—"}</td>
              <td>
                <StatusBadge tone={availabilityTone(row.candidate.availability)}>
                  {formatLabel(row.candidate.availability)}
                </StatusBadge>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
