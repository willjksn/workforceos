import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { listGuarantees } from "@/lib/repositories/recruiting-delivery";
import { can } from "@/lib/rbac/permissions";
import { PageHeader, PageShell, formatLabel } from "../_components/ui";
import { StatusBadge } from "@/components/ui/display";

export default async function GuaranteesPage() {
  const principal = await requireAppPermission("placements.read");
  const guarantees = await listGuarantees(principal.organizationId);
  const canReadPii = can(principal, "candidate_pii.read");

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Recruiting"
        title="Guarantees"
        description="Windows are calculated from search-agreement days. Terms are never invented at placement time."
      />
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">Candidate</th>
            <th>Job</th>
            <th>Window</th>
            <th>Days</th>
            <th>Status</th>
            <th>Source terms</th>
          </tr>
        </thead>
        <tbody>
          {guarantees.map((row) => (
            <tr key={row.guarantee.id} className="border-b border-border">
              <td className="py-2">{presentCandidate(row.candidate, canReadPii).fullName}</td>
              <td>{row.job.title}</td>
              <td>{row.guarantee.startsOn} → {row.guarantee.endsOn}</td>
              <td>{row.guarantee.guaranteeDays}</td>
              <td>
                <StatusBadge tone={row.guarantee.status === "expiring_soon" ? "warning" : "navy"}>
                  {formatLabel(row.guarantee.status)}
                </StatusBadge>
              </td>
              <td>{row.guarantee.sourceTerms ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  );
}
