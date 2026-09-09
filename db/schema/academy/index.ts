import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { users } from "../core";

/**
 * Lightweight Academy completion — not an LMS.
 * Required vs Not Required is computed from effective permissions in code.
 * Completion never grants permissions.
 */
export const userTrainingProgress = pgTable("user_training_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  moduleSlug: text("module_slug").notNull(),
  status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("user_training_progress_user_id_idx").on(table.userId),
  unique("user_training_progress_user_module_uq").on(table.userId, table.moduleSlug),
]);

export const userTrainingProgressRelations = relations(userTrainingProgress, ({ one }) => ({
  user: one(users, {
    fields: [userTrainingProgress.userId],
    references: [users.id],
  }),
}));
