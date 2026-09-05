import { requireAppPermission } from "@/lib/auth/guard";
import { listSkillsCatalog } from "@/lib/repositories/workforce";
import { DataTable, PageHeader, PageShell, formatLabel } from "../../_components/ui";
import { WorkforceSubnav } from "../_components/workforce-subnav";

export default async function WorkforceSkillsPage() {
  await requireAppPermission("workforce.read");
  const rows = await listSkillsCatalog();
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Workforce"
        title="Skills taxonomy"
        description="Canonical skills reused by recruiting, military, and workforce planning. This is not a second taxonomy."
      />
      <WorkforceSubnav active="/app/workforce/skills" />
      <DataTable columns={["Skill", "Family", "Source"]}>
        {rows.map((skill) => (
          <tr key={skill.id}>
            <td>{skill.name}</td>
            <td>{formatLabel(skill.skillFamily)}</td>
            <td>{skill.onetSource ?? "—"}</td>
          </tr>
        ))}
      </DataTable>
    </PageShell>
  );
}
