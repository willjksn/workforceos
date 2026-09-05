import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

import { createdAtOnly, timestamps } from "../_common";
import { agents, organizations, users } from "../core";
import { actorTypeEnum, approvalStatusEnum, privacyClassEnum, privacyDeletionStatusEnum } from "../enums";

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  actorType: actorTypeEnum("actor_type").notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  actorAgentId: uuid("actor_agent_id").references(() => agents.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  recordType: text("record_type").notNull(),
  recordId: uuid("record_id").notNull(),
  beforeSnapshot: jsonb("before_snapshot"),
  afterSnapshot: jsonb("after_snapshot"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  index("audit_events_organization_id_idx").on(table.organizationId),
  index("audit_events_actor_user_id_idx").on(table.actorUserId),
  index("audit_events_actor_agent_id_idx").on(table.actorAgentId),
  index("audit_events_record_idx").on(table.recordType, table.recordId),
]);

export const approvals = pgTable("approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  recordType: text("record_type").notNull(),
  recordId: uuid("record_id").notNull(),
  approvalType: text("approval_type").notNull(),
  status: approvalStatusEnum("status").notNull().default("pending"),
  requestingUserId: uuid("requesting_user_id").references(() => users.id, { onDelete: "set null" }),
  requestingAgentId: uuid("requesting_agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  assignedReviewerUserId: uuid("assigned_reviewer_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  decisionNotes: text("decision_notes"),
  decidedAt: timestamp("decided_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("approvals_organization_id_idx").on(table.organizationId),
  index("approvals_record_idx").on(table.recordType, table.recordId),
  index("approvals_requesting_user_id_idx").on(table.requestingUserId),
  index("approvals_requesting_agent_id_idx").on(table.requestingAgentId),
  index("approvals_assigned_reviewer_user_id_idx").on(table.assignedReviewerUserId),
  index("approvals_org_status_idx").on(table.organizationId, table.status),
]);

export const files = pgTable("files", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  storageProvider: text("storage_provider").notNull(),
  storageKey: text("storage_key").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  checksum: text("checksum"),
  privacyClass: privacyClassEnum("privacy_class").notNull().default("internal"),
  retentionUntil: timestamp("retention_until", { withTimezone: true, mode: "date" }),
  uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps(),
}, (table) => [
  index("files_organization_id_idx").on(table.organizationId),
  index("files_uploaded_by_user_id_idx").on(table.uploadedByUserId),
  unique("files_organization_storage_key_uq").on(table.organizationId, table.storageKey),
]);

export const privacyDeletionRequests = pgTable("privacy_deletion_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  candidateId: uuid("candidate_id").notNull(),
  requestedByUserId: uuid("requested_by_user_id").references(() => users.id, { onDelete: "set null" }),
  status: privacyDeletionStatusEnum("status").notNull().default("requested"),
  reason: text("reason").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("privacy_deletion_requests_organization_id_idx").on(table.organizationId),
  index("privacy_deletion_requests_candidate_id_idx").on(table.candidateId),
  index("privacy_deletion_requests_requested_by_user_id_idx").on(table.requestedByUserId),
]);

export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  id: uuid("id").defaultRandom().primaryKey(),
  bucketKey: text("bucket_key").notNull(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true, mode: "date" }).notNull(),
  hitCount: integer("hit_count").notNull().default(0),
  ...createdAtOnly(),
}, (table) => [
  unique("rate_limit_buckets_key_window_uq").on(table.bucketKey, table.windowStartedAt),
  index("rate_limit_buckets_bucket_key_idx").on(table.bucketKey),
]);

export const requirements = pgTable("requirements", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  module: text("module").notNull(),
  priority: text("priority").notNull(),
  status: text("status").notNull(),
  version: text("version").notNull(),
  dependencies: text("dependencies"),
  acceptanceCriteria: text("acceptance_criteria").notNull(),
  ...timestamps(),
}, (table) => [
  unique("requirements_code_uq").on(table.code),
]);

export const decisionLog = pgTable("decision_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("decision_code").notNull(),
  title: text("title").notNull(),
  decision: text("decision").notNull(),
  reason: text("reason").notNull(),
  owner: text("owner").notNull(),
  status: text("status").notNull(),
  decidedOn: timestamp("date", { withTimezone: true, mode: "date" }).notNull(),
  affectedModules: text("affected_modules").notNull(),
  reconsiderationCondition: text("reconsideration_condition"),
  ...timestamps(),
}, (table) => [
  unique("decision_log_code_uq").on(table.code),
]);

export const TEMPORARY_EMBEDDING_DIMENSIONS = 1536;

export const semanticDocuments = pgTable("semantic_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  documentType: text("document_type").notNull(),
  content: text("content").notNull(),
  contentHash: text("content_hash").notNull(),
  // Temporary development dimension. Review before production (DEC-SEM-001).
  embedding: vector("embedding", { dimensions: TEMPORARY_EMBEDDING_DIMENSIONS }),
  embeddingModel: text("embedding_model"),
  embeddingVersion: text("embedding_version"),
  embeddingDimensions: integer("embedding_dimensions"),
  privacyClass: privacyClassEnum("privacy_class").notNull().default("internal"),
  requiredPermission: text("required_permission"),
  ...createdAtOnly(),
}, (table) => [
  index("semantic_documents_organization_id_idx").on(table.organizationId),
  index("semantic_documents_entity_idx").on(table.entityType, table.entityId),
]);

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditEvents.organizationId],
    references: [organizations.id],
  }),
}));

export const approvalsRelations = relations(approvals, ({ one }) => ({
  organization: one(organizations, {
    fields: [approvals.organizationId],
    references: [organizations.id],
  }),
  assignedReviewer: one(users, {
    fields: [approvals.assignedReviewerUserId],
    references: [users.id],
  }),
}));
