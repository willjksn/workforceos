"use server";

import { requireCurrentPrincipal } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/rbac/permissions";
import { RATE_LIMITS, RateLimitError, assertRateLimit } from "@/lib/security/rate-limit";
import { searchWorkforceOs, type GlobalSearchHit } from "@/lib/search/global";

export type GlobalSearchResult = {
  hits: GlobalSearchHit[];
  error?: string;
};

export async function searchWorkforceOsAction(query: string): Promise<GlobalSearchResult> {
  try {
    const principal = await requireCurrentPrincipal();
    await assertRateLimit({ key: `search:${principal.id}`, ...RATE_LIMITS.search });
    const hits = await searchWorkforceOs(principal, query);
    return { hits };
  } catch (error) {
    if (error instanceof AuthorizationError) return { hits: [], error: error.message };
    if (error instanceof RateLimitError) return { hits: [], error: error.message };
    return { hits: [], error: "Search could not complete. Try again." };
  }
}
