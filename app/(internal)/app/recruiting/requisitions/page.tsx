import Link from "next/link";

import { createRequisitionAction } from "@/lib/actions/hiring";
import { requireAppPermission } from "@/lib/auth/guard";
import { listRequisitions } from "@/lib/hiring/service";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import {
  DataTable,
  EmptyState,
  Field,
  PageHeader,
  PageShell,
  PrimaryButton,
  formatLabel,
  inputClassName,
} from "../../_components/ui";
import { StatusBadge } from "@/components/ui/display";
import { JobsSubnav } from "../../jobs/_components/jobs-subnav";

export default async function RequisitionsPage() {
  const principal = await requireAppPermission("jobs.read");
  const canCreate = can(principal, "jobs.create");
  const rows = await listRequisitions(principal.organizationId);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Talent"
        title="Headcount requests"
        description="Request and approve headcount, then open a job. This is the intake step for the same job record — not a separate recruiting product."
      />
      <JobsSubnav active="/app/recruiting/requisitions" />
      {rows.length === 0 ? (
        <EmptyState title="No headcount requests yet.">
          Create a request when you need approval before opening a job. Approved jobs still search the Talent Network first.
        </EmptyState>
      ) : (
        <DataTable columns={["Title", "Department", "Location", "Status", "Approval"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="font-medium text-navy">{row.title}</td>
              <td>{row.department ?? "—"}</td>
              <td>{row.location ?? "—"}</td>
              <td>
                <StatusBadge>{formatLabel(row.status)}</StatusBadge>
              </td>
              <td>{formatLabel(row.approvalStatus)}</td>
            </tr>
          ))}
        </DataTable>
      )}
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
      <p className="mt-6 text-sm text-muted-foreground">
        After approval, open the search from{" "}
        <Link className="text-navy underline" href="/app/jobs">
          Jobs
        </Link>
        .
      </p>
    </PageShell>
  );
}
