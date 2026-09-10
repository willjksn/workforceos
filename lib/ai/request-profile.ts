/**
 * Chat Completions request-shape compatibility (DEC-AI-011 / DEC-AI-012).
 * Business code selects FAST / STANDARD / REASONING. This module decides
 * which HTTP fields the selected model/provider will accept.
 */

export type TokenField = "max_tokens" | "max_completion_tokens";

export type ParameterInclusion = "omit" | "send";

export type ChatParameterProfile = {
  label: string;
  tokenField: TokenField;
  temperature: ParameterInclusion;
  topP: ParameterInclusion;
  logprobs: ParameterInclusion;
  responseFormat: ParameterInclusion;
  reasoningEffort: ParameterInclusion;
  tools: ParameterInclusion;
};

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function normalizeModel(model: string) {
  return model.trim().toLowerCase();
}

function isGeminiProvider(provider: string) {
  return provider.trim().toLowerCase() === "gemini";
}

/** GPT-4.1 / GPT-4o / GPT-3.5 chat models that accept custom temperature. */
function isClassicChatModel(model: string) {
  const id = normalizeModel(model);
  return (
    id.includes("gpt-4o") ||
    id.includes("gpt-4.1") ||
    /\bgpt-4-/.test(id) ||
    id.includes("gpt-3.5") ||
    id.includes("chatgpt")
  );
}

/** GPT-5 / o-series style models: default temperature only, max_completion_tokens. */
function isRestrictedSamplingModel(model: string) {
  const id = normalizeModel(model);
  if (isClassicChatModel(id)) return false;
  return (
    /\bgpt-?5(\b|[.-])/.test(id) ||
    /(^|[^a-z0-9])o[1-4](\b|[.-])/.test(id) ||
    /\bo1\b|\bo3\b|\bo4\b/.test(id)
  );
}

export function supportsTemperature(model: string, provider = "openai_compatible") {
  return chatParameterProfile({ model, provider }).temperature === "send";
}

export function supportsTopP(model: string, provider = "openai_compatible") {
  return chatParameterProfile({ model, provider }).topP === "send";
}

export function supportsReasoningEffort(model: string, provider = "openai_compatible") {
  return chatParameterProfile({ model, provider }).reasoningEffort === "send";
}

export function chatParameterProfile(input: { model: string; provider: string }): ChatParameterProfile {
  if (isGeminiProvider(input.provider)) {
    return {
      label: "gemini-chat",
      tokenField: "max_tokens",
      temperature: "send",
      topP: "omit",
      logprobs: "omit",
      responseFormat: "omit",
      reasoningEffort: "omit",
      tools: "omit",
    };
  }

  if (isClassicChatModel(input.model)) {
    return {
      label: "openai-chat",
      tokenField: "max_completion_tokens",
      temperature: "send",
      topP: "omit",
      logprobs: "omit",
      responseFormat: "omit",
      reasoningEffort: "omit",
      tools: "omit",
    };
  }

  if (isRestrictedSamplingModel(input.model)) {
    return {
      label: "openai-restricted",
      tokenField: "max_completion_tokens",
      temperature: "omit",
      topP: "omit",
      logprobs: "omit",
      responseFormat: "omit",
      reasoningEffort: "omit",
      tools: "omit",
    };
  }

  // Unknown OpenAI-compatible ids (including current production class ids): omit
  // sampling fields so GPT-5-family defaults are not overridden.
  return {
    label: "openai-default",
    tokenField: "max_completion_tokens",
    temperature: "omit",
    topP: "omit",
    logprobs: "omit",
    responseFormat: "omit",
    reasoningEffort: "omit",
    tools: "omit",
  };
}

export function describeParameterProfile(profile: ChatParameterProfile, temperatureValue?: number) {
  return {
    profile: profile.label,
    tokenField: profile.tokenField,
    temperature: profile.temperature === "send" ? temperatureValue ?? 0.2 : "omitted",
    topP: "omitted",
    logprobs: "omitted",
    responseFormat: "omitted",
    reasoning: "omitted",
    tools: "omitted",
  };
}

export function buildChatCompletionsBody(input: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  profile: ChatParameterProfile;
  includeTemperature?: boolean;
  tokenField?: TokenField;
}) {
  const tokenField = input.tokenField ?? input.profile.tokenField;
  const includeTemperature = input.includeTemperature ?? input.profile.temperature === "send";
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
  };
  if (includeTemperature) body.temperature = input.temperature ?? 0.2;
  body[tokenField] = input.maxTokens ?? 1200;
  return body;
}

export function rejectedRequestField(message: string) {
  const parameter = /unsupported parameter:\s*'([^']+)'/i.exec(message);
  if (parameter?.[1]) return parameter[1];
  const value = /unsupported value:\s*'([^']+)'/i.exec(message);
  if (value?.[1]) return value[1];
  return null;
}

export function nextChatRequestShape(
  current: { tokenField: TokenField; includeTemperature: boolean },
  unsupported: string | null,
): { tokenField: TokenField; includeTemperature: boolean } | null {
  if (unsupported === "max_tokens" && current.tokenField === "max_tokens") {
    return { ...current, tokenField: "max_completion_tokens" };
  }
  if (unsupported === "max_completion_tokens" && current.tokenField === "max_completion_tokens") {
    return { ...current, tokenField: "max_tokens" };
  }
  if (unsupported === "temperature" && current.includeTemperature) {
    return { ...current, includeTemperature: false };
  }
  return null;
}
