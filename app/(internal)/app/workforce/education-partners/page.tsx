import { createPartnerAction } from "@/lib/actions/workforce";
import { requireAppPermission } from "@/lib/auth/guard";
import { listEducationPartners } from "@/lib/repositories/workforce";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { DataTable, Field, PageHeader, PageShell, PrimaryButton, formatLabel, inputClassName } from "../../_components/ui";
import { WorkforceSubnav } from "../_components/workforce-subnav";

export default async function EducationPartnersPage() {
  const principal = await requireAppPermission("education_partners.read");
  const rows = await listEducationPartners(principal.organizationId);
  const canWrite = can(principal, "education_partners.write");
  return (
    <PageShell wide>
      <PageHeader eyebrow="Workforce" title="Education partners" description="Community colleges, universities, technical schools, training providers, and workforce boards. CRM companies/contacts are reused when linked." />
      <WorkforceSubnav active="/app/workforce/education-partners" />
      <DataTable columns={["Partner", "Type", "Status", "Capacity"]}>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.name}{row.isFixture ? " (fixture)" : ""}</td>
            <td>{formatLabel(row.partnerType)}</td>
            <td>{formatLabel(row.partnershipStatus)}</td>
            <td>{row.annualCapacity ?? "unknown"}</td>
          </tr>
        ))}
      </DataTable>
      {canWrite ? (
        <ActionForm action={createPartnerAction} className="mt-8 max-w-xl space-y-3">
          <Field label="Name" name="name">
            <input className={inputClassName} id="name" name="name" required />
          </Field>
          <Field label="Type" name="partnerType">
            <select className={inputClassName} id="partnerType" name="partnerType">
              <option value="community_college">Community college</option>
              <option value="university">University</option>
              <option value="technical_school">Technical school</option>
              <option value="training_provider">Training provider</option>
              <option value="workforce_board">Workforce board</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <PrimaryButton>Add partner</PrimaryButton>
        </ActionForm>
      ) : null}
    </PageShell>
  );
}
