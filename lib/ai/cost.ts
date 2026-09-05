import { and, eq, gte, sql } from "drizzle-orm";

import { getDb } from "../../db";
import { agents, aiUsageEvents } from "../../db/schema";
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
  provider: string;
  model: string;
  taskType: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd: number;
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
    })
    .returning();
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

export async function usageSummary(organizationId: string) {
  const db = getDb();
  const day = startOfUtcDay();
  const month = startOfUtcMonth();
  const events = await db
    .select()
    .from(aiUsageEvents)
    .where(and(eq(aiUsageEvents.organizationId, organizationId), gte(aiUsageEvents.createdAt, month)));
  const daily = events.filter((event) => event.createdAt >= day);
  const sum = (rows: typeof events) =>
    rows.reduce((total, event) => total + Number(event.estimatedCostUsd ?? 0), 0);
  return {
    monthCostUsd: sum(events),
    dayCostUsd: sum(daily),
    monthRuns: events.length,
    dayRuns: daily.length,
    events,
  };
}
