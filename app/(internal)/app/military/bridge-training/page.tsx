import { requireAppPermission } from "@/lib/auth/guard";
import { listBridgeTraining } from "@/lib/repositories/military";
import { DataTable, EmptyState, PageHeader, PageShell, StatusBadge, formatLabel } from "../../_components/ui";
import { MilitarySubnav } from "../_components/military-subnav";

export default async function BridgeTrainingPage() {
  await requireAppPermission("military.read");
  const rows = await listBridgeTraining();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Military talent"
        title="Bridge training"
        description="Skill gaps and recommended credentials. These records do not promise employment outcomes."
      />
      <MilitarySubnav active="/app/military/bridge-training" />
      {rows.length === 0 ? (
        <EmptyState title="No bridge-training records.">
          Recommendations describe gaps and credentials. They do not promise employment outcomes.
        </EmptyState>
      ) : (
        <DataTable columns={["Military", "Civilian", "Missing skills", "Credential / program", "Review"]}>
          {rows.map((row) => (
            <tr key={row.recommendation.id} className="align-top">
              <td>
                {row.military.code} · {row.military.title}
              </td>
              <td>{row.civilian?.title ?? "—"}</td>
              <td>{row.recommendation.missingSkills ?? "—"}</td>
              <td>
                {row.recommendation.recommendedCredential ?? row.recommendation.trainingProgram ?? "—"}
                <p className="text-xs text-muted-foreground">{row.recommendation.expectedBridgePurpose}</p>
              </td>
              <td>
                <StatusBadge>{formatLabel(row.recommendation.reviewStatus)}</StatusBadge>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
