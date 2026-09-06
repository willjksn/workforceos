import { getServerEnv } from "../../env";

export const DEFAULT_OPENAI_MODEL_PRIMARY = "gpt-5.6";
export const DEFAULT_OPENAI_MODEL_BALANCED = "gpt-5.6-terra";
export const DEFAULT_OPENAI_MODEL_FAST = "gpt-5.6-luna";
export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
export const APPROVED_EMBEDDING_DIMENSION = 1536;

export type AiStackConfig = {
  openaiApiKey: string | undefined;
  openaiBaseUrl: string;
  primaryModel: string;
  balancedModel: string;
  fastModel: string;
  embeddingModel: string | undefined;
  webSearchPrimary: "openai" | "tavily";
  webSearchFallback: "tavily" | "none";
  tavilyApiKey: string | undefined;
  talentSourcingProvider: "seekout" | "hireez" | undefined;
};

export function getAiStackConfig(): AiStackConfig {
  const env = getServerEnv();
  const webPrimary = env.WEB_SEARCH_PRIMARY === "tavily" ? "tavily" : "openai";
  const webFallback = env.WEB_SEARCH_FALLBACK === "none" ? "none" : "tavily";
  const sourcing =
    env.TALENT_SOURCING_PROVIDER === "hireez"
      ? "hireez"
      : env.TALENT_SOURCING_PROVIDER === "seekout"
        ? "seekout"
        : undefined;
  return {
    openaiApiKey: env.OPENAI_API_KEY ?? env.AI_API_KEY,
    openaiBaseUrl: env.AI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL,
    primaryModel: env.OPENAI_MODEL_PRIMARY ?? env.AI_MODEL ?? DEFAULT_OPENAI_MODEL_PRIMARY,
    balancedModel: env.OPENAI_MODEL_BALANCED ?? DEFAULT_OPENAI_MODEL_BALANCED,
    fastModel: env.OPENAI_MODEL_FAST ?? DEFAULT_OPENAI_MODEL_FAST,
    embeddingModel: env.OPENAI_EMBEDDING_MODEL,
    webSearchPrimary: webPrimary,
    webSearchFallback: webFallback,
    tavilyApiKey: env.TAVILY_API_KEY,
    talentSourcingProvider: sourcing,
  };
}

export function isOpenAiConfigured(config: AiStackConfig = getAiStackConfig()) {
  return Boolean(config.openaiApiKey);
}

export function isTavilyConfigured(config: AiStackConfig = getAiStackConfig()) {
  return Boolean(config.tavilyApiKey);
}

export function modelForTier(tier: "sol" | "terra" | "luna", config: AiStackConfig = getAiStackConfig()) {
  if (tier === "sol") return config.primaryModel;
  if (tier === "terra") return config.balancedModel;
  return config.fastModel;
}

export function tierForModel(model: string, config: AiStackConfig = getAiStackConfig()): "sol" | "terra" | "luna" | "unknown" {
  if (model === config.primaryModel || model === "gpt-5.6" || model === "gpt-5.6-sol") return "sol";
  if (model === config.balancedModel || model.includes("terra")) return "terra";
  if (model === config.fastModel || model.includes("luna")) return "luna";
  return "unknown";
}
