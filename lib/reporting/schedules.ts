import { and, desc, eq, isNull, lte } from "drizzle-orm";

import { getDb } from "../../db";
import { reportExportJobs, reportExportSchedules } from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { AuthorizationError, can, requirePermission, type Principal } from "../rbac/permissions";
import { isReportCategory, parseReportFilters, type ReportCategory, type ReportFilters } from "./filters";
import { runReport } from "./reports";

const CADENCES = ["daily", "weekly"] as const;

export function nextReportRunAt(cadence: (typeof CADENCES)[number], from = new Date()) {
  const next = new Date(from);
  next.setHours(6, 15, 0, 0);
  if (cadence === "daily") {
    if (next <= from) next.setDate(next.getDate() + 1);
    return next;
  }
  const daysUntilMonday = (8 - next.getDay()) % 7 || 7;
  next.setDate(next.getDate() + daysUntilMonday);
  return next;
}

export async function listReportExportSchedules(principal: Principal) {
  requirePermission(principal, "reports.export");
  const db = getDb();
  return db
    .select()
    .from(reportExportSchedules)
    .where(
      and(eq(reportExportSchedules.organizationId, principal.organizationId), isNull(reportExportSchedules.archivedAt)),
    )
    .orderBy(desc(reportExportSchedules.createdAt));
}

export async function listReportExportJobs(principal: Principal, limit = 12) {
  requirePermission(principal, "reports.export");
  const db = getDb();
  return db
    .select()
    .from(reportExportJobs)
    .where(and(eq(reportExportJobs.organizationId, principal.organizationId), isNull(reportExportJobs.archivedAt)))
    .orderBy(desc(reportExportJobs.createdAt))
    .limit(limit);
}

export async function createReportExportSchedule(input: {
  principal: Principal;
  category: string;
  cadence: (typeof CADENCES)[number];
  filters?: ReportFilters;
}) {
  requirePermission(input.principal, "reports.export");
  if (!isReportCategory(input.category)) throw new AuthorizationError("Unknown report category");
  if (input.category === "talent") {
    throw new AuthorizationError("Scheduled talent PII exports are not allowed. Use on-demand export.");
  }
  const db = getDb();
  const [row] = await db
    .insert(reportExportSchedules)
    .values({
      organizationId: input.principal.organizationId,
      createdByUserId: input.principal.id,
      category: input.category,
      cadence: input.cadence,
      includePii: false,
      enabled: true,
      nextRunAt: nextReportRunAt(input.cadence),
      filters: input.filters as Record<string, string | null> | undefined,
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "report_export_schedule.created",
    recordType: "report_export_schedule",
    recordId: row.id,
    after: { category: row.category, cadence: row.cadence },
  });
  return row;
}

export async function runDueReportExportJobs(now = new Date()) {
  const db = getDb();
  const due = await db
    .select()
    .from(reportExportSchedules)
    .where(
      and(
        eq(reportExportSchedules.enabled, true),
        isNull(reportExportSchedules.archivedAt),
        lte(reportExportSchedules.nextRunAt, now),
      ),
    )
    .limit(25);
  const results = [];
  for (const schedule of due) {
    if (!isReportCategory(schedule.category)) continue;
    const [job] = await db
      .insert(reportExportJobs)
      .values({
        organizationId: schedule.organizationId,
        scheduleId: schedule.id,
        requestedByUserId: schedule.createdByUserId,
        category: schedule.category,
        status: "running",
        includePii: false,
        startedAt: now,
      })
      .returning();
    try {
      const report = await runReport(
        schedule.organizationId,
        schedule.category as ReportCategory,
        parseReportFilters((schedule.filters ?? {}) as Record<string, string | undefined>),
        { includePii: false },
      );
      await db
        .update(reportExportJobs)
        .set({
          status: "completed",
          rowCount: report.rows.length,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(reportExportJobs.id, job.id));
      await db
        .update(reportExportSchedules)
        .set({
          lastRunAt: now,
          nextRunAt: nextReportRunAt(schedule.cadence, now),
          updatedAt: new Date(),
        })
        .where(eq(reportExportSchedules.id, schedule.id));
      results.push({ scheduleId: schedule.id, jobId: job.id, rows: report.rows.length });
    } catch (error) {
      await db
        .update(reportExportJobs)
        .set({
          status: "failed",
          error: error instanceof Error ? error.message : "Report job failed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(reportExportJobs.id, job.id));
      results.push({ scheduleId: schedule.id, jobId: job.id, error: true });
    }
  }
  return results;
}

export function canScheduleReports(principal: Principal) {
  return can(principal, "reports.export");
}
