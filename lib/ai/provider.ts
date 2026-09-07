import { getServerEnv } from "../env";
import { AgentError } from "./errors";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

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

async function callOpenAiCompatible(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs: number;
}): Promise<CompletionResult> {
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
      inputTokens,
      outputTokens,
      estimatedCostUsd: estimateCost(inputTokens, outputTokens),
      usedFallback: false,
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

export async function completePrompt(request: CompletionRequest): Promise<CompletionResult> {
  const env = getServerEnv();
  const provider = request.provider ?? env.AI_PROVIDER ?? "internal_heuristic";
  const model = request.model ?? env.AI_MODEL ?? "heuristic-v1";
  const timeoutMs = request.timeoutMs ?? 30000;

  if (!env.AI_API_KEY || provider === "internal_heuristic") {
    const text = heuristicReply(request.messages);
    return {
      text,
      provider: "internal_heuristic",
      model: "heuristic-v1",
      modelVersion: "unconfigured",
      estimatedCostUsd: 0,
      usedFallback: false,
    };
  }

  const baseUrl = env.AI_BASE_URL ?? "https://api.openai.com/v1";
  try {
    return await callOpenAiCompatible({
      baseUrl,
      apiKey: env.AI_API_KEY,
      model,
      messages: request.messages,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      timeoutMs,
    });
  } catch {
    const fallbackModel = request.fallbackModel ?? env.AI_FALLBACK_MODEL;
    if (fallbackModel && fallbackModel !== model) {
      try {
        const result = await callOpenAiCompatible({
          baseUrl,
          apiKey: env.AI_API_KEY,
          model: fallbackModel,
          messages: request.messages,
          temperature: request.temperature,
          maxTokens: request.maxTokens,
          timeoutMs,
        });
        return { ...result, usedFallback: true };
      } catch {
        /* fall through to heuristic */
      }
    }
    const text = heuristicReply(request.messages);
    return {
      text,
      provider: "internal_heuristic",
      model: "heuristic-v1",
      modelVersion: "fallback-after-error",
      estimatedCostUsd: 0,
      usedFallback: true,
    };
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
