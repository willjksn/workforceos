import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { userTrainingProgress } from "@/db/schema";
import { isTrainingModuleSlug } from "./training";
import { isTrainingProgressStatus, type TrainingProgressStatus } from "./types";

export type PersistedTrainingRow = {
  moduleSlug: string;
  status: TrainingProgressStatus;
  startedAt: Date | null;
  completedAt: Date | null;
};

export async function listUserTrainingProgress(userId: string): Promise<PersistedTrainingRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      moduleSlug: userTrainingProgress.moduleSlug,
      status: userTrainingProgress.status,
      startedAt: userTrainingProgress.startedAt,
      completedAt: userTrainingProgress.completedAt,
    })
    .from(userTrainingProgress)
    .where(eq(userTrainingProgress.userId, userId));

  return rows.flatMap((row) => {
    if (!isTrainingProgressStatus(row.status) || !isTrainingModuleSlug(row.moduleSlug)) return [];
    return [{ moduleSlug: row.moduleSlug, status: row.status, startedAt: row.startedAt, completedAt: row.completedAt }];
  });
}

export async function listTrainingProgressByUserIds(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, PersistedTrainingRow[]>();
  const db = getDb();
  const rows = await db
    .select({
      userId: userTrainingProgress.userId,
      moduleSlug: userTrainingProgress.moduleSlug,
      status: userTrainingProgress.status,
      startedAt: userTrainingProgress.startedAt,
      completedAt: userTrainingProgress.completedAt,
    })
    .from(userTrainingProgress)
    .where(inArray(userTrainingProgress.userId, userIds));

  const byUser = new Map<string, PersistedTrainingRow[]>();
  for (const row of rows) {
    if (!isTrainingProgressStatus(row.status) || !isTrainingModuleSlug(row.moduleSlug)) continue;
    const list = byUser.get(row.userId) ?? [];
    list.push({
      moduleSlug: row.moduleSlug,
      status: row.status,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
    });
    byUser.set(row.userId, list);
  }
  return byUser;
}

export function progressBySlug(rows: PersistedTrainingRow[]) {
  return new Map(rows.map((row) => [row.moduleSlug, row]));
}

/**
 * Persist start or completion. This writes `user_training_progress` only.
 * It does not assign roles, grant permissions, or change overrides.
 */
export async function upsertTrainingProgress(input: {
  userId: string;
  moduleSlug: string;
  status: TrainingProgressStatus;
}) {
  if (!isTrainingModuleSlug(input.moduleSlug)) {
    throw new Error("Unknown training module.");
  }
  const db = getDb();
  const now = new Date();
  const [existing] = await db
    .select()
    .from(userTrainingProgress)
    .where(
      and(eq(userTrainingProgress.userId, input.userId), eq(userTrainingProgress.moduleSlug, input.moduleSlug)),
    )
    .limit(1);

  if (existing?.status === "completed" && input.status !== "completed") {
    return existing;
  }

  if (existing) {
    const [updated] = await db
      .update(userTrainingProgress)
      .set({
        status: input.status,
        startedAt: existing.startedAt ?? now,
        completedAt: input.status === "completed" ? now : existing.completedAt,
        updatedAt: now,
      })
      .where(eq(userTrainingProgress.id, existing.id))
      .returning();
    return updated;
  }

  const [inserted] = await db
    .insert(userTrainingProgress)
    .values({
      userId: input.userId,
      moduleSlug: input.moduleSlug,
      status: input.status,
      startedAt: now,
      completedAt: input.status === "completed" ? now : null,
    })
    .returning();
  return inserted;
}
