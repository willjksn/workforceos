import { eq } from "drizzle-orm";

import { getDb } from "../../db";
import { aiCircuitBreakers } from "../../db/schema";
import { AgentError } from "./errors";

const FAILURE_THRESHOLD = 5;
const OPEN_MS = 15 * 60 * 1000;

export async function assertCircuitClosed(input: { organizationId: string; agentId: string }) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(aiCircuitBreakers)
    .where(eq(aiCircuitBreakers.agentId, input.agentId))
    .limit(1);
  if (!row) return;
  if (row.state === "open" && row.openUntil && row.openUntil > new Date()) {
    throw new AgentError("Circuit breaker is open after repeated agent failures", "circuit_open");
  }
}

export async function recordRunSuccess(input: { organizationId: string; agentId: string }) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(aiCircuitBreakers)
    .where(eq(aiCircuitBreakers.agentId, input.agentId))
    .limit(1);
  if (!existing) return;
  await db
    .update(aiCircuitBreakers)
    .set({
      state: "closed",
      consecutiveFailures: 0,
      openUntil: null,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(aiCircuitBreakers.id, existing.id));
}

export async function recordRunFailure(input: {
  organizationId: string;
  agentId: string;
  error: string;
}) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(aiCircuitBreakers)
    .where(eq(aiCircuitBreakers.agentId, input.agentId))
    .limit(1);
  const failures = (existing?.consecutiveFailures ?? 0) + 1;
  const open = failures >= FAILURE_THRESHOLD;
  const values = {
    organizationId: input.organizationId,
    agentId: input.agentId,
    state: (open ? "open" : "closed") as "open" | "closed",
    consecutiveFailures: failures,
    openUntil: open ? new Date(Date.now() + OPEN_MS) : null,
    lastError: input.error,
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(aiCircuitBreakers).set(values).where(eq(aiCircuitBreakers.id, existing.id));
  } else {
    await db.insert(aiCircuitBreakers).values(values);
  }
}
