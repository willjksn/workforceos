import type { AiModelTier } from "./types";

/** Estimated USD per 1M tokens. Not a billing contract; used for budgets and health. */
const TIER_RATES: Record<AiModelTier, { input: number; output: number }> = {
  sol: { input: 5, output: 25 },
  terra: { input: 1.25, output: 10 },
  luna: { input: 0.25, output: 2 },
};

export function estimateTierCost(input: {
  tier: AiModelTier | "heuristic" | "unknown";
  inputTokens?: number;
  outputTokens?: number;
}) {
  if (input.tier === "heuristic" || input.tier === "unknown") return 0;
  const rates = TIER_RATES[input.tier];
  const inCost = ((input.inputTokens ?? 0) / 1_000_000) * rates.input;
  const outCost = ((input.outputTokens ?? 0) / 1_000_000) * rates.output;
  return Number((inCost + outCost).toFixed(6));
}

export function costLedgerRow(input: {
  provider: string;
  model: string;
  tier: AiModelTier | "heuristic" | "unknown";
  taskType: string;
  inputTokens?: number;
  outputTokens?: number;
  webSearchCalls?: number;
  tavilyRequests?: number;
}) {
  return {
    provider: input.provider,
    model: input.model,
    modelTier: input.tier,
    taskType: input.taskType,
    inputTokens: input.inputTokens ?? null,
    outputTokens: input.outputTokens ?? null,
    estimatedCostUsd: estimateTierCost(input),
    webSearchCalls: input.webSearchCalls ?? 0,
    tavilyRequests: input.tavilyRequests ?? 0,
  };
}
