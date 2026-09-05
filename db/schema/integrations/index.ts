import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { createdAtOnly, timestamps } from "../_common";
import { organizations } from "../core";

export const integrationConnections = pgTable("integration_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  provider: text("provider").notNull(),
  status: text("status").notNull().default("not_configured"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true, mode: "date" }),
  lastError: text("last_error"),
  ...timestamps(),
}, (table) => [
  index("integration_connections_organization_id_idx").on(table.organizationId),
]);

export const externalRecords = pgTable("external_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  provider: text("provider").notNull(),
  externalId: text("external_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  payload: jsonb("payload"),
  ...timestamps(),
}, (table) => [
  index("external_records_organization_id_idx").on(table.organizationId),
  index("external_records_entity_idx").on(table.entityType, table.entityId),
]);

export const integrationEvents = pgTable("integration_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  provider: text("provider").notNull(),
  action: text("action").notNull(),
  status: text("status").notNull(),
  detail: text("detail"),
  ...createdAtOnly(),
}, (table) => [
  index("integration_events_organization_id_idx").on(table.organizationId),
]);
