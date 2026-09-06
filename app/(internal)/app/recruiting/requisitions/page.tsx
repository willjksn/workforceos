import { createRequisitionAction } from "@/lib/actions/hiring";
import { requireAppPermission } from "@/lib/auth/guard";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { Field, PageHeader, PageShell, PrimaryButton, inputClassName } from "../../_components/ui";

export default async function RequisitionsPage() {
  const principal = await requireAppPermission("jobs.read");
  const canCreate = can(principal, "jobs.create");
  return (
    <PageShell>
      <PageHeader eyebrow="Recruiting" title="Job requisitions" description="Request, approve, then open a job. Approvals use the existing engine." />
      {canCreate ? (
        <ActionForm action={createRequisitionAction} className="mt-6 max-w-lg space-y-3 border border-border bg-white p-4">
          <Field label="Title">
            <input name="title" required className={inputClassName} />
          </Field>
          <Field label="Department">
            <input name="department" className={inputClassName} />
          </Field>
          <Field label="Location">
            <input name="location" className={inputClassName} />
          </Field>
          <Field label="Employment type">
            <input name="employmentType" className={inputClassName} />
          </Field>
          <PrimaryButton>Create and submit for approval</PrimaryButton>
        </ActionForm>
      ) : null}
    </PageShell>
  );
}
