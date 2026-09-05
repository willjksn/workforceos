import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAtOnly, timestamps } from "../_common";
import { agents, organizations, users } from "../core";
import {
  agentHandoffStatusEnum,
  automationRuleStatusEnum,
  circuitBreakerStateEnum,
  knowledgeRecordStatusEnum,
  knowledgeRecordTypeEnum,
  privacyClassEnum,
  promptVersionStatusEnum,
  reviewCategoryEnum,
} from "../enums";
import { approvals } from "../system";

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "restrict",
  }),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("queued"),
  taskKey: text("task_key").notNull().default("unknown"),
  workflowCode: text("workflow_code"),
  workflowVersion: text("workflow_version"),
  recordType: text("record_type"),
  recordId: uuid("record_id"),
  inputSummary: text("input_summary"),
  inputs: jsonb("inputs").$type<Record<string, unknown>>(),
  sources: jsonb("sources").$type<Array<{ type: string; id?: string; label: string }>>(),
  provider: text("provider"),
  model: text("model"),
  modelVersion: text("model_version"),
  outputSummary: text("output_summary"),
  confidence: numeric("confidence", { precision: 5, scale: 4 }),
  estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 6 }),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  humanReviewRequired: boolean("human_review_required").notNull().default(true),
  approvalState: text("approval_state").notNull().default("not_required"),
  errorDetail: text("error_detail"),
  errorCode: text("error_code"),
  retryCount: integer("retry_count").notNull().default(0),
  parentRunId: uuid("parent_run_id"),
  triggeredBy: text("triggered_by").notNull().default("manual"),
  invokedByUserId: uuid("invoked_by_user_id").references(() => users.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  ...createdAtOnly(),
}, (table) => [
  index("agent_runs_organization_id_idx").on(table.organizationId),
  index("agent_runs_agent_id_idx").on(table.agentId),
  index("agent_runs_invoked_by_user_id_idx").on(table.invokedByUserId),
  index("agent_runs_parent_run_id_idx").on(table.parentRunId),
  index("agent_runs_record_idx").on(table.recordType, table.recordId),
]);

export const agentOutputs = pgTable("agent_outputs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "restrict",
  }),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "restrict" }),
  agentRunId: uuid("agent_run_id").references(() => agentRuns.id, { onDelete: "set null" }),
  approvalId: uuid("approval_id").references(() => approvals.id, { onDelete: "set null" }),
  outputType: text("output_type").notNull(),
  reviewCategory: reviewCategoryEnum("review_category"),
  recordType: text("record_type"),
  recordId: uuid("record_id"),
  summary: text("summary").notNull(),
  payload: jsonb("payload"),
  model: text("model"),
  modelVersion: text("model_version"),
  provider: text("provider"),
  confidence: numeric("confidence", { precision: 5, scale: 4 }),
  sourceReferences: jsonb("source_references"),
  missingData: jsonb("missing_data").$type<string[]>(),
  assumptions: text("assumptions"),
  humanReviewRequired: boolean("human_review_required").notNull().default(true),
  status: text("status").notNull().default("pending_review"),
  ...createdAtOnly(),
}, (table) => [
  index("agent_outputs_organization_id_idx").on(table.organizationId),
  index("agent_outputs_agent_id_idx").on(table.agentId),
  index("agent_outputs_agent_run_id_idx").on(table.agentRunId),
  index("agent_outputs_approval_id_idx").on(table.approvalId),
  index("agent_outputs_record_idx").on(table.recordType, table.recordId),
]);

export const agentPermissions = pgTable("agent_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  permissionSlug: text("permission_slug").notNull(),
  ...createdAtOnly(),
}, (table) => [
  index("agent_permissions_agent_id_idx").on(table.agentId),
  unique("agent_permissions_agent_permission_uq").on(table.agentId, table.permissionSlug),
]);

