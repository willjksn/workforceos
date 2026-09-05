import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { listTalentPipelines } from "@/lib/repositories/workforce";
import { DataTable, PageHeader, PageShell, formatLabel } from "../../_components/ui";
import { WorkforceSubnav } from "../_components/workforce-subnav";

export default async function TalentPipelinesPage() {
  const principal = await requireAppPermission("pipelines.read");
  const rows = await listTalentPipelines(principal.organizationId);
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Workforce"
        title="Talent pipelines"
        description="Gap allocation across military, apprenticeship, education, internal development, and external recruiting."
      />
      <WorkforceSubnav active="/app/workforce/pipelines" />
      <DataTable columns={["Pipeline", "Client", "Role", "Source", "Target / year"]}>
        {rows.map((row) => (
          <tr key={row.pipeline.id}>
            <td>
              <Link className="font-medium text-navy" href={`/app/workforce/pipelines/${row.pipeline.id}`}>
                {row.pipeline.name}
              </Link>
            </td>
            <td>{row.companyName}</td>
            <td>{row.roleTitle}</td>
            <td>{formatLabel(row.pipeline.sourceType)}</td>
            <td>{row.pipeline.targetCandidatesPerYear}</td>
          </tr>
        ))}
      </DataTable>
    </PageShell>
  );
}
