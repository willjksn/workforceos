const RESTRICTED_KEYS = [
  "email",
  "phone",
  "linkedinUrl",
  "address1",
  "address2",
  "resumeText",
  "compensationExpectations",
  "compensationMin",
  "compensationMax",
];

export function stripScoutPii<T>(value: T, canReadPii: boolean): T {
  if (canReadPii) return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripScoutPii(item, false)) as T;
  }
  if (value && typeof value === "object") {
    const copy: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (RESTRICTED_KEYS.some((restricted) => key.toLowerCase() === restricted.toLowerCase())) {
        copy[key] = null;
        continue;
      }
      copy[key] = stripScoutPii(nested, false);
    }
    return copy as T;
  }
  return value;
}
