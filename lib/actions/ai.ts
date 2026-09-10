"use server";

import { z } from "zod";

import { requireAppPermission, requirePlatformAdmin } from "@/lib/auth/guard";
import { AuthorizationError } from "@/lib/rbac/permissions";
import { AgentError } from "@/lib/ai/errors";
import { runControlledFallbackVerification, runProductionAiVerification } from "@/lib/ai/health-probe";
import { runAgentTask, retryAgentRun } from "@/lib/ai/runner";
import { decideReviewItem } from "@/lib/ai/review";
import { acceptHandoff, createAgentHandoff } from "@/lib/ai/handoffs";
import { approveKnowledgeRecord, createKnowledgeRecord } from "@/lib/ai/knowledge";
import { approvePromptVersion, createPromptVersion } from "@/lib/ai/prompts";

export type ActionState = { error?: string; message?: string };

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError || error instanceof AgentError) return { error: error.message };
  if (error instanceof z.ZodError) return { error: error.issues[0]?.message };
  if (error instanceof Error) return { error: error.message };
  return { error: "Unable to complete AI operation" };
}

function actorFrom(principal: { id: string; organizationId: string; roleSlugs: string[]; permissions: ReadonlySet<string> }) {
  return {
    organizationId: principal.organizationId,
    userId: principal.id,
    roleSlugs: principal.roleSlugs,
    permissions: principal.permissions,
  };
}

export async function runAgentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("agents.manage");
    const { assertRateLimit, RATE_LIMITS } = await import("@/lib/security/rate-limit");
    await assertRateLimit({ key: `ai:${principal.id}`, ...RATE_LIMITS.ai });
    const parsed = z
      .object({
        agentSlug: z.string().min(1),
        taskKey: z.string().min(1),
        recordType: z.string().optional(),
        recordId: z.string().uuid().optional(),
        serviceCode: z.string().optional(),
      })
      .parse({
        agentSlug: formData.get("agentSlug"),
        taskKey: formData.get("taskKey"),
        recordType: formData.get("recordType") || undefined,
        recordId: formData.get("recordId") || undefined,
        serviceCode: formData.get("serviceCode") || undefined,
      });
    await runAgentTask({ actor: actorFrom(principal), ...parsed });
    return {};
  } catch (error) {
    return fail(error);
  }
}

export async function retryRunAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("agents.manage");
    const parsed = z.object({ runId: z.string().uuid() }).parse({ runId: formData.get("runId") });
    await retryAgentRun({ actor: actorFrom(principal), runId: parsed.runId });
    return {};
  } catch (error) {
    return fail(error);
  }
}

export async function decideReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("agents.read");
    const parsed = z
      .object({
        outputId: z.string().uuid(),
        decision: z.enum(["approved", "rejected", "changes_requested"]),
        notes: z.string().optional(),
      })
      .parse({
        outputId: formData.get("outputId"),
        decision: formData.get("decision"),
        notes: formData.get("notes") || undefined,
      });
    await decideReviewItem({
      organizationId: principal.organizationId,
      reviewerUserId: principal.id,
      outputId: parsed.outputId,
      decision: parsed.decision,
      notes: parsed.notes,
      actorType: "human",
      reviewer: principal,
    });
    return {};
  } catch (error) {
    return fail(error);
  }
}

export async function createKnowledgeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("knowledge.write");
    const parsed = z
      .object({
        slug: z.string().trim().min(1),
        title: z.string().trim().min(1),
        knowledgeType: z.enum([
          "service_playbook",
          "military_methodology",
          "workforce_methodology",
          "legal_template_reference",
          "recruiting_playbook",
          "client_approved_insight",
          "lessons_learned",
          "case_study",
          "internal_process",
        ]),
        content: z.string().trim().min(1),
        source: z.string().optional(),
      })
      .parse({
        slug: formData.get("slug"),
        title: formData.get("title"),
        knowledgeType: formData.get("knowledgeType"),
        content: formData.get("content"),
        source: formData.get("source") || undefined,
      });
    await createKnowledgeRecord({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      ...parsed,
    });
    return {};
  } catch (error) {
    return fail(error);
  }
}

