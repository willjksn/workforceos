import Link from "next/link";

import { createJobAction } from "@/lib/actions/recruiting";
import { requireAppPermission } from "@/lib/auth/guard";
import { listCompaniesForSelect, listContacts } from "@/lib/repositories/crm";
import { listCanonicalSkills, listJobs } from "@/lib/repositories/recruiting";
import { can } from "@/lib/rbac/permissions";
import { AcademyHelp } from "@/components/academy/academy-help";
import { ActionForm } from "../_components/action-form";
import {
  CreatePanel,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  PageHeader,
  PageShell,
  PrimaryButton,
  SearchForm,
  ListPager,
  formatLabel,
  inputClassName,
} from "../_components/ui";
import { StatusBadge } from "@/components/ui/display";
import { JobsSubnav } from "./_components/jobs-subnav";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const principal = await requireAppPermission("jobs.read");
  const { q, page } = await searchParams;
  const result = await listJobs(principal.organizationId, q, { page });
  const rows = result.items;
  const canWrite = can(principal, "jobs.write");
  const companies = canWrite ? await listCompaniesForSelect(principal.organizationId) : [];
  const contacts = canWrite ? await listContacts(principal.organizationId) : [];
  const skillCatalog = canWrite ? await listCanonicalSkills() : [];

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Talent"
        title="Jobs"
        description="One operating surface for search assignments. Request headcount, open the job, then run the Internal Talent Network search before any external sourcing hook."
        actions={<AcademyHelp articleSlug="module-jobs" />}
      />
      <JobsSubnav active="/app/jobs" />
      <FilterBar>
        <SearchForm action="/app/jobs" q={q} placeholder="Search job title" className="" />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState title="No jobs match.">
          Adjust the search or create a job when you have write access.
        </EmptyState>
      ) : (
        <DataTable
          columns={["Title", "Company", "Location", "Status", "Priority", "Pipeline", "Days open"]}
        >
          {rows.map((row) => (
            <tr key={row.job.id}>
              <td>
                <Link className="font-medium text-navy" href={`/app/jobs/${row.job.id}`}>
                  {row.job.title}
                </Link>
              </td>
              <td>{row.companyName ?? "—"}</td>
              <td>{row.job.locationLabel ?? "—"}</td>
              <td>
                <StatusBadge
                  tone={
                    row.job.status === "search_active"
                      ? "teal"
                      : row.job.status === "filled"
                        ? "success"
                        : "navy"
                  }
                >
                  {formatLabel(row.job.status)}
                </StatusBadge>
              </td>
              <td>{formatLabel(row.job.priority)}</td>
              <td>
                <Link className="font-medium text-navy underline decoration-border underline-offset-4 hover:decoration-teal" href={`/app/jobs/${row.job.id}/pipeline`}>
                  {row.activePipelineCount}
                </Link>
              </td>
              <td>{row.daysOpen}</td>
            </tr>
          ))}
        </DataTable>
      )}
      <ListPager pathname="/app/jobs" page={result.page} pageSize={result.pageSize} total={result.total} params={{ q }} />
      {canWrite ? (
        <CreatePanel
          title="Create job"
          description="Intake stays collapsed until you need it, so the search list stays the operating view."
        >
          <ActionForm action={createJobAction} className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" name="title">
              <input className={inputClassName} id="title" name="title" required />
            </Field>
            <Field label="Normalized title" name="normalizedTitle">
              <input className={inputClassName} id="normalizedTitle" name="normalizedTitle" />
            </Field>
            <Field label="Company" name="companyId">
              <select className={inputClassName} id="companyId" name="companyId" defaultValue="">
                <option value="">No company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Hiring manager" name="hiringManagerContactId">
              <select className={inputClassName} id="hiringManagerContactId" name="hiringManagerContactId" defaultValue="">
                <option value="">Not assigned</option>
                {contacts.map((row) => (
                  <option key={row.contact.id} value={row.contact.id}>{row.contact.fullName}</option>
                ))}
              </select>
            </Field>
            <Field label="Location" name="locationLabel">
              <input className={inputClassName} id="locationLabel" name="locationLabel" />
            </Field>
            <Field label="Status" name="status">
              <select className={inputClassName} id="status" name="status" defaultValue="open">
                <option value="draft">draft</option>
                <option value="open">open</option>
                <option value="search_active">search_active</option>
              </select>
            </Field>
            <Field label="Compensation min" name="compensationMin">
              <input className={inputClassName} id="compensationMin" name="compensationMin" />
            </Field>
            <Field label="Compensation max" name="compensationMax">
              <input className={inputClassName} id="compensationMax" name="compensationMax" />
            </Field>
            <Field label="Required years" name="requiredExperienceYears">
              <input className={inputClassName} id="requiredExperienceYears" name="requiredExperienceYears" type="number" min={0} />
            </Field>
            <Field label="Workplace type" name="workplaceType">
              <input className={inputClassName} id="workplaceType" name="workplaceType" />
            </Field>
            <Field label="Priority" name="priority">
              <input className={inputClassName} id="priority" name="priority" defaultValue="normal" />
            </Field>
            <Field label="Urgency" name="urgency">
              <input className={inputClassName} id="urgency" name="urgency" defaultValue="normal" />
            </Field>
            <Field label="Target start" name="targetStartDate">
              <input className={inputClassName} id="targetStartDate" name="targetStartDate" type="date" />
            </Field>
            <Field label="Military compatibility" name="militaryCompatibility">
              <input className={inputClassName} id="militaryCompatibility" name="militaryCompatibility" />
            </Field>
            <Field label="Bonus" name="bonus">
              <input className={inputClassName} id="bonus" name="bonus" />
            </Field>
            <Field label="Certifications" name="certifications">
              <input className={inputClassName} id="certifications" name="certifications" />
            </Field>
            <Field label="Travel" name="travel">
              <input className={inputClassName} id="travel" name="travel" />
            </Field>
            <Field label="Relocation" name="relocation">
              <input className={inputClassName} id="relocation" name="relocation" />
            </Field>
            <Field label="Reason open" name="reasonOpen">
              <input className={inputClassName} id="reasonOpen" name="reasonOpen" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description" name="description">
                <textarea className={inputClassName} id="description" name="description" rows={3} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-navy">Canonical skills</p>
              <p className="mt-1 text-xs text-muted-foreground">Reuse the skills taxonomy. Do not type duplicate skill strings.</p>
              <div className="mt-2 grid gap-2">
                {skillCatalog.slice(0, 12).map((skill) => (
                  <label key={skill.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>{skill.name}</span>
                    <span className="flex items-center gap-2">
                      <input type="hidden" name="skillId" value={skill.id} />
                      <select className={inputClassName} name="requirementType" defaultValue="">
                        <option value="">Skip</option>
                        <option value="required">required</option>
                        <option value="preferred">preferred</option>
                        <option value="nice_to_have">nice to have</option>
                      </select>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <PrimaryButton>Create job</PrimaryButton>
            </div>
          </ActionForm>
        </CreatePanel>
      ) : null}
    </PageShell>
  );
}
