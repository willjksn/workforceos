import { and, eq } from "drizzle-orm";

import { getDb } from "../../db";
import {
  agentOutputs,
  agentPermissions,
  agentRuns,
  agents,
  aiModelConfigs,
  opportunitySignals,
} from "../../db/schema";
import { requestApproval } from "../approvals/service";
import { recordAuditEvent } from "../audit/record-audit-event";
import { createDeliveryProject, createProposalFromPlan, triggerBillingEvent } from "../delivery/engine";
import { createDraftAgentMapping } from "../repositories/military";
import { runInternalTalentSearch } from "../repositories/recruiting";
import { addOpportunitySignal, createOpportunity } from "../repositories/crm";
import { draftAiWorkforceRecommendation } from "../workforce/engine";
import { parseAutonomyLevel, canWriteDraftRecords, canExecuteInternalWorkflow } from "./autonomy";
import { assertCircuitClosed, recordRunFailure, recordRunSuccess } from "./circuit";
import { buildAgentContext } from "./context";
import { assertCostLimits, recordUsage } from "./cost";
import { AgentError } from "./errors";
import { agentAllowsTask, agentDefinition, isForbiddenTask } from "./registry";
import { completePrompt, parseModelJson } from "./provider";
import { loadApprovedPrompt } from "./prompts";
import { executeHeuristicTask } from "./tasks";

export type AgentActor = {
  organizationId: string;
  userId?: string | null;
  roleSlugs?: string[];
  permissions: ReadonlySet<string>;
};

