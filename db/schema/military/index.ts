import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { agents, users } from "../core";
import { candidates } from "../talent";
import {
  mappingOriginEnum,
  mappingReviewStatusEnum,
  militaryBranchEnum,
  militaryClassificationTypeEnum,
  militaryPresenceLevelEnum,
} from "../enums";
import { civilianOccupations, skills } from "../workforce";

export const militaryOccupations = pgTable("military_occupations", {
  id: uuid("id").defaultRandom().primaryKey(),
  branch: militaryBranchEnum("branch").notNull(),
  classificationType: militaryClassificationTypeEnum("classification_type").notNull(),
  code: text("code").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  careerField: text("career_field"),
  rankApplicability: text("rank_applicability"),
  source: text("source"),
  sourceUrl: text("source_url"),
  sourceVersion: text("source_version"),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true, mode: "date" }),
  mappingQuality: text("mapping_quality").notNull().default("development_fixture"),
  ...timestamps(),
}, (table) => [
  unique("military_occupations_branch_code_uq").on(table.branch, table.code),
  index("military_occupations_title_trgm_idx").using("gin", sql`${table.title} gin_trgm_ops`),
  index("military_occupations_code_trgm_idx").using("gin", sql`${table.code} gin_trgm_ops`),
]);

export const candidateMilitaryExperiences = pgTable("candidate_military_experiences", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, {
    onDelete: "cascade",
  }),
  militaryOccupationId: uuid("military_occupation_id")
    .notNull()
    .references(() => militaryOccupations.id, { onDelete: "restrict" }),
  rank: text("rank"),
  payGrade: text("pay_grade"),
  yearsService: integer("years_service"),
  yearsInOccupation: integer("years_in_occupation"),
  leadershipLevel: text("leadership_level"),
  dutyStations: text("duty_stations"),
  platforms: text("platforms"),
  training: text("training"),
  certifications: text("certifications"),
  clearance: text("clearance"),
  transitionDate: timestamp("transition_date", { withTimezone: true, mode: "date" }),
  notes: text("notes"),
  ...timestamps(),
}, (table) => [
  index("candidate_military_experiences_candidate_id_idx").on(table.candidateId),
  index("candidate_military_experiences_occupation_id_idx").on(table.militaryOccupationId),
]);

export const militaryOccupationSkills = pgTable("military_occupation_skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  militaryOccupationId: uuid("military_occupation_id")
    .notNull()
    .references(() => militaryOccupations.id, { onDelete: "cascade" }),
  skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "restrict" }),
  ...timestamps(),
}, (table) => [
  index("military_occupation_skills_occupation_id_idx").on(table.militaryOccupationId),
  index("military_occupation_skills_skill_id_idx").on(table.skillId),
  unique("military_occupation_skills_uq").on(table.militaryOccupationId, table.skillId),
]);

export const militaryInstallations = pgTable("military_installations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  branch: militaryBranchEnum("branch"),
  city: text("city"),
  region: text("region"),
  country: text("country").notNull().default("US"),
  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }),
  coordinateSource: text("coordinate_source"),
  transitionRelevance: text("transition_relevance"),
  skillbridgeRelevance: text("skillbridge_relevance"),
  recruitingPriority: text("recruiting_priority"),
  source: text("source"),
  ...timestamps(),
});

