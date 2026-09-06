import { getAIProvider, getAiStackConfig, isOpenAiConfigured, routeAiModel } from "./stack";
import { HeuristicAIProvider } from "./stack/heuristic-provider";
import type { ChatMessage } from "./stack/types";

export type { ChatMessage };

export type CompletionRequest = {
  taskType: string;
  messages: ChatMessage[];
  provider?: string;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
  maxTokens?: number;
  fallbackProvider?: string;
  fallbackModel?: string;
  agentSlug?: string;
};

export type CompletionResult = {
  text: string;
  provider: string;
  model: string;
  modelVersion: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd: number;
  usedFallback: boolean;
  modelTier?: string;
  unavailable?: boolean;
};

export { parseModelJson } from "./stack/parse";

export async function completePrompt(request: CompletionRequest): Promise<CompletionResult> {
  const config = getAiStackConfig();
  const route = routeAiModel({
    taskType: request.taskType,
    agentSlug: request.agentSlug,
  });
  const forceHeuristic = process.env.AI_PROVIDER === "internal_heuristic" || !isOpenAiConfigured(config);
  const provider = forceHeuristic ? new HeuristicAIProvider() : getAIProvider();
  const result = await provider.generate({
    taskType: request.taskType,
    agentSlug: request.agentSlug,
    messages: request.messages,
    temperature: request.temperature,
    timeoutMs: request.timeoutMs,
    maxTokens: request.maxTokens,
  });
  return {
    text: result.text,
    provider: result.provider,
    model: result.model,
    modelVersion: result.modelVersion,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    estimatedCostUsd: result.usage.estimatedCostUsd,
    usedFallback: result.usedFallback,
    modelTier: result.tier,
    unavailable: result.unavailable,
  };
}

export function routedModelForTask(taskType: string, agentSlug?: string) {
  return routeAiModel({ taskType, agentSlug });
}
