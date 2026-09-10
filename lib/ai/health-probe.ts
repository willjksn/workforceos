import { and, desc, eq, gt, ne, or } from "drizzle-orm";

import { getDb } from "../../db";
import { agentRuns, agents, aiUsageEvents, organizations } from "../../db/schema";
import { recordUsage } from "./cost";
import { AgentError } from "./errors";
import {
  areBusinessCapabilityModelsConfigured,
  capabilityClassForTask,
  isGeminiFallbackConfigured,
  isHeuristicModelName,
  isLiveAiConfigured,
  resolveCapabilityModel,
  resolveClassFallbackModel,
  type AiCapabilityClass,
} from "./capabilities";
import { classifyProviderError, shouldFailoverForAvailability } from "./failover";
import { completePrompt, type CompletionResult } from "./provider";

export const AI_HEALTH_PROBE_TASK = {
  FAST: "status_summary",
  STANDARD: "summarize_company",
  REASONING: "executive_summary",
} as const;

export const UNAVAILABLE_PROBE_MODEL = "workforceos-probe-model-unavailable";

export type AiProbeKind = "FAST" | "STANDARD" | "REASONING" | "GEMINI_FAILOVER";

export type AiProbeRecord = {
  kind: AiProbeKind;
  ok: boolean;
  provider: string;
  model: string;
  capabilityClass: AiCapabilityClass;
  usedFallback: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number;
  latencyMs: number;
  runId: string | null;
  usageId: string | null;
  error: string | null;
  expectedConfiguredModelSet: boolean;
  matchedConfiguredClass: boolean;
};

export type LastAiEvidence = {
  at: Date;
  provider: string;
  model: string | null;
  capabilityClass: string | null;
  usedFallback: boolean;
  source: "agent_runs" | "ai_usage_events";
};

function probeMessages(label: string) {
  return [
    {
      role: "system" as const,
      content:
        "You are a WorkforceOS internal health probe. Reply with JSON only. Do not mention people, emails, phones, compensation, or resumes.",
    },
    {
      role: "user" as const,
      content: [
        `Task: production AI health probe (${label}).`,
        "Return JSON with keys summary, facts, inferences, missingData, assumptions, confidence.",
        "summary must be a short confirmation that this is a harmless internal probe.",
        "facts: [\"No candidate or client records were supplied.\"].",
        "inferences: [].",
        "missingData: [].",
        "assumptions: \"Internal health probe only.\"",
        "confidence: 1.",
      ].join("\n"),
    },
  ];
}

function failIfHeuristic(result: CompletionResult, kind: AiProbeKind) {
  if (result.provider === "internal_heuristic" || isHeuristicModelName(result.model)) {
    throw new AgentError(
      `${kind} probe stayed on internal_heuristic. AI runtime is not making live provider calls.`,
      "provider",
    );
  }
}

async function resolveProbeAgent(organizationId: string) {
  const db = getDb();
  const [preferred] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.organizationId, organizationId), eq(agents.slug, "knowledge-agent")))
    .limit(1);
  if (preferred) return preferred;
  const [anyAgent] = await db.select().from(agents).where(eq(agents.organizationId, organizationId)).limit(1);
  return anyAgent ?? null;
}

export async function resolveProbeOrganizationId(preferred?: string | null) {
  if (preferred) return preferred;
  const db = getDb();
  const [named] = await db.select().from(organizations).where(eq(organizations.slug, "workforceos")).limit(1);
  if (named) return named.id;
  const [first] = await db.select().from(organizations).limit(1);
  if (!first) throw new AgentError("No organization exists to record AI health probes.", "not_found");
  return first.id;
}

async function persistProbe(input: {
  organizationId: string;
  actorUserId?: string | null;
  kind: AiProbeKind;
  taskType: string;
  result: CompletionResult;
}) {
  const db = getDb();
  const agent = await resolveProbeAgent(input.organizationId);
  let runId: string | null = null;
  if (agent) {
    const [run] = await db
      .insert(agentRuns)
      .values({
        organizationId: input.organizationId,
        agentId: agent.id,
        status: "completed",
        taskKey: input.taskType,
        inputSummary: `ai-health-probe:${input.kind}`,
        inputs: { probe: true, kind: input.kind, pii: false },
        sources: [{ type: "system", label: "AI health probe" }],
        provider: input.result.provider,
        model: input.result.model,
        modelVersion: input.result.modelVersion,
        outputSummary: `Controlled ${input.kind} health probe completed.`,
        estimatedCostUsd: String(input.result.estimatedCostUsd),
        inputTokens: input.result.inputTokens,
        outputTokens: input.result.outputTokens,
        humanReviewRequired: false,
        approvalState: "not_required",
        retryCount: input.result.usedFallback ? 1 : 0,
        triggeredBy: "manual",
        invokedByUserId: input.actorUserId ?? null,
        completedAt: new Date(),
      })
      .returning();
    runId = run.id;
  }
  const usage = await recordUsage({
    organizationId: input.organizationId,
    agentId: agent?.id ?? null,
    agentRunId: runId,
    invokedByUserId: input.actorUserId ?? null,
    provider: input.result.provider,
    model: input.result.model,
    taskType: input.taskType,
    inputTokens: input.result.inputTokens,
    outputTokens: input.result.outputTokens,
    estimatedCostUsd: input.result.estimatedCostUsd,
    modelTier: input.result.capabilityClass,
    latencyMs: input.result.latencyMs,
    usedFallback: input.result.usedFallback,
  });
  return { runId, usageId: usage.id };
}

