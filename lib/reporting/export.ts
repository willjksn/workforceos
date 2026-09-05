import { AuthorizationError, can, type Principal } from "../rbac/permissions";
import { recordAuditEvent } from "../audit/record-audit-event";
import { runReport } from "./reports";
import type { ReportCategory, ReportFilters } from "./filters";

function csvEscape(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }
  return value;
}

export function reportToCsv(columns: string[], rows: Array<{ cells: string[] }>) {
  return [columns.map(csvEscape).join(","), ...rows.map((row) => row.cells.map(csvEscape).join(","))].join("\n");
}

export async function exportReportCsv(input: {
  actor: Principal;
  organizationId: string;
  category: ReportCategory;
  filters: ReportFilters;
  includePii?: boolean;
}) {
  if (!can(input.actor, "reports.export") && !can(input.actor, "reports.export_pii")) {
    throw new AuthorizationError("Missing permission: reports.export");
  }
  if (input.includePii) {
    if (!can(input.actor, "reports.export_pii")) {
      throw new AuthorizationError("PII exports require reports.export_pii");
    }
    if (!can(input.actor, "candidate_pii.read")) {
      throw new AuthorizationError("PII exports require candidate_pii.read");
    }
  }

  const report = await runReport(input.organizationId, input.category, input.filters, {
    includePii: input.includePii === true && input.category === "talent",
  });
  const pii = input.includePii === true && input.category === "talent";
  const csv = reportToCsv(report.columns, report.rows);
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actor.id },
    action: pii ? "report.exported_pii" : "report.exported",
    recordType: "report",
    recordId: input.actor.id,
    after: { category: input.category, pii, rows: report.rows.length },
  });
  return { csv, filename: pii ? `workforceos-${input.category}-restricted.csv` : `workforceos-${input.category}.csv` };
}
