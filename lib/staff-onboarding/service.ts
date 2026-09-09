import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  staffOnboarding,
  staffOnboardingEquipment,
  staffPolicyAcknowledgements,
  users,
} from "@/db/schema";
import { listUserTrainingProgress } from "@/lib/academy/progress";
import { requiredTrainingSlugs } from "@/lib/academy/training";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { loadPrincipalByUserId } from "@/lib/rbac/authorize";
import { AuthorizationError, can, requirePermission, type Principal } from "@/lib/rbac/permissions";

import {
  DAY_1_ACADEMY_SLUGS,
  EQUIPMENT_ITEM_KEYS,
  STAFF_POLICY_KEYS,
  allDay1AcademyComplete,
  allWeek1RequiredComplete,
  assertManagerNotSelf,
  deriveStaffOnboardingCadence,
  isEquipmentItemKey,
  isStaffOnboardingCadence,
  isStaffPolicyKey,
  suggestedCadenceFromElapsed,
  week1RequiredSlugs,
  type EquipmentItemKey,
  type StaffOnboardingCadence,
  type StaffPolicyKey,
} from "./cadence";

export { assertManagerNotSelf };

function canViewStaffOnboarding(actor: Principal, targetUserId: string) {
  return actor.id === targetUserId || can(actor, "admin.users");
}

function assertCanView(actor: Principal, targetUserId: string) {
  if (!canViewStaffOnboarding(actor, targetUserId)) {
    throw new AuthorizationError("You can only view your own staff onboarding.");
  }
}

function assertCanCompleteOwnOrAdmin(actor: Principal, targetUserId: string) {
  if (actor.id === targetUserId) return;
  requirePermission(actor, "admin.users");
}

