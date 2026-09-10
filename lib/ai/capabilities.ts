import { getServerEnv, type ServerEnv } from "../env";

export const AI_CAPABILITY_CLASSES = ["FAST", "STANDARD", "REASONING", "EMBEDDING"] as const;

export type AiCapabilityClass = (typeof AI_CAPABILITY_CLASSES)[number];

export type AiRuntimeMode = "live" | "heuristic";

const HEURISTIC_MODEL = "heuristic-v1";
const DEVELOPMENT_EMBEDDING_MODEL = "development-hash";

const REASONING_TASKS = new Set([
  "mapping_draft",
  "gap_interpretation",
  "scenario_analysis",
  "workforce_roadmap",
  "skills_architecture",
  "draft_proposal",
  "executive_summary",
  "recommend_research",
  "solution_recommendation",
]);

const FAST_TASKS = new Set([
  "scout_search",
  "scout_summarize",
  "candidate_summary",
  "status_summary",
  "invoice_commentary",
  "ar_summary",
  "stalled_alert",
  "overdue_tasks",
  "compliance_check",
]);

const EMBEDDING_TASKS = new Set(["retrieve_knowledge", "index_lessons"]);

export function isAiCapabilityClass(value: string | null | undefined): value is AiCapabilityClass {
  return Boolean(value && (AI_CAPABILITY_CLASSES as readonly string[]).includes(value));
}

export function capabilityClassForTask(taskType: string): AiCapabilityClass {
  if (EMBEDDING_TASKS.has(taskType)) return "EMBEDDING";
  if (REASONING_TASKS.has(taskType)) return "REASONING";
  if (FAST_TASKS.has(taskType)) return "FAST";
  return "STANDARD";
}

export function resolveAiApiKey(env: ServerEnv = getServerEnv()) {
  return env.AI_API_KEY ?? env.OPENAI_API_KEY;
}

export function resolveAiProviderName(env: ServerEnv = getServerEnv()) {
  const named = env.AI_PROVIDER?.trim();
  if (named) return named;
  return resolveAiApiKey(env) ? "openai_compatible" : "internal_heuristic";
}

export function resolveAiBaseUrl(env: ServerEnv = getServerEnv()) {
  return env.AI_BASE_URL ?? "https://api.openai.com/v1";
}

export function resolveAiBaseHost(env: ServerEnv = getServerEnv()) {
  try {
    return new URL(resolveAiBaseUrl(env)).host;
  } catch {
    return "unparseable";
  }
}

export function resolveFallbackBaseHost(env: ServerEnv = getServerEnv()) {
  try {
    return new URL(resolveFallbackBaseUrl(env)).host;
  } catch {
    return "unparseable";
  }
}

export function resolveCapabilityModel(
  capability: AiCapabilityClass,
  env: ServerEnv = getServerEnv(),
): string {
  if (capability === "FAST") {
    return env.AI_MODEL_FAST ?? env.OPENAI_MODEL_FAST ?? env.AI_MODEL ?? HEURISTIC_MODEL;
  }
  if (capability === "STANDARD") {
    return env.AI_MODEL_STANDARD ?? env.OPENAI_MODEL_BALANCED ?? env.AI_MODEL ?? HEURISTIC_MODEL;
  }
  if (capability === "REASONING") {
    return (
      env.AI_MODEL_REASONING ??
      env.OPENAI_MODEL_PRIMARY ??
      env.AI_MODEL_STANDARD ??
      env.AI_MODEL ??
      HEURISTIC_MODEL
    );
  }
  return env.AI_MODEL_EMBEDDING ?? env.OPENAI_EMBEDDING_MODEL ?? DEVELOPMENT_EMBEDDING_MODEL;
}

export function resolveFallbackModel(env: ServerEnv = getServerEnv()) {
  return env.AI_FALLBACK_MODEL;
}

export function resolveFallbackProviderName(env: ServerEnv = getServerEnv()) {
  const named = env.AI_FALLBACK_PROVIDER?.trim().toLowerCase();
  if (named === "gemini") return "gemini";
  return null;
}