export const militaryOccupationInstallations = pgTable("military_occupation_installations", {
  id: uuid("id").defaultRandom().primaryKey(),
  militaryOccupationId: uuid("military_occupation_id")
    .notNull()
    .references(() => militaryOccupations.id, { onDelete: "cascade" }),
  installationId: uuid("installation_id")
    .notNull()
    .references(() => militaryInstallations.id, { onDelete: "cascade" }),
  presenceLevel: militaryPresenceLevelEnum("presence_level").notNull().default("unknown"),
  confidence: integer("confidence"),
  whyPresent: text("why_present"),
  transitionOpportunity: text("transition_opportunity"),
  skillbridgeOpportunity: text("skillbridge_opportunity"),
  recruitingPriority: text("recruiting_priority"),
  source: text("source"),
  sourceVersion: text("source_version"),
  reviewStatus: mappingReviewStatusEnum("review_status").notNull().default("approved"),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  origin: mappingOriginEnum("origin").notNull().default("reference_data"),
  originatingAgentId: uuid("originating_agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  ...timestamps(),
}, (table) => [
  index("military_occupation_installations_occupation_id_idx").on(table.militaryOccupationId),
  index("military_occupation_installations_installation_id_idx").on(table.installationId),
  index("military_occupation_installations_reviewed_by_user_id_idx").on(table.reviewedByUserId),
  index("military_occupation_installations_originating_agent_id_idx").on(table.originatingAgentId),
  unique("military_occupation_installations_uq").on(
    table.militaryOccupationId,
    table.installationId,
  ),
]);

export const militaryCivilianMappings = pgTable("military_civilian_mappings", {
  id: uuid("id").defaultRandom().primaryKey(),
  militaryOccupationId: uuid("military_occupation_id")
    .notNull()
    .references(() => militaryOccupations.id, { onDelete: "cascade" }),
  civilianOccupationId: uuid("civilian_occupation_id")
    .notNull()
    .references(() => civilianOccupations.id, { onDelete: "restrict" }),
  compatibilityScore: integer("compatibility_score"),
  skillsSummary: text("skills_summary"),
  certifications: text("certifications"),
  gaps: text("gaps"),
  bridgeTraining: text("bridge_training"),
  explanation: text("explanation"),
  mappingQuality: text("mapping_quality").notNull().default("development_fixture"),
  source: text("source"),
  sourceUrl: text("source_url"),
  sourceVersion: text("source_version"),
  aiModel: text("ai_model"),
  modelVersion: text("model_version"),
  confidence: integer("confidence"),
  reviewStatus: mappingReviewStatusEnum("review_status").notNull().default("approved"),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true, mode: "date" }),
  origin: mappingOriginEnum("origin").notNull().default("reference_data"),
  originatingAgentId: uuid("originating_agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  ...timestamps(),
}, (table) => [
  index("military_civilian_mappings_military_id_idx").on(table.militaryOccupationId),
  index("military_civilian_mappings_civilian_id_idx").on(table.civilianOccupationId),
  index("military_civilian_mappings_reviewed_by_user_id_idx").on(table.reviewedByUserId),
  index("military_civilian_mappings_originating_agent_id_idx").on(table.originatingAgentId),
  unique("military_civilian_mappings_uq").on(table.militaryOccupationId, table.civilianOccupationId),
]);

export const bridgeTrainingRecommendations = pgTable("bridge_training_recommendations", {
  id: uuid("id").defaultRandom().primaryKey(),
  militaryOccupationId: uuid("military_occupation_id")
    .notNull()
    .references(() => militaryOccupations.id, { onDelete: "cascade" }),
  civilianOccupationId: uuid("civilian_occupation_id").references(() => civilianOccupations.id, {
    onDelete: "set null",
  }),
  mappingId: uuid("mapping_id").references(() => militaryCivilianMappings.id, {
    onDelete: "set null",
  }),
  transferableSkills: text("transferable_skills"),
  missingSkills: text("missing_skills"),
  recommendedCredential: text("recommended_credential"),
  trainingProgram: text("training_program"),
  priority: text("priority").notNull().default("normal"),
  expectedBridgePurpose: text("expected_bridge_purpose"),
  source: text("source"),
  sourceVersion: text("source_version"),
  reviewStatus: mappingReviewStatusEnum("review_status").notNull().default("pending"),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  origin: mappingOriginEnum("origin").notNull().default("reference_data"),
  originatingAgentId: uuid("originating_agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  ...timestamps(),
}, (table) => [
  index("bridge_training_recommendations_occupation_id_idx").on(table.militaryOccupationId),
  index("bridge_training_recommendations_civilian_id_idx").on(table.civilianOccupationId),
  index("bridge_training_recommendations_mapping_id_idx").on(table.mappingId),
  index("bridge_training_recommendations_reviewed_by_user_id_idx").on(table.reviewedByUserId),
  index("bridge_training_recommendations_originating_agent_id_idx").on(table.originatingAgentId),
]);

export const candidateMilitaryTranslations = pgTable("candidate_military_translations", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, {
    onDelete: "cascade",
  }),
  militaryOccupationId: uuid("military_occupation_id").references(() => militaryOccupations.id, {
    onDelete: "set null",
  }),
  civilianOccupationId: uuid("civilian_occupation_id").references(() => civilianOccupations.id, {
    onDelete: "set null",
  }),
  hiringManagerSummary: text("hiring_manager_summary"),
  civilianExperienceSummary: text("civilian_experience_summary"),
  overallAlignment: text("overall_alignment"),
  explanation: text("explanation"),
  source: text("source"),
  aiModel: text("ai_model"),
  modelVersion: text("model_version"),
  confidence: integer("confidence"),
  reviewStatus: mappingReviewStatusEnum("review_status").notNull().default("pending"),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  origin: mappingOriginEnum("origin").notNull().default("system"),
  originatingAgentId: uuid("originating_agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  ...timestamps(),
}, (table) => [
  index("candidate_military_translations_candidate_id_idx").on(table.candidateId),
  index("candidate_military_translations_occupation_id_idx").on(table.militaryOccupationId),
  index("candidate_military_translations_civilian_id_idx").on(table.civilianOccupationId),
  index("candidate_military_translations_reviewed_by_user_id_idx").on(table.reviewedByUserId),
]);

