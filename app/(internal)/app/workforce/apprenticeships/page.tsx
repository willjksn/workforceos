import { requireAppPermission } from "@/lib/auth/guard";
import { listApprenticeships } from "@/lib/repositories/workforce";
import { DataTable, PageHeader, PageShell, formatLabel } from "../../_components/ui";
import { WorkforceSubnav } from "../_components/workforce-subnav";

export default async function ApprenticeshipsPage() {
  const principal = await requireAppPermission("workforce.read");
  const rows = await listApprenticeships(principal.organizationId);
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Workforce"
        title="Apprenticeships"
        description="Workforce planning records only. This is not a registered apprenticeship regulatory system."
      />
      <WorkforceSubnav active="/app/workforce/apprenticeships" />
      <DataTable columns={["Sponsor", "Duration", "Enrollment", "Capacity", "Status"]}>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.sponsorName ?? "—"}{row.isFixture ? " (fixture)" : ""}</td>
            <td>{row.durationMonths ?? "—"} months</td>
            <td>{row.targetEnrollment ?? "—"}</td>
            <td>{row.annualCapacity ?? "—"}</td>
            <td>{formatLabel(row.status)}</td>
          </tr>
        ))}
      </DataTable>
    </PageShell>
  );
}
