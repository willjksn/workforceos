import { AgentError } from "../errors";
import type { AiToolDefinition, ChatMessage } from "./types";

export type ResponsesCallInput = {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs: number;
  tools?: AiToolDefinition[];
  webSearch?: boolean;
  fetchImpl?: typeof fetch;
};

export type ResponsesCallOutput = {
  text: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  webSearchCalls: number;
  citations: Array<{ url?: string; title?: string }>;
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
};

type ResponsesJson = {
  output_text?: string;
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
  output?: Array<{
    type?: string;
    status?: string;
    content?: Array<{ type?: string; text?: string; annotations?: Array<{ type?: string; url?: string; title?: string }> }>;
    name?: string;
    arguments?: string | Record<string, unknown>;
  }>;
};

function toResponsesInput(messages: ChatMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: [{ type: "input_text" as const, text: message.content }],
  }));
}

function extractText(json: ResponsesJson) {
  if (json.output_text?.trim()) return json.output_text.trim();
  const parts: string[] = [];
  for (const item of json.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.text?.trim()) parts.push(content.text.trim());
    }
  }
  return parts.join("\n").trim();
}

function extractCitations(json: ResponsesJson) {
  const citations: Array<{ url?: string; title?: string }> = [];
  for (const item of json.output ?? []) {
    for (const content of item.content ?? []) {
      for (const annotation of content.annotations ?? []) {
        if (annotation.url || annotation.title) {
          citations.push({ url: annotation.url, title: annotation.title });
        }
      }
    }
  }
  return citations;
}

function extractToolCalls(json: ResponsesJson) {
  const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
  for (const item of json.output ?? []) {
    if (item.type === "function_call" && item.name) {
      let args: Record<string, unknown> = {};
      if (typeof item.arguments === "string") {
        try {
          args = JSON.parse(item.arguments) as Record<string, unknown>;
        } catch {
          args = { raw: item.arguments };
        }
      } else if (item.arguments && typeof item.arguments === "object") {
        args = item.arguments;
      }
      calls.push({ name: item.name, arguments: args });
    }
  }
  return calls;
}

export async function callOpenAiResponses(input: ResponsesCallInput): Promise<ResponsesCallOutput> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  const fetchImpl = input.fetchImpl ?? fetch;
  const tools: Array<Record<string, unknown>> = [];
  if (input.webSearch) {
    tools.push({ type: "web_search" });
  }
  for (const tool of input.tools ?? []) {
    tools.push({
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    });
  }

  try {
    const response = await fetchImpl(`${input.baseUrl.replace(/\/$/, "")}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        input: toResponsesInput(input.messages),
        temperature: input.temperature ?? 0.2,
        max_output_tokens: input.maxTokens ?? 1200,
        tools: tools.length ? tools : undefined,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new AgentError(`Provider HTTP ${response.status}`, "provider");
    }
    const json = (await response.json()) as ResponsesJson;
    const text = extractText(json);
    if (!text && extractToolCalls(json).length === 0) {
      throw new AgentError("Provider returned an empty completion", "provider");
    }
    const webSearchCalls = (json.output ?? []).filter((item) => item.type === "web_search_call").length;
    return {
      text,
      model: json.model ?? input.model,
      inputTokens: json.usage?.input_tokens ?? json.usage?.prompt_tokens,
      outputTokens: json.usage?.output_tokens ?? json.usage?.completion_tokens,
      webSearchCalls,
      citations: extractCitations(json),
      toolCalls: extractToolCalls(json),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function callOpenAiEmbeddings(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  text: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 30000);
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(`${input.baseUrl.replace(/\/$/, "")}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: input.model, input: input.text }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new AgentError(`Embedding HTTP ${response.status}`, "provider");
    }
    const json = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
      model?: string;
    };
    const values = json.data?.[0]?.embedding;
    if (!values?.length) throw new AgentError("Embedding provider returned an empty vector", "provider");
    return { values, model: json.model ?? input.model };
  } finally {
    clearTimeout(timer);
  }
}
