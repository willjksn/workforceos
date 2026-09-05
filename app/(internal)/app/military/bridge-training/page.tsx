import { requireAppPermission } from "@/lib/auth/guard";
import { listBridgeTraining } from "@/lib/repositories/military";
import { PageHeader, PageShell, formatLabel } from "../../_components/ui";
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
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">Military</th>
            <th>Civilian</th>
            <th>Missing skills</th>
            <th>Credential / program</th>
            <th>Review</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.recommendation.id} className="border-b border-border align-top">
              <td className="py-2">{row.military.code} · {row.military.title}</td>
              <td>{row.civilian?.title ?? "—"}</td>
              <td>{row.recommendation.missingSkills ?? "—"}</td>
              <td>
                {row.recommendation.recommendedCredential ?? row.recommendation.trainingProgram ?? "—"}
                <p className="text-xs text-muted-foreground">{row.recommendation.expectedBridgePurpose}</p>
              </td>
              <td>{formatLabel(row.recommendation.reviewStatus)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  );
}
