import { GREENHOUSE_ADAPTER_KEY, type CareerSourceCategory, type CareerSourceHealthState } from "./types";

/**
 * Live means a complete Greenhouse sync succeeded and the latest attempt did not fail.
 * Manual imports stay manual. Never-run sources stay not_yet_synced.
 */
export function careerSourceHealth(input: {
  sourceType: CareerSourceCategory;
  adapterKey?: string | null;
  lastSuccessfulSyncAt: Date | null;
  failed?: boolean;
  blocked?: boolean;
}): CareerSourceHealthState {
  if (input.blocked) return "blocked";
  if (input.failed) return "error";
  if (input.lastSuccessfulSyncAt) {
    return input.sourceType === "employer_api" && input.adapterKey === GREENHOUSE_ADAPTER_KEY ? "live" : "manual";
  }
  return "not_yet_synced";
}
