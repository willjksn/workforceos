import { developmentEmbedding } from "../knowledge";
import { AgentError } from "../errors";
import {
  APPROVED_EMBEDDING_DIMENSION,
  getAiStackConfig,
  isOpenAiConfigured,
  type AiStackConfig,
} from "./config";
import { callOpenAiEmbeddings } from "./responses";
import type { EmbeddingProvider, EmbeddingVector } from "./types";

export class DevelopmentHashEmbeddingProvider implements EmbeddingProvider {
  readonly id = "development-hash";
  readonly model = "development-hash";
  readonly version = "phase7-dev";
  readonly dimension = APPROVED_EMBEDDING_DIMENSION;

  async embed(text: string): Promise<EmbeddingVector> {
    return {
      values: developmentEmbedding(text),
      model: this.model,
      version: this.version,
      dimension: this.dimension,
    };
  }
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly id = "openai";
  readonly model: string;
  readonly version: string;
  readonly dimension = APPROVED_EMBEDDING_DIMENSION;

  constructor(
    private readonly config: AiStackConfig = getAiStackConfig(),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.model = config.embeddingModel ?? "unspecified";
    this.version = config.embeddingModel ?? "unspecified";
  }

  async embed(text: string): Promise<EmbeddingVector> {
    if (!isOpenAiConfigured(this.config) || !this.config.embeddingModel) {
      throw new AgentError("OpenAI embedding model is not configured", "config");
    }
    const result = await callOpenAiEmbeddings({
      baseUrl: this.config.openaiBaseUrl,
      apiKey: this.config.openaiApiKey as string,
      model: this.config.embeddingModel,
      text,
      fetchImpl: this.fetchImpl,
    });
    if (result.values.length !== APPROVED_EMBEDDING_DIMENSION) {
      throw new AgentError(
        `Embedding dimension ${result.values.length} does not match stored semantic_documents dimension ${APPROVED_EMBEDDING_DIMENSION}. Reindex/migration required before changing models (DEC-SEM-001).`,
        "config",
      );
    }
    return {
      values: result.values,
      model: result.model,
      version: result.model,
      dimension: result.values.length,
    };
  }
}

export function getEmbeddingProvider(config: AiStackConfig = getAiStackConfig()): EmbeddingProvider {
  if (isOpenAiConfigured(config) && config.embeddingModel) {
    return new OpenAIEmbeddingProvider(config);
  }
  return new DevelopmentHashEmbeddingProvider();
}
