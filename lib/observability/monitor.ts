const SECRET_KEYS = ["password", "token", "secret", "apikey", "authorization", "dsn"];
const PII_KEYS = ["email", "phone", "linkedinurl", "ssn"];

function shouldRedact(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z]/g, "");
  return SECRET_KEYS.some((item) => normalized.includes(item)) || PII_KEYS.includes(normalized);
}

export function redactLogValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactLogValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        shouldRedact(key) ? "[redacted]" : redactLogValue(nested),
      ]),
    );
  }
  return value;
}

export function logServerEvent(event: string, fields: Record<string, unknown> = {}) {
  const payload = redactLogValue({ event, ...fields, at: new Date().toISOString() });
  console.info("[workforceos]", payload);
}

export async function captureException(error: unknown, context: Record<string, unknown> = {}) {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "Error";
  logServerEvent("exception", { name, message, ...context });
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const parsed = new URL(dsn);
    const publicKey = parsed.username;
    const projectId = parsed.pathname.replace(/^\//, "");
    if (!publicKey || !projectId) return;
    await fetch(`${parsed.protocol}//${parsed.host}/api/${projectId}/store/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=workforceos/0.1.0`,
      },
      body: JSON.stringify({
        message,
        level: "error",
        timestamp: Date.now() / 1000,
        extra: redactLogValue(context),
        tags: { app: "workforceos" },
      }),
    });
  } catch {
    // Observability must never break the request path.
  }
}
