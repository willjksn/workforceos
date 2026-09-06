import type { z } from "zod";

import { AgentError } from "../errors";
import { parseModelJson } from "./parse";
import { getAiStackConfig, isOpenAiConfigured, modelForTier, type AiStackConfig } from "./config";
import { estimateTierCost } from "./cost";
import { canFallbackToTier, routeAiModel } from "./router";
import { callOpenAiResponses } from "./responses";
import type {
  AIProvider,
  AiGenerateRequest,
  AiGenerateResult,
  AiModelTier,
  AiStructuredResult,
} from "./types";

export class OpenAIProvider implements AIProvider {
  readonly id = "openai";

  constructor(
    private readonly config: AiStackConfig = getAiStackConfig(),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    return this.execute(request);
  }

  async reason(request: AiGenerateRequest): Promise<AiGenerateResult> {
    return this.execute({ ...request, taskKind: request.taskKind ?? "reason", complexity: request.complexity ?? "high" });
  }

  async classify(request: AiGenerateRequest): Promise<AiGenerateResult> {
    return this.execute({ ...request, taskKind: request.taskKind ?? "classify", complexity: request.complexity ?? "low" });
  }

  async draft(request: AiGenerateRequest): Promise<AiGenerateResult> {
    return this.execute({ ...request, taskKind: request.taskKind ?? "draft", complexity: request.complexity ?? "medium" });
  }

  async runWithTools(request: AiGenerateRequest): Promise<AiGenerateResult> {
    return this.execute({ ...request, taskKind: request.taskKind ?? "tool_use" });
  }

  async generateStructured<T>(request: AiGenerateRequest, schema: z.ZodType<T>): Promise<AiStructuredResult<T>> {
    const result = await this.execute({
      ...request,
      messages: [
        ...request.messages,
        {
          role: "system",
          content: "Return valid JSON only. Do not wrap in markdown. The JSON must match the requested schema.",
        },
      ],
    });
    const parsed = parseModelJson(result.text);
    const validated = schema.safeParse(parsed);
    return {
      ...result,
      data: validated.success ? validated.data : null,
      valid: validated.success,
    };
  }

  private async execute(request: AiGenerateRequest): Promise<AiGenerateResult> {
    if (!isOpenAiConfigured(this.config)) {
      throw new AgentError("OpenAI is not configured", "config");
    }
    const route = routeAiModel({
      taskType: request.taskType,
      agentSlug: request.agentSlug,
      taskKind: request.taskKind,
      complexity: request.complexity,
      risk: request.risk,
      config: this.config,
    });
    const timeoutMs = request.timeoutMs ?? 30000;
    try {
      return await this.callTier(route.tier, request, timeoutMs, false);
    } catch (error) {
      if (canFallbackToTier(route, "terra") && route.tier !== "terra") {
        try {
          return await this.callTier("terra", request, timeoutMs, true, "Primary Sol model unavailable; used Terra.");
        } catch {
          /* continue */
        }
      }
      if (canFallbackToTier(route, "luna") && route.tier !== "luna") {
        try {
          return await this.callTier("luna", request, timeoutMs, true, "Balanced model unavailable; used Luna.");
        } catch {
          /* continue */
        }
      }
      if (route.tier === "sol" && !route.allowLunaFallback) {
        return {
          text: "AI service temporarily unavailable for this task.",
          provider: this.id,
          model: route.model,
          modelVersion: route.model,
          tier: route.tier,
          usedFallback: false,
          unavailable: true,
          fallbackReason: error instanceof Error ? error.message : "provider_error",
          usage: { estimatedCostUsd: 0 },
        };
      }
      throw error;
    }
  }

  private async callTier(
    tier: AiModelTier,
    request: AiGenerateRequest,
    timeoutMs: number,
    usedFallback: boolean,
    fallbackReason?: string,
  ): Promise<AiGenerateResult> {
    const model = modelForTier(tier, this.config);
    const result = await callOpenAiResponses({
      baseUrl: this.config.openaiBaseUrl,
      apiKey: this.config.openaiApiKey as string,
      model,
      messages: request.messages,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      timeoutMs,
      tools: request.tools,
      fetchImpl: this.fetchImpl,
    });
    return {
      text: result.text,
      provider: this.id,
      model: result.model,
      modelVersion: result.model,
      tier,
      usedFallback,
      fallbackReason,
      usage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        estimatedCostUsd: estimateTierCost({
          tier,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        }),
        webSearchCalls: result.webSearchCalls,
      },
      toolCalls: result.toolCalls,
    };
  }
}
