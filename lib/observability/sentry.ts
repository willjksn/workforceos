import { redactLogValue } from "./redact";

let initialized = false;

export function isOfficialSentrySdkActive() {
  return initialized && Boolean(process.env.SENTRY_DSN?.trim());
}

export async function initOfficialSentry() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn || initialized) return initialized;
  try {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend(event) {
        const extra = event.extra ? (redactLogValue(event.extra) as Record<string, unknown>) : undefined;
        const tags = event.tags ? (redactLogValue(event.tags) as Record<string, string>) : undefined;
        return {
          ...event,
          extra,
          tags,
          user: undefined,
          request: event.request
            ? { method: event.request.method, url: undefined, headers: undefined, data: undefined }
            : undefined,
        };
      },
    });
    initialized = true;
  } catch {
    initialized = false;
  }
  return initialized;
}

export async function captureWithOfficialSentry(error: unknown, context: Record<string, unknown>) {
  if (!process.env.SENTRY_DSN?.trim()) return;
  try {
    if (!initialized) await initOfficialSentry();
    if (!initialized) return;
    const Sentry = await import("@sentry/node");
    Sentry.captureException(error, { extra: redactLogValue(context) as Record<string, unknown> });
  } catch {
    // Observability must never break the request path.
  }
}
