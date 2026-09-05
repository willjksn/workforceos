import { requireAppPermission } from "@/lib/auth/guard";
import { listForecasts } from "@/lib/repositories/workforce";
import { DataTable, PageHeader, PageShell, formatLabel } from "../../_components/ui";
import { WorkforceSubnav } from "../_components/workforce-subnav";

export default async function WorkforceForecastsPage() {
  const principal = await requireAppPermission("forecasts.read");
  const rows = await listForecasts(principal.organizationId);
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Workforce"
        title="Demand forecasts"
        description="Versioned 12/24/36-month estimates. Not guaranteed outcomes. Each row stores method, assumptions, confidence, and reviewer."
      />
      <WorkforceSubnav active="/app/workforce/forecasts" />
      <DataTable columns={["Forecast", "Horizon", "Status", "Quality"]}>
        {rows.map((row) => (
          <tr key={row.forecast.id}>
            <td>{row.forecast.name}{row.forecast.isFixture ? " (fixture)" : ""}</td>
            <td>{row.forecast.horizonMonths} months</td>
            <td>{formatLabel(row.forecast.status)}</td>
            <td>{formatLabel(row.forecast.dataQuality)}</td>
          </tr>
        ))}
      </DataTable>
    </PageShell>
  );
}
