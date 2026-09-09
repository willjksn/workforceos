import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { organizations, users } from "../core";
import { staffOnboardingCadenceEnum } from "../enums";

/**
 * PierOne staff onboarding — distinct from ATS hire `onboarding_instances`.
 * Cadence is tracked state, not a calendar. Completing training or Week 4
 * review never grants roles or permissions.
 */
export const staffOnboarding = pgTable("staff_onboarding", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cadence: staffOnboardingCadenceEnum("cadence").notNull().default("day_1"),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  week2ShadowCompletedAt: timestamp("week2_shadow_completed_at", { withTimezone: true, mode: "date" }),
  week3SupervisedCompletedAt: timestamp("week3_supervised_completed_at", { withTimezone: true, mode: "date" }),
  week4ReviewedAt: timestamp("week4_reviewed_at", { withTimezone: true, mode: "date" }),
  week4ReviewedByUserId: uuid("week4_reviewed_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  week4Notes: text("week4_notes"),
  ...timestamps(),
}, (table) => [
  index("staff_onboarding_organization_id_idx").on(table.organizationId),
  index("staff_onboarding_user_id_idx").on(table.userId),
  index("staff_onboarding_week4_reviewed_by_user_id_idx").on(table.week4ReviewedByUserId),
  unique("staff_onboarding_user_uq").on(table.userId),
]);

/** Lightweight systems checklist. Not a procurement system. */
export const staffOnboardingEquipment = pgTable("staff_onboarding_equipment", {
  id: uuid("id").defaultRandom().primaryKey(),
  onboardingId: uuid("onboarding_id").notNull().references(() => staffOnboarding.id, {
    onDelete: "cascade",
  }),
  itemKey: text("item_key").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  completedByUserId: uuid("completed_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  ...timestamps(),
}, (table) => [
  index("staff_onboarding_equipment_onboarding_id_idx").on(table.onboardingId),
  index("staff_onboarding_equipment_completed_by_user_id_idx").on(table.completedByUserId),
  unique("staff_onboarding_equipment_item_uq").on(table.onboardingId, table.itemKey),
]);

/** Timestamped policy acknowledgements. Not a legal CMS. */
export const staffPolicyAcknowledgements = pgTable("staff_policy_acknowledgements", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  policyKey: text("policy_key").notNull(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true, mode: "date" }).notNull(),
  ...timestamps(),
}, (table) => [
  index("staff_policy_acknowledgements_user_id_idx").on(table.userId),
  unique("staff_policy_acknowledgements_user_policy_uq").on(table.userId, table.policyKey),
]);

export const staffOnboardingRelations = relations(staffOnboarding, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [staffOnboarding.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [staffOnboarding.userId],
    references: [users.id],
  }),
  week4Reviewer: one(users, {
    fields: [staffOnboarding.week4ReviewedByUserId],
    references: [users.id],
    relationName: "staff_onboarding_week4_reviewer",
  }),
  equipment: many(staffOnboardingEquipment),
}));

export const staffOnboardingEquipmentRelations = relations(staffOnboardingEquipment, ({ one }) => ({
  onboarding: one(staffOnboarding, {
    fields: [staffOnboardingEquipment.onboardingId],
    references: [staffOnboarding.id],
  }),
}));

export const staffPolicyAcknowledgementsRelations = relations(staffPolicyAcknowledgements, ({ one }) => ({
  user: one(users, {
    fields: [staffPolicyAcknowledgements.userId],
    references: [users.id],
  }),
}));
