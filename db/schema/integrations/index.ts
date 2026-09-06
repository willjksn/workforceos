import { boolean, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { createdAtOnly, timestamps } from "../_common";
import { organizations, users } from "../core";
import { companies, contacts } from "../crm";
import { enrichmentReviewStatusEnum, integrationJobStatusEnum, workspaceReferenceTypeEnum } from "../enums";

export const integrationConnections = pgTable("integration_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  provider: text("provider").notNull(),
  status: text("status").notNull().default("not_configured"),
  environment: text("environment").notNull().default("unconfigured"),
  accountLabel: text("account_label"),
  scopes: text("scopes"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true, mode: "date" }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true, mode: "date" }),
  lastHealthCheckAt: timestamp("last_health_check_at", { withTimezone: true, mode: "date" }),
  lastRequestAt: timestamp("last_request_at", { withTimezone: true, mode: "date" }),
  lastError: text("last_error"),
  retryCount: integer("retry_count").notNull().default(0),
  disabledAt: timestamp("disabled_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  unique("integration_connections_org_provider_uq").on(table.organizationId, table.provider),
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
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  unique("external_records_org_provider_entity_uq").on(
    table.organizationId,
    table.provider,
    table.entityType,
    table.entityId,
  ),
  unique("external_records_org_provider_external_uq").on(
    table.organizationId,
    table.provider,
    table.externalId,
    table.entityType,
  ),
  index("external_records_organization_id_idx").on(table.organizationId),
  index("external_records_entity_idx").on(table.entityType, table.entityId),
]);

export const integrationEvents = pgTable("integration_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  connectionId: uuid("connection_id").references(() => integrationConnections.id, { onDelete: "set null" }),
  provider: text("provider").notNull(),
  action: text("action").notNull(),
  status: text("status").notNull(),
  detail: text("detail"),
  externalEventId: text("external_event_id"),
  idempotencyKey: text("idempotency_key"),
  retryCount: integer("retry_count").notNull().default(0),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true, mode: "date" }),
  deadLetter: boolean("dead_letter").notNull().default(false),
  payload: jsonb("payload"),
  ...createdAtOnly(),
}, (table) => [
  index("integration_events_organization_id_idx").on(table.organizationId),
  index("integration_events_org_status_idx").on(table.organizationId, table.status),
  index("integration_events_connection_id_idx").on(table.connectionId),
  unique("integration_events_idempotency_uq").on(table.organizationId, table.provider, table.idempotencyKey),
]);

export const integrationWebhookReceipts = pgTable("integration_webhook_receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "restrict",
  }),
  provider: text("provider").notNull(),
  externalEventId: text("external_event_id").notNull(),
  signatureValid: boolean("signature_valid").notNull().default(false),
  status: integrationJobStatusEnum("status").notNull().default("queued"),
  processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
  lastError: text("last_error"),
  payload: jsonb("payload"),
  ...createdAtOnly(),
}, (table) => [
  unique("integration_webhook_receipts_provider_event_uq").on(table.provider, table.externalEventId),
  index("integration_webhook_receipts_organization_id_idx").on(table.organizationId),
]);

export const enrichmentReviews = pgTable("enrichment_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  provider: text("provider").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  externalId: text("external_id"),
  proposedPayload: jsonb("proposed_payload"),
  confidence: integer("confidence"),
  status: enrichmentReviewStatusEnum("status").notNull().default("pending_review"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true, mode: "date" }),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  reviewNotes: text("review_notes"),
  ...timestamps(),
}, (table) => [
  index("enrichment_reviews_organization_id_idx").on(table.organizationId),
  index("enrichment_reviews_company_id_idx").on(table.companyId),
  index("enrichment_reviews_contact_id_idx").on(table.contactId),
  index("enrichment_reviews_reviewed_by_user_id_idx").on(table.reviewedByUserId),
]);

export const workspaceEventReferences = pgTable("workspace_event_references", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  provider: text("provider").notNull(),
  referenceType: workspaceReferenceTypeEnum("reference_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  externalId: text("external_id"),
  title: text("title"),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("workspace_event_references_organization_id_idx").on(table.organizationId),
  index("workspace_event_references_entity_idx").on(table.entityType, table.entityId),
]);
