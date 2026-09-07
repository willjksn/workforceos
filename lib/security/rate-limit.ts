import { and, eq, sql } from "drizzle-orm";

import { getDb } from "../../db";
import { rateLimitBuckets } from "../../db/schema";

export class RateLimitError extends Error {
  constructor(message = "Too many requests. Wait a moment and try again.") {
    super(message);
    this.name = "RateLimitError";
  }
}

export type RateLimitWindow = {
  key: string;
  limit: number;
  windowSeconds: number;
};

const memory = new Map<string, { windowStartedAt: number; hitCount: number }>();

export const RATE_LIMITS = {
  ai: { limit: 30, windowSeconds: 60 },
  export: { limit: 10, windowSeconds: 60 },
  search: { limit: 60, windowSeconds: 60 },
  webhook: { limit: 120, windowSeconds: 60 },
  authSensitive: { limit: 20, windowSeconds: 60 },
  publicApplication: { limit: 5, windowSeconds: 60 },
  publicInquiry: { limit: 5, windowSeconds: 60 },
  publicMilitaryTalent: { limit: 5, windowSeconds: 60 },
  hmacReplay: { limit: 1, windowSeconds: 10 * 60 },
} as const;

function windowStart(windowSeconds: number, now = Date.now()) {
  const ms = windowSeconds * 1000;
  return new Date(Math.floor(now / ms) * ms);
}

export function consumeMemoryBucket(input: RateLimitWindow & { now?: number }) {
  const started = windowStart(input.windowSeconds, input.now).getTime();
  const stored = memory.get(input.key);
  if (!stored || stored.windowStartedAt !== started) {
    memory.set(input.key, { windowStartedAt: started, hitCount: 1 });
    return { allowed: true, remaining: input.limit - 1 };
  }
  stored.hitCount += 1;
  return {
    allowed: stored.hitCount <= input.limit,
    remaining: Math.max(0, input.limit - stored.hitCount),
  };
}

export function resetMemoryRateLimits() {
  memory.clear();
}

export async function assertRateLimit(input: RateLimitWindow) {
  const started = windowStart(input.windowSeconds);
  try {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(rateLimitBuckets)
      .where(and(eq(rateLimitBuckets.bucketKey, input.key), eq(rateLimitBuckets.windowStartedAt, started)))
      .limit(1);
    if (!existing) {
      await db.insert(rateLimitBuckets).values({
        bucketKey: input.key,
        windowStartedAt: started,
        hitCount: 1,
      });
      return;
    }
    const [updated] = await db
      .update(rateLimitBuckets)
      .set({ hitCount: sql`${rateLimitBuckets.hitCount} + 1` })
      .where(eq(rateLimitBuckets.id, existing.id))
      .returning();
    if ((updated?.hitCount ?? existing.hitCount + 1) > input.limit) {
      throw new RateLimitError();
    }
  } catch (error) {
    if (error instanceof RateLimitError) throw error;
    const result = consumeMemoryBucket(input);
    if (!result.allowed) throw new RateLimitError();
  }
}
