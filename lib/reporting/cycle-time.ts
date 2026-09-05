import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import { interviews, jobs, placements } from "../../db/schema";

function daysBetween(start: Date | null | undefined, end: Date | string | null | undefined) {
  if (!start || !end) return null;
  const endDate = end instanceof Date ? end : new Date(end);
  if (Number.isNaN(endDate.getTime())) return null;
  return Math.round((endDate.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function average(values: Array<number | null>) {
  const present = values.filter((value): value is number => value != null);
  if (present.length === 0) return null;
  return Math.round(present.reduce((sum, value) => sum + value, 0) / present.length);
}

export async function recruitingCycleTimes(organizationId: string) {
  const db = getDb();
  const [jobRows, placementRows, interviewRows] = await Promise.all([
    db.select().from(jobs).where(and(eq(jobs.organizationId, organizationId), isNull(jobs.archivedAt))),
    db
      .select({ placement: placements, job: jobs })
      .from(placements)
      .innerJoin(jobs, eq(placements.jobId, jobs.id))
      .where(eq(jobs.organizationId, organizationId)),
    db
      .select({ interview: interviews, job: jobs })
      .from(interviews)
      .innerJoin(jobs, eq(interviews.jobId, jobs.id))
      .where(eq(jobs.organizationId, organizationId)),
  ]);

  return {
    timeToShortlistDays: average(
      jobRows.map((job) => daysBetween(job.internalTalentSearchStartedAt, job.internalTalentSearchCompletedAt)),
    ),
    timeToInterviewDays: average(
      interviewRows.map((row) => daysBetween(row.job.createdAt, row.interview.scheduledFor ?? row.interview.createdAt)),
    ),
    timeToFillDays: average(
      placementRows.map((row) => daysBetween(row.job.createdAt, row.placement.startDate ?? row.placement.createdAt)),
    ),
  };
}