export const occupationDataImports = pgTable("occupation_data_imports", {
  id: uuid("id").defaultRandom().primaryKey(),
  source: text("source").notNull(),
  sourceVersion: text("source_version"),
  summary: text("summary"),
  recordsUpserted: integer("records_upserted").notNull().default(0),
  recordsSkipped: integer("records_skipped").notNull().default(0),
  importedByUserId: uuid("imported_by_user_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps(),
}, (table) => [
  index("occupation_data_imports_imported_by_user_id_idx").on(table.importedByUserId),
]);

export const militaryOccupationsRelations = relations(militaryOccupations, ({ many }) => ({
  skills: many(militaryOccupationSkills),
  installations: many(militaryOccupationInstallations),
  civilianMappings: many(militaryCivilianMappings),
  bridgeTraining: many(bridgeTrainingRecommendations),
}));

export const militaryOccupationSkillsRelations = relations(militaryOccupationSkills, ({ one }) => ({
  occupation: one(militaryOccupations, {
    fields: [militaryOccupationSkills.militaryOccupationId],
    references: [militaryOccupations.id],
  }),
  skill: one(skills, {
    fields: [militaryOccupationSkills.skillId],
    references: [skills.id],
  }),
}));

export const militaryInstallationsRelations = relations(militaryInstallations, ({ many }) => ({
  occupations: many(militaryOccupationInstallations),
}));

export const militaryOccupationInstallationsRelations = relations(
  militaryOccupationInstallations,
  ({ one }) => ({
    occupation: one(militaryOccupations, {
      fields: [militaryOccupationInstallations.militaryOccupationId],
      references: [militaryOccupations.id],
    }),
    installation: one(militaryInstallations, {
      fields: [militaryOccupationInstallations.installationId],
      references: [militaryInstallations.id],
    }),
  }),
);

export const militaryCivilianMappingsRelations = relations(militaryCivilianMappings, ({ one }) => ({
  militaryOccupation: one(militaryOccupations, {
    fields: [militaryCivilianMappings.militaryOccupationId],
    references: [militaryOccupations.id],
  }),
  civilianOccupation: one(civilianOccupations, {
    fields: [militaryCivilianMappings.civilianOccupationId],
    references: [civilianOccupations.id],
  }),
}));

export const bridgeTrainingRecommendationsRelations = relations(
  bridgeTrainingRecommendations,
  ({ one }) => ({
    militaryOccupation: one(militaryOccupations, {
      fields: [bridgeTrainingRecommendations.militaryOccupationId],
      references: [militaryOccupations.id],
    }),
    civilianOccupation: one(civilianOccupations, {
      fields: [bridgeTrainingRecommendations.civilianOccupationId],
      references: [civilianOccupations.id],
    }),
  }),
);
