import { getServerEnv } from "../env";
import { logServerEvent } from "../observability/monitor";
import {
  HEURISTIC_MODEL,
  capabilityClassForTask,
  isHeuristicModelName,
  isLiveAiConfigured,
  resolveAiApiKey,
  resolveAiBaseUrl,
  resolveAiProviderName,
  resolveCapabilityModel,
  resolveFallbackModel,
  type AiCapabilityClass,
} from "./capabilities";
import { AgentError } from "./errors";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type CompletionRequest = {
  taskType: string;
  messages: ChatMessage[];
  provider?: string;
  model?: string;
  capabilityClass?: AiCapabilityClass;
  temperature?: number;
  timeoutMs?: number;
  maxTokens?: number;
  fallbackProvider?: string;
  fallbackModel?: string;
};

export type CompletionResult = {
  text: string;
  provider: string;
  model: string;
  modelVersion: string;
  capabilityClass: AiCapabilityClass;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd: number;
  usedFallback: boolean;
  latencyMs: number;
};

function heuristicReply(messages: ChatMessage[]) {
  const user = messages.find((message) => message.role === "user")?.content ?? "";
  const task = /Task:\s*(.+)/i.exec(user)?.[1]?.trim() ?? "analysis";
  return JSON.stringify({
    summary: `Heuristic draft for ${task} from stored WorkforceOS records. Not a live model completion.`,
    facts: [],
    inferences: ["This output is generated without a configured model provider."],
    missingData: ["Live model provider is not configured."],
    assumptions: ["Only PostgreSQL context supplied to the agent was used."],
    confidence: null,
    recommendation: "Human review required before any client-facing or external use.",
  });
}

function heuristicResult(input: {
  capabilityClass: AiCapabilityClass;
  usedFallback: boolean;
  modelVersion: string;
  latencyMs: number;
  messages: ChatMessage[];
}): CompletionResult {
  return {
    text: heuristicReply(input.messages),
    provider: "internal_heuristic",
    model: HEURISTIC_MODEL,
    modelVersion: input.modelVersion,
    capabilityClass: input.capabilityClass,
    estimatedCostUsd: 0,
    usedFallback: input.usedFallback,
    latencyMs: input.latencyMs,
  };
}

async function callOpenAiCompatible(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs: number;
  capabilityClass: AiCapabilityClass;
}): Promise<CompletionResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await fetch(`${input.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxTokens ?? 1200,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new AgentError(`Provider HTTP ${response.status}`, "provider");
    }
    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new AgentError("Provider returned an empty completion", "provider");
    const inputTokens = json.usage?.prompt_tokens;
    const outputTokens = json.usage?.completion_tokens;
    return {
      text,
      provider: "openai_compatible",
      model: json.model ?? input.model,
      modelVersion: json.model ?? input.model,
      capabilityClass: input.capabilityClass,
      inputTokens,
      outputTokens,
      estimatedCostUsd: estimateCost(inputTokens, outputTokens),
      usedFallback: false,
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

function estimateCost(inputTokens?: number, outputTokens?: number) {
  if (inputTokens == null && outputTokens == null) return 0;
  const inCost = ((inputTokens ?? 0) / 1_000_000) * 3;
  const outCost = ((outputTokens ?? 0) / 1_000_000) * 15;
  return Number((inCost + outCost).toFixed(6));
}

function resolveRequestedModel(request: CompletionRequest, capabilityClass: AiCapabilityClass) {
  if (request.model && !isHeuristicModelName(request.model) && !request.capabilityClass) {
    return request.model;
  }
  return resolveCapabilityModel(capabilityClass);
}

export async function completePrompt(request: CompletionRequest): Promise<CompletionResult> {
  const env = getServerEnv();
  const started = Date.now();
  const capabilityClass = request.capabilityClass ?? capabilityClassForTask(request.taskType);
  const apiKey = resolveAiApiKey(env);
  const envProvider = resolveAiProviderName(env);
  const requestedProvider = request.provider ?? envProvider;
  const model = resolveRequestedModel(request, capabilityClass);
  const timeoutMs = request.timeoutMs ?? 30000;
  const live = isLiveAiConfigured(env) && requestedProvider !== "internal_heuristic" && !isHeuristicModelName(model);

  if (!apiKey || !live) {
    const result = heuristicResult({
      capabilityClass,
      usedFallback: false,
      modelVersion: apiKey && requestedProvider !== "internal_heuristic" ? "key-present-model-unset" : "unconfigured",
      latencyMs: Date.now() - started,
      messages: request.messages,
    });
    logServerEvent("ai.completion", {
      taskType: request.taskType,
      capabilityClass,
      provider: result.provider,
      model: result.model,
      usedFallback: false,
      latencyMs: result.latencyMs,
      live: false,
    });
    return result;
  }

  const baseUrl = resolveAiBaseUrl(env);
  try {
    const result = await callOpenAiCompatible({
      baseUrl,
      apiKey,
      model,
      messages: request.messages,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      timeoutMs,
      capabilityClass,
    });
    logServerEvent("ai.completion", {
      taskType: request.taskType,
      capabilityClass,
      provider: result.provider,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUsd: result.estimatedCostUsd,
      usedFallback: false,
      latencyMs: result.latencyMs,
      live: true,
    });
    return result;
  } catch (error) {
    const fallbackModel = request.fallbackModel ?? resolveFallbackModel(env);
    logServerEvent("ai.completion_failed", {
      taskType: request.taskType,
      capabilityClass,
      provider: requestedProvider,
      model,
      timeoutMs,
      retry: Boolean(fallbackModel && fallbackModel !== model),
    });
    if (fallbackModel && fallbackModel !== model && !isHeuristicModelName(fallbackModel)) {
      try {
        const result = await callOpenAiCompatible({
          baseUrl,
          apiKey,
          model: fallbackModel,
          messages: request.messages,
          temperature: request.temperature,
          maxTokens: request.maxTokens,
          timeoutMs,
          capabilityClass,
        });
        const fallbackResult = { ...result, usedFallback: true };
        logServerEvent("ai.completion", {
          taskType: request.taskType,
          capabilityClass,
          provider: fallbackResult.provider,
          model: fallbackResult.model,
          inputTokens: fallbackResult.inputTokens,
          outputTokens: fallbackResult.outputTokens,
          estimatedCostUsd: fallbackResult.estimatedCostUsd,
          usedFallback: true,
          latencyMs: fallbackResult.latencyMs,
          live: true,
        });
        return fallbackResult;
      } catch {
        /* fall through to heuristic */
      }
    }
    const result = heuristicResult({
      capabilityClass,
      usedFallback: true,
      modelVersion: "fallback-after-error",
      latencyMs: Date.now() - started,
      messages: request.messages,
    });
    logServerEvent("ai.completion", {
      taskType: request.taskType,
      capabilityClass,
      provider: result.provider,
      model: result.model,
      usedFallback: true,
      latencyMs: result.latencyMs,
      live: false,
    });
    return result;
  }
}

export function parseModelJson(text: string): Record<string, unknown> {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return { summary: text };
}
