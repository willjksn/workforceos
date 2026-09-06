export function parseModelJson(text: string): Record<string, unknown> {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return { summary: text };
}
