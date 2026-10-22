import { employerJobContentHash } from "./content-hash";
import type { NormalizedEmployerJob } from "./types";

export type StoredSourcedJob = {
  externalKey: string;
  contentHash: string | null;
  status: string;
};

export type SyncPlanItem =
  | { action: "create"; job: NormalizedEmployerJob; contentHash: string }
  | { action: "change"; job: NormalizedEmployerJob; contentHash: string; previousStatus: string }
  | { action: "reopen"; job: NormalizedEmployerJob; contentHash: string }
  | { action: "unchanged"; job: NormalizedEmployerJob; contentHash: string }
  | { action: "close"; externalKey: string }
  | { action: "error"; externalKey: string | null; message: string };

const AUTO_CLOSE = new Set(["open", "search_active"]);

/**
 * A failed sync returns no job changes. Missing keys close only when the caller
 * says the listing is complete. CSV and manual imports pass closeMissing false.
 */
export function planSourceSync(input: {
  existing: StoredSourcedJob[];
  discovered: NormalizedEmployerJob[];
  syncSucceeded: boolean;
  listingComplete: boolean;
  closeMissing: boolean;
}) {
  if (!input.syncSucceeded) return [] as SyncPlanItem[];
  const items: SyncPlanItem[] = [];
  const seen = new Set<string>();
  const byKey = new Map(input.existing.map((row) => [row.externalKey, row]));
  for (const job of input.discovered) {
    if (!job.externalKey.trim() || !job.title.trim()) {
      items.push({ action: "error", externalKey: job.externalKey || null, message: "External key and title are required." });
      continue;
    }
    if (seen.has(job.externalKey)) {
      items.push({ action: "error", externalKey: job.externalKey, message: "Duplicate external key in this import." });
      continue;
    }
    seen.add(job.externalKey);
    let contentHash = "";
    try {
      contentHash = employerJobContentHash(job);
    } catch (error) {
      items.push({
        action: "error",
        externalKey: job.externalKey,
        message: error instanceof Error ? error.message : "Job could not be normalized.",
      });
      continue;
    }
    const current = byKey.get(job.externalKey);
    if (!current) {
      items.push({ action: "create", job, contentHash });
      continue;
    }
    const same = current.contentHash === contentHash;
    if (job.explicitlyClosed) {
      if (same && current.status === "closed") items.push({ action: "unchanged", job, contentHash });
      else if (same) items.push({ action: "close", externalKey: job.externalKey });
      else items.push({ action: "change", job, contentHash, previousStatus: current.status });
      continue;
    }
    if (same && current.status === "closed") {
      items.push({ action: "reopen", job, contentHash });
      continue;
    }
    if (same) items.push({ action: "unchanged", job, contentHash });
    else items.push({ action: "change", job, contentHash, previousStatus: current.status });
  }
  if (input.closeMissing && input.listingComplete) {
    for (const row of input.existing) {
      if (!seen.has(row.externalKey) && AUTO_CLOSE.has(row.status)) {
        items.push({ action: "close", externalKey: row.externalKey });
      }
    }
  }
  return items;
}
