import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "./_common";
import { organizations, users } from "./core";

/**
 * A human review record for an advisory outcome pattern.
 * Accepting a row stores a note. It does not change matching, mappings, requirements, or routing.
 * The row keeps aggregates and source labels. It does not keep candidate contact details.
 */
export const outcomeLearningRecommendations = pgTable("outcome_learning_recommendations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  recommendationType: text("recommendation_type").notNull(),
  subjectKey: text("subject_key").notNull(),
  timeWindow: text("time_window").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true, mode: "date" }),
  windowEnd: timestamp("window_end", { withTimezone: true, mode: "date" }).notNull(),
  sampleCount: integer("sample_count").notNull(),
  evidenceBand: text("evidence_band").notNull(),
  observedPattern: text("observed_pattern").notNull(),
  whyItMatters: text("why_it_matters").notNull(),
  humanReviewPrompt: text("human_review_prompt").notNull(),
  sourceRecords: text("source_records").notNull(),
  sourceFilter: text("source_filter").notNull(),
  supportingSummary: text("supporting_summary").notNull(),
  reviewState: text("review_state").notNull().default("new"),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  reviewNote: text("review_note"),
  generatedAt: timestamp("generated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  ...timestamps(),
}, (table) => [
  unique("outcome_learning_recommendations_identity_uq").on(
    table.organizationId,
    table.recommendationType,
    table.subjectKey,
    table.timeWindow,
  ),
  index("outcome_learning_recommendations_organization_id_idx").on(table.organizationId),
  index("outcome_learning_recommendations_reviewed_by_user_id_idx").on(table.reviewedByUserId),
  index("outcome_learning_recommendations_org_window_state_idx").on(
    table.organizationId,
    table.timeWindow,
    table.reviewState,
  ),
  check(
    "outcome_learning_recommendations_type_chk",
    sql`${table.recommendationType} in ('REVIEW_MATCH_ASSUMPTION', 'REVIEW_MILITARY_MAPPING', 'REVIEW_JOB_REQUIREMENT', 'REVIEW_PIPELINE_STRATEGY', 'REVIEW_EMPLOYER_WORKFLOW', 'REVIEW_FOLLOW_UP_PROCESS', 'INSUFFICIENT_DATA')`,
  ),
  check(
    "outcome_learning_recommendations_window_chk",
    sql`${table.timeWindow} in ('30d', '90d', '180d', '365d', 'all')`,
  ),
  check(
    "outcome_learning_recommendations_band_chk",
    sql`${table.evidenceBand} in ('insufficient', 'early_signal', 'operational_pattern')`,
  ),
  check(
    "outcome_learning_recommendations_state_chk",
    sql`${table.reviewState} in ('new', 'reviewing', 'accepted_as_note', 'dismissed', 'needs_more_data')`,
  ),
  check("outcome_learning_recommendations_sample_chk", sql`${table.sampleCount} >= 0`),
]);
