export function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/\0/g, "").replace(/\s+/g, " ").trim();
}

export function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

export function normalizePhone(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits || null;
}

export function normalizeWebsiteHost(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const raw = value.trim();
  try {
    const withProto = /:\/\//.test(raw) ? raw : `https://${raw}`;
    const host = new URL(withProto).hostname.replace(/^www\./i, "").toLowerCase();
    if (!host || host === "localhost") return null;
    return host;
  } catch {
    const host = raw
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      ?.toLowerCase();
    return host || null;
  }
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}
