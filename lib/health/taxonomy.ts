export const HEALTH_STATUSES = [
  "LIVE",
  "CONFIGURED",
  "DEGRADED",
  "HEURISTIC",
  "MOCK",
  "MANUAL",
  "NOT_CONFIGURED",
  "DEFERRED",
  "DEVELOPMENT",
  "ERROR",
  "OK",
] as const;

export type HealthStatus = (typeof HEALTH_STATUSES)[number];

export type HealthCheck = {
  title: string;
  status: HealthStatus;
  detail: string;
  /** True when the process is not in ERROR/DEGRADED. Not a production-live claim. */
  ok: boolean;
};

export type HealthStatusTone = "neutral" | "navy" | "teal" | "success" | "warning" | "danger";

export type IntegrationHonestySummary = {
  live: number;
  configured: number;
  mockManual: number;
  notConfigured: number;
  deferred: number;
  development: number;
};

export function healthStatusOk(status: HealthStatus) {
  return status !== "ERROR" && status !== "DEGRADED";
}

export function healthStatusLabel(status: HealthStatus) {
  return status.replaceAll("_", " ");
}

export function healthStatusTone(status: HealthStatus): HealthStatusTone {
  switch (status) {
    case "LIVE":
      return "success";
    case "CONFIGURED":
      return "teal";
    case "DEGRADED":
    case "DEVELOPMENT":
      return "warning";
    case "ERROR":
      return "danger";
    case "HEURISTIC":
    case "MANUAL":
    case "OK":
      return "navy";
    default:
      return "neutral";
  }
}

export function healthCheck(
  title: string,
  status: HealthStatus,
  detail: string,
): HealthCheck {
  return { title, status, detail, ok: healthStatusOk(status) };
}

export function summarizeIntegrationStatuses(statuses: HealthStatus[]): IntegrationHonestySummary {
  const summary: IntegrationHonestySummary = {
    live: 0,
    configured: 0,
    mockManual: 0,
    notConfigured: 0,
    deferred: 0,
    development: 0,
  };
  for (const status of statuses) {
    if (status === "LIVE") summary.live += 1;
    else if (status === "CONFIGURED") summary.configured += 1;
    else if (status === "MOCK" || status === "MANUAL") summary.mockManual += 1;
    else if (status === "NOT_CONFIGURED") summary.notConfigured += 1;
    else if (status === "DEFERRED") summary.deferred += 1;
    else if (status === "DEVELOPMENT") summary.development += 1;
  }
  return summary;
}

export function formatIntegrationSummary(summary: IntegrationHonestySummary) {
  return `Live: ${summary.live}. Configured: ${summary.configured}. Mock/Manual: ${summary.mockManual}. Not configured: ${summary.notConfigured}.`;
}