export function resolveGeminiApiKey(env: ServerEnv = getServerEnv()) {
  return env.GEMINI_API_KEY;
}

export function resolveFallbackBaseUrl(env: ServerEnv = getServerEnv()) {
  return env.AI_FALLBACK_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai";
}

export function resolveClassFallbackModel(
  capability: AiCapabilityClass,
  env: ServerEnv = getServerEnv(),
): string | undefined {
  if (capability === "FAST") return env.AI_MODEL_FAST_FALLBACK;
  if (capability === "STANDARD") return env.AI_MODEL_STANDARD_FALLBACK;
  if (capability === "REASONING") return env.AI_MODEL_REASONING_FALLBACK;
  return undefined;
}

export function isGeminiFallbackConfigured(env: ServerEnv = getServerEnv()) {
  return resolveFallbackProviderName(env) === "gemini" && Boolean(resolveGeminiApiKey(env));
}

export function isHeuristicModelName(model: string | null | undefined) {
  return !model || model === HEURISTIC_MODEL || model === DEVELOPMENT_EMBEDDING_MODEL || model === "unconfigured";
}

export function isLiveAiConfigured(env: ServerEnv = getServerEnv()) {
  const provider = resolveAiProviderName(env);
  const apiKey = resolveAiApiKey(env);
  return Boolean(apiKey) && provider !== "internal_heuristic";
}

export function isEmbeddingModelConfigured(env: ServerEnv = getServerEnv()) {
  return Boolean(env.AI_MODEL_EMBEDDING ?? env.OPENAI_EMBEDDING_MODEL);
}

export function isBusinessCapabilityClassConfigured(
  capability: Exclude<AiCapabilityClass, "EMBEDDING">,
  env: ServerEnv = getServerEnv(),
) {
  return !isHeuristicModelName(resolveCapabilityModel(capability, env));
}

export function areBusinessCapabilityModelsConfigured(env: ServerEnv = getServerEnv()) {
  return (
    isBusinessCapabilityClassConfigured("FAST", env) &&
    isBusinessCapabilityClassConfigured("STANDARD", env) &&
    isBusinessCapabilityClassConfigured("REASONING", env)
  );
}

export function getAiRuntimeMode(env: ServerEnv = getServerEnv()): AiRuntimeMode {
  return isLiveAiConfigured(env) ? "live" : "heuristic";
}

export function describeAiRuntime(env: ServerEnv = getServerEnv()) {
  const live = isLiveAiConfigured(env);
  const providerName = resolveAiProviderName(env);
  const embeddingsNamed = isEmbeddingModelConfigured(env);
  return {
    mode: live ? ("live" as const) : ("heuristic" as const),
    providerConfigured: live,
    providerName: live ? providerName : "internal_heuristic",
    apiKeyConfigured: Boolean(resolveAiApiKey(env)),
    embeddingsConfigured: embeddingsNamed,
    embeddingPath: embeddingsNamed
      ? "Named embedding model is configured. Retrieval still uses the development-hash / vector(1536) path (DEC-SEM-001)."
      : "Embeddings use development-hash vectors (DEC-SEM-001 temporary 1536). No live embedding model is configured.",
    scoutConfigured: true,
    scoutLiveCompletions: live,
    fallbackConfigured: isGeminiFallbackConfigured(env),
    fallbackProviderName: isGeminiFallbackConfigured(env) ? "gemini" : null,
    businessClassesConfigured: areBusinessCapabilityModelsConfigured(env),
    primaryHost: resolveAiBaseHost(env),
    fallbackHost: isGeminiFallbackConfigured(env) ? resolveFallbackBaseHost(env) : null,
    capabilityModels: {
      FAST: resolveCapabilityModel("FAST", env),
      STANDARD: resolveCapabilityModel("STANDARD", env),
      REASONING: resolveCapabilityModel("REASONING", env),
      EMBEDDING: resolveCapabilityModel("EMBEDDING", env),
    },
  };
}

export { HEURISTIC_MODEL, DEVELOPMENT_EMBEDDING_MODEL };
