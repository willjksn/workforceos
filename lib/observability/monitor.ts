import { redactLogValue } from "./redact";

export { redactLogValue };

export function logServerEvent(event: string, fields: Record<string, unknown> = {}) {
  const payload = redactLogValue({ event, ...fields, at: new Date().toISOString() });
  console.info("[workforceos]", payload);
}

export async function captureException(error: unknown, context: Record<string, unknown> = {}) {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "Error";
  logServerEvent("exception", { name, message, ...context });
  const { captureWithOfficialSentry } = await import("./sentry");
  await captureWithOfficialSentry(error, { name, message, ...context });
}