export async function runAgentTask(input: {
  actor: AgentActor;
  agentSlug: string;
  taskKey: string;
  recordType?: string;
  recordId?: string;
  inputs?: Record<string, unknown>;
  trigger?: "manual" | "automation" | "handoff" | "retry";
  parentRunId?: string;
  serviceCode?: string;
}) {
  if (isForbiddenTask(input.agentSlug, input.taskKey) || !agentAllowsTask(input.agentSlug, input.taskKey)) {
    throw new AgentError(`Agent ${input.agentSlug} cannot perform ${input.taskKey}`, "forbidden");
  }

  const definition = agentDefinition(input.agentSlug);
  if (!definition) throw new AgentError(`Unknown agent ${input.agentSlug}`, "not_found");

  const db = getDb();
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.organizationId, input.actor.organizationId), eq(agents.slug, input.agentSlug)))
    .limit(1);
  if (!agent || agent.status !== "enabled") {
    throw new AgentError(`Agent ${input.agentSlug} is not enabled`, "config");
  }

  const storedPerms = await db
    .select()
    .from(agentPermissions)
    .where(eq(agentPermissions.agentId, agent.id));
  const agentPermSet = new Set(
    storedPerms.length ? storedPerms.map((row) => row.permissionSlug) : definition.permissions,
  );
  for (const permission of agentPermSet) {
    if (!input.actor.permissions.has(permission)) {
      throw new AgentError(`Agent cannot exceed caller permissions (${permission})`, "rbac");
    }
  }
  const effective = new Set([...agentPermSet].filter((permission) => input.actor.permissions.has(permission)));
  if (!agentPermSet.has("candidate_pii.read") || !input.actor.permissions.has("candidate_pii.read")) {
    effective.delete("candidate_pii.read");
  }
  if (effective.size === 0) {
    throw new AgentError("Agent has no overlapping permissions with the caller", "rbac");
  }

  const autonomy = parseAutonomyLevel(agent.autonomyLevel);
  await assertCostLimits({ organizationId: input.actor.organizationId, agentId: agent.id });
  await assertCircuitClosed({ organizationId: input.actor.organizationId, agentId: agent.id });

  const context = await buildAgentContext({
    organizationId: input.actor.organizationId,
    agentSlug: input.agentSlug,
    taskKey: input.taskKey,
    recordType: input.recordType,
    recordId: input.recordId,
    permissions: effective,
    serviceCode: input.serviceCode ?? (typeof contextServiceCode(input.inputs) === "string" ? String(input.inputs?.serviceCode) : null),
  });

  const prompt = await loadApprovedPrompt({
    organizationId: input.actor.organizationId,
    agentId: agent.id,
    promptName: input.taskKey,
  });

  const [modelConfig] = await db
    .select()
    .from(aiModelConfigs)
    .where(
      and(
        eq(aiModelConfigs.organizationId, input.actor.organizationId),
        eq(aiModelConfigs.taskType, input.taskKey),
      ),
    )
    .limit(1);

  const [run] = await db
    .insert(agentRuns)
    .values({
      organizationId: input.actor.organizationId,
      agentId: agent.id,
      status: "running",
      taskKey: input.taskKey,
      workflowCode: context.workflow?.code,
      workflowVersion: context.workflow?.version,
      recordType: input.recordType,
      recordId: input.recordId,
      inputSummary: `${input.agentSlug}:${input.taskKey}`,
      inputs: input.inputs ?? {},
      sources: context.sources,
      triggeredBy: input.trigger ?? "manual",
      parentRunId: input.parentRunId,
      invokedByUserId: input.actor.userId ?? null,
      humanReviewRequired: true,
    })
    .returning();

  try {
    const heuristic = executeHeuristicTask(context);
    const completion = await completePrompt({
      taskType: input.taskKey,
      agentSlug: input.agentSlug,
      temperature: modelConfig?.temperature ? Number(modelConfig.temperature) : undefined,
      timeoutMs: modelConfig?.timeoutMs,
      maxTokens: modelConfig?.maxTokens ?? undefined,
      messages: [
        {
          role: "system",
          content:
            prompt?.content ??
            "You are a WorkforceOS internal agent. Use only supplied database, workflow, and knowledge context. Distinguish sourced facts from inference. Do not invent labor-market or commercial terms. Do not approve your own output.",
        },
        {
          role: "user",
          content: [
            `Task: ${input.taskKey}`,
            `Agent: ${input.agentSlug}`,
            `Workflow: ${context.workflow ? `${context.workflow.code} ${context.workflow.version}` : "none"}`,
            `Record: ${input.recordType ?? "none"} ${input.recordId ?? ""}`,
            `Facts vs inference requirement: label inferences separately.`,
            `Context JSON: ${JSON.stringify({
              record: context.record,
              workflow: context.workflow,
              knowledge: context.knowledge,
              inputs: input.inputs ?? {},
            })}`,
          ].join("\n"),
        },
      ],
    });
    const parsed = parseModelJson(completion.text);
    const summary = typeof parsed.summary === "string" ? parsed.summary : heuristic.summary;
    const missingData = Array.isArray(parsed.missingData)
      ? parsed.missingData.map(String)
      : heuristic.missingData;
    const assumptions = typeof parsed.assumptions === "string" ? parsed.assumptions : heuristic.assumptions;
    const confidence =
      typeof parsed.confidence === "number"
        ? parsed.confidence.toFixed(4)
        : typeof parsed.confidence === "string"
          ? parsed.confidence
          : heuristic.confidence;

    const [output] = await db
      .insert(agentOutputs)
      .values({
        organizationId: input.actor.organizationId,
        agentId: agent.id,
        agentRunId: run.id,
        outputType: input.taskKey,
        reviewCategory: heuristic.reviewCategory,
        recordType: input.recordType,
        recordId: input.recordId,
        summary,
        payload: {
          ...heuristic.payload,
          modelPayload: parsed,
          facts: parsed.facts ?? heuristic.facts,
          inferences: parsed.inferences ?? heuristic.inferences,
        },
        model: completion.model,
        modelVersion: completion.modelVersion,
        provider: completion.provider,
        confidence,
        sourceReferences: context.sources,
        missingData,
        assumptions,
        humanReviewRequired: heuristic.humanReviewRequired,
        status: heuristic.humanReviewRequired ? "pending_review" : "draft",
      })
      .returning();

    let approvalId: string | null = null;
    let approvalState = "not_required";
    if (heuristic.humanReviewRequired) {
      const approval = await requestApproval({
        organizationId: input.actor.organizationId,
        recordType: "agent_output",
        recordId: output.id,
        approvalType: heuristic.reviewCategory ?? "agent_output",
        requestingUserId: null,
        requestingAgentId: agent.id,
      });
      approvalId = approval.id;
      approvalState = "pending";
      await db.update(agentOutputs).set({ approvalId }).where(eq(agentOutputs.id, output.id));
    }

    const draft = canWriteDraftRecords(autonomy)
      ? await applyDraftWrites({
          actor: input.actor,
          agent,
          taskKey: input.taskKey,
          context,
          summary,
          autonomy,
          canExecute: canExecuteInternalWorkflow(autonomy),
          inputs: input.inputs ?? {},
        })
      : null;

    await db
      .update(agentRuns)
      .set({
        status: "completed",
        provider: completion.provider,
        model: completion.model,
        modelVersion: completion.modelVersion,
        outputSummary: summary,
        confidence,
        estimatedCostUsd: String(completion.estimatedCostUsd),
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        sources: context.sources,
        humanReviewRequired: heuristic.humanReviewRequired,
        approvalState,
        completedAt: new Date(),
      })
      .where(eq(agentRuns.id, run.id));

    await recordUsage({
      organizationId: input.actor.organizationId,
      agentId: agent.id,
      agentRunId: run.id,
      provider: completion.provider,
      model: completion.model,
      taskType: input.taskKey,
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
      estimatedCostUsd: completion.estimatedCostUsd,
      modelTier: completion.modelTier,
    });
    await recordRunSuccess({ organizationId: input.actor.organizationId, agentId: agent.id });
    if (heuristic.humanReviewRequired) {
      await recordAuditEvent({
        organizationId: input.actor.organizationId,
        actor: { type: "agent", agentId: agent.id, userId: input.actor.userId },
        action: "agent_output.created",
        recordType: "agent_output",
        recordId: output.id,
        after: {
          taskKey: input.taskKey,
          reviewCategory: heuristic.reviewCategory,
          provider: completion.provider,
          model: completion.model,
        },
      });
    }

    return { runId: run.id, output, approvalId, draft, context };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent run failed";
    await db
      .update(agentRuns)
      .set({
        status: "failed",
        errorDetail: message,
        errorCode: error instanceof AgentError ? error.code : "provider",
        completedAt: new Date(),
      })
      .where(eq(agentRuns.id, run.id));
    await recordRunFailure({
      organizationId: input.actor.organizationId,
      agentId: agent.id,
      error: message,
    });
    throw error;
  }
}

