import { requireAppPermission } from "@/lib/auth/guard";
import { listScenarios } from "@/lib/repositories/workforce";
import { DataTable, PageHeader, PageShell } from "../../_components/ui";
import { WorkforceSubnav } from "../_components/workforce-subnav";

export default async function WorkforceScenariosPage() {
  const principal = await requireAppPermission("scenario_models.read");
  const rows = await listScenarios(principal.organizationId);
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Workforce"
        title="Scenario modeling"
        description="Side-by-side planning estimates. Scenarios are not guaranteed forecasts."
      />
      <WorkforceSubnav active="/app/workforce/scenarios" />
      <DataTable columns={["Scenario", "Assessment", "Quality"]}>
        {rows.map((row) => (
          <tr key={row.scenario.id}>
            <td>{row.scenario.name}{row.scenario.isFixture ? " (fixture)" : ""}</td>
            <td>{row.assessmentTitle}</td>
            <td>{row.scenario.dataQuality}</td>
          </tr>
        ))}
      </DataTable>
    </PageShell>
  );
}
