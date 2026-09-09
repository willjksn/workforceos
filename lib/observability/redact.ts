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
