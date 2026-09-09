import { afterEach, describe, expect, it, vi } from "vitest";

import {
  capabilityClassForTask,
  describeAiRuntime,
  getAiRuntimeMode,
  isLiveAiConfigured,
  resolveAiApiKey,
  resolveCapabilityModel,
} from "../lib/ai/capabilities";
import { completePrompt } from "../lib/ai/provider";
import { isForbiddenTask } from "../lib/ai/registry";
import { resetServerEnvCache } from "../lib/env";
import { ROLE_PERMISSIONS, can, type Principal } from "../lib/rbac/permissions";
import { isRegisteredCommand, SCOUT_COMMAND_FAMILIES } from "../lib/scout/commands";
import { assertScoutCannotSend, isScoutExternalSendEnabled, rejectScoutSend } from "../lib/scout/execute";
import { parseScoutIntent } from "../lib/scout/parse-intent";
import { stripScoutPii } from "../lib/scout/pii";

function principalFor(role: keyof typeof ROLE_PERMISSIONS): Principal {
  return {
    id: "user-1",
    status: "active",
    organizationId: "org-1",
    roleSlugs: [role],
    permissions: new Set(ROLE_PERMISSIONS[role]),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  resetServerEnvCache();
});

describe("Phase B capability-class models", () => {
  it("maps features to FAST / STANDARD / REASONING / EMBEDDING instead of gpt-* strings", () => {
    expect(capabilityClassForTask("scout_search")).toBe("FAST");
    expect(capabilityClassForTask("match_scoring")).toBe("STANDARD");
    expect(capabilityClassForTask("mapping_draft")).toBe("REASONING");
    expect(capabilityClassForTask("draft_proposal")).toBe("REASONING");
    expect(capabilityClassForTask("retrieve_knowledge")).toBe("EMBEDDING");
  });

  it("aliases AI_MODEL_* onto existing OPENAI_* / AI_MODEL names", () => {
    vi.stubEnv("AI_MODEL_FAST", "fast-class");
    vi.stubEnv("AI_MODEL_STANDARD", "standard-class");
    vi.stubEnv("AI_MODEL_REASONING", "reasoning-class");
    vi.stubEnv("AI_MODEL_EMBEDDING", "embedding-class");
    resetServerEnvCache();
    expect(resolveCapabilityModel("FAST")).toBe("fast-class");
    expect(resolveCapabilityModel("STANDARD")).toBe("standard-class");
    expect(resolveCapabilityModel("REASONING")).toBe("reasoning-class");
    expect(resolveCapabilityModel("EMBEDDING")).toBe("embedding-class");
  });

  it("falls back through OPENAI_MODEL_* and AI_MODEL without inventing a provider brand", () => {
    vi.stubEnv("OPENAI_MODEL_FAST", "legacy-fast");
    vi.stubEnv("OPENAI_MODEL_BALANCED", "legacy-balanced");
    vi.stubEnv("OPENAI_MODEL_PRIMARY", "legacy-primary");
    vi.stubEnv("OPENAI_EMBEDDING_MODEL", "legacy-embed");
    resetServerEnvCache();
    expect(resolveCapabilityModel("FAST")).toBe("legacy-fast");
    expect(resolveCapabilityModel("STANDARD")).toBe("legacy-balanced");
    expect(resolveCapabilityModel("REASONING")).toBe("legacy-primary");
    expect(resolveCapabilityModel("EMBEDDING")).toBe("legacy-embed");
  });

  it("treats OPENAI_API_KEY as an alias for AI_API_KEY", () => {
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-alias");
    vi.stubEnv("AI_PROVIDER", "openai_compatible");
    resetServerEnvCache();
    expect(resolveAiApiKey()).toBe("sk-test-alias");
    expect(isLiveAiConfigured()).toBe(true);
    expect(getAiRuntimeMode()).toBe("live");
  });

  it("is heuristic when no API key is set", async () => {
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("AI_PROVIDER", "");
    resetServerEnvCache();
    expect(isLiveAiConfigured()).toBe(false);
    expect(getAiRuntimeMode()).toBe("heuristic");
    const result = await completePrompt({
      taskType: "scout_search",
      messages: [{ role: "user", content: "Task: scout_search" }],
    });
    expect(result.provider).toBe("internal_heuristic");
    expect(result.model).toBe("heuristic-v1");
    expect(result.capabilityClass).toBe("FAST");
    expect(result.estimatedCostUsd).toBe(0);
    expect(JSON.parse(result.text).inferences[0]).toMatch(/without a configured model provider/i);
  });

  it("labels runtime live vs heuristic without exposing secrets", () => {
    vi.stubEnv("AI_API_KEY", "sk-live-not-for-logs");
    vi.stubEnv("AI_PROVIDER", "openai_compatible");
    resetServerEnvCache();
    const live = describeAiRuntime();
    expect(live.mode).toBe("live");
    expect(live.providerName).toBe("openai_compatible");
    expect(JSON.stringify(live)).not.toContain("sk-live");
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    resetServerEnvCache();
    const heuristic = describeAiRuntime();
    expect(heuristic.mode).toBe("heuristic");
    expect(heuristic.providerName).toBe("internal_heuristic");
    expect(heuristic.scoutConfigured).toBe(true);
  });
});

