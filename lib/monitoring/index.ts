export type MonitoringEvent = {
  level: "info" | "error";
  message: string;
  context?: Record<string, unknown>;
};

export function captureException(error: unknown, context?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[workforceos:monitor]", message, context ?? {});
}

export function captureMessage(event: MonitoringEvent) {
  if (event.level === "error") {
    console.error("[workforceos:monitor]", event.message, event.context ?? {});
    return;
  }
  console.info("[workforceos:monitor]", event.message, event.context ?? {});
}
