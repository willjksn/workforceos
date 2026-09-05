export function emptyToNull(value: FormDataEntryValue | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function requiredString(value: FormDataEntryValue | null | undefined, field: string) {
  const parsed = emptyToNull(value);
  if (!parsed) {
    throw new Error(`${field} is required`);
  }
  return parsed;
}

export function sanitizeSearchQuery(value: string | undefined) {
  return (value ?? "").replace(/[%_]/g, "").trim().slice(0, 200);
}