export const promptVersions = pgTable("prompt_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "restrict" }),
  promptName: text("prompt_name").notNull(),
  version: text("version").notNull(),
  status: promptVersionStatusEnum("status").notNull().default("draft"),
  content: text("content").notNull(),
  changeReason: text("change_reason"),
  effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("prompt_versions_organization_id_idx").on(table.organizationId),
  index("prompt_versions_agent_id_idx").on(table.agentId),
  index("prompt_versions_approved_by_user_id_idx").on(table.approvedByUserId),
  unique("prompt_versions_agent_name_version_uq").on(table.agentId, table.promptName, table.version),
]);

export const aiModelConfigs = pgTable("ai_model_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  taskType: text("task_type").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  modelVersion: text("model_version"),
  temperature: numeric("temperature", { precision: 4, scale: 3 }),
  timeoutMs: integer("timeout_ms").notNull().default(30000),
  maxTokens: integer("max_tokens"),
  dailyCostLimitUsd: numeric("daily_cost_limit_usd", { precision: 12, scale: 4 }),
  monthlyCostLimitUsd: numeric("monthly_cost_limit_usd", { precision: 12, scale: 4 }),
  fallbackProvider: text("fallback_provider"),
  fallbackModel: text("fallback_model"),
  status: text("status").notNull().default("active"),
  ...timestamps(),
}, (table) => [
  index("ai_model_configs_organization_id_idx").on(table.organizationId),
  unique("ai_model_configs_org_task_uq").on(table.organizationId, table.taskType),
]);

export const knowledgeRecords = pgTable("knowledge_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  knowledgeType: knowledgeRecordTypeEnum("knowledge_type").notNull(),
  status: knowledgeRecordStatusEnum("status").notNull().default("draft"),
  version: text("version").notNull().default("1.0"),
  content: text("content").notNull(),
  source: text("source"),
  sourceUrl: text("source_url"),
  privacyClass: privacyClassEnum("privacy_class").notNull().default("internal"),
  requiredPermission: text("required_permission"),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
  changeReason: text("change_reason"),
  ...timestamps(),
}, (table) => [
  index("knowledge_records_organization_id_idx").on(table.organizationId),
  index("knowledge_records_approved_by_user_id_idx").on(table.approvedByUserId),
  unique("knowledge_records_org_slug_version_uq").on(table.organizationId, table.slug, table.version),
]);

export const automationRules = pgTable("automation_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  eventName: text("event_name").notNull(),
  agentSlug: text("agent_slug"),
  taskKey: text("task_key"),
  actionKey: text("action_key").notNull(),
  status: automationRuleStatusEnum("status").notNull().default("enabled"),
  ...timestamps(),
}, (table) => [
  index("automation_rules_organization_id_idx").on(table.organizationId),
  unique("automation_rules_org_code_uq").on(table.organizationId, table.code),
]);

export const automationRuleRuns = pgTable("automation_rule_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  ruleId: uuid("rule_id").notNull().references(() => automationRules.id, { onDelete: "restrict" }),
  eventName: text("event_name").notNull(),
  recordType: text("record_type"),
  recordId: uuid("record_id"),
  status: text("status").notNull().default("completed"),
  resultSummary: text("result_summary"),
  agentRunId: uuid("agent_run_id").references(() => agentRuns.id, { onDelete: "set null" }),
  errorDetail: text("error_detail"),
  ...createdAtOnly(),
}, (table) => [
  index("automation_rule_runs_organization_id_idx").on(table.organizationId),
  index("automation_rule_runs_rule_id_idx").on(table.ruleId),
  index("automation_rule_runs_agent_run_id_idx").on(table.agentRunId),
  index("automation_rule_runs_record_idx").on(table.recordType, table.recordId),
]);

