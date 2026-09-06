import { and, eq, inArray, or, count } from "drizzle-orm";

import { getDb } from "../../db";
import { integrationConnections, integrationEvents } from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";

export async function logIntegrationEvent(input: {
  organizationId: string;
  provider: string;
  action: string;
  status: string;
  detail?: string | null;
  connectionId?: string | null;
  externalEventId?: string | null;
  idempotencyKey?: string | null;
  retryCount?: number;
  deadLetter?: boolean;
  payload?: unknown;
}) {
  const db = getDb();
  const [event] = await db
    .insert(integrationEvents)
    .values({
      organizationId: input.organizationId,
      provider: input.provider,
      action: input.action,
      status: input.status,
      detail: input.detail ?? null,
      connectionId: input.connectionId ?? null,
      externalEventId: input.externalEventId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      retryCount: input.retryCount ?? 0,
      deadLetter: input.deadLetter ?? false,
      payload: input.payload ?? null,
    })
    .returning();
  return event;
}

export async function markConnection(input: {
  organizationId: string;
  provider: string;
  status: string;
  environment?: string;
  accountLabel?: string | null;
  lastError?: string | null;
  success?: boolean;
}) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, input.organizationId),
        eq(integrationConnections.provider, input.provider),
      ),
    )
    .limit(1);
  const now = new Date();
  if (existing) {
    const [updated] = await db
      .update(integrationConnections)
      .set({
        status: input.status,
        environment: input.environment ?? existing.environment,
        accountLabel: input.accountLabel ?? existing.accountLabel,
        lastError: input.lastError ?? null,
        lastSyncAt: now,
        lastHealthCheckAt: now,
        lastSuccessAt: input.success ? now : existing.lastSuccessAt,
        retryCount: input.success ? 0 : existing.retryCount + 1,
        updatedAt: now,
      })
      .where(eq(integrationConnections.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(integrationConnections)
    .values({
      organizationId: input.organizationId,
      provider: input.provider,
      status: input.status,
      environment: input.environment ?? "unconfigured",
      accountLabel: input.accountLabel ?? null,
      lastError: input.lastError ?? null,
      lastSyncAt: now,
      lastHealthCheckAt: now,
      lastSuccessAt: input.success ? now : null,
    })
    .returning();
  return created;
}

export async function retryFailedEvent(input: {
  organizationId: string;
  eventId: string;
  actorUserId: string;
}) {
  const db = getDb();
  const [event] = await db.select().from(integrationEvents).where(eq(integrationEvents.id, input.eventId)).limit(1);
  if (!event || event.organizationId !== input.organizationId) {
    throw new Error("Integration event not found");
  }
  const retryCount = event.retryCount + 1;
  const deadLetter = retryCount >= 5;
  const [updated] = await db
    .update(integrationEvents)
    .set({
      retryCount,
      deadLetter,
      status: deadLetter ? "dead_letter" : "queued",
      nextRetryAt: deadLetter ? null : new Date(),
      detail: deadLetter ? `${event.detail ?? "Failed"}; moved to dead letter after ${retryCount} retries` : "Manual retry queued",
    })
    .where(eq(integrationEvents.id, event.id))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: deadLetter ? "integration.dead_letter" : "integration.retry",
    recordType: "integration_event",
    recordId: event.id,
    before: event,
    after: updated,
  });
  return updated;
}

export async function listFailedIntegrationEvents(organizationId: string) {
  const db = getDb();
  return db
    .select()
    .from(integrationEvents)
    .where(
      and(
        eq(integrationEvents.organizationId, organizationId),
        or(eq(integrationEvents.deadLetter, true), inArray(integrationEvents.status, ["failed", "error"])),
      ),
    )
    .limit(50);
}

export async function countFailedIntegrationEvents(organizationId: string) {
  const db = getDb();
  const [row] = await db
    .select({ value: count() })
    .from(integrationEvents)
    .where(
      and(
        eq(integrationEvents.organizationId, organizationId),
        or(eq(integrationEvents.deadLetter, true), inArray(integrationEvents.status, ["failed", "error"])),
      ),
    );
  return Number(row?.value ?? 0);
}
