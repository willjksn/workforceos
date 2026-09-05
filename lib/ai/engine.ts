import { and, desc, eq, gte, sql } from "drizzle-orm";

import { getDb } from "../../db";
import {
  agentHandoffs,
  agentOutputs,
  agentPermissions,
  agentRuns,
  agents,
  aiCircuitBreakers,
  automationRuleRuns,
  automationRules,
  knowledgeRecords,
  promptVersions,
} from "../../db/schema";
import { listReviewQueue } from "./review";
import { usageSummary } from "./cost";

export async function listAgents(organizationId: string) {
  const db = getDb();
  return db.select().from(agents).where(eq(agents.organizationId, organizationId));
}

export async function listAgentRuns(organizationId: string, failedOnly = false) {
  const db = getDb();
  const rows = await db
    .select({ run: agentRuns, agent: agents })
    .from(agentRuns)
    .innerJoin(agents, eq(agentRuns.agentId, agents.id))
    .where(eq(agentRuns.organizationId, organizationId))
    .orderBy(desc(agentRuns.startedAt))
    .limit(100);
  return failedOnly ? rows.filter((row) => row.run.status === "failed") : rows;
}

export async function getAgentRun(organizationId: string, runId: string) {
  const db = getDb();
  const [row] = await db
    .select({ run: agentRuns, agent: agents })
    .from(agentRuns)
    .innerJoin(agents, eq(agentRuns.agentId, agents.id))
    .where(and(eq(agentRuns.organizationId, organizationId), eq(agentRuns.id, runId)))
    .limit(1);
  if (!row) return null;
  const outputs = await db.select().from(agentOutputs).where(eq(agentOutputs.agentRunId, runId));
  return { ...row, outputs };
}

export async function listAgentOutputs(organizationId: string) {
  const db = getDb();
  return db
    .select({ output: agentOutputs, agent: agents })
    .from(agentOutputs)
    .innerJoin(agents, eq(agentOutputs.agentId, agents.id))
    .where(eq(agentOutputs.organizationId, organizationId))
    .orderBy(desc(agentOutputs.createdAt))
    .limit(100);
}

export async function listAutomation(organizationId: string) {
  const db = getDb();
  const rules = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.organizationId, organizationId));
  const runs = await db
    .select()
    .from(automationRuleRuns)
    .where(eq(automationRuleRuns.organizationId, organizationId))
    .orderBy(desc(automationRuleRuns.createdAt))
    .limit(50);
  return { rules, runs };
}

export async function listPromptVersions(organizationId: string) {
  const db = getDb();
  return db
    .select({ prompt: promptVersions, agent: agents })
    .from(promptVersions)
    .innerJoin(agents, eq(promptVersions.agentId, agents.id))
    .where(eq(promptVersions.organizationId, organizationId))
    .orderBy(desc(promptVersions.createdAt));
}

export async function listKnowledge(organizationId: string) {
  const db = getDb();
  return db
    .select()
    .from(knowledgeRecords)
    .where(eq(knowledgeRecords.organizationId, organizationId))
    .orderBy(desc(knowledgeRecords.updatedAt));
}

export async function listAgentPermissionRows(organizationId: string) {
  const db = getDb();
  const rows = await db.select().from(agents).where(eq(agents.organizationId, organizationId));
  const perms = await db.select().from(agentPermissions);
  return rows.map((agent) => ({
    agent,
    permissions: perms.filter((row) => row.agentId === agent.id).map((row) => row.permissionSlug),
  }));
}

export async function commandCenterSnapshot(organizationId: string) {
  const db = getDb();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const enabledAgents = await db
    .select()
    .from(agents)
    .where(and(eq(agents.organizationId, organizationId), eq(agents.status, "enabled")));
  const runsToday = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentRuns)
    .where(and(eq(agentRuns.organizationId, organizationId), gte(agentRuns.startedAt, today)));
  const failed = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentRuns)
    .where(and(eq(agentRuns.organizationId, organizationId), eq(agentRuns.status, "failed")));
  const reviews = await listReviewQueue(organizationId);
  const usage = await usageSummary(organizationId);
  const recentOutputs = await listAgentOutputs(organizationId);
  const automations = await db
    .select({ count: sql<number>`count(*)` })
    .from(automationRuleRuns)
    .where(and(eq(automationRuleRuns.organizationId, organizationId), gte(automationRuleRuns.createdAt, today)));
  const handoffs = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentHandoffs)
    .where(and(eq(agentHandoffs.organizationId, organizationId), eq(agentHandoffs.status, "pending")));
  const breakers = await db
    .select()
    .from(aiCircuitBreakers)
    .where(eq(aiCircuitBreakers.organizationId, organizationId));
  return {
    enabledAgents,
    runsToday: Number(runsToday[0]?.count ?? 0),
    failures: Number(failed[0]?.count ?? 0),
    pendingReviews: reviews.length,
    estimatedCostToday: usage.dayCostUsd,
    estimatedCostMonth: usage.monthCostUsd,
    recentOutputs: recentOutputs.slice(0, 8),
    automationsTriggeredToday: Number(automations[0]?.count ?? 0),
    approvalBacklog: reviews.length,
    pendingHandoffs: Number(handoffs[0]?.count ?? 0),
    openBreakers: breakers.filter((row) => row.state === "open"),
  };
}

export { usageSummary };
