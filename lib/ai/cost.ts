import { and, count, desc, eq, gte, sql } from "drizzle-orm";

import { getDb } from "../../db";
import { agents, aiUsageEvents } from "../../db/schema";
import { logServerEvent } from "../observability/monitor";
import { AgentError } from "./errors";

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export async function recordUsage(input: {
  organizationId: string;
  agentId?: string | null;
  agentRunId?: string | null;
  invokedByUserId?: string | null;
  provider: string;
  model: string;
  taskType: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd: number;
  modelTier?: string | null;
  latencyMs?: number | null;
  usedFallback?: boolean;
  webSearchCalls?: number | null;
  tavilyRequests?: number | null;
}) {
  const db = getDb();
  const [row] = await db
    .insert(aiUsageEvents)
    .values({
      organizationId: input.organizationId,
      agentId: input.agentId ?? null,
      agentRunId: input.agentRunId ?? null,
      provider: input.provider,
      model: input.model,
      taskType: input.taskType,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      estimatedCostUsd: String(input.estimatedCostUsd),
      modelTier: input.modelTier ?? null,
      webSearchCalls: input.webSearchCalls ?? 0,
      tavilyRequests: input.tavilyRequests ?? 0,
    })
    .returning();
  logServerEvent("ai.usage", {
    taskType: input.taskType,
    provider: input.provider,
    model: input.model,
    modelTier: input.modelTier,
    latencyMs: input.latencyMs,
    usedFallback: input.usedFallback ?? false,
    hasUser: Boolean(input.invokedByUserId),
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    estimatedCostUsd: input.estimatedCostUsd,
  });
  return row;
}

async function usageSince(organizationId: string, agentId: string, since: Date) {
  const db = getDb();
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${aiUsageEvents.estimatedCostUsd}), 0)`,
    })
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.organizationId, organizationId),
        eq(aiUsageEvents.agentId, agentId),
        gte(aiUsageEvents.createdAt, since),
      ),
    );
  return Number(row?.total ?? 0);
}

export async function assertCostLimits(input: {
  organizationId: string;
  agentId: string;
  additionalCostUsd?: number;
}) {
  const db = getDb();
  const [agent] = await db.select().from(agents).where(eq(agents.id, input.agentId)).limit(1);
  if (!agent) throw new AgentError("Agent not found", "not_found");
  const additional = input.additionalCostUsd ?? 0;
  const dailyLimit = agent.dailyCostLimitUsd ? Number(agent.dailyCostLimitUsd) : null;
  const monthlyLimit = agent.monthlyCostLimitUsd ? Number(agent.monthlyCostLimitUsd) : null;
  if (dailyLimit != null) {
    const used = await usageSince(input.organizationId, input.agentId, startOfUtcDay());
    if (used + additional >= dailyLimit) {
      throw new AgentError("Daily AI cost limit reached for this agent", "cost_limit");
    }
  }
  if (monthlyLimit != null) {
    const used = await usageSince(input.organizationId, input.agentId, startOfUtcMonth());
    if (used + additional >= monthlyLimit) {
      throw new AgentError("Monthly AI cost limit reached for this agent", "cost_limit");
    }
  }
}

export async function listCostLimitAlerts(organizationId: string) {
  const db = getDb();
  const rows = await db.select().from(agents).where(eq(agents.organizationId, organizationId));
  const alerts: Array<{
    agentId: string;
    slug: string;
    period: "daily" | "monthly";
    usedUsd: number;
    limitUsd: number;
  }> = [];
  for (const agent of rows) {
    const dailyLimit = agent.dailyCostLimitUsd ? Number(agent.dailyCostLimitUsd) : null;
    const monthlyLimit = agent.monthlyCostLimitUsd ? Number(agent.monthlyCostLimitUsd) : null;
    if (dailyLimit != null) {
      const used = await usageSince(organizationId, agent.id, startOfUtcDay());
      if (used >= dailyLimit) {
        alerts.push({ agentId: agent.id, slug: agent.slug, period: "daily", usedUsd: used, limitUsd: dailyLimit });
      }
    }
    if (monthlyLimit != null) {
      const used = await usageSince(organizationId, agent.id, startOfUtcMonth());
      if (used >= monthlyLimit) {
        alerts.push({ agentId: agent.id, slug: agent.slug, period: "monthly", usedUsd: used, limitUsd: monthlyLimit });
      }
    }
  }
  return alerts;
}

export async function usageSummary(organizationId: string, options?: { includeEvents?: boolean }) {
  const db = getDb();
  const day = startOfUtcDay();
  const month = startOfUtcMonth();
  const includeEvents = options?.includeEvents !== false;
  const [monthAgg, dayAgg, events] = await Promise.all([
    db
      .select({
        cost: sql<string>`coalesce(sum(${aiUsageEvents.estimatedCostUsd}), 0)`,
        runs: count(),
      })
      .from(aiUsageEvents)
      .where(and(eq(aiUsageEvents.organizationId, organizationId), gte(aiUsageEvents.createdAt, month))),
    db
      .select({
        cost: sql<string>`coalesce(sum(${aiUsageEvents.estimatedCostUsd}), 0)`,
        runs: count(),
      })
      .from(aiUsageEvents)
      .where(and(eq(aiUsageEvents.organizationId, organizationId), gte(aiUsageEvents.createdAt, day))),
    includeEvents
      ? db
          .select()
          .from(aiUsageEvents)
          .where(and(eq(aiUsageEvents.organizationId, organizationId), gte(aiUsageEvents.createdAt, month)))
          .orderBy(desc(aiUsageEvents.createdAt))
          .limit(40)
      : Promise.resolve([]),
  ]);
  return {
    monthCostUsd: Number(monthAgg[0]?.cost ?? 0),
    dayCostUsd: Number(dayAgg[0]?.cost ?? 0),
    monthRuns: Number(monthAgg[0]?.runs ?? 0),
    dayRuns: Number(dayAgg[0]?.runs ?? 0),
    events,
  };
}
