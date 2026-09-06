import type { z } from "zod";

import { parseModelJson } from "./parse";
import type { AIProvider, AiGenerateRequest, AiGenerateResult, AiStructuredResult } from "./types";

function heuristicReply(messages: { role: string; content: string }[]) {
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

export class HeuristicAIProvider implements AIProvider {
  readonly id = "internal_heuristic";

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    return {
      text: heuristicReply(request.messages),
      provider: this.id,
      model: "heuristic-v1",
      modelVersion: "unconfigured",
      tier: "heuristic",
      usedFallback: false,
      usage: { estimatedCostUsd: 0 },
    };
  }

  async generateStructured<T>(request: AiGenerateRequest, schema: z.ZodType<T>): Promise<AiStructuredResult<T>> {
    const result = await this.generate(request);
    const parsed = parseModelJson(result.text);
    const validated = schema.safeParse(parsed);
    return { ...result, data: validated.success ? validated.data : null, valid: validated.success };
  }

  reason(request: AiGenerateRequest) {
    return this.generate(request);
  }
  classify(request: AiGenerateRequest) {
    return this.generate(request);
  }
  draft(request: AiGenerateRequest) {
    return this.generate(request);
  }
  runWithTools(request: AiGenerateRequest) {
    return this.generate(request);
  }
}
