export const PUBLIC_SERVICE_UNAVAILABLE = "Service temporarily unavailable.";

function looksLikeHtml(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("<") || /^<!doctype/i.test(trimmed) || /<html[\s>]/i.test(trimmed);
}

export function publicSafeErrorMessage(error: unknown, fallback = PUBLIC_SERVICE_UNAVAILABLE): string {
  if (typeof error === "string") {
    const trimmed = error.trim();
    if (!trimmed || looksLikeHtml(trimmed) || /unexpected token\s+'<'/i.test(trimmed)) {
      return fallback;
    }
    if (/\[object Object\]/i.test(trimmed)) return fallback;
    return trimmed.slice(0, 280);
  }
  if (error instanceof Error) {
    return publicSafeErrorMessage(error.message, fallback);
  }
  if (error && typeof error === "object") {
    const record = error as { error?: unknown; message?: unknown };
    if (typeof record.error === "string" || (record.error && typeof record.error === "object")) {
      return publicSafeErrorMessage(record.error, fallback);
    }
    if (typeof record.message === "string") {
      return publicSafeErrorMessage(record.message, fallback);
    }
  }
  return fallback;
}

export async function readPublicJsonError(response: Response, fallback = PUBLIC_SERVICE_UNAVAILABLE): Promise<string> {
  const text = await response.text();
  if (!text || looksLikeHtml(text)) return fallback;
  try {
    return publicSafeErrorMessage(JSON.parse(text), fallback);
  } catch {
    return fallback;
  }
}
