import { index, integer, jsonb, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { organizations, users } from "../core";
import { scoutSessions } from "../scout";

export const researchSessions = pgTable("research_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  scoutSessionId: uuid("scout_session_id").references(() => scoutSessions.id, { onDelete: "set null" }),
  query: text("query").notNull(),
  researchType: text("research_type").notNull(),
  providers: jsonb("providers").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("running"),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
  estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  webSearchCalls: integer("web_search_calls").notNull().default(0),
  tavilyRequests: integer("tavily_requests").notNull().default(0),
  failureState: text("failure_state"),
  errorDetail: text("error_detail"),
  ...timestamps(),
}, (table) => [
  index("research_sessions_organization_id_idx").on(table.organizationId),
  index("research_sessions_user_id_idx").on(table.userId),
  index("research_sessions_scout_session_id_idx").on(table.scoutSessionId),
]);

export const externalResearchResults = pgTable("external_research_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  researchSessionId: uuid("research_session_id").notNull().references(() => researchSessions.id, {
    onDelete: "restrict",
  }),
  provider: text("provider").notNull(),
  sourceType: text("source_type").notNull(),
  title: text("title").notNull(),
  snippet: text("snippet"),
  url: text("url"),
  publisher: text("publisher"),
  publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  sourceVersion: text("source_version"),
  confidence: numeric("confidence", { precision: 5, scale: 4 }),
  structuredProviderId: text("structured_provider_id"),
  humanReviewStatus: text("human_review_status").notNull().default("unreviewed"),
  proposedAction: text("proposed_action"),
  appliedToRecordType: text("applied_to_record_type"),
  appliedToRecordId: uuid("applied_to_record_id"),
  provenance: jsonb("provenance").$type<Record<string, unknown>>(),
  ...timestamps(),
}, (table) => [
  index("external_research_results_organization_id_idx").on(table.organizationId),
  index("external_research_results_session_id_idx").on(table.researchSessionId),
]);

export const researchCache = pgTable("research_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  cacheKey: text("cache_key").notNull(),
  provider: text("provider").notNull(),
  researchType: text("research_type").notNull(),
  query: text("query").notNull(),
  filters: jsonb("filters").$type<Record<string, unknown>>(),
  resultSummary: jsonb("result_summary").$type<Record<string, unknown>>().notNull(),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  ...timestamps(),
}, (table) => [
  unique("research_cache_key_uq").on(table.cacheKey),
  index("research_cache_expires_at_idx").on(table.expiresAt),
]);