export async function retryAgentRun(input: { actor: AgentActor; runId: string }) {
  const db = getDb();
  const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, input.runId)).limit(1);
  if (!run) throw new AgentError("Run not found", "not_found");
  const [agent] = await db.select().from(agents).where(eq(agents.id, run.agentId)).limit(1);
  if (!agent) throw new AgentError("Agent not found", "not_found");
  return runAgentTask({
    actor: input.actor,
    agentSlug: agent.slug,
    taskKey: run.taskKey,
    recordType: run.recordType ?? undefined,
    recordId: run.recordId ?? undefined,
    inputs: (run.inputs as Record<string, unknown> | null) ?? undefined,
    trigger: "retry",
    parentRunId: run.id,
  });
}

function contextServiceCode(inputs?: Record<string, unknown>) {
  return inputs?.serviceCode;
}

async function applyDraftWrites(input: {
  actor: AgentActor;
  agent: { id: string; slug: string };
  taskKey: string;
  context: Awaited<ReturnType<typeof buildAgentContext>>;
  summary: string;
  autonomy: ReturnType<typeof parseAutonomyLevel>;
  canExecute: boolean;
  inputs: Record<string, unknown>;
}) {
  const organizationId = input.actor.organizationId;
  const userId = input.actor.userId;
  if (input.taskKey === "draft_signal" && input.context.recordType === "company" && input.context.recordId && userId) {
    const signal = await addOpportunitySignal({
      organizationId,
      actorUserId: userId,
      companyId: input.context.recordId,
      signalType: "workforce_need",
      title: "AI draft signal",
      details: input.summary,
      source: "opportunity-scout",
      reviewStatus: "pending_review",
    });
    return { type: "opportunity_signal", id: signal.id };
  }
  if (input.taskKey === "recommend_opportunity" && userId) {
    const companyId =
      (typeof input.inputs.companyId === "string" && input.inputs.companyId) ||
      (input.context.recordType === "company" ? input.context.recordId : null) ||
      (typeof input.context.record?.companyId === "string" ? input.context.record.companyId : null);
    if (companyId) {
      const opportunity = await createOpportunity({
        organizationId,
        actorUserId: userId,
        companyId,
        name: "AI recommended opportunity (draft)",
        stage: "identified",
        notes: input.summary,
        serviceCode: typeof input.inputs.serviceCode === "string" ? input.inputs.serviceCode : null,
      });
      if (input.context.recordType === "opportunity_signal" && input.context.recordId) {
        const db = getDb();
        await db
          .update(opportunitySignals)
          .set({ resultingOpportunityId: opportunity.id, reviewStatus: "converted", updatedAt: new Date() })
          .where(eq(opportunitySignals.id, input.context.recordId));
      }
      return { type: "opportunity", id: opportunity.id };
    }
  }
  if (input.taskKey === "mapping_draft") {
    const militaryOccupationId = String(input.inputs.militaryOccupationId ?? "");
    const civilianOccupationId = String(input.inputs.civilianOccupationId ?? "");
    if (militaryOccupationId && civilianOccupationId) {
      const mapping = await createDraftAgentMapping({
        organizationId,
        originatingAgentId: input.agent.id,
        militaryOccupationId,
        civilianOccupationId,
        explanation: input.summary,
      });
      return { type: "military_civilian_mapping", id: mapping.id };
    }
  }
  if (
    (input.taskKey === "gap_interpretation" || input.taskKey === "workforce_roadmap") &&
    userId &&
    typeof input.inputs.assessmentId === "string"
  ) {
    const kind = input.agent.slug === "workforce-architect" ? "architect" : "analyst";
    const recommendation = await draftAiWorkforceRecommendation({
      actor: { organizationId, userId, roleSlugs: input.actor.roleSlugs },
      assessmentId: input.inputs.assessmentId,
      kind,
    });
    return { type: "workforce_recommendation", id: recommendation.recommendation.id };
  }
  if (input.taskKey === "draft_proposal" && userId && typeof input.inputs.solutionPlanId === "string") {
    const proposal = await createProposalFromPlan({
      actor: { organizationId, userId, roleSlugs: input.actor.roleSlugs },
      solutionPlanId: input.inputs.solutionPlanId,
    });
    return { type: "proposal", id: proposal.proposal.id };
  }
  if (input.taskKey === "internal_talent_search" && input.canExecute && userId && typeof input.inputs.jobId === "string") {
    const result = await runInternalTalentSearch({
      organizationId,
      actorUserId: userId,
      jobId: input.inputs.jobId,
    });
    return { type: "internal_talent_search", id: input.inputs.jobId, result };
  }
  if (
    input.taskKey === "next_actions" &&
    input.canExecute &&
    userId &&
    typeof input.inputs.action === "string" &&
    input.inputs.action === "create_delivery_project" &&
    typeof input.inputs.solutionPlanId === "string"
  ) {
    const created = await createDeliveryProject({
      actor: { organizationId, userId, roleSlugs: input.actor.roleSlugs },
      solutionPlanId: input.inputs.solutionPlanId,
      contractId: typeof input.inputs.contractId === "string" ? input.inputs.contractId : null,
    });
    return { type: "project", id: created.project.id };
  }
  if (
    input.taskKey === "next_actions" &&
    input.canExecute &&
    userId &&
    typeof input.inputs.action === "string" &&
    input.inputs.action === "create_billing_event" &&
    typeof input.inputs.projectId === "string" &&
    typeof input.inputs.amount === "string"
  ) {
    const event = await triggerBillingEvent({
      actor: { organizationId, userId, roleSlugs: input.actor.roleSlugs },
      projectId: input.inputs.projectId,
      amount: input.inputs.amount,
      sourceMilestone: String(input.inputs.sourceMilestone ?? "automation_milestone"),
    });
    return { type: "billing_event", id: event.id };
  }
  return null;
}
