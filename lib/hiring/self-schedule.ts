import { and, eq } from "drizzle-orm";

import { getDb } from "../../db";
import {
  applications,
  candidates,
  interviewCalendarEvents,
  interviewScorecards,
  interviews,
  jobs,
} from "../../db/schema";
import { getCalendarProvider } from "../calendar";
import { PublicAccessError, resolvePublicAccessToken } from "../public-access/tokens";

export async function getSelfScheduleContext(token: string) {
  const access = await resolvePublicAccessToken({ token, purpose: "interview_self_schedule" });
  if (!access.applicationId) throw new PublicAccessError("This scheduling link is not tied to an application.");
  const db = getDb();
  const [row] = await db
    .select({ application: applications, candidate: candidates, job: jobs })
    .from(applications)
    .innerJoin(candidates, eq(candidates.id, applications.candidateId))
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(
      and(eq(applications.id, access.applicationId), eq(applications.organizationId, access.organizationId)),
    )
    .limit(1);
  if (!row) throw new PublicAccessError("Application not found for this link.");
  const calendar = getCalendarProvider();
  const from = new Date();
  const to = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);
  const slots = await calendar.getAvailability({
    owner: access.createdByUserId ?? access.organizationId,
    from,
    to,
    durationMinutes: 45,
  });
  return {
    access,
    jobTitle: row.job.title,
    candidateName: row.candidate.fullName,
    liveScheduling: calendar.liveScheduling,
    provider: calendar.name,
    slots,
  };
}

export async function pickSelfScheduleSlot(input: {
  token: string;
  start: Date;
  end: Date;
  timezone?: string;
}) {
  const context = await getSelfScheduleContext(input.token);
  const allowed = context.slots.some(
    (slot) => slot.start.getTime() === input.start.getTime() && slot.end.getTime() === input.end.getTime(),
  );
  if (!allowed) throw new PublicAccessError("That slot is no longer available.", 400);
  const calendar = getCalendarProvider();
  const event = await calendar.createEvent({
    title: `Interview — ${context.jobTitle}`,
    start: input.start,
    end: input.end,
    timezone: input.timezone ?? "America/New_York",
    attendees: [],
    description: "WorkforceOS candidate self-scheduled interview",
  });
  const db = getDb();
  const [application] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, context.access.applicationId!))
    .limit(1);
  if (!application) throw new PublicAccessError("Application not found for this link.");
  const [interview] = await db
    .insert(interviews)
    .values({
      candidateId: application.candidateId,
      jobId: application.jobId,
      applicationId: application.id,
      stage: "interview",
      format: "video",
      locationOrLink: event.meetingUrl,
      status: "scheduled",
      scheduledFor: input.start,
    })
    .returning();
  await db.insert(interviewCalendarEvents).values({
    interviewId: interview.id,
    provider: event.provider,
    externalEventId: event.externalEventId,
    calendarOwner: context.access.createdByUserId ?? context.access.organizationId,
    startsAt: event.start,
    endsAt: event.end,
    timezone: event.timezone,
    meetingUrl: event.meetingUrl,
    status: event.status,
  });
  if (context.access.createdByUserId) {
    await db.insert(interviewScorecards).values({
      organizationId: context.access.organizationId,
      interviewId: interview.id,
      applicationId: application.id,
      interviewerUserId: context.access.createdByUserId,
      status: "pending",
    });
  }
  await db
    .update(applications)
    .set({ updatedAt: new Date() })
    .where(eq(applications.id, application.id));
  return { interviewId: interview.id, meetingUrl: event.meetingUrl, liveScheduling: calendar.liveScheduling };
}