export async function ensureStaffOnboarding(input: {
  organizationId: string;
  userId: string;
}) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(staffOnboarding)
    .where(eq(staffOnboarding.userId, input.userId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(staffOnboarding)
    .values({
      organizationId: input.organizationId,
      userId: input.userId,
      cadence: "day_1",
    })
    .returning();
  if (!created) throw new Error("Unable to start staff onboarding.");

  await db.insert(staffOnboardingEquipment).values(
    EQUIPMENT_ITEM_KEYS.map((itemKey) => ({
      onboardingId: created.id,
      itemKey,
    })),
  );

  return created;
}

export async function getStaffOnboardingSnapshot(input: {
  actor: Principal;
  userId: string;
}) {
  assertCanView(input.actor, input.userId);
  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      organizationId: users.organizationId,
      fullName: users.fullName,
      email: users.email,
      organizationalTitle: users.organizationalTitle,
      status: users.status,
      managerId: users.managerId,
    })
    .from(users)
    .where(and(eq(users.id, input.userId), eq(users.organizationId, input.actor.organizationId)))
    .limit(1);
  if (!user) throw new Error("That person is not in this organization.");

  const record = await ensureStaffOnboarding({
    organizationId: user.organizationId,
    userId: user.id,
  });

  const [equipment, acknowledgements, progress, targetPrincipal, manager] = await Promise.all([
    db
      .select()
      .from(staffOnboardingEquipment)
      .where(eq(staffOnboardingEquipment.onboardingId, record.id)),
    db
      .select()
      .from(staffPolicyAcknowledgements)
      .where(eq(staffPolicyAcknowledgements.userId, user.id)),
    listUserTrainingProgress(user.id),
    loadPrincipalByUserId(user.id),
    user.managerId
      ? db
          .select({ id: users.id, fullName: users.fullName })
          .from(users)
          .where(eq(users.id, user.managerId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);

  const principalForTraining = targetPrincipal ?? input.actor;
  const completedSlugs = progress.filter((row) => row.status === "completed").map((row) => row.moduleSlug);
  const day1AcademyComplete = allDay1AcademyComplete(completedSlugs);
  const week1RequiredComplete = targetPrincipal
    ? allWeek1RequiredComplete(targetPrincipal, completedSlugs)
    : false;
  const derivedCadence = deriveStaffOnboardingCadence({
    day1AcademyComplete,
    week1RequiredComplete,
    week2ShadowComplete: Boolean(record.week2ShadowCompletedAt),
    week3SupervisedComplete: Boolean(record.week3SupervisedCompletedAt),
    week4Reviewed: Boolean(record.week4ReviewedAt),
  });
  const suggestedCadence = record.week4ReviewedAt
    ? "complete"
    : suggestedCadenceFromElapsed(record.startedAt, new Date());

  const equipmentByKey = new Map(equipment.map((row) => [row.itemKey, row]));

  return {
    user,
    manager,
    record,
    derivedCadence,
    suggestedCadence,
    day1AcademyComplete,
    week1RequiredComplete,
    requiredTraining: requiredTrainingSlugs(principalForTraining),
    week1Slugs: week1RequiredSlugs(principalForTraining),
    day1Slugs: [...DAY_1_ACADEMY_SLUGS],
    completedSlugs,
    progress,
    equipment: EQUIPMENT_ITEM_KEYS.map((key) => ({
      itemKey: key,
      completedAt: equipmentByKey.get(key)?.completedAt ?? null,
    })),
    policies: STAFF_POLICY_KEYS.map((key) => ({
      policyKey: key,
      acknowledgedAt: acknowledgements.find((row) => row.policyKey === key)?.acknowledgedAt ?? null,
    })),
    canManage: can(input.actor, "admin.users"),
    isSelf: input.actor.id === user.id,
  };
}

/**
 * Persist a policy acknowledgement. Writes `staff_policy_acknowledgements` only.
 * Does not assign roles, grant permissions, or change overrides.
 */
export async function acknowledgeStaffPolicy(input: {
  actor: Principal;
  userId: string;
  policyKey: StaffPolicyKey | string;
}) {
  assertCanCompleteOwnOrAdmin(input.actor, input.userId);
  if (input.actor.id !== input.userId) {
    requirePermission(input.actor, "admin.users");
  }
  if (!isStaffPolicyKey(input.policyKey)) {
    throw new Error("Unknown staff policy.");
  }

  const db = getDb();
  const [user] = await db
    .select({ id: users.id, organizationId: users.organizationId })
    .from(users)
    .where(and(eq(users.id, input.userId), eq(users.organizationId, input.actor.organizationId)))
    .limit(1);
  if (!user) throw new Error("That person is not in this organization.");

  const now = new Date();
  const [existing] = await db
    .select()
    .from(staffPolicyAcknowledgements)
    .where(
      and(
        eq(staffPolicyAcknowledgements.userId, user.id),
        eq(staffPolicyAcknowledgements.policyKey, input.policyKey),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [inserted] = await db
    .insert(staffPolicyAcknowledgements)
    .values({
      userId: user.id,
      policyKey: input.policyKey,
      acknowledgedAt: now,
    })
    .returning();

  await recordAuditEvent({
    organizationId: user.organizationId,
    actor: { type: "human", userId: input.actor.id },
    action: "staff_onboarding.policy_acknowledged",
    recordType: "staff_policy_acknowledgement",
    recordId: inserted?.id ?? user.id,
    after: { policyKey: input.policyKey, userId: user.id },
  });

  return inserted;
}

export async function setStaffEquipmentItem(input: {
  actor: Principal;
  userId: string;
  itemKey: EquipmentItemKey | string;
  complete: boolean;
}) {
  assertCanCompleteOwnOrAdmin(input.actor, input.userId);
  if (input.actor.id !== input.userId) {
    requirePermission(input.actor, "admin.users");
  }
  if (!isEquipmentItemKey(input.itemKey)) {
    throw new Error("Unknown equipment item.");
  }

  const snapshot = await getStaffOnboardingSnapshot({ actor: input.actor, userId: input.userId });
  const db = getDb();
  const now = new Date();
  const [existing] = await db
    .select()
    .from(staffOnboardingEquipment)
    .where(
      and(
        eq(staffOnboardingEquipment.onboardingId, snapshot.record.id),
        eq(staffOnboardingEquipment.itemKey, input.itemKey),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(staffOnboardingEquipment)
      .set({
        completedAt: input.complete ? existing.completedAt ?? now : null,
        completedByUserId: input.complete ? existing.completedByUserId ?? input.actor.id : null,
        updatedAt: now,
      })
      .where(eq(staffOnboardingEquipment.id, existing.id))
      .returning();
    return updated;
  }

  const [inserted] = await db
    .insert(staffOnboardingEquipment)
    .values({
      onboardingId: snapshot.record.id,
      itemKey: input.itemKey,
      completedAt: input.complete ? now : null,
      completedByUserId: input.complete ? input.actor.id : null,
    })
    .returning();
  return inserted;
}

export async function setStaffOnboardingMilestone(input: {
  actor: Principal;
  userId: string;
  milestone: "week2_shadow" | "week3_supervised";
  complete: boolean;
}) {
  assertCanCompleteOwnOrAdmin(input.actor, input.userId);
  if (input.actor.id !== input.userId) {
    requirePermission(input.actor, "admin.users");
  }
  const snapshot = await getStaffOnboardingSnapshot({ actor: input.actor, userId: input.userId });
  const now = new Date();
  const db = getDb();
  const [updated] = await db
    .update(staffOnboarding)
    .set({
      week2ShadowCompletedAt:
        input.milestone === "week2_shadow"
          ? input.complete
            ? snapshot.record.week2ShadowCompletedAt ?? now
            : null
          : snapshot.record.week2ShadowCompletedAt,
      week3SupervisedCompletedAt:
        input.milestone === "week3_supervised"
          ? input.complete
            ? snapshot.record.week3SupervisedCompletedAt ?? now
            : null
          : snapshot.record.week3SupervisedCompletedAt,
      updatedAt: now,
    })
    .where(eq(staffOnboarding.id, snapshot.record.id))
    .returning();
  return updated;
}

/**
 * Human Week 4 access/training review. Writes review timestamps only.
 * Does not assign roles, grant permissions, or change overrides.
 */
export async function recordStaffOnboardingWeek4Review(input: {
  actor: Principal;
  userId: string;
  notes?: string | null;
}) {
  requirePermission(input.actor, "admin.users");
  const snapshot = await getStaffOnboardingSnapshot({ actor: input.actor, userId: input.userId });
  const now = new Date();
  const db = getDb();
  const [updated] = await db
    .update(staffOnboarding)
    .set({
      cadence: "complete",
      week4ReviewedAt: snapshot.record.week4ReviewedAt ?? now,
      week4ReviewedByUserId: snapshot.record.week4ReviewedByUserId ?? input.actor.id,
      week4Notes: input.notes?.trim() || snapshot.record.week4Notes,
      updatedAt: now,
    })
    .where(eq(staffOnboarding.id, snapshot.record.id))
    .returning();

  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "human", userId: input.actor.id },
    action: "staff_onboarding.week4_review",
    recordType: "staff_onboarding",
    recordId: snapshot.record.id,
    after: { userId: input.userId, cadence: "complete" },
  });

  return updated;
}

export async function setStaffOnboardingCadence(input: {
  actor: Principal;
  userId: string;
  cadence: StaffOnboardingCadence | string;
}) {
  requirePermission(input.actor, "admin.users");
  if (!isStaffOnboardingCadence(input.cadence)) {
    throw new Error("Unknown onboarding cadence.");
  }
  if (input.cadence === "complete") {
    throw new Error("Mark Week 4 review instead of setting Complete. Review does not grant permissions.");
  }
  const snapshot = await getStaffOnboardingSnapshot({ actor: input.actor, userId: input.userId });
  if (snapshot.record.week4ReviewedAt) {
    throw new Error("Week 4 review is already recorded. Training completion still does not grant permissions.");
  }
  const db = getDb();
  const [updated] = await db
    .update(staffOnboarding)
    .set({ cadence: input.cadence, updatedAt: new Date() })
    .where(eq(staffOnboarding.id, snapshot.record.id))
    .returning();
  return updated;
}

export async function setUserManager(input: {
  actor: Principal;
  userId: string;
  managerId: string | null;
}) {
  requirePermission(input.actor, "admin.users");
  assertManagerNotSelf(input.userId, input.managerId);

  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, input.userId), eq(users.organizationId, input.actor.organizationId)))
    .limit(1);
  if (!user || user.archivedAt) {
    throw new Error("That person is not in this organization.");
  }

  if (input.managerId) {
    const [manager] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, input.managerId), eq(users.organizationId, input.actor.organizationId)))
      .limit(1);
    if (!manager || manager.archivedAt) {
      throw new Error("Choose a manager in this organization.");
    }
  }

  if ((user.managerId ?? null) === (input.managerId ?? null)) return user;

  const [updated] = await db
    .update(users)
    .set({ managerId: input.managerId, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();

  await recordAuditEvent({
    organizationId: input.actor.organizationId,
    actor: { type: "human", userId: input.actor.id },
    action: "user.manager.update",
    recordType: "user",
    recordId: user.id,
    before: { managerId: user.managerId },
    after: { managerId: input.managerId },
  });

  return updated;
}
