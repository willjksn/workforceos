import { eq } from "drizzle-orm";

import { getDb } from "../../db";
import { agentHandoffs, agents } from "../../db/schema";
import { requestApproval } from "../approvals/service";
import { recordAuditEvent } from "../audit/record-audit-event";
import { AgentError } from "./errors";
import { runAgentTask, type AgentActor } from "./runner";

export async function createAgentHandoff(input: {
  actor: AgentActor;
  fromAgentSlug: string;
  toAgentSlug: string;
  taskKey: string;
  inputs?: Record<string, unknown>;
  fromRunId?: string;
  outputSummary?: string;
  confidence?: string | null;
  sources?: unknown;
}) {
  const db = getDb();
  const [fromAgent] = await db.select().from(agents).where(eq(agents.slug, input.fromAgentSlug)).limit(1);
  const [toAgent] = await db.select().from(agents).where(eq(agents.slug, input.toAgentSlug)).limit(1);
  if (!fromAgent || !toAgent) throw new AgentError("Handoff agents were not found", "not_found");
  const [handoff] = await db
    .insert(agentHandoffs)
    .values({
      organizationId: input.actor.organizationId,
      fromAgentId: fromAgent.id,
      toAgentId: toAgent.id,
      taskKey: input.taskKey,
      inputs: input.inputs ?? {},
      outputSummary: input.outputSummary,
      confidence: input.confidence,
      sources: input.sources,
      fromRunId: input.fromRunId,
      humanApprovalRequired: true,
      status: "pending",
    })
    .returning();
  const approval = await requestApproval({
    organizationId: input.actor.organizationId,
    recordType: "agent_handoff",
    recordId: handoff.id,
    approvalType: "agent_handoff",
    requestingUserId: input.actor.userId ?? null,
    requestingAgentId: fromAgent.id,
  });
  await db.update(agentHandoffs).set({ approvalId: approval.id }).where(eq(agentHandoffs.id, handoff.id));
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "agent", agentId: fromAgent.id, userId: input.actor.userId },
    action: "agent_handoff.created",
    recordType: "agent_handoff",
    recordId: handoff.id,
    after: { from: input.fromAgentSlug, to: input.toAgentSlug, taskKey: input.taskKey },
  });
  return { ...handoff, approvalId: approval.id };
}

export async function acceptHandoff(input: { actor: AgentActor; handoffId: string }) {
  const db = getDb();
  const [handoff] = await db.select().from(agentHandoffs).where(eq(agentHandoffs.id, input.handoffId)).limit(1);
  if (!handoff) throw new AgentError("Handoff not found", "not_found");
  const [toAgent] = await db.select().from(agents).where(eq(agents.id, handoff.toAgentId)).limit(1);
  if (!toAgent) throw new AgentError("Receiving agent not found", "not_found");
  const result = await runAgentTask({
    actor: input.actor,
    agentSlug: toAgent.slug,
    taskKey: handoff.taskKey,
    inputs: (handoff.inputs as Record<string, unknown> | null) ?? undefined,
    trigger: "handoff",
    parentRunId: handoff.fromRunId ?? undefined,
  });
  const [updated] = await db
    .update(agentHandoffs)
    .set({
      status: "completed",
      toRunId: result.runId,
      outputSummary: result.output.summary,
      updatedAt: new Date(),
    })
    .where(eq(agentHandoffs.id, handoff.id))
    .returning();
  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "human", userId: input.actor.userId },
    action: "agent_handoff.completed",
    recordType: "agent_handoff",
    recordId: updated.id,
    after: { toRunId: result.runId, status: updated.status },
  });
  return { handoff: updated, run: result };
}
