import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildChatCompletionsBody,
  chatParameterProfile,
  supportsReasoningEffort,
  supportsTemperature,
  supportsTopP,
} from "../lib/ai/request-profile";
import { completePrompt } from "../lib/ai/provider";
import { resetServerEnvCache } from "../lib/env";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetServerEnvCache();
});

const messages = [{ role: "user" as const, content: "Task: status_summary" }];

function liveEnv(models: { fast: string; standard: string; reasoning: string }) {
  vi.stubEnv("AI_API_KEY", "sk-test");
  vi.stubEnv("AI_PROVIDER", "openai_compatible");
  vi.stubEnv("AI_MODEL_FAST", models.fast);
  vi.stubEnv("AI_MODEL_STANDARD", models.standard);
  vi.stubEnv("AI_MODEL_REASONING", models.reasoning);
  resetServerEnvCache();
}

function successFetch(model: string) {
  return vi.fn(async (_url: string, init?: { body?: BodyInit | null }) => {
    const body = typeof init?.body === "string" ? init.body : "";
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
    if (body.includes('"top_p"') || body.includes('"logprobs"') || body.includes("reasoning_effort")) {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: { code: "unsupported_parameter", message: "Unsupported parameter sent." } }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"summary":"live"}' } }],
        model,
        usage: { prompt_tokens: 8, completion_tokens: 4 },
      }),
    };
  });
}

describe("chat parameter profile", () => {
  it("omits temperature for models that do not support a custom value", () => {
    const profile = chatParameterProfile({ provider: "openai_compatible", model: "gpt-5-mini" });
    expect(supportsTemperature("gpt-5-mini")).toBe(false);
    expect(profile.temperature).toBe("omit");
    expect(profile.tokenField).toBe("max_completion_tokens");
    expect(supportsTopP("gpt-5-mini")).toBe(false);
    expect(supportsReasoningEffort("gpt-5-mini")).toBe(false);
    const body = buildChatCompletionsBody({
      model: "gpt-5-mini",
      messages,
      temperature: 0.2,
      profile,
    });
    expect(body).not.toHaveProperty("temperature");
    expect(body).toHaveProperty("max_completion_tokens", 1200);
    expect(body).not.toHaveProperty("max_tokens");
    expect(body).not.toHaveProperty("top_p");
    expect(body).not.toHaveProperty("logprobs");
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("includes configured temperature for models that support it", () => {
    expect(supportsTemperature("gpt-4o-mini")).toBe(true);
    const profile = chatParameterProfile({ provider: "openai_compatible", model: "gpt-4o-mini" });
    const body = buildChatCompletionsBody({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.2,
      profile,
    });
    expect(body.temperature).toBe(0.2);
    expect(body).toHaveProperty("max_completion_tokens");
  });

  it("omits temperature for unknown OpenAI-compatible class ids", () => {
    const body = buildChatCompletionsBody({
      model: "fast-class",
      messages,
      temperature: 0.2,
      profile: chatParameterProfile({ provider: "openai_compatible", model: "fast-class" }),
    });
    expect(body).not.toHaveProperty("temperature");
  });
});

describe("capability-class live calls with restricted sampling models", () => {
  it("FAST STANDARD and REASONING succeed without heuristic or avoidable 400s", async () => {
    liveEnv({ fast: "gpt-5-mini", standard: "gpt-5", reasoning: "gpt-5-pro" });
    const fetchMock = successFetch("ok-model");
    vi.stubGlobal("fetch", fetchMock);

    const fast = await completePrompt({
      taskType: "status_summary",
      capabilityClass: "FAST",
      requireLive: true,
      messages,
    });
    const standard = await completePrompt({
      taskType: "summarize_company",
      capabilityClass: "STANDARD",
      requireLive: true,
      messages: [{ role: "user", content: "Task: summarize_company" }],
    });
    const reasoning = await completePrompt({
      taskType: "executive_summary",
      capabilityClass: "REASONING",
      requireLive: true,
      messages: [{ role: "user", content: "Task: executive_summary" }],
    });

    expect(fast.provider).toBe("openai_compatible");
    expect(standard.provider).toBe("openai_compatible");
    expect(reasoning.provider).toBe("openai_compatible");
    expect(fast.usedFallback).toBe(false);
    expect(standard.usedFallback).toBe(false);
    expect(reasoning.usedFallback).toBe(false);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("generativelanguage"))).toBe(false);
    for (const call of fetchMock.mock.calls) {
      const body = String(call[1]?.body ?? "");
      expect(body).not.toContain('"temperature"');
      expect(body).toContain("max_completion_tokens");
    }
  });
});
