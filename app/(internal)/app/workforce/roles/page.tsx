import { createRoleAction } from "@/lib/actions/workforce";
import { requireAppPermission } from "@/lib/auth/guard";
import { listCompaniesForSelect } from "@/lib/repositories/crm";
import { listWorkforceRoles } from "@/lib/repositories/workforce";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { DataTable, Field, PageHeader, PageShell, PrimaryButton, formatLabel, inputClassName } from "../../_components/ui";
import { WorkforceSubnav } from "../_components/workforce-subnav";

export default async function WorkforceRolesPage() {
  const principal = await requireAppPermission("workforce.read");
  const rows = await listWorkforceRoles(principal.organizationId);
  const canWrite = can(principal, "workforce.write");
  const companies = canWrite ? await listCompaniesForSelect(principal.organizationId) : [];

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Workforce"
        title="Workforce roles"
        description="Planning-level occupations. These are not recruiting job requisitions."
      />
      <WorkforceSubnav active="/app/workforce/roles" />
      <DataTable columns={["Role", "Headcount", "Criticality", "Scarcity"]}>
        {rows.map((role) => (
          <tr key={role.id}>
            <td>{role.title}{role.isFixture ? " (fixture)" : ""}</td>
            <td>{role.currentHeadcount}</td>
            <td>{formatLabel(role.criticality)}</td>
            <td>{formatLabel(role.talentScarcity)}</td>
          </tr>
        ))}
      </DataTable>
      {canWrite ? (
        <ActionForm action={createRoleAction} className="mt-8 max-w-xl space-y-3">
          <Field label="Client" name="companyId">
            <select className={inputClassName} id="companyId" name="companyId" required>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Role title" name="title">
            <input className={inputClassName} id="title" name="title" required />
          </Field>
          <Field label="Current headcount" name="currentHeadcount">
            <input className={inputClassName} id="currentHeadcount" name="currentHeadcount" type="number" min="0" defaultValue="0" />
          </Field>
          <PrimaryButton>Add workforce role</PrimaryButton>
        </ActionForm>
      ) : null}
    </PageShell>
  );
}
