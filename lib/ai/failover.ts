/**
 * Gemini is availability backup only (DEC-AI-012).
 * Never fail over for tone, style, structure, or low confidence.
 */

export const AVAILABILITY_FAILURE_TYPES = [
  "timeout",
  "http_408",
  "http_429",
  "http_5xx",
  "abort",
  "empty_body",
] as const;

export type AvailabilityFailureType = (typeof AVAILABILITY_FAILURE_TYPES)[number];

export type FailoverReason =
  | { kind: "availability"; type: AvailabilityFailureType }
  | { kind: "style" }
  | { kind: "tone" }
  | { kind: "low_confidence" }
  | { kind: "structure" }
  | { kind: "unknown"; detail?: string };

export function isAvailabilityFailure(reason: FailoverReason): boolean {
  return reason.kind === "availability";
}

/** True only for timeout, 408/429/5xx, abort, or empty body. Style/tone/confidence never hop. */
export function shouldFailoverForAvailability(reason: FailoverReason): boolean {
  return isAvailabilityFailure(reason);
}

export function classifyProviderError(error: unknown): FailoverReason {
  if (!error) return { kind: "unknown", detail: "empty_error" };
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (name === "AbortError" || lower.includes("aborted") || lower.includes("abort")) {
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return { kind: "availability", type: "timeout" };
    }
    return { kind: "availability", type: "abort" };
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("etimedout")) {
    return { kind: "availability", type: "timeout" };
  }
  if (lower.includes("empty completion") || lower.includes("empty body") || lower.includes("empty response")) {
    return { kind: "availability", type: "empty_body" };
  }

  const http = /(?:provider\s+)?http\s+(\d{3})/i.exec(message) ?? /\b(\d{3})\b/.exec(message);
  if (http) {
    const status = Number(http[1]);
    if (status === 408) return { kind: "availability", type: "http_408" };
    if (status === 429) return { kind: "availability", type: "http_429" };
    if (status >= 500 && status <= 599) return { kind: "availability", type: "http_5xx" };
    return { kind: "unknown", detail: `http_${status}` };
  }

  if (lower.includes("fetch failed") || lower.includes("network") || lower.includes("econnreset") || lower.includes("econnrefused")) {
    return { kind: "availability", type: "abort" };
  }

  return { kind: "unknown", detail: name || "unclassified" };
}

export function failoverReasonFromLabel(
  label: "style" | "tone" | "low_confidence" | "structure" | AvailabilityFailureType,
): FailoverReason {
  if (label === "style") return { kind: "style" };
  if (label === "tone") return { kind: "tone" };
  if (label === "low_confidence") return { kind: "low_confidence" };
  if (label === "structure") return { kind: "structure" };
  return { kind: "availability", type: label };
}
