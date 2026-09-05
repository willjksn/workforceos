import { and, eq } from "drizzle-orm";

import { getDb } from "../../db";
import { automationRuleRuns, automationRules, projects } from "../../db/schema";
import { createDeliveryProject, triggerBillingEvent } from "../delivery/engine";
import { runInternalTalentSearch } from "../repositories/recruiting";
import { runAgentTask, type AgentActor } from "./runner";

export async function dispatchOperatingEvent(input: {
  actor: AgentActor;
  eventName: string;
  recordType?: string;
  recordId?: string;
  payload?: Record<string, unknown>;
}) {
  const db = getDb();
  const rules = await db
    .select()
    .from(automationRules)
    .where(
      and(
        eq(automationRules.organizationId, input.actor.organizationId),
        eq(automationRules.eventName, input.eventName),
        eq(automationRules.status, "enabled"),
      ),
    );
  const results = [];
  for (const rule of rules.slice(0, 10)) {
    try {
      const outcome = await executeRuleAction(rule, input);
      const [run] = await db
        .insert(automationRuleRuns)
        .values({
          organizationId: input.actor.organizationId,
          ruleId: rule.id,
          eventName: input.eventName,
          recordType: input.recordType,
          recordId: input.recordId,
          status: "completed",
          resultSummary: outcome.summary,
          agentRunId: outcome.agentRunId ?? null,
        })
        .returning();
      results.push({ rule, run, outcome });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Automation failed";
      const [run] = await db
        .insert(automationRuleRuns)
        .values({
          organizationId: input.actor.organizationId,
          ruleId: rule.id,
          eventName: input.eventName,
          recordType: input.recordType,
          recordId: input.recordId,
          status: "failed",
          errorDetail: message,
        })
        .returning();
      results.push({ rule, run, error: message });
    }
  }
  return results;
}

async function executeRuleAction(
  rule: typeof automationRules.$inferSelect,
  input: {
    actor: AgentActor;
    recordType?: string;
    recordId?: string;
    payload?: Record<string, unknown>;
  },
) {
  const payload = input.payload ?? {};
  if (rule.actionKey === "internal_talent_search") {
    const jobId = String(payload.jobId ?? input.recordId ?? "");
    if (!jobId || !input.actor.userId) throw new Error("jobId required");
    await runInternalTalentSearch({
      organizationId: input.actor.organizationId,
      actorUserId: input.actor.userId,
      jobId,
    });
    const agentRun = rule.agentSlug
      ? await runAgentTask({
          actor: input.actor,
          agentSlug: rule.agentSlug,
          taskKey: rule.taskKey ?? "internal_talent_search",
          recordType: "job",
          recordId: jobId,
          inputs: { jobId },
          trigger: "automation",
        })
      : null;
    return { summary: "Internal Talent Network search started", agentRunId: agentRun?.runId };
  }
  if (rule.actionKey === "create_delivery_project") {
    const contractId = String(payload.contractId ?? input.recordId ?? "");
    const db = getDb();
    const [existing] = contractId
      ? await db.select().from(projects).where(eq(projects.contractId, contractId)).limit(1)
      : [undefined];
    if (existing) return { summary: "Delivery project already exists for contract", agentRunId: null };
    const solutionPlanId = String(payload.solutionPlanId ?? "");
    if (!solutionPlanId || !input.actor.userId) throw new Error("solutionPlanId required");
    const created = await createDeliveryProject({
      actor: {
        organizationId: input.actor.organizationId,
        userId: input.actor.userId,
        roleSlugs: input.actor.roleSlugs,
      },
      solutionPlanId,
      contractId: contractId || null,
    });
    return { summary: `Created delivery project ${created.project.id}`, agentRunId: null, projectId: created.project.id };
  }
  if (rule.actionKey === "create_billing_event") {
    if (!input.actor.userId) throw new Error("actor required");
    const event = await triggerBillingEvent({
      actor: {
        organizationId: input.actor.organizationId,
        userId: input.actor.userId,
        roleSlugs: input.actor.roleSlugs,
      },
      projectId: String(payload.projectId ?? input.recordId ?? ""),
      amount: String(payload.amount ?? "0"),
      sourceMilestone: String(payload.sourceMilestone ?? "milestone_completed"),
    });
    return { summary: `Billing event ${event.id} triggered from stored terms`, agentRunId: null, billingEventId: event.id };
  }
  if (rule.agentSlug && rule.taskKey) {
    const result = await runAgentTask({
      actor: input.actor,
      agentSlug: rule.agentSlug,
      taskKey: rule.taskKey,
      recordType: input.recordType,
      recordId: input.recordId,
      inputs: payload,
      trigger: "automation",
    });
    return { summary: result.output.summary, agentRunId: result.runId };
  }
  return { summary: `Rule ${rule.code} recorded`, agentRunId: null };
}
