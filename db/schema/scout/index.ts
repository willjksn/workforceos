import { relations } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { organizations, users } from "../core";
import {
  scoutActionStatusEnum,
  scoutCommandFamilyEnum,
  scoutMessageRoleEnum,
} from "../enums";

export const scoutSessions = pgTable("scout_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title"),
  pagePathname: text("page_pathname"),
  pageModule: text("page_module"),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  ...timestamps(),
}, (table) => [
  index("scout_sessions_organization_id_idx").on(table.organizationId),
  index("scout_sessions_user_id_idx").on(table.userId),
  index("scout_sessions_entity_idx").on(table.entityType, table.entityId),
]);

export const scoutMessages = pgTable("scout_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => scoutSessions.id, {
    onDelete: "cascade",
  }),
  role: scoutMessageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  commandFamily: scoutCommandFamilyEnum("command_family"),
  payload: jsonb("payload"),
  ...timestamps(),
}, (table) => [
  index("scout_messages_session_id_idx").on(table.sessionId),
]);

export const scoutActions = pgTable("scout_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  sessionId: uuid("session_id").references(() => scoutSessions.id, { onDelete: "set null" }),
  messageId: uuid("message_id").references(() => scoutMessages.id, { onDelete: "set null" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  commandFamily: scoutCommandFamilyEnum("command_family").notNull(),
  actionKey: text("action_key").notNull(),
  status: scoutActionStatusEnum("status").notNull().default("proposed"),
  confirmationRequired: text("confirmation_required").notNull().default("true"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "date" }),
  executedAt: timestamp("executed_at", { withTimezone: true, mode: "date" }),
  targetRecordType: text("target_record_type"),
  targetRecordId: uuid("target_record_id"),
  inputDto: jsonb("input_dto"),
  result: jsonb("result"),
  errorText: text("error_text"),
  ...timestamps(),
}, (table) => [
  index("scout_actions_organization_id_idx").on(table.organizationId),
  index("scout_actions_session_id_idx").on(table.sessionId),
  index("scout_actions_message_id_idx").on(table.messageId),
  index("scout_actions_user_id_idx").on(table.userId),
  index("scout_actions_target_idx").on(table.targetRecordType, table.targetRecordId),
]);

export const scoutSessionsRelations = relations(scoutSessions, ({ many }) => ({
  messages: many(scoutMessages),
  actions: many(scoutActions),
}));

export const scoutMessagesRelations = relations(scoutMessages, ({ one }) => ({
  session: one(scoutSessions, {
    fields: [scoutMessages.sessionId],
    references: [scoutSessions.id],
  }),
}));

export const scoutActionsRelations = relations(scoutActions, ({ one }) => ({
  session: one(scoutSessions, {
    fields: [scoutActions.sessionId],
    references: [scoutSessions.id],
  }),
  message: one(scoutMessages, {
    fields: [scoutActions.messageId],
    references: [scoutMessages.id],
  }),
}));
