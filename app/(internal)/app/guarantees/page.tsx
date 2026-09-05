import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { listGuarantees } from "@/lib/repositories/recruiting-delivery";
import { can } from "@/lib/rbac/permissions";
import { DataTable, EmptyState, PageHeader, PageShell, StatusBadge, formatLabel } from "../_components/ui";

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
      {guarantees.length === 0 ? (
        <EmptyState title="No guarantee windows.">
          Windows appear when a placement is created with search-agreement guarantee days.
        </EmptyState>
      ) : (
        <DataTable columns={["Candidate", "Job", "Window", "Days", "Status", "Source terms"]}>
          {guarantees.map((row) => (
            <tr key={row.guarantee.id}>
              <td>{presentCandidate(row.candidate, canReadPii).fullName}</td>
              <td>{row.job.title}</td>
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
