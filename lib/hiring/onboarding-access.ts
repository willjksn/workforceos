import { and, eq } from "drizzle-orm";

import { getDb } from "../../db";
import { applications, candidates, jobs, onboardingInstances, onboardingTasks } from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { PublicAccessError, resolvePublicAccessToken } from "../public-access/tokens";
import { HiringError } from "./service";

export async function getHireOnboardingAccess(token: string) {
  const access = await resolvePublicAccessToken({ token, purpose: "hire_onboarding" });
  if (!access.onboardingInstanceId) throw new PublicAccessError("This onboarding link is not tied to a hire checklist.");
  const db = getDb();
  const [row] = await db
    .select({
      instance: onboardingInstances,
      application: applications,
      candidate: candidates,
      job: jobs,
    })
    .from(onboardingInstances)
    .innerJoin(applications, eq(applications.id, onboardingInstances.applicationId))
    .innerJoin(candidates, eq(candidates.id, applications.candidateId))
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(
      and(
        eq(onboardingInstances.id, access.onboardingInstanceId),
        eq(onboardingInstances.organizationId, access.organizationId),
      ),
    )
    .limit(1);
  if (!row) throw new PublicAccessError("Hire onboarding checklist not found.");
  const tasks = await db
    .select()
    .from(onboardingTasks)
    .where(eq(onboardingTasks.instanceId, row.instance.id));
  return {
    access,
    jobTitle: row.job.title,
    firstName: row.candidate.fullName.split(" ")[0] ?? "there",
    startDate: row.instance.startDate,
    status: row.instance.status,
    tasks: tasks.filter((task) => task.ownerRole === "new_hire"),
  };
}

export async function completeHireOnboardingTaskByToken(input: { token: string; taskId: string }) {
  const context = await getHireOnboardingAccess(input.token);
  const task = context.tasks.find((row) => row.id === input.taskId);
  if (!task) throw new HiringError("That task is not available on this hire checklist.");
  if (task.status === "completed") return task;
  const db = getDb();
  const [updated] = await db
    .update(onboardingTasks)
    .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(onboardingTasks.id, task.id))
    .returning();
  await recordAuditEvent({
    organizationId: context.access.organizationId,
    actor: { type: "system" },
    action: "onboarding_task.completed_public",
    recordType: "onboarding_task",
    recordId: task.id,
    after: { instanceId: context.access.onboardingInstanceId, title: task.title, via: "hire_onboarding_token" },
  });
  return updated;
}
