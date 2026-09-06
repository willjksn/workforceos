import { getAiStackConfig, isOpenAiConfigured, isTavilyConfigured } from "../ai/stack/config";
import { callOpenAiResponses } from "../ai/stack/responses";
import { provenanceRecord, type SourceProvenance } from "./provenance";

export type WebResearchQuery = {
  query: string;
  researchType: "general" | "deep" | "company" | "hiring";
  maxResults?: number;
};

export type WebResearchHit = {
  title: string;
  snippet: string;
  url?: string | null;
  publisher?: string | null;
  provenance: SourceProvenance;
};

export type WebResearchResult = {
  provider: "openai" | "tavily";
  ok: boolean;
  hits: WebResearchHit[];
  error?: string;
  retrievedAt: Date;
};

export type WebResearchProvider = {
  readonly id: "openai" | "tavily";
  search(query: WebResearchQuery): Promise<WebResearchResult>;
};

function emptyResult(provider: "openai" | "tavily", error: string): WebResearchResult {
  return { provider, ok: false, hits: [], error, retrievedAt: new Date() };
}

export class OpenAIWebSearchProvider implements WebResearchProvider {
  readonly id = "openai" as const;

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async search(query: WebResearchQuery): Promise<WebResearchResult> {
    const config = getAiStackConfig();
    if (!isOpenAiConfigured(config)) {
      return emptyResult("openai", "OpenAI web search is not configured.");
    }
    try {
      const response = await callOpenAiResponses({
        baseUrl: config.openaiBaseUrl,
        apiKey: config.openaiApiKey as string,
        model: config.primaryModel,
        messages: [
          {
            role: "system",
            content:
              "Search the web for current public information. Return concise findings with titles. Do not invent URLs. This is not a WorkforceOS internal fact.",
          },
          { role: "user", content: query.query },
        ],
        webSearch: true,
        timeoutMs: 30000,
        fetchImpl: this.fetchImpl,
      });
      const retrievedAt = new Date();
      const hits: WebResearchHit[] =
        response.citations.length > 0
          ? response.citations.slice(0, query.maxResults ?? 5).map((citation, index) => ({
              title: citation.title ?? `Web finding ${index + 1}`,
              snippet: response.text.slice(0, 400),
              url: citation.url ?? null,
              publisher: null,
              provenance: provenanceRecord({
                provider: "openai",
                sourceType: "OPENAI_WEB",
                url: citation.url ?? null,
                retrievedAt,
              }),
            }))
          : [
              {
                title: "OpenAI web research",
                snippet: response.text.slice(0, 400),
                url: null,
                publisher: null,
                provenance: provenanceRecord({
                  provider: "openai",
                  sourceType: "OPENAI_WEB",
                  retrievedAt,
                }),
              },
            ];
      return { provider: "openai", ok: true, hits, retrievedAt };
    } catch (error) {
      return emptyResult("openai", error instanceof Error ? error.message : "OpenAI web search failed.");
    }
  }
}

export class TavilyWebResearchProvider implements WebResearchProvider {
  readonly id = "tavily" as const;

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async search(query: WebResearchQuery): Promise<WebResearchResult> {
    const config = getAiStackConfig();
    if (!isTavilyConfigured(config)) {
      return emptyResult("tavily", "Tavily is not configured.");
    }
    try {
      const response = await this.fetchImpl("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: config.tavilyApiKey,
          query: query.query,
          search_depth: query.researchType === "deep" ? "advanced" : "basic",
          max_results: query.maxResults ?? 8,
        }),
      });
      if (!response.ok) {
        return emptyResult("tavily", `Tavily HTTP ${response.status}`);
      }
      const json = (await response.json()) as {
        results?: Array<{ title?: string; url?: string; content?: string }>;
      };
      const retrievedAt = new Date();
      const hits: WebResearchHit[] = (json.results ?? []).slice(0, query.maxResults ?? 8).map((row) => ({
        title: row.title ?? "Tavily result",
        snippet: (row.content ?? "").slice(0, 400),
        url: row.url ?? null,
        publisher: null,
        provenance: provenanceRecord({
          provider: "tavily",
          sourceType: "TAVILY_WEB",
          url: row.url ?? null,
          retrievedAt,
        }),
      }));
      return { provider: "tavily", ok: true, hits, retrievedAt };
    } catch (error) {
      return emptyResult("tavily", error instanceof Error ? error.message : "Tavily search failed.");
    }
  }
}

export type WebResearchRouterInput = {
  query: WebResearchQuery;
  prefer?: "openai" | "tavily" | null;
  openaiProvider?: WebResearchProvider;
  tavilyProvider?: WebResearchProvider;
};

export async function runWebResearch(input: WebResearchRouterInput): Promise<{
  result: WebResearchResult | null;
  attempted: Array<"openai" | "tavily">;
  usedFallback: boolean;
  bothFailed: boolean;
}> {
  const config = getAiStackConfig();
  const openai = input.openaiProvider ?? new OpenAIWebSearchProvider();
  const tavily = input.tavilyProvider ?? new TavilyWebResearchProvider();
  const prefer =
    input.prefer ??
    (input.query.researchType === "deep" ? "tavily" : config.webSearchPrimary);
  const attempted: Array<"openai" | "tavily"> = [];

  const primary = prefer === "tavily" ? tavily : openai;
  const fallback = prefer === "tavily" ? openai : tavily;
  const fallbackEnabled = config.webSearchFallback === "tavily" || prefer === "tavily";

  attempted.push(primary.id);
  const first = await primary.search(input.query);
  if (first.ok) {
    return { result: first, attempted, usedFallback: false, bothFailed: false };
  }

  if (fallbackEnabled) {
    attempted.push(fallback.id);
    const second = await fallback.search(input.query);
    if (second.ok) {
      return { result: second, attempted, usedFallback: true, bothFailed: false };
    }
    return { result: second, attempted, usedFallback: true, bothFailed: true };
  }

  return { result: first, attempted, usedFallback: false, bothFailed: !first.ok };
}
