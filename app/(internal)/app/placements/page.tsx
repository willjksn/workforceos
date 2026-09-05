import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { listGuarantees, listPlacements } from "@/lib/repositories/recruiting-delivery";
import { can } from "@/lib/rbac/permissions";
import { PageHeader, PageShell, formatDate, formatLabel } from "../_components/ui";
import { StatusBadge } from "@/components/ui/display";

export default async function PlacementsPage() {
  const principal = await requireAppPermission("placements.read");
  const placements = await listPlacements(principal.organizationId);
  const guarantees = await listGuarantees(principal.organizationId);
  const canReadPii = can(principal, "candidate_pii.read");

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Recruiting"
        title="Placements and guarantees"
        description="Guarantee windows are calculated from search-agreement days. Finance invoicing is a later billing hook only."
      />
      <h2 className="mt-8 section-title">Placements</h2>
      <table className="mt-4 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">Candidate</th>
            <th>Job</th>
            <th>Company</th>
            <th>Start</th>
            <th>Fee</th>
            <th>Guarantee days</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {placements.map((row) => (
            <tr key={row.placement.id} className="border-b border-border">
              <td className="py-2">{presentCandidate(row.candidate, canReadPii).fullName}</td>
              <td>{row.job.title}</td>
              <td>{row.companyName ?? "—"}</td>
              <td>{formatDate(row.placement.startDate)}</td>
              <td>{row.placement.placementFee ?? "—"}</td>
              <td>{row.placement.guaranteeDays ?? "—"}</td>
              <td><StatusBadge>{formatLabel(row.placement.status)}</StatusBadge></td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="mt-10 section-title">Guarantees</h2>
      <table className="mt-4 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">Candidate</th>
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
              <td>{row.guarantee.startsOn} → {row.guarantee.endsOn}</td>
              <td>{row.guarantee.guaranteeDays}</td>
              <td><StatusBadge tone={row.guarantee.status === "expiring_soon" ? "warning" : "navy"}>{formatLabel(row.guarantee.status)}</StatusBadge></td>
              <td>{row.guarantee.sourceTerms ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  );
}
