import { and, desc, eq, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import { inAppNotifications } from "../../db/schema";

type NotificationKind =
  | "skillbridge_window_approaching"
  | "follow_up_overdue"
  | "employer_response_overdue"
  | "resume_missing"
  | "interview_upcoming"
  | "approval_pending"
  | "conversion_decision_approaching"
  | "scout_action";

export async function createInAppNotification(input: {
  organizationId: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
  recordType?: string | null;
  recordId?: string | null;
}) {
  const db = getDb();
  const [row] = await db
    .insert(inAppNotifications)
    .values({
      organizationId: input.organizationId,
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      recordType: input.recordType ?? null,
      recordId: input.recordId ?? null,
    })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function listInAppNotifications(userId: string, organizationId: string) {
  const db = getDb();
  return db
    .select()
    .from(inAppNotifications)
    .where(
      and(
        eq(inAppNotifications.userId, userId),
        eq(inAppNotifications.organizationId, organizationId),
        isNull(inAppNotifications.archivedAt),
      ),
    )
    .orderBy(desc(inAppNotifications.createdAt));
}

export async function markNotificationRead(id: string, userId: string) {
  const db = getDb();
  await db
    .update(inAppNotifications)
    .set({ readAt: new Date(), updatedAt: new Date() })
    .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.userId, userId)));
}