function toRecord(
  kind: AiProbeKind,
  taskType: string,
  result: CompletionResult,
  persisted: { runId: string | null; usageId: string | null },
  extra?: { error?: string | null },
): AiProbeRecord {
  const expectedClass = kind === "GEMINI_FAILOVER" ? capabilityClassForTask(taskType) : kind;
  const configuredModel = resolveCapabilityModel(expectedClass);
  return {
    kind,
    ok: !extra?.error,
    provider: result.provider,
    model: result.model,
    capabilityClass: result.capabilityClass,
    usedFallback: result.usedFallback,
    inputTokens: result.inputTokens ?? null,
    outputTokens: result.outputTokens ?? null,
    estimatedCostUsd: result.estimatedCostUsd,
    latencyMs: result.latencyMs,
    runId: persisted.runId,
    usageId: persisted.usageId,
    error: extra?.error ?? null,
    expectedConfiguredModelSet: !isHeuristicModelName(configuredModel),
    matchedConfiguredClass:
      kind === "GEMINI_FAILOVER"
        ? result.provider === "gemini" && result.usedFallback
        : result.capabilityClass === expectedClass && !result.usedFallback && result.provider !== "internal_heuristic",
  };
}

export async function runClassProbe(input: {
  organizationId: string;
  actorUserId?: string | null;
  kind: "FAST" | "STANDARD" | "REASONING";
}): Promise<AiProbeRecord> {
  const taskType = AI_HEALTH_PROBE_TASK[input.kind];
  const result = await completePrompt({
    taskType,
    capabilityClass: input.kind,
    maxTokens: 400,
    messages: probeMessages(input.kind),
  });
  failIfHeuristic(result, input.kind);
  if (result.usedFallback) {
    throw new AgentError(`${input.kind} probe used fallback. OpenAI live call did not complete on the primary provider.`, "provider");
  }
  if (result.capabilityClass !== input.kind) {
    throw new AgentError(`${input.kind} probe routed to ${result.capabilityClass}.`, "config");
  }
  const persisted = await persistProbe({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    kind: input.kind,
    taskType,
    result,
  });
  return toRecord(input.kind, taskType, result, persisted);
}

export async function runGeminiAvailabilityProbe(input: {
  organizationId: string;
  actorUserId?: string | null;
}): Promise<AiProbeRecord> {
  if (!isGeminiFallbackConfigured()) {
    throw new AgentError("Gemini fallback is not configured. Probe refused.", "config");
  }
  if (!resolveClassFallbackModel("FAST")) {
    throw new AgentError("AI_MODEL_FAST_FALLBACK is unset. Gemini hop cannot run.", "config");
  }
  const taskType = AI_HEALTH_PROBE_TASK.FAST;
  const result = await completePrompt({
    taskType,
    model: UNAVAILABLE_PROBE_MODEL,
    fallbackModel: UNAVAILABLE_PROBE_MODEL,
    maxTokens: 400,
    messages: probeMessages("GEMINI_FAILOVER"),
  });
  failIfHeuristic(result, "GEMINI_FAILOVER");
  if (result.provider !== "gemini" || !result.usedFallback) {
    throw new AgentError(
      `Gemini availability probe did not hop. Provider=${result.provider} usedFallback=${result.usedFallback}.`,
      "provider",
    );
  }
  const persisted = await persistProbe({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    kind: "GEMINI_FAILOVER",
    taskType,
    result,
  });
  return toRecord("GEMINI_FAILOVER", taskType, result, persisted);
}

export function styleDoesNotFailover() {
  return {
    style: shouldFailoverForAvailability(classifyProviderError(new Error("wording was unsatisfactory"))),
    tone: shouldFailoverForAvailability(classifyProviderError(new Error("tone too casual"))),
    structure: shouldFailoverForAvailability(classifyProviderError(new Error("JSON schema mismatch"))),
    lowConfidence: shouldFailoverForAvailability(classifyProviderError(new Error("low confidence"))),
  };
}

