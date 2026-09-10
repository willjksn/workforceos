import { getServerEnv } from "../env";
import { logServerEvent } from "../observability/monitor";
import {
  HEURISTIC_MODEL,
  capabilityClassForTask,
  isGeminiFallbackConfigured,
  isHeuristicModelName,
  isLiveAiConfigured,
  resolveAiApiKey,
  resolveAiBaseUrl,
  resolveAiProviderName,
  resolveCapabilityModel,
  resolveClassFallbackModel,
  resolveFallbackBaseUrl,
  resolveFallbackModel,
  resolveGeminiApiKey,
  type AiCapabilityClass,
} from "./capabilities";
import { AgentError } from "./errors";
import { classifyProviderError, shouldFailoverForAvailability, type FailoverReason } from "./failover";
import {
  buildChatCompletionsBody,
  chatParameterProfile,
  describeParameterProfile,
  nextChatRequestShape,
  rejectedRequestField,
  type TokenField,
} from "./request-profile";

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
  /** When true, never return a heuristic draft. Throw the provider failure instead. */
  requireLive?: boolean;
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

type ChatRequestShape = { tokenField: TokenField; includeTemperature: boolean };

async function callOpenAiCompatible(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  provider: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs: number;
  capabilityClass: AiCapabilityClass;
  usedFallback: boolean;
}): Promise<CompletionResult> {
  const started = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, input.timeoutMs);
  const profile = chatParameterProfile({ model: input.model, provider: input.provider });
  let tokenField = profile.tokenField;
  let includeTemperature = profile.temperature === "send";
  const attempted = new Set<string>();
  logServerEvent("ai.request", {
    provider: input.provider,
    capabilityClass: input.capabilityClass,
    model: input.model,
    usedFallback: input.usedFallback,
    ...describeParameterProfile(profile, input.temperature ?? 0.2),
  });
  try {
    while (true) {
      const shape = `${tokenField}:${includeTemperature ? "temp" : "notemp"}`;
      if (attempted.has(shape)) {
        throw new AgentError("Provider HTTP 400 unsupported_parameter: request shape retries exhausted", "provider");
      }
      attempted.add(shape);
      const response: Response = await fetch(`${input.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildChatCompletionsBody({
            model: input.model,
            messages: input.messages,
            temperature: input.temperature,
            maxTokens: input.maxTokens,
            profile,
            tokenField,
            includeTemperature,
          }),
        ),
        signal: controller.signal,
      });
      if (!response.ok) {
        const errJson = (await response.json().catch(() => ({}))) as {
          error?: { code?: string; type?: string; message?: string };
        };
        const errorCode = errJson.error?.code ?? errJson.error?.type ?? "";
        const errorMessage =
          typeof errJson.error?.message === "string" ? sanitizeProviderMessage(errJson.error.message) : "";
        const combined = `Provider HTTP ${response.status}${errorCode ? ` ${errorCode}` : ""}${errorMessage ? `: ${errorMessage}` : ""}`;
        const retry: ChatRequestShape | null =
          response.status === 400
            ? nextChatRequestShape({ tokenField, includeTemperature }, rejectedRequestField(combined))
            : null;
        if (retry) {
          tokenField = retry.tokenField;
          includeTemperature = retry.includeTemperature;
          continue;
        }
        throw new AgentError(combined, "provider");
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
        provider: input.provider,
        model: json.model ?? input.model,
        modelVersion: json.model ?? input.model,
        capabilityClass: input.capabilityClass,
        inputTokens,
        outputTokens,
        estimatedCostUsd: estimateCost(inputTokens, outputTokens),
        usedFallback: input.usedFallback,
        latencyMs: Date.now() - started,
      };
    }
  } catch (error) {
    if (timedOut) {
      throw new AgentError("Provider timed out", "provider");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function sanitizeProviderMessage(message: string) {
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\bsk-[a-zA-Z0-9_-]+/gi, "[redacted]")
    .replace(/\bAIza[a-zA-Z0-9_-]+/gi, "[redacted]")
    .slice(0, 180);
}

function failoverLabel(reason: FailoverReason) {
  if (reason.kind === "availability") return reason.type;
  if (reason.kind === "unknown") return reason.detail ?? "unknown";
  return reason.kind;
}

function throwLiveFailure(input: {
  capabilityClass: AiCapabilityClass;
  reason: FailoverReason;
  error: unknown;
}): never {
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  throw new AgentError(
    `Live ${input.capabilityClass} provider call failed (${failoverLabel(input.reason)}). ${sanitizeProviderMessage(message)} No heuristic fill-in.`,
    "provider",
  );
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

function logCompletion(input: {
  taskType: string;
  capabilityClass: AiCapabilityClass;
  result: CompletionResult;
  live: boolean;
  failureType?: string;
}) {
  logServerEvent("ai.completion", {
    taskType: input.taskType,
    capabilityClass: input.capabilityClass,
    provider: input.result.provider,
    model: input.result.model,
    usedFallback: input.result.usedFallback,
    latencyMs: input.result.latencyMs,
    live: input.live,
    failureType: input.failureType,
    inputTokens: input.result.inputTokens,
    outputTokens: input.result.outputTokens,
    estimatedCostUsd: input.result.estimatedCostUsd,
  });
}

function logAttemptFailure(input: {
  taskType: string;
  capabilityClass: AiCapabilityClass;
  provider: string;
  model: string;
  usedFallback: boolean;
  reason: FailoverReason;
}) {
  logServerEvent("ai.completion_failed", {
    taskType: input.taskType,
    capabilityClass: input.capabilityClass,
    provider: input.provider,
    model: input.model,
    usedFallback: input.usedFallback,
    failureType: input.reason.kind === "availability" ? input.reason.type : input.reason.kind,
  });
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
    if (request.requireLive) {
      throw new AgentError(
        !apiKey
          ? "Live AI is not configured. No API key at runtime."
          : isHeuristicModelName(model)
            ? `${capabilityClass} class model id is unset or heuristic; HTTP was not attempted.`
            : "AI_PROVIDER is internal_heuristic. HTTP was not attempted.",
        "config",
      );
    }
    const result = heuristicResult({
      capabilityClass,
      usedFallback: false,
      modelVersion: apiKey && requestedProvider !== "internal_heuristic" ? "key-present-model-unset" : "unconfigured",
      latencyMs: Date.now() - started,
      messages: request.messages,
    });
    logCompletion({ taskType: request.taskType, capabilityClass, result, live: false });
    return result;
  }

  const baseUrl = resolveAiBaseUrl(env);
  const callArgs = {
    messages: request.messages,
    temperature: request.temperature,
    maxTokens: request.maxTokens,
    timeoutMs,
    capabilityClass,
  };

  try {
    const result = await callOpenAiCompatible({
      ...callArgs,
      baseUrl,
      apiKey,
      model,
      provider: "openai_compatible",
      usedFallback: false,
    });
    logCompletion({ taskType: request.taskType, capabilityClass, result, live: true });
    return result;
  } catch (error) {
    const primaryReason = classifyProviderError(error);
    logAttemptFailure({
      taskType: request.taskType,
      capabilityClass,
      provider: requestedProvider,
      model,
      usedFallback: false,
      reason: primaryReason,
    });

    // Same-provider spare, then Gemini class fallback — availability failures only (DEC-AI-012).
    // Circuit breaker and cost caps are asserted in the runner before this hop; hopping cannot reopen them.
    if (shouldFailoverForAvailability(primaryReason)) {
      const sameProviderFallback = request.fallbackModel ?? resolveFallbackModel(env);
      if (sameProviderFallback && sameProviderFallback !== model && !isHeuristicModelName(sameProviderFallback)) {
        try {
          const result = await callOpenAiCompatible({
            ...callArgs,
            baseUrl,
            apiKey,
            model: sameProviderFallback,
            provider: "openai_compatible",
            usedFallback: true,
          });
          logCompletion({ taskType: request.taskType, capabilityClass, result, live: true });
          return result;
        } catch (fallbackError) {
          const sameReason = classifyProviderError(fallbackError);
          logAttemptFailure({
            taskType: request.taskType,
            capabilityClass,
            provider: "openai_compatible",
            model: sameProviderFallback,
            usedFallback: true,
            reason: sameReason,
          });
          if (!shouldFailoverForAvailability(sameReason)) {
            if (request.requireLive) {
              throwLiveFailure({ capabilityClass, reason: sameReason, error: fallbackError });
            }
            return finishHeuristicAfterFailure({
              started,
              capabilityClass,
              request,
              failureType: sameReason.kind === "availability" ? sameReason.type : sameReason.kind,
            });
          }
        }
      }

      const geminiKey = resolveGeminiApiKey(env);
      const classFallback = resolveClassFallbackModel(capabilityClass, env);
      const requestWantsGemini = request.fallbackProvider?.trim().toLowerCase() === "gemini";
      if (
        capabilityClass !== "EMBEDDING" &&
        (isGeminiFallbackConfigured(env) || (requestWantsGemini && Boolean(geminiKey))) &&
        geminiKey &&
        classFallback &&
        !isHeuristicModelName(classFallback)
      ) {
        try {
          const result = await callOpenAiCompatible({
            ...callArgs,
            baseUrl: resolveFallbackBaseUrl(env),
            apiKey: geminiKey,
            model: classFallback,
            provider: "gemini",
            usedFallback: true,
          });
          logCompletion({ taskType: request.taskType, capabilityClass, result, live: true });
          return result;
        } catch (geminiError) {
          const geminiReason = classifyProviderError(geminiError);
          logAttemptFailure({
            taskType: request.taskType,
            capabilityClass,
            provider: "gemini",
            model: classFallback,
            usedFallback: true,
            reason: geminiReason,
          });
        }
      }
    }

    if (request.requireLive) {
      throwLiveFailure({ capabilityClass, reason: primaryReason, error });
    }
    return finishHeuristicAfterFailure({
      started,
      capabilityClass,
      request,
      failureType: primaryReason.kind === "availability" ? primaryReason.type : primaryReason.kind,
    });
  }
}

function finishHeuristicAfterFailure(input: {
  started: number;
  capabilityClass: AiCapabilityClass;
  request: CompletionRequest;
  failureType: string;
}): CompletionResult {
  const result = heuristicResult({
    capabilityClass: input.capabilityClass,
    usedFallback: true,
    modelVersion: "fallback-after-error",
    latencyMs: Date.now() - input.started,
    messages: input.request.messages,
  });
  logCompletion({
    taskType: input.request.taskType,
    capabilityClass: input.capabilityClass,
    result,
    live: false,
    failureType: input.failureType,
  });
  return result;
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