export const agentHandoffs = pgTable("agent_handoffs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  fromAgentId: uuid("from_agent_id").notNull().references(() => agents.id, { onDelete: "restrict" }),
  toAgentId: uuid("to_agent_id").notNull().references(() => agents.id, { onDelete: "restrict" }),
  taskKey: text("task_key").notNull(),
  inputs: jsonb("inputs").$type<Record<string, unknown>>(),
  outputSummary: text("output_summary"),
  confidence: numeric("confidence", { precision: 5, scale: 4 }),
  sources: jsonb("sources"),
  fromRunId: uuid("from_run_id").references(() => agentRuns.id, { onDelete: "set null" }),
  toRunId: uuid("to_run_id").references(() => agentRuns.id, { onDelete: "set null" }),
  humanApprovalRequired: boolean("human_approval_required").notNull().default(true),
  approvalId: uuid("approval_id").references(() => approvals.id, { onDelete: "set null" }),
  status: agentHandoffStatusEnum("status").notNull().default("pending"),
  ...timestamps(),
}, (table) => [
  index("agent_handoffs_organization_id_idx").on(table.organizationId),
  index("agent_handoffs_from_agent_id_idx").on(table.fromAgentId),
  index("agent_handoffs_to_agent_id_idx").on(table.toAgentId),
  index("agent_handoffs_from_run_id_idx").on(table.fromRunId),
  index("agent_handoffs_to_run_id_idx").on(table.toRunId),
  index("agent_handoffs_approval_id_idx").on(table.approvalId),
]);

export const aiUsageEvents = pgTable("ai_usage_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
  agentRunId: uuid("agent_run_id").references(() => agentRuns.id, { onDelete: "set null" }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  taskType: text("task_type").notNull(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
  ...createdAtOnly(),
}, (table) => [
  index("ai_usage_events_organization_id_idx").on(table.organizationId),
  index("ai_usage_events_agent_id_idx").on(table.agentId),
  index("ai_usage_events_agent_run_id_idx").on(table.agentRunId),
  index("ai_usage_events_created_at_idx").on(table.createdAt),
]);

export const aiCircuitBreakers = pgTable("ai_circuit_breakers", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  state: circuitBreakerStateEnum("state").notNull().default("closed"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  openUntil: timestamp("open_until", { withTimezone: true, mode: "date" }),
  lastError: text("last_error"),
  ...timestamps(),
}, (table) => [
  index("ai_circuit_breakers_organization_id_idx").on(table.organizationId),
  unique("ai_circuit_breakers_agent_uq").on(table.agentId),
]);

export const meetingExtractions = pgTable("meeting_extractions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  meetingRecordType: text("meeting_record_type").notNull(),
  meetingRecordId: uuid("meeting_record_id").notNull(),
  agentRunId: uuid("agent_run_id").references(() => agentRuns.id, { onDelete: "set null" }),
  decisions: jsonb("decisions").$type<string[]>(),
  actionItems: jsonb("action_items").$type<string[]>(),
  commitments: jsonb("commitments").$type<string[]>(),
  dates: jsonb("dates").$type<string[]>(),
  risks: jsonb("risks").$type<string[]>(),
  opportunities: jsonb("opportunities").$type<string[]>(),
  status: text("status").notNull().default("pending_review"),
  ...timestamps(),
}, (table) => [
  index("meeting_extractions_organization_id_idx").on(table.organizationId),
  index("meeting_extractions_agent_run_id_idx").on(table.agentRunId),
  index("meeting_extractions_meeting_idx").on(table.meetingRecordType, table.meetingRecordId),
]);

export const agentRunsRelations = relations(agentRuns, ({ one, many }) => ({
  agent: one(agents, {
    fields: [agentRuns.agentId],
    references: [agents.id],
  }),
  outputs: many(agentOutputs),
}));

export const agentOutputsRelations = relations(agentOutputs, ({ one }) => ({
  agent: one(agents, {
    fields: [agentOutputs.agentId],
    references: [agents.id],
  }),
  run: one(agentRuns, {
    fields: [agentOutputs.agentRunId],
    references: [agentRuns.id],
  }),
}));