export async function runProductionAiVerification(input: {
  organizationId?: string | null;
  actorUserId?: string | null;
  includeGeminiFailover?: boolean;
}) {
  if (!isLiveAiConfigured()) {
    throw new AgentError("Live AI is not configured. Probe refused.", "config");
  }
  if (!areBusinessCapabilityModelsConfigured()) {
    throw new AgentError(
      "FAST / STANDARD / REASONING class model ids are unset. Live calls would stay heuristic.",
      "config",
    );
  }
  const organizationId = await resolveProbeOrganizationId(input.organizationId);
  const styleGate = styleDoesNotFailover();
  if (styleGate.style || styleGate.tone || styleGate.structure || styleGate.lowConfidence) {
    throw new AgentError("Style/tone/structure incorrectly classified as availability failures.", "config");
  }
  const fast = await runClassProbe({ organizationId, actorUserId: input.actorUserId, kind: "FAST" });
  const standard = await runClassProbe({ organizationId, actorUserId: input.actorUserId, kind: "STANDARD" });
  const reasoning = await runClassProbe({ organizationId, actorUserId: input.actorUserId, kind: "REASONING" });
  let gemini: AiProbeRecord | null = null;
  if (input.includeGeminiFailover !== false && isGeminiFallbackConfigured()) {
    gemini = await runGeminiAvailabilityProbe({ organizationId, actorUserId: input.actorUserId });
  }
  return {
    organizationId,
    fast,
    standard,
    reasoning,
    gemini,
    styleDoesNotFailover: true,
    piiUsed: false,
  };
}

export async function loadLastLiveAiEvidence(): Promise<LastAiEvidence | null> {
  const db = getDb();
  const [run] = await db
    .select({
      completedAt: agentRuns.completedAt,
      provider: agentRuns.provider,
      model: agentRuns.model,
      retryCount: agentRuns.retryCount,
      taskKey: agentRuns.taskKey,
    })
    .from(agentRuns)
    .where(and(eq(agentRuns.status, "completed"), ne(agentRuns.provider, "internal_heuristic")))
    .orderBy(desc(agentRuns.completedAt))
    .limit(1);
  const [usage] = await db
    .select({
      createdAt: aiUsageEvents.createdAt,
      provider: aiUsageEvents.provider,
      model: aiUsageEvents.model,
      modelTier: aiUsageEvents.modelTier,
    })
    .from(aiUsageEvents)
    .where(ne(aiUsageEvents.provider, "internal_heuristic"))
    .orderBy(desc(aiUsageEvents.createdAt))
    .limit(1);

  const runAt = run?.completedAt ?? null;
  const usageAt = usage?.createdAt ?? null;
  if (!runAt && !usageAt) return null;
  const useUsage = usageAt && (!runAt || usageAt >= runAt);
  if (useUsage && usage) {
    return {
      at: usage.createdAt,
      provider: usage.provider,
      model: usage.model,
      capabilityClass: usage.modelTier,
      usedFallback: usage.provider === "gemini",
      source: "ai_usage_events",
    };
  }
  if (!run || !runAt || !run.provider) return null;
  return {
    at: runAt,
    provider: run.provider,
    model: run.model,
    capabilityClass: capabilityClassForTask(run.taskKey),
    usedFallback: run.provider === "gemini" || run.retryCount > 0,
    source: "agent_runs",
  };
}

export async function loadLastAiFallbackEvidence(): Promise<LastAiEvidence | null> {
  const db = getDb();
  const [run] = await db
    .select({
      completedAt: agentRuns.completedAt,
      provider: agentRuns.provider,
      model: agentRuns.model,
      retryCount: agentRuns.retryCount,
      taskKey: agentRuns.taskKey,
    })
    .from(agentRuns)
    .where(
      and(
        eq(agentRuns.status, "completed"),
        or(eq(agentRuns.provider, "gemini"), gt(agentRuns.retryCount, 0)),
      ),
    )
    .orderBy(desc(agentRuns.completedAt))
    .limit(1);
  const [usage] = await db
    .select({
      createdAt: aiUsageEvents.createdAt,
      provider: aiUsageEvents.provider,
      model: aiUsageEvents.model,
      modelTier: aiUsageEvents.modelTier,
    })
    .from(aiUsageEvents)
    .where(eq(aiUsageEvents.provider, "gemini"))
    .orderBy(desc(aiUsageEvents.createdAt))
    .limit(1);
  const runAt = run?.completedAt ?? null;
  const usageAt = usage?.createdAt ?? null;
  if (!runAt && !usageAt) return null;
  const useUsage = usageAt && (!runAt || usageAt >= runAt);
  if (useUsage && usage) {
    return {
      at: usage.createdAt,
      provider: usage.provider,
      model: usage.model,
      capabilityClass: usage.modelTier,
      usedFallback: true,
      source: "ai_usage_events",
    };
  }
  if (!run || !runAt || !run.provider) return null;
  return {
    at: runAt,
    provider: run.provider,
    model: run.model,
    capabilityClass: capabilityClassForTask(run.taskKey),
    usedFallback: true,
    source: "agent_runs",
  };
}

export function formatAiEvidence(evidence: LastAiEvidence | null, empty: string) {
  if (!evidence) return empty;
  const model = evidence.model ? ` · model ${evidence.model}` : "";
  const capability = evidence.capabilityClass ? ` · ${evidence.capabilityClass}` : "";
  const fallback = evidence.usedFallback ? " · fallback" : "";
  return `${evidence.at.toISOString()} · ${evidence.provider}${capability}${model}${fallback}`;
}
