/**
 * Career-source rows use their own stored health words.
 * Command Center maps them onto the system truth vocabulary.
 * A status string of "live" without a successful sync is not LIVE.
 */
export function careerSourceHonesty(
  status: string,
  lastSuccessfulSyncAt: Date | string | null,
): "LIVE" | "MANUAL" | "ERROR" | "DEGRADED" | "NOT CONFIGURED" {
  if (status === "live" && lastSuccessfulSyncAt) return "LIVE";
  if (status === "manual") return "MANUAL";
  if (status === "error") return "ERROR";
  if (status === "blocked") return "DEGRADED";
  return "NOT CONFIGURED";
}
