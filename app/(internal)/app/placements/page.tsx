import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { listGuarantees, listPlacements } from "@/lib/repositories/recruiting-delivery";
import { can } from "@/lib/rbac/permissions";
import {
  DataTable,
  EmptyState,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusBadge,
  formatDate,
  formatLabel,
} from "../_components/ui";

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
      <div className="mt-8">
        <SectionHeader title="Placements" />
      </div>
      {placements.length === 0 ? (
        <EmptyState title="No placements recorded.">
          A placement is created from an accepted offer. Guarantee days come from the search agreement.
        </EmptyState>
      ) : (
        <DataTable className="mt-4" columns={["Candidate", "Job", "Company", "Start", "Fee", "Guarantee days", "Status"]}>
          {placements.map((row) => (
            <tr key={row.placement.id}>
              <td>{presentCandidate(row.candidate, canReadPii).fullName}</td>
              <td>{row.job.title}</td>
              <td>{row.companyName ?? "—"}</td>
              <td>{formatDate(row.placement.startDate)}</td>
              <td>{row.placement.placementFee ?? "—"}</td>
              <td>{row.placement.guaranteeDays ?? "—"}</td>
              <td>
                <StatusBadge>{formatLabel(row.placement.status)}</StatusBadge>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      <div className="mt-10">
        <SectionHeader title="Guarantees" />
      </div>
      {guarantees.length === 0 ? (
        <EmptyState title="No guarantee windows.">
          Windows appear when a placement is created with search-agreement guarantee days.
        </EmptyState>
      ) : (
        <DataTable className="mt-4" columns={["Candidate", "Window", "Days", "Status", "Source terms"]}>
          {guarantees.map((row) => (
            <tr key={row.guarantee.id}>
              <td>{presentCandidate(row.candidate, canReadPii).fullName}</td>
              <td>
                {row.guarantee.startsOn} → {row.guarantee.endsOn}
              </td>
              <td>{row.guarantee.guaranteeDays}</td>
              <td>
                <StatusBadge tone={row.guarantee.status === "expiring_soon" ? "warning" : "navy"}>
                  {formatLabel(row.guarantee.status)}
                </StatusBadge>
              </td>
              <td>{row.guarantee.sourceTerms ?? "—"}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
