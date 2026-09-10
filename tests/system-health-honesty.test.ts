import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { classifyProviderError, shouldFailoverForAvailability } from "../lib/ai/failover";
import { completePrompt } from "../lib/ai/provider";
import {
  areBusinessCapabilityModelsConfigured,
  describeAiRuntime,
  resolveCapabilityModel,
} from "../lib/ai/capabilities";
import { styleDoesNotFailover, UNAVAILABLE_PROBE_MODEL } from "../lib/ai/health-probe";
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
    expect(page).toMatch(/Run live OpenAI test/);
    expect(page).toMatch(/Run controlled fallback probe/);
    expect(page).not.toMatch(/defaultChecked/);
    expect(page).not.toMatch(/includeGemini/);
    expect(page).toMatch(/HTTP 429/);
    expect(page).toMatch(/runtime\.fallbackModels/);
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

  it("resolves the production FAST STANDARD and REASONING class ids from env", () => {
    vi.stubEnv("AI_MODEL_FAST", "gpt-5.6-luna");
    vi.stubEnv("AI_MODEL_STANDARD", "gpt-5.6-terra");
    vi.stubEnv("AI_MODEL_REASONING", "gpt-5.6-sol");
    resetServerEnvCache();
    expect(resolveCapabilityModel("FAST")).toBe("gpt-5.6-luna");
    expect(resolveCapabilityModel("STANDARD")).toBe("gpt-5.6-terra");
    expect(resolveCapabilityModel("REASONING")).toBe("gpt-5.6-sol");
    expect(describeAiRuntime().capabilityModels).toMatchObject({
      FAST: "gpt-5.6-luna",
      STANDARD: "gpt-5.6-terra",
      REASONING: "gpt-5.6-sol",
    });
  });

  it("resolves Gemini class fallback model ids without exposing keys", () => {
    vi.stubEnv("AI_FALLBACK_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "gemini-test-key");
    vi.stubEnv("AI_MODEL_FAST_FALLBACK", "gemini-fast-id");
    vi.stubEnv("AI_MODEL_STANDARD_FALLBACK", "gemini-standard-id");
    vi.stubEnv("AI_MODEL_REASONING_FALLBACK", "gemini-reasoning-id");
    resetServerEnvCache();
    const runtime = describeAiRuntime();
    expect(runtime.fallbackConfigured).toBe(true);
    expect(runtime.fallbackProviderName).toBe("gemini");
    expect(runtime.fallbackModels).toEqual({
      FAST: "gemini-fast-id",
      STANDARD: "gemini-standard-id",
      REASONING: "gemini-reasoning-id",
    });
    expect(JSON.stringify(runtime)).not.toContain("gemini-test-key");
  });
});

