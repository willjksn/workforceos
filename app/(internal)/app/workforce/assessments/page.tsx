import Link from "next/link";

import { createAssessmentAction } from "@/lib/actions/workforce";
import { requireAppPermission } from "@/lib/auth/guard";
import { listCompaniesForSelect } from "@/lib/repositories/crm";
import { listWorkforceAssessments } from "@/lib/repositories/workforce";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import {
  DataTable,
  EmptyState,
  Field,
  PageHeader,
  PageShell,
  PrimaryButton,
  StatusBadge,
  formatLabel,
  inputClassName,
} from "../../_components/ui";
import { WorkforceSubnav } from "../_components/workforce-subnav";

export default async function WorkforceAssessmentsPage() {
  const principal = await requireAppPermission("workforce.read");
  const rows = await listWorkforceAssessments(principal.organizationId);
  const canWrite = can(principal, "workforce.write");
  const companies = canWrite ? await listCompaniesForSelect(principal.organizationId) : [];

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Workforce"
        title="Workforce assessments"
        description="Versioned assessments. A delivered assessment is never overwritten."
      />
      <WorkforceSubnav active="/app/workforce/assessments" />
      {rows.length === 0 ? (
        <EmptyState title="No assessments yet.">Create an assessment for a client workforce plan.</EmptyState>
      ) : (
        <DataTable columns={["Assessment", "Client", "Status", "Version"]}>
          {rows.map((row) => (
            <tr key={row.assessment.id}>
              <td>
                <Link className="font-medium text-navy" href={`/app/workforce/assessments/${row.assessment.id}`}>
                  {row.assessment.title}
                </Link>
              </td>
              <td>{row.companyName}</td>
              <td>
                <StatusBadge tone={row.assessment.status === "delivered" ? "success" : "navy"}>
                  {formatLabel(row.assessment.status)}
                </StatusBadge>
              </td>
              <td>v{row.assessment.versionNumber}</td>
            </tr>
          ))}
        </DataTable>
      )}
      {canWrite ? (
        <ActionForm action={createAssessmentAction} className="mt-8 max-w-xl space-y-3">
          <Field label="Client" name="companyId">
            <select className={inputClassName} id="companyId" name="companyId" required>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title" name="title">
            <input className={inputClassName} id="title" name="title" required />
          </Field>
          <PrimaryButton>Create assessment</PrimaryButton>
        </ActionForm>
      ) : null}
    </PageShell>
  );
}
