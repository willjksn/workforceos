import { notFound } from "next/navigation";

import { saveReportAction, scheduleReportExportAction } from "@/lib/actions/reports";
import { requireAppPermission } from "@/lib/auth/guard";
import { can } from "@/lib/rbac/permissions";
import { isReportCategory, parseReportFilters } from "@/lib/reporting/filters";
import { runReport } from "@/lib/reporting/reports";
import { listSavedReports } from "@/lib/reporting/saved";
import { listReportExportJobs, listReportExportSchedules } from "@/lib/reporting/schedules";
import { MetricCard } from "@/components/ui/display";
import { ActionForm } from "../../_components/action-form";
import {
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  PageShell,
  PrimaryButton,
  SectionHeader,
  inputClassName,
} from "../../_components/ui";

export default async function ReportCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const principal = await requireAppPermission("reports.read");
  const { category } = await params;
  if (!isReportCategory(category)) notFound();
  const query = await searchParams;
  const filters = parseReportFilters(query);
  const report = await runReport(principal.organizationId, category, filters);
  const saved = await listSavedReports(principal.organizationId, principal.id, category);
  const canExport = can(principal, "reports.export") || can(principal, "reports.export_pii");
  const canSchedule = can(principal, "reports.export");
  const schedules = canSchedule ? await listReportExportSchedules(principal) : [];
  const jobs = canSchedule ? await listReportExportJobs(principal) : [];
  const exportHref = `/api/reports/export?category=${category}&from=${query.from ?? ""}&to=${query.to ?? ""}&companyId=${query.companyId ?? ""}&serviceCode=${query.serviceCode ?? ""}&ownerUserId=${query.ownerUserId ?? ""}`;
  const piiExportHref = `${exportHref}&pii=1`;

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Reports"
        title={report.title}
        description={report.description}
        actions={
          canExport ? (
            <div className="flex gap-3">
              <a className="text-sm font-medium text-teal" href={exportHref}>
                Export CSV
              </a>
              {category === "talent" && can(principal, "reports.export_pii") ? (
                <a className="text-sm font-medium text-teal" href={piiExportHref}>
                  Export CSV with PII
                </a>
              ) : null}
            </div>
          ) : null
        }
      />
      <form method="get" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm">
          From
          <input className={inputClassName} type="date" name="from" defaultValue={query.from ?? ""} />
        </label>
        <label className="text-sm">
          To
          <input className={inputClassName} type="date" name="to" defaultValue={query.to ?? ""} />
        </label>
        <label className="text-sm">
          Client ID
          <input className={inputClassName} name="companyId" defaultValue={query.companyId ?? ""} />
        </label>
        <label className="text-sm">
          Service
          <input className={inputClassName} name="serviceCode" defaultValue={query.serviceCode ?? ""} />
        </label>
        <label className="text-sm">
          Owner ID
          <input className={inputClassName} name="ownerUserId" defaultValue={query.ownerUserId ?? ""} />
        </label>
        <div className="sm:col-span-2 lg:col-span-5">
          <PrimaryButton>Apply filters</PrimaryButton>
        </div>
      </form>
      <ActionForm action={saveReportAction} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="from" value={query.from ?? ""} />
        <input type="hidden" name="to" value={query.to ?? ""} />
        <input type="hidden" name="companyId" value={query.companyId ?? ""} />
        <input type="hidden" name="serviceCode" value={query.serviceCode ?? ""} />
        <input type="hidden" name="ownerUserId" value={query.ownerUserId ?? ""} />
        <label className="text-sm">
          Save as
          <input className={inputClassName} name="name" placeholder="Q3 pipeline" required />
        </label>
        <PrimaryButton>Save report</PrimaryButton>
      </ActionForm>
      {canSchedule && category !== "talent" ? (
        <ActionForm action={scheduleReportExportAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="from" value={query.from ?? ""} />
          <input type="hidden" name="to" value={query.to ?? ""} />
          <input type="hidden" name="companyId" value={query.companyId ?? ""} />
          <input type="hidden" name="serviceCode" value={query.serviceCode ?? ""} />
          <input type="hidden" name="ownerUserId" value={query.ownerUserId ?? ""} />
          <label className="text-sm">
            Schedule
            <select className={inputClassName} name="cadence" defaultValue="weekly">
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
            </select>
          </label>
          <PrimaryButton>Schedule CSV job</PrimaryButton>
        </ActionForm>
      ) : null}
      {canSchedule && schedules.length > 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Scheduled jobs: {schedules.filter((row) => row.category === category).length}. Recent runs:{" "}
          {jobs
            .filter((row) => row.category === category)
            .slice(0, 3)
            .map((row) => `${row.status}${row.rowCount != null ? ` (${row.rowCount} rows)` : ""}`)
            .join(" · ") || "none yet"}
          . Scheduled exports stay on this report. Talent contact details stay on-demand. This is not a BI platform.
        </p>
      ) : null}
      {saved.length > 0 ? (
        <FilterBar>
          <p className="text-sm text-muted-foreground">
            Saved:{" "}
            {saved.map((view, index) => {
              const filters = (view.filters ?? {}) as Record<string, string | null>;
              const params = new URLSearchParams();
              if (filters.from) params.set("from", filters.from.slice(0, 10));
              if (filters.to) params.set("to", filters.to.slice(0, 10));
              if (filters.companyId) params.set("companyId", filters.companyId);
              if (filters.serviceCode) params.set("serviceCode", filters.serviceCode);
              if (filters.ownerUserId) params.set("ownerUserId", filters.ownerUserId);
              return (
                <span key={view.id}>
                  {index > 0 ? " · " : null}
                  <a className="text-teal" href={`?${params.toString()}`}>
                    {view.name}
                  </a>
                </span>
              );
            })}
          </p>
        </FilterBar>
      ) : null}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {report.metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} hint={metric.hint} />
        ))}
      </div>
      <div className="mt-10">
        <SectionHeader title="Rows" />
        {report.rows.length === 0 ? (
          <EmptyState title="Nothing answers this question yet.">
            Change the filters or add the operating records this question reads. Reports never invent metrics.
          </EmptyState>
        ) : (
          <DataTable columns={report.columns}>
            {report.rows.map((row) => (
              <tr key={row.id}>
                {row.cells.map((cell) => (
                  <td key={`${row.id}-${cell}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </PageShell>
  );
}