describe("Gemini availability failover", () => {
  it("does not treat unknown model ids as availability failover", () => {
    expect(shouldFailoverForAvailability(classifyProviderError(new Error("Provider HTTP 404 model_not_found")))).toBe(false);
    expect(shouldFailoverForAvailability(classifyProviderError(new Error("The model does not exist")))).toBe(false);
    expect(shouldFailoverForAvailability(classifyProviderError(new Error("Provider HTTP 429")))).toBe(true);
    expect(shouldFailoverForAvailability(classifyProviderError(new Error("Provider HTTP 503")))).toBe(true);
    const style = styleDoesNotFailover();
    expect(style.style).toBe(false);
    expect(style.tone).toBe(false);
    expect(style.structure).toBe(false);
    expect(style.lowConfidence).toBe(false);
  });

  it("completes a direct Gemini connectivity check without treating it as a hop", async () => {
    vi.stubEnv("AI_API_KEY", "sk-test");
    vi.stubEnv("AI_PROVIDER", "openai_compatible");
    vi.stubEnv("AI_FALLBACK_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "gemini-test-key");
    vi.stubEnv("AI_MODEL_FAST_FALLBACK", "fast-fallback");
    resetServerEnvCache();
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).toContain("generativelanguage.googleapis.com");
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"status":"ok","provider":"gemini"}' } }],
          model: "fast-fallback",
          usage: { prompt_tokens: 5, completion_tokens: 4 },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await completePrompt({
      taskType: "status_summary",
      capabilityClass: "FAST",
      provider: "gemini",
      model: "fast-fallback",
      requireLive: true,
      liveFailureLabel: "Gemini direct connectivity",
      messages: [{ role: "user", content: "Return JSON with status=ok and provider=gemini." }],
    });
    expect(result.provider).toBe("gemini");
    expect(result.usedFallback).toBe(false);
    expect(result.requestedModel).toBe("fast-fallback");
    expect(fetchMock.mock.calls.every((call) => String(call[0]).includes("api.openai.com"))).toBe(false);
  });

  it("hops to Gemini after a simulated OpenAI 429 and not after a successful primary call", async () => {
    vi.stubEnv("AI_API_KEY", "sk-test");
    vi.stubEnv("AI_PROVIDER", "openai_compatible");
    vi.stubEnv("AI_MODEL_FAST", "gpt-5.6-luna");
    vi.stubEnv("AI_FALLBACK_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "gemini-test-key");
    vi.stubEnv("AI_MODEL_FAST_FALLBACK", "fast-fallback");
    resetServerEnvCache();

    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("generativelanguage.googleapis.com")) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '{"status":"ok","provider":"gemini"}' } }],
            model: "fast-fallback",
            usage: { prompt_tokens: 11, completion_tokens: 7 },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"summary":"openai probe"}' } }],
          model: "gpt-5.6-luna",
          usage: { prompt_tokens: 9, completion_tokens: 4 },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const fallback = await completePrompt({
      taskType: "status_summary",
      capabilityClass: "FAST",
      skipSameProviderRetry: true,
      simulateAvailabilityFailure: "http_429",
      requireLive: true,
      liveFailureLabel: "Controlled OpenAI fallback probe",
      messages: [{ role: "user", content: "Return JSON with status=ok and capability=FAST." }],
    });
    expect(fallback.provider).toBe("gemini");
    expect(fallback.usedFallback).toBe(true);
    expect(fallback.capabilityClass).toBe("FAST");
    expect(fallback.requestedModel).toBe("fast-fallback");
    expect(fetchMock.mock.calls.every((call) => String(call[0]).includes("generativelanguage"))).toBe(true);

    const primary = await completePrompt({
      taskType: "status_summary",
      capabilityClass: "FAST",
      messages: [{ role: "user", content: "Task: status_summary" }],
    });
    expect(primary.provider).toBe("openai_compatible");
    expect(primary.usedFallback).toBe(false);
  });

  it("does not hop to Gemini for a 404 unknown model id", async () => {
    vi.stubEnv("AI_API_KEY", "sk-test");
    vi.stubEnv("AI_PROVIDER", "openai_compatible");
    vi.stubEnv("AI_MODEL_FAST", "gpt-5.6-luna");
    vi.stubEnv("AI_FALLBACK_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "gemini-test-key");
    vi.stubEnv("AI_MODEL_FAST_FALLBACK", "fast-fallback");
    resetServerEnvCache();
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: false,
      status: 404,
      json: async () => ({ error: { code: "model_not_found", message: "The model does not exist" } }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      completePrompt({
        taskType: "status_summary",
        capabilityClass: "FAST",
        requireLive: true,
        messages: [{ role: "user", content: "live" }],
      }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/http_404|model_not_found/),
    });
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("generativelanguage"))).toBe(false);
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

  it("uses max_completion_tokens for OpenAI and retries without hopping to Gemini", async () => {
    vi.stubEnv("AI_API_KEY", "sk-test");
    vi.stubEnv("AI_PROVIDER", "openai_compatible");
    vi.stubEnv("AI_MODEL_FAST", "fast-class");
    vi.stubEnv("AI_FALLBACK_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "gemini-test-key");
    vi.stubEnv("AI_MODEL_FAST_FALLBACK", "fast-fallback");
    resetServerEnvCache();

    const fetchMock = vi.fn(async (_url: string, init?: { body?: BodyInit | null }) => {
      const body = typeof init?.body === "string" ? init.body : "";
      if (body.includes('"max_tokens"') && !body.includes("max_completion_tokens")) {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            error: {
              code: "unsupported_parameter",
              message: "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.",
            },
          }),
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

    const result = await completePrompt({
      taskType: "status_summary",
      capabilityClass: "FAST",
      requireLive: true,
      messages: [{ role: "user", content: "Task: status_summary" }],
    });
    expect(result.provider).toBe("openai_compatible");
    expect(result.usedFallback).toBe(false);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("generativelanguage"))).toBe(false);
    const firstBody = String(fetchMock.mock.calls[0]?.[1]?.body ?? "");
    expect(firstBody).toContain("max_completion_tokens");
    expect(firstBody).not.toContain('"max_tokens"');
    expect(firstBody).not.toContain('"temperature"');
  });

  it("retries max_tokens when max_completion_tokens is unsupported on a temperature-capable model", async () => {
    vi.stubEnv("AI_API_KEY", "sk-test");
    vi.stubEnv("AI_PROVIDER", "openai_compatible");
    vi.stubEnv("AI_MODEL_FAST", "gpt-4o-mini");
    resetServerEnvCache();

    const fetchMock = vi.fn(async (_url: string, init?: { body?: BodyInit | null }) => {
      const body = typeof init?.body === "string" ? init.body : "";
      if (body.includes("max_completion_tokens")) {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            error: {
              code: "unsupported_parameter",
              message: "Unsupported parameter: 'max_completion_tokens' is not supported with this model.",
            },
          }),
        };
      }
      if (body.includes('"temperature"')) {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            error: {
              code: "unsupported_value",
              message: "Unsupported value: 'temperature' does not support 0.2 with this model. Only the default (1) value is supported.",
            },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"summary":"legacy"}' } }],
          model: "gpt-4o-mini",
          usage: { prompt_tokens: 3, completion_tokens: 2 },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await completePrompt({
      taskType: "status_summary",
      capabilityClass: "FAST",
      requireLive: true,
      messages: [{ role: "user", content: "Task: status_summary" }],
    });
    expect(result.provider).toBe("openai_compatible");
    expect(result.usedFallback).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not treat unsupported_parameter as a Gemini availability hop", () => {
    expect(
      shouldFailoverForAvailability(
        classifyProviderError(
          new Error(
            "Provider HTTP 400 unsupported_parameter: Unsupported parameter: 'max_tokens' is not supported with this model.",
          ),
        ),
      ),
    ).toBe(false);
  });

  it("sends the configured FAST model and never the synthetic fallback id on a live class call", async () => {
    vi.stubEnv("AI_API_KEY", "sk-test");
    vi.stubEnv("AI_PROVIDER", "openai_compatible");
    vi.stubEnv("AI_MODEL_FAST", "gpt-5.6-luna");
    resetServerEnvCache();
    const fetchMock = vi.fn(async (_url: string, init?: { body?: BodyInit | null }) => {
      const body = typeof init?.body === "string" ? init.body : "";
      expect(body).toContain("gpt-5.6-luna");
      expect(body).not.toContain(UNAVAILABLE_PROBE_MODEL);
      expect(body).not.toContain('"temperature"');
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"status":"ok","capability":"FAST"}' } }],
          model: "gpt-5.6-luna",
          usage: { prompt_tokens: 6, completion_tokens: 3 },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await completePrompt({
      taskType: "status_summary",
      capabilityClass: "FAST",
      requireLive: true,
      messages: [{ role: "user", content: "Return JSON with status=ok and capability=FAST." }],
    });
    expect(result.requestedModel).toBe("gpt-5.6-luna");
    expect(result.provider).toBe("openai_compatible");
    expect(result.usedFallback).toBe(false);
  });

  it("labels synthetic unavailable-model failures as a controlled fallback probe", async () => {
    vi.stubEnv("AI_API_KEY", "sk-test");
    vi.stubEnv("AI_PROVIDER", "openai_compatible");
    vi.stubEnv("AI_MODEL_FAST", "gpt-5.6-luna");
    resetServerEnvCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({ error: { code: "server_error", message: "unavailable" } }),
      })),
    );
    await expect(
      completePrompt({
        taskType: "status_summary",
        capabilityClass: "FAST",
        requireLive: true,
        skipSameProviderRetry: true,
        liveFailureLabel: "Controlled OpenAI fallback probe",
        messages: [{ role: "user", content: "fallback" }],
      }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/^Controlled OpenAI fallback probe/),
    });
  });
});
