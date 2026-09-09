export function formatCitations(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const labels = value
    .map((item) => {
      if (typeof item === "string" && item.trim()) return item.trim();
      if (item && typeof item === "object") {
        const row = item as { label?: unknown; type?: unknown; id?: unknown; source?: unknown };
        const label = [row.label, row.source, row.type].find((part) => typeof part === "string" && part.trim());
        if (typeof label === "string") return label.trim();
      }
      return null;
    })
    .filter((label): label is string => Boolean(label));
  return labels.length > 0 ? labels.join(" · ") : null;
}

export function knowledgeCitation(row: { source?: string | null; sourceUrl?: string | null; version?: string | null }) {
  const parts = [row.source, row.sourceUrl, row.version ? `v${row.version}` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "No source recorded";
}