export async function approveKnowledgeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("knowledge.approve");
    const parsed = z.object({ knowledgeRecordId: z.string().uuid() }).parse({
      knowledgeRecordId: formData.get("knowledgeRecordId"),
    });
    await approveKnowledgeRecord({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      knowledgeRecordId: parsed.knowledgeRecordId,
    });
    return {};
  } catch (error) {
    return fail(error);
  }
}

export async function createPromptAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("agents.manage");
    const parsed = z
      .object({
        agentId: z.string().uuid(),
        promptName: z.string().min(1),
        version: z.string().min(1),
        content: z.string().min(1),
        changeReason: z.string().min(1),
      })
      .parse({
        agentId: formData.get("agentId"),
        promptName: formData.get("promptName"),
        version: formData.get("version"),
        content: formData.get("content"),
        changeReason: formData.get("changeReason"),
      });
    await createPromptVersion({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      ...parsed,
      status: "draft",
    });
    return {};
  } catch (error) {
    return fail(error);
  }
}

export async function approvePromptAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("agents.manage");
    const parsed = z.object({ promptVersionId: z.string().uuid() }).parse({
      promptVersionId: formData.get("promptVersionId"),
    });
    await approvePromptVersion({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      promptVersionId: parsed.promptVersionId,
    });
    return {};
  } catch (error) {
    return fail(error);
  }
}

export async function createHandoffAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("agents.manage");
    const parsed = z
      .object({
        fromAgentSlug: z.string().min(1),
        toAgentSlug: z.string().min(1),
        taskKey: z.string().min(1),
      })
      .parse({
        fromAgentSlug: formData.get("fromAgentSlug"),
        toAgentSlug: formData.get("toAgentSlug"),
        taskKey: formData.get("taskKey"),
      });
    await createAgentHandoff({ actor: actorFrom(principal), ...parsed });
    return {};
  } catch (error) {
    return fail(error);
  }
}

export async function acceptHandoffAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("agents.manage");
    const parsed = z.object({ handoffId: z.string().uuid() }).parse({ handoffId: formData.get("handoffId") });
    await acceptHandoff({ actor: actorFrom(principal), handoffId: parsed.handoffId });
    return {};
  } catch (error) {
    return fail(error);
  }
}

function summarizeLiveProbe(label: string, probe: { ok: boolean; requestedModel: string; model: string; provider: string; usedFallback: boolean }) {
  const echoed = probe.model !== probe.requestedModel ? ` (provider echoed ${probe.model})` : "";
  return `OpenAI ${label} LIVE — ${probe.requestedModel}${echoed} — ${probe.ok && !probe.usedFallback && probe.provider !== "internal_heuristic" ? "PASS" : "FAIL"}`;
}

export async function verifyProductionAiAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    const principal = await requirePlatformAdmin();
    const result = await runProductionAiVerification({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      includeGeminiFailover: false,
    });
    const lines = [
      `Resolved FAST=${result.resolvedModels.FAST} STANDARD=${result.resolvedModels.STANDARD} REASONING=${result.resolvedModels.REASONING}`,
      summarizeLiveProbe("FAST", result.fast),
      summarizeLiveProbe("STANDARD", result.standard),
      summarizeLiveProbe("REASONING", result.reasoning),
      "Gemini fallback: not run (use Controlled fallback probe)",
      `PII used: ${result.piiUsed ? "yes" : "no"}`,
    ];
    return { message: lines.join(" · ") };
  } catch (error) {
    return fail(error);
  }
}

export async function verifyProductionAiFallbackAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    const principal = await requirePlatformAdmin();
    const result = await runControlledFallbackVerification({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
    });
    const probe = result.gemini;
    return {
      message: `Gemini fallback CONTROLLED PROBE — ${probe.ok && probe.usedFallback && probe.provider === "gemini" ? "PASS" : "FAIL"} provider=${probe.provider} fallback=${probe.usedFallback ? "yes" : "no"}`,
    };
  } catch (error) {
    return fail(error);
  }
}
