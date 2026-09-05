import { createPathwayAction } from "@/lib/actions/workforce";
import { requireAppPermission } from "@/lib/auth/guard";
import { listCompaniesForSelect } from "@/lib/repositories/crm";
import { listCareerPaths } from "@/lib/repositories/workforce";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { Field, PageHeader, PageShell, PrimaryButton, RecordList, RecordRow, inputClassName } from "../../_components/ui";
import { WorkforceSubnav } from "../_components/workforce-subnav";

export default async function CareerPathwaysPage() {
  const principal = await requireAppPermission("career_paths.read");
  const rows = await listCareerPaths(principal.organizationId);
  const canWrite = can(principal, "career_paths.write");
  const companies = canWrite ? await listCompaniesForSelect(principal.organizationId) : [];
  return (
    <PageShell>
      <PageHeader eyebrow="Workforce" title="Career pathways" description="Levels may be sequential or lateral. Compensation bands appear only if the client supplies them." />
      <WorkforceSubnav active="/app/workforce/career-pathways" />
      <RecordList>
        {rows.map((row) => (
          <RecordRow
            key={row.path.id}
            href={`/app/workforce/career-pathways/${row.path.id}`}
            title={row.path.name}
            meta={row.levels.map((level) => level.title).join(" → ")}
          />
        ))}
      </RecordList>
      {canWrite ? (
        <ActionForm action={createPathwayAction} className="mt-8 max-w-xl space-y-3">
          <Field label="Client" name="companyId">
            <select className={inputClassName} id="companyId" name="companyId" required>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Pathway name" name="name">
            <input className={inputClassName} id="name" name="name" required />
          </Field>
          <Field label="Levels (one per line)" name="levels">
            <textarea className={inputClassName} id="levels" name="levels" rows={5} placeholder={"Technician I\nTechnician II\nSupervisor"} />
          </Field>
          <PrimaryButton>Create pathway</PrimaryButton>
        </ActionForm>
      ) : null}
    </PageShell>
  );
}
