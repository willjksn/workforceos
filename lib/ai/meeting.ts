import { eq } from "drizzle-orm";

import { getDb } from "../../db";
import { meetingExtractions, projectMeetings } from "../../db/schema";
import { requestApproval } from "../approvals/service";
import { recordAuditEvent } from "../audit/record-audit-event";
import { AgentError } from "./errors";
import { runAgentTask, type AgentActor } from "./runner";

export async function extractMeetingIntelligence(input: {
  actor: AgentActor;
  meetingId: string;
}) {
  const db = getDb();
  const [meeting] = await db.select().from(projectMeetings).where(eq(projectMeetings.id, input.meetingId)).limit(1);
  if (!meeting) throw new AgentError("Meeting record not found", "not_found");
  const result = await runAgentTask({
    actor: input.actor,
    agentSlug: "project-agent",
    taskKey: "meeting_actions_to_tasks",
    recordType: "project_meeting",
    recordId: meeting.id,
    inputs: { notes: meeting.notes, actions: meeting.actions, title: meeting.title },
  });
  const proposedTasks = String(meeting.actions ?? "")
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
  const [extraction] = await db
    .insert(meetingExtractions)
    .values({
      organizationId: input.actor.organizationId,
      meetingRecordType: "project_meeting",
      meetingRecordId: meeting.id,
      agentRunId: result.runId,
      decisions: [],
      actionItems: proposedTasks,
      commitments: [],
      dates: [],
      risks: [],
      opportunities: [],
      status: "pending_review",
    })
    .returning();
  const approval = await requestApproval({
    organizationId: input.actor.organizationId,
    recordType: "meeting_extraction",
    recordId: extraction.id,
    approvalType: "client_deliverable",
    requestingUserId: null,
    requestingAgentId: result.output.agentId,
  });
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "agent", agentId: result.output.agentId, userId: input.actor.userId },
    action: "meeting_extraction.created",
    recordType: "meeting_extraction",
    recordId: extraction.id,
    after: { meetingId: meeting.id, approvalId: approval.id },
  });
  return { extraction, approval, result, proposedTasks };
}

export async function applyMeetingActionsAsProposedTasks(input: {
  actor: AgentActor;
  extractionId: string;
}) {
  const db = getDb();
  const [extraction] = await db
    .select()
    .from(meetingExtractions)
    .where(eq(meetingExtractions.id, input.extractionId))
    .limit(1);
  if (!extraction) throw new AgentError("Extraction not found", "not_found");
  if (extraction.status !== "approved") {
    throw new AgentError("Meeting extractions require human approval before creating tasks", "approval");
  }
  return extraction.actionItems ?? [];
}
