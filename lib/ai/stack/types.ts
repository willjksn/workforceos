import type { z } from "zod";

export const AI_MODEL_TIERS = ["sol", "terra", "luna"] as const;
export type AiModelTier = (typeof AI_MODEL_TIERS)[number];

export const AI_TASK_KINDS = [
  "reason",
  "synthesize",
  "summarize",
  "draft",
  "classify",
  "extract",
  "tag",
  "intent",
  "tool_use",
] as const;
export type AiTaskKind = (typeof AI_TASK_KINDS)[number];

export const AI_RISK_LEVELS = ["low", "medium", "high"] as const;
export type AiRiskLevel = (typeof AI_RISK_LEVELS)[number];

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AiGenerateRequest = {
  taskType: string;
  messages: ChatMessage[];
  agentSlug?: string;
  taskKind?: AiTaskKind;
  complexity?: "low" | "medium" | "high";
  risk?: AiRiskLevel;
  temperature?: number;
  timeoutMs?: number;
  maxTokens?: number;
  tools?: AiToolDefinition[];
};

export type AiToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type AiUsage = {
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd: number;
  webSearchCalls?: number;
};

export type AiGenerateResult = {
  text: string;
  provider: string;
  model: string;
  modelVersion: string;
  tier: AiModelTier | "heuristic";
  usedFallback: boolean;
  fallbackReason?: string;
  unavailable?: boolean;
  usage: AiUsage;
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
};

export type AiStructuredResult<T> = AiGenerateResult & {
  data: T | null;
  valid: boolean;
};

export type AiModelRoute = {
  tier: AiModelTier;
  model: string;
  allowTerraFallback: boolean;
  allowLunaFallback: boolean;
  reason: string;
};

export type AIProvider = {
  readonly id: string;
  generate(request: AiGenerateRequest): Promise<AiGenerateResult>;
  generateStructured<T>(request: AiGenerateRequest, schema: z.ZodType<T>): Promise<AiStructuredResult<T>>;
  reason(request: AiGenerateRequest): Promise<AiGenerateResult>;
  classify(request: AiGenerateRequest): Promise<AiGenerateResult>;
  draft(request: AiGenerateRequest): Promise<AiGenerateResult>;
  runWithTools(request: AiGenerateRequest): Promise<AiGenerateResult>;
};

export type EmbeddingVector = {
  values: number[];
  model: string;
  version: string;
  dimension: number;
};

export type EmbeddingProvider = {
  readonly id: string;
  readonly model: string;
  readonly version: string;
  readonly dimension: number;
  embed(text: string): Promise<EmbeddingVector>;
};
