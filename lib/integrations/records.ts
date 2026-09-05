import { and, eq } from "drizzle-orm";

import { getDb } from "../../db";
import { externalRecords } from "../../db/schema";

export async function upsertExternalRecord(input: {
  organizationId: string;
  provider: string;
  externalId: string;
  entityType: string;
  entityId: string;
  payload?: unknown;
}) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(externalRecords)
    .where(
      and(
        eq(externalRecords.organizationId, input.organizationId),
        eq(externalRecords.provider, input.provider),
        eq(externalRecords.entityType, input.entityType),
        eq(externalRecords.entityId, input.entityId),
      ),
    )
    .limit(1);
  if (existing) {
    const [updated] = await db
      .update(externalRecords)
      .set({
        externalId: input.externalId,
        payload: input.payload ?? existing.payload,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(externalRecords.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(externalRecords)
    .values({
      organizationId: input.organizationId,
      provider: input.provider,
      externalId: input.externalId,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload ?? null,
      lastSyncAt: new Date(),
    })
    .returning();
  return created;
}

export async function findExternalRecord(input: {
  organizationId: string;
  provider: string;
  entityType: string;
  entityId: string;
}) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(externalRecords)
    .where(
      and(
        eq(externalRecords.organizationId, input.organizationId),
        eq(externalRecords.provider, input.provider),
        eq(externalRecords.entityType, input.entityType),
        eq(externalRecords.entityId, input.entityId),
      ),
    )
    .limit(1);
  return row ?? null;
}
