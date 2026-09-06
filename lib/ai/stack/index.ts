export { getAiStackConfig, isOpenAiConfigured, isTavilyConfigured, modelForTier, tierForModel } from "./config";
export { routeAiModel, canFallbackToTier, inferTaskKind, inferRisk } from "./router";
export { estimateTierCost, costLedgerRow } from "./cost";
export { OpenAIProvider } from "./openai-provider";
export { HeuristicAIProvider } from "./heuristic-provider";
export { getEmbeddingProvider, OpenAIEmbeddingProvider, DevelopmentHashEmbeddingProvider } from "./embeddings";
export { parseModelJson } from "./parse";
export { callOpenAiResponses } from "./responses";
export type {
  AIProvider,
  AiGenerateRequest,
  AiGenerateResult,
  AiModelRoute,
  AiModelTier,
  AiTaskKind,
  EmbeddingProvider,
  EmbeddingVector,
} from "./types";

import { getAiStackConfig, isOpenAiConfigured } from "./config";
import { HeuristicAIProvider } from "./heuristic-provider";
import { OpenAIProvider } from "./openai-provider";
import type { AIProvider } from "./types";

export function getAIProvider(): AIProvider {
  const config = getAiStackConfig();
  if (isOpenAiConfigured(config) && (config.openaiBaseUrl.includes("openai.com") || !process.env.AI_PROVIDER || process.env.AI_PROVIDER === "openai")) {
    return new OpenAIProvider(config);
  }
  if (isOpenAiConfigured(config)) {
    return new OpenAIProvider(config);
  }
  return new HeuristicAIProvider();
}
