import { requireAppPermission } from "@/lib/auth/guard";
import { listSupply } from "@/lib/repositories/workforce";
import { DataTable, PageHeader, PageShell, formatLabel } from "../../_components/ui";
import { WorkforceSubnav } from "../_components/workforce-subnav";

export default async function WorkforceSupplyPage() {
  const principal = await requireAppPermission("workforce.read");
  const rows = await listSupply(principal.organizationId);
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Workforce"
        title="Talent supply"
        description="Internal, military, education, apprenticeship, and Talent Network supply. Labor-market sources that are not connected stay marked as placeholders."
      />
      <WorkforceSubnav active="/app/workforce/supply" />
      <DataTable columns={["Role", "Source", "Estimated supply", "Quality"]}>
        {rows.map((row) => (
          <tr key={row.entry.id}>
            <td>{row.roleTitle}</td>
            <td>{formatLabel(row.entry.sourceType)}</td>
            <td>{row.entry.estimatedSupply}</td>
            <td>{formatLabel(row.entry.dataQuality)}{row.entry.isFixture ? " · fixture" : ""}</td>
          </tr>
        ))}
      </DataTable>
    </PageShell>
  );
}
