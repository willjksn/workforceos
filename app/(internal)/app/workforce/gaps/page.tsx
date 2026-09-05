import { requireAppPermission } from "@/lib/auth/guard";
import { listWorkforceGaps } from "@/lib/repositories/workforce";
import { DataTable, PageHeader, PageShell, StatusBadge, formatLabel } from "../../_components/ui";
import { WorkforceSubnav } from "../_components/workforce-subnav";

export default async function WorkforceGapsPage() {
  const principal = await requireAppPermission("workforce.read");
  const rows = await listWorkforceGaps(principal.organizationId);
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Workforce"
        title="Workforce gaps"
        description="Demand minus expected supply. Severity uses stored thresholds, not color alone. Estimates only."
      />
      <WorkforceSubnav active="/app/workforce/gaps" />
      <div className="mt-6 overflow-x-auto">
        <DataTable columns={["Role", "Client", "Horizon", "Demand", "Supply", "Gap", "Severity"]}>
          {rows.map((row) => (
            <tr key={row.gap.id} className={row.gap.severity === "critical" ? "bg-card" : undefined}>
              <td>{row.roleTitle}</td>
              <td>{row.companyName}</td>
              <td>{row.gap.horizonMonths} mo</td>
              <td>{row.gap.demand}</td>
              <td>{row.gap.supply}</td>
              <td>{row.gap.gap}</td>
              <td>
                <StatusBadge tone={row.gap.severity === "critical" ? "warning" : "navy"}>
                  {formatLabel(row.gap.severity)}
                </StatusBadge>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Heatmap uses PierOne navy/warning tones only. Bright decorative colors are not used.</p>
    </PageShell>
  );
}
