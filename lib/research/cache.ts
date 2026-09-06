import { createHash } from "node:crypto";

export type ResearchCacheEntry = {
  provider: string;
  researchType: string;
  query: string;
  retrievedAt: Date;
  expiresAt: Date;
  summary: Record<string, unknown>;
};

const memory = new Map<string, ResearchCacheEntry>();

export function researchCacheKey(input: {
  provider: string;
  query: string;
  filters?: Record<string, unknown>;
  researchType: string;
}) {
  const payload = JSON.stringify({
    provider: input.provider,
    query: input.query.trim().toLowerCase(),
    filters: input.filters ?? {},
    researchType: input.researchType,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function ttlForResearchType(researchType: string) {
  if (/hiring|breaking|current|news/.test(researchType)) return 30 * 60 * 1000;
  if (/company|account|firm/.test(researchType)) return 12 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

export function readResearchCache(key: string) {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt.getTime() <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry;
}

export function writeResearchCache(key: string, entry: ResearchCacheEntry) {
  memory.set(key, entry);
  return entry;
}

export function clearResearchCache() {
  memory.clear();
}