describe("Phase B Scout closed commands and domains", () => {
  it("keeps the command registry closed and never accepts SQL", () => {
    expect(SCOUT_COMMAND_FAMILIES).toContain("SEARCH");
    expect(isRegisteredCommand("SEARCH")).toBe(true);
    expect(isRegisteredCommand("RUN_SQL")).toBe(false);
    expect(parseScoutIntent("SELECT * FROM candidates").ok).toBe(false);
    expect(parseScoutIntent("INSERT INTO invoices VALUES (1)").ok).toBe(false);
  });

  it("parses operating surfaces for Companies through Knowledge", () => {
    const cases: Array<[string, string]> = [
      ["Show companies in energy", "companies"],
      ["Search contacts at this account", "contacts"],
      ["Show commercial opportunities", "opportunities"],
      ["Find candidates open to opportunities", "candidates"],
      ["Show open jobs", "jobs"],
      ["Show transitioning service members who need an employer match", "skillbridge"],
      ["Show SkillBridge-eligible employer opportunities", "jobs"],
      ["Show delivery projects", "projects"],
      ["Show invoices and AR aging", "finance"],
      ["What is currently featured on the public website", "public_content"],
      ["Show knowledge and training programs", "knowledge"],
    ];
    for (const [prompt, entity] of cases) {
      const parsed = parseScoutIntent(prompt);
      expect(parsed.ok, prompt).toBe(true);
      if (parsed.ok) expect(parsed.dto.entity, prompt).toBe(entity);
    }
    const jobs = parseScoutIntent("Show SkillBridge-eligible employer opportunities");
    expect(jobs.ok).toBe(true);
    if (jobs.ok) expect(jobs.dto.filters?.skillbridgeEligible).toBe(true);
  });

  it("enforces Scout RBAC and keeps cost admin off operators", () => {
    const recruiter = principalFor("recruiter");
    const reader = principalFor("read-only");
    const partner = principalFor("managing-partner");
    expect(can(recruiter, "scout.use")).toBe(true);
    expect(can(recruiter, "scout.search")).toBe(true);
    expect(can(recruiter, "agents.manage")).toBe(false);
    expect(can(reader, "scout.search")).toBe(true);
    expect(can(reader, "scout.internal_actions")).toBe(false);
    expect(can(reader, "candidate_pii.read")).toBe(false);
    expect(can(partner, "agents.manage")).toBe(true);
  });

  it("strips candidate PII before any model context", () => {
    const stripped = stripScoutPii(
      {
        email: "hidden@example.test",
        phone: "555-0100",
        compensationExpectations: "120000",
        resumeText: "SECRET RESUME",
        currentTitle: "Electrician",
      },
      false,
    );
    expect(stripped.email).toBeNull();
    expect(stripped.phone).toBeNull();
    expect(stripped.compensationExpectations).toBeNull();
    expect(stripped.resumeText).toBeNull();
    expect(stripped.currentTitle).toBe("Electrician");
  });

  it("keeps Scout external send hard-denied", async () => {
    expect(isScoutExternalSendEnabled()).toBe(false);
    expect(assertScoutCannotSend()).toBe(false);
    const denied = await rejectScoutSend();
    expect(denied.sendAllowed).toBe(false);
    expect(can(principalFor("managing-partner"), "scout.external_actions")).toBe(true);
    expect(isForbiddenTask("scout", "send_outbound")).toBe(true);
  });
});
