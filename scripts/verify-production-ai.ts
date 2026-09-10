import "./load-env";

import { runProductionAiVerification } from "../lib/ai/health-probe";
import { describeAiRuntime } from "../lib/ai/capabilities";
import { getSystemHealth } from "../lib/health/status";

function printProbe(label: string, probe: {
  ok: boolean;
  provider: string;
  model: string;
  capabilityClass: string;
  usedFallback: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number;
  runId: string | null;
  usageId: string | null;
  error: string | null;
}) {
  console.log(
    `${label}: ${probe.ok ? "PASS" : "FAIL"} provider=${probe.provider} class=${probe.capabilityClass} model=${probe.model} fallback=${probe.usedFallback} tokens=${probe.inputTokens ?? 0}/${probe.outputTokens ?? 0} cost=${probe.estimatedCostUsd} run=${probe.runId ?? "none"} usage=${probe.usageId ?? "none"}${probe.error ? ` error=${probe.error}` : ""}`,
  );
}

async function main() {
  const runtime = describeAiRuntime();
  console.log(
    `Runtime mode=${runtime.mode} provider=${runtime.providerName} classesConfigured=${runtime.businessClassesConfigured} geminiConfigured=${runtime.fallbackConfigured}`,
  );
  if (runtime.apiKeyConfigured) {
    console.log("API key present: yes (value not printed)");
  }
  const result = await runProductionAiVerification({
    includeGeminiFailover: runtime.fallbackConfigured,
  });
  printProbe("FAST", result.fast);
  printProbe("STANDARD", result.standard);
  printProbe("REASONING", result.reasoning);
  if (result.gemini) printProbe("GEMINI", result.gemini);
  else console.log("GEMINI: skipped");
  console.log(`Style/tone does not failover: ${result.styleDoesNotFailover}`);
  console.log(`PII used: ${result.piiUsed}`);
  const health = await getSystemHealth();
  const lastLive = health.checks.find((check) => check.title === "Last successful live AI call");
  const lastFallback = health.checks.find((check) => check.title === "Last AI fallback");
  const openai = health.checks.find((check) => check.title === "OpenAI");
  const gemini = health.checks.find((check) => check.title === "Gemini fallback");
  console.log(`OpenAI status=${openai?.status} ${openai?.detail}`);
  console.log(`Gemini status=${gemini?.status} ${gemini?.detail}`);
  console.log(`Last live: ${lastLive?.status} ${lastLive?.detail}`);
  console.log(`Last fallback: ${lastFallback?.status} ${lastFallback?.detail}`);
  const misleading = health.checks.filter(
    (check) =>
      check.status === "LIVE" &&
      /MOCK|NOT CONFIGURED|MANUAL|development-hash/i.test(check.detail) &&
      check.title !== "Scout",
  );
  if (misleading.length) {
    throw new Error(`Misleading LIVE cards: ${misleading.map((item) => item.title).join(", ")}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
