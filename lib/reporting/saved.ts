import { and, eq } from "drizzle-orm";

import { getDb } from "../../db";
import { savedViews } from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import type { ReportCategory, ReportFilters } from "./filters";

export function reportModule(category: ReportCategory) {
  return `reports:${category}`;
}

export async function listSavedReports(organizationId: string, userId: string, category?: ReportCategory) {
  const db = getDb();
  return db
    .select()
    .from(savedViews)
    .where(
      and(
        eq(savedViews.organizationId, organizationId),
        eq(savedViews.userId, userId),
        category ? eq(savedViews.module, reportModule(category)) : undefined,
      ),
    );
}

export async function saveReportView(input: {
  organizationId: string;
  userId: string;
  category: ReportCategory;
  name: string;
  filters: ReportFilters;
}) {
  const db = getDb();
  const [row] = await db
    .insert(savedViews)
    .values({
      organizationId: input.organizationId,
      userId: input.userId,
      module: reportModule(input.category),
      name: input.name,
      filters: {
        from: input.filters.from?.toISOString() ?? null,
        to: input.filters.to?.toISOString() ?? null,
        companyId: input.filters.companyId ?? null,
        serviceCode: input.filters.serviceCode ?? null,
        ownerUserId: input.filters.ownerUserId ?? null,
      },
    })
    .onConflictDoUpdate({
      target: [savedViews.userId, savedViews.module, savedViews.name],
      set: {
        filters: {
          from: input.filters.from?.toISOString() ?? null,
          to: input.filters.to?.toISOString() ?? null,
          companyId: input.filters.companyId ?? null,
          serviceCode: input.filters.serviceCode ?? null,
          ownerUserId: input.filters.ownerUserId ?? null,
        },
        updatedAt: new Date(),
      },
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.userId },
    action: "saved_report.upserted",
    recordType: "saved_view",
    recordId: row.id,
    after: { name: row.name, module: row.module },
  });
  return row;
}
