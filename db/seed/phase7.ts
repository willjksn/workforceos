import { eq } from "drizzle-orm";

import type { getDb } from "../index";
import {
  agentPermissions,
  agents,
  aiModelConfigs,
  automationRules,
  knowledgeRecords,
  promptVersions,
} from "../schema";
import { APPROVED_AGENTS, AUTOMATION_RULE_SPECS } from "../../lib/ai/registry";
import { INTERNAL_ORG_ID } from "./constants";

export async function seedPhase7Ai(
  db: ReturnType<typeof getDb>,
  options: { approvedByUserId?: string | null } = {},
) {
  const approvedByUserId = options.approvedByUserId ?? null;
  for (const definition of APPROVED_AGENTS) {
    await db
      .insert(agents)
      .values({
        organizationId: INTERNAL_ORG_ID,
        slug: definition.slug,
        name: definition.name,
        description: definition.description,
        status: "enabled",
        autonomyLevel: definition.autonomyLevel,
        defaultTaskType: definition.tasks[0],
        dailyCostLimitUsd: "25.0000",
        monthlyCostLimitUsd: "250.0000",
      })
      .onConflictDoUpdate({
        target: [agents.organizationId, agents.slug],
        set: {
          name: definition.name,
          description: definition.description,
          status: "enabled",
          autonomyLevel: definition.autonomyLevel,
          defaultTaskType: definition.tasks[0],
          dailyCostLimitUsd: "25.0000",
          monthlyCostLimitUsd: "250.0000",
        },
      });
  }

  const registered = await db.select().from(agents).where(eq(agents.organizationId, INTERNAL_ORG_ID));
  const bySlug = Object.fromEntries(registered.map((row) => [row.slug, row]));

  for (const definition of APPROVED_AGENTS) {
    const agent = bySlug[definition.slug];
    if (!agent) continue;
    for (const permissionSlug of definition.permissions) {
      await db
        .insert(agentPermissions)
        .values({ agentId: agent.id, permissionSlug })
        .onConflictDoNothing();
    }
    for (const task of definition.tasks) {
      await db
        .insert(promptVersions)
        .values({
          organizationId: INTERNAL_ORG_ID,
          agentId: agent.id,
          promptName: task,
          version: "1.0",
          status: "approved",
          content: `WorkforceOS ${definition.name} task ${task}. Use only supplied PostgreSQL context, approved workflows, and approved knowledge. Label sourced facts separately from inference. Never invent labor-market statistics, fees, or legal language. Never approve your own output. Never send external communications or execute contracts.`,
          changeReason: "Phase 7 initial approved prompt",
          approvedByUserId,
          approvedAt: new Date(),
        })
        .onConflictDoNothing();
    }
  }

  await db
    .insert(aiModelConfigs)
    .values({
      organizationId: INTERNAL_ORG_ID,
      taskType: "default",
      provider: "internal_heuristic",
      model: "heuristic-v1",
      modelVersion: "unconfigured",
      temperature: "0.200",
      timeoutMs: 30000,
      dailyCostLimitUsd: "50.0000",
      monthlyCostLimitUsd: "500.0000",
      fallbackProvider: "internal_heuristic",
      fallbackModel: "heuristic-v1",
      status: "active",
    })
    .onConflictDoNothing();

  for (const spec of AUTOMATION_RULE_SPECS) {
    await db
      .insert(automationRules)
      .values({
        organizationId: INTERNAL_ORG_ID,
        code: spec.code,
        name: spec.name,
        description: spec.name,
        eventName: spec.eventName,
        agentSlug: spec.agentSlug,
        taskKey: spec.taskKey,
        actionKey: spec.actionKey,
        status: "enabled",
      })
      .onConflictDoNothing();
  }

  const knowledgeSeed = [
    {
      slug: "professional-search-playbook",
      title: "Professional Search playbook",
      knowledgeType: "recruiting_playbook" as const,
      content:
        "Internal Talent Network search completes before any external sourcing adapter. Candidate scores are job-specific. Submissions require human approval. Scores never auto-reject.",
      source: "SERVICE_WORKFLOWS.md",
    },
    {
      slug: "military-mapping-methodology",
      title: "Military mapping methodology",
      knowledgeType: "military_methodology" as const,
      content:
        "Military-to-civilian mappings store source, version, confidence, origin, and review status. Agent drafts start pending. The originating agent cannot approve them.",
      source: "DEC-MIL-001",
    },
    {
      slug: "workforce-intelligence-method",
      title: "Workforce intelligence method",
      knowledgeType: "workforce_methodology" as const,
      content:
        "Forecasts, gaps, and scenarios are estimates with provenance. Do not fabricate BLS, Census, or O*NET values. Client-facing recommendations require human approval.",
      source: "DEC-WF-003",
    },
    {
      slug: "internal-process-ai-ops",
      title: "AI operations process",
      knowledgeType: "internal_process" as const,
      content:
        "Agents operate on PostgreSQL. Material outputs go to the Review Queue. Autonomy level 4 never sends unsupervised external commitments.",
      source: "DEC-AI-002",
    },
  ];
  for (const row of knowledgeSeed) {
    await db
      .insert(knowledgeRecords)
      .values({
        organizationId: INTERNAL_ORG_ID,
        slug: row.slug,
        title: row.title,
        knowledgeType: row.knowledgeType,
        content: row.content,
        source: row.source,
        status: "approved",
        version: "1.0",
        privacyClass: "internal",
        requiredPermission: "knowledge.read",
        approvedByUserId,
        approvedAt: new Date(),
        changeReason: "Phase 7 catalog seed",
      })
      .onConflictDoNothing();
  }
}
