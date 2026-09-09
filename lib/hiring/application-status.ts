import { and, eq } from "drizzle-orm";

import { getDb } from "../../db";
import { applications, jobs } from "../../db/schema";
import { PublicAccessError, resolvePublicAccessToken } from "../public-access/tokens";

export async function getPublicApplicationStatus(token: string) {
  const access = await resolvePublicAccessToken({ token, purpose: "application_status" });
  if (!access.applicationId) throw new PublicAccessError("This status link is not tied to an application.");
  const db = getDb();
  const [row] = await db
    .select({
      stage: applications.currentStage,
      appliedAt: applications.appliedAt,
      status: applications.status,
      jobTitle: jobs.title,
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(
      and(eq(applications.id, access.applicationId), eq(applications.organizationId, access.organizationId)),
    )
    .limit(1);
  if (!row) throw new PublicAccessError("Application not found for this link.");
  return {
    jobTitle: row.jobTitle,
    stage: row.stage,
    status: row.status,
    appliedAt: row.appliedAt,
  };
}
