import { createProgramAction } from "@/lib/actions/workforce";
import { requireAppPermission } from "@/lib/auth/guard";
import { listTrainingPrograms } from "@/lib/repositories/workforce";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { DataTable, Field, PageHeader, PageShell, PrimaryButton, inputClassName } from "../../_components/ui";
import { WorkforceSubnav } from "../_components/workforce-subnav";

export default async function TrainingProgramsPage() {
  const principal = await requireAppPermission("training_programs.read");
  const rows = await listTrainingPrograms(principal.organizationId);
  const canWrite = can(principal, "training_programs.write");
  return (
    <PageShell wide>
      <PageHeader eyebrow="Workforce" title="Training programs" description="Completion and placement rates appear only when source data is on file." />
      <WorkforceSubnav active="/app/workforce/training-programs" />
      <DataTable columns={["Program", "Duration", "Capacity", "Completion", "Placement"]}>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.name}{row.isFixture ? " (fixture)" : ""}</td>
            <td>{row.durationDays ?? "—"}</td>
            <td>{row.capacity ?? "—"}</td>
            <td>{row.completionRatePercent ?? "not recorded"}</td>
            <td>{row.placementRatePercent ?? "not recorded"}</td>
          </tr>
        ))}
      </DataTable>
      {canWrite ? (
        <ActionForm action={createProgramAction} className="mt-8 max-w-xl space-y-3">
          <Field label="Program name" name="name">
            <input className={inputClassName} id="name" name="name" required />
          </Field>
          <PrimaryButton>Add training program</PrimaryButton>
        </ActionForm>
      ) : null}
    </PageShell>
  );
}
