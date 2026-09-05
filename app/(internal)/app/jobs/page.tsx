import Link from "next/link";

import { createJobAction } from "@/lib/actions/recruiting";
import { requireAppPermission } from "@/lib/auth/guard";
import { listCompaniesForSelect } from "@/lib/repositories/crm";
import { listJobs } from "@/lib/repositories/recruiting";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../_components/action-form";
import { Field, PageHeader, PrimaryButton, SearchForm, inputClassName } from "../_components/ui";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const principal = await requireAppPermission("jobs.read");
  const { q } = await searchParams;
  const rows = await listJobs(principal.organizationId, q);
  const companies = can(principal, "jobs.write")
    ? await listCompaniesForSelect(principal.organizationId)
    : [];

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Jobs"
        description="Professional Search assignments. Creating a job always creates an internal Talent Network search project."
      />
      <SearchForm action="/app/jobs" q={q} placeholder="Search job title" />
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-600">No jobs match.</p>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2">Title</th>
              <th>Company</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ job, companyName }) => (
              <tr key={job.id} className="border-b">
                <td className="py-2">
                  <Link className="underline" href={`/app/jobs/${job.id}`}>
                    {job.title}
                  </Link>
                </td>
                <td>{companyName ?? "—"}</td>
                <td>{job.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {can(principal, "jobs.write") ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Create job</h2>
          <p className="mt-2 text-sm text-zinc-600">
            External sourcing is not available in this phase. Internal search is required first.
          </p>
          <ActionForm action={createJobAction} className="mt-4 max-w-xl space-y-3">
            <Field label="Title" name="title">
              <input className={inputClassName} id="title" name="title" required />
            </Field>
            <Field label="Company" name="companyId">
              <select className={inputClassName} id="companyId" name="companyId" defaultValue="">
                <option value="">No company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status" name="status">
              <select className={inputClassName} id="status" name="status" defaultValue="open">
                <option value="draft">draft</option>
                <option value="open">open</option>
                <option value="on_hold">on_hold</option>
              </select>
            </Field>
            <Field label="Description" name="description">
              <textarea className={inputClassName} id="description" name="description" rows={4} />
            </Field>
            <PrimaryButton>Create job</PrimaryButton>
          </ActionForm>
        </section>
      ) : null}
    </main>
  );
}
