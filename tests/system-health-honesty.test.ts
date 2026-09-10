import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { classifyProviderError, shouldFailoverForAvailability } from "../lib/ai/failover";
import { completePrompt } from "../lib/ai/provider";
import {
  areBusinessCapabilityModelsConfigured,
  describeAiRuntime,
} from "../lib/ai/capabilities";
import { styleDoesNotFailover } from "../lib/ai/health-probe";
import { resetServerEnvCache } from "../lib/env";
import {
  formatIntegrationSummary,
  healthStatusLabel,
  healthStatusOk,
  healthStatusTone,
  summarizeIntegrationStatuses,
} from "../lib/health/taxonomy";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetServerEnvCache();
});

describe("System status honesty", () => {
  it("never paints MOCK / MANUAL / NOT CONFIGURED as success green", () => {
    expect(healthStatusTone("LIVE")).toBe("success");
    expect(healthStatusTone("CONFIGURED")).toBe("teal");
    expect(healthStatusTone("DEGRADED")).toBe("warning");
    expect(healthStatusTone("MOCK")).toBe("neutral");
    expect(healthStatusTone("MANUAL")).toBe("navy");
    expect(healthStatusTone("NOT_CONFIGURED")).toBe("neutral");
    expect(healthStatusTone("DEVELOPMENT")).toBe("warning");
    expect(healthStatusTone("ERROR")).toBe("danger");
    expect(healthStatusLabel("NOT_CONFIGURED")).toBe("NOT CONFIGURED");
    expect(healthStatusOk("MOCK")).toBe(true);
    expect(healthStatusOk("ERROR")).toBe(false);
  });

  it("summarizes integrations without counting mock as live", () => {
    const summary = summarizeIntegrationStatuses([
      "LIVE",
      "CONFIGURED",
      "MOCK",
      "MANUAL",
      "NOT_CONFIGURED",
      "NOT_CONFIGURED",
      "DEVELOPMENT",
    ]);
    expect(summary.live).toBe(1);
    expect(summary.configured).toBe(1);
    expect(summary.mockManual).toBe(2);
    expect(summary.notConfigured).toBe(2);
    expect(summary.development).toBe(1);
    expect(formatIntegrationSummary(summary)).toMatch(/Live: 1/);
    expect(formatIntegrationSummary(summary)).not.toMatch(/Healthy/i);
  });

  it("does not render a HEALTHY badge on System Status", () => {
    const page = readFileSync(path.join(__dirname, "../app/(internal)/app/admin/system-health/page.tsx"), "utf8");
    expect(page).not.toMatch(/Healthy/);
    expect(page).toMatch(/healthStatusLabel\(check\.status\)/);
    expect(page).toMatch(/Run controlled AI verification/);
  });
});

describe("AI capability class configuration", () => {
  it("does not treat a key alone as class-configured", () => {
    vi.stubEnv("AI_API_KEY", "sk-test");
    vi.stubEnv("AI_PROVIDER", "openai_compatible");
    resetServerEnvCache();
    expect(areBusinessCapabilityModelsConfigured()).toBe(false);
    expect(describeAiRuntime().businessClassesConfigured).toBe(false);
  });

  it("requires FAST STANDARD and REASONING class ids", () => {
    vi.stubEnv("AI_API_KEY", "sk-test");
    vi.stubEnv("AI_MODEL_FAST", "fast-class");
    vi.stubEnv("AI_MODEL_STANDARD", "standard-class");
    vi.stubEnv("AI_MODEL_REASONING", "reasoning-class");
    resetServerEnvCache();
    expect(areBusinessCapabilityModelsConfigured()).toBe(true);
  });
});

describe("Gemini availability failover", () => {
  it("treats model unavailable as availability and never hops for style", () => {
    expect(shouldFailoverForAvailability(classifyProviderError(new Error("Provider HTTP 404 model_not_found")))).toBe(true);
    expect(shouldFailoverForAvailability(classifyProviderError(new Error("The model does not exist")))).toBe(true);
    const style = styleDoesNotFailover();
    expect(style.style).toBe(false);
    expect(style.tone).toBe(false);
    expect(style.structure).toBe(false);
    expect(style.lowConfidence).toBe(false);
  });

  it("hops to Gemini after OpenAI model unavailable and not after a successful primary call", async () => {
    vi.stubEnv("AI_API_KEY", "sk-test");
    vi.stubEnv("AI_PROVIDER", "openai_compatible");
    vi.stubEnv("AI_MODEL_FAST", "fast-class");
    vi.stubEnv("AI_FALLBACK_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "gemini-test-key");
    vi.stubEnv("AI_MODEL_FAST_FALLBACK", "fast-fallback");
    resetServerEnvCache();

    const fetchMock = vi.fn(async (url: string, init?: { body?: BodyInit | null }) => {
      if (String(url).includes("generativelanguage.googleapis.com")) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '{"summary":"gemini probe"}' } }],
            model: "fast-fallback",
            usage: { prompt_tokens: 11, completion_tokens: 7 },
          }),
        };
      }
      const body = typeof init?.body === "string" ? init.body : "";
      if (body.includes("workforceos-probe-model-unavailable")) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: { code: "model_not_found" } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"summary":"openai probe"}' } }],
          model: "fast-class",
          usage: { prompt_tokens: 9, completion_tokens: 4 },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const fallback = await completePrompt({
      taskType: "status_summary",
      model: "workforceos-probe-model-unavailable",
      fallbackModel: "workforceos-probe-model-unavailable",
      messages: [{ role: "user", content: "Task: status_summary" }],
    });
    expect(fallback.provider).toBe("gemini");
    expect(fallback.usedFallback).toBe(true);
    expect(fallback.capabilityClass).toBe("FAST");

    const primary = await completePrompt({
      taskType: "status_summary",
      capabilityClass: "FAST",
      messages: [{ role: "user", content: "Task: status_summary" }],
    });
    expect(primary.provider).toBe("openai_compatible");
    expect(primary.usedFallback).toBe(false);
    expect(primary.model).toBe("fast-class");
  });

  it("requireLive throws the provider HTTP error instead of returning heuristic", async () => {
    vi.stubEnv("AI_API_KEY", "sk-test");
    vi.stubEnv("AI_PROVIDER", "openai_compatible");
    vi.stubEnv("AI_MODEL_FAST", "fast-class");
    resetServerEnvCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: "invalid_api_key", message: "Incorrect API key provided: sk-test" } }),
      })),
    );

    await expect(
      completePrompt({
        taskType: "status_summary",
        capabilityClass: "FAST",
        requireLive: true,
        messages: [{ role: "user", content: "Task: status_summary" }],
      }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/http_401[\s\S]*invalid_api_key/),
    });

    try {
      await completePrompt({
        taskType: "status_summary",
        capabilityClass: "FAST",
        requireLive: true,
        messages: [{ role: "user", content: "Task: status_summary" }],
      });
      throw new Error("expected live failure");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toMatch(/sk-test/);
      expect(message).not.toMatch(/stayed on internal_heuristic/);
    }

    const heuristic = await completePrompt({
      taskType: "status_summary",
      capabilityClass: "FAST",
      messages: [{ role: "user", content: "Task: status_summary" }],
    });
    expect(heuristic.provider).toBe("internal_heuristic");
  });
});
