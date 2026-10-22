import { relations, sql } from "drizzle-orm";
import { boolean, foreignKey, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { agents, organizations, users } from "../core";
import { files } from "../system";
import {
  candidateAvailabilityEnum,
  capabilityBasisEnum,
  clearanceLevelEnum,
  clearanceStatusEnum,
  consentStatusEnum,
  credentialStatusEnum,
  educationCompletionStatusEnum,
  mappingReviewStatusEnum,
  militaryStatusEnum,
  poolMembershipSourceEnum,
  privacyClassEnum,
  profileEvidenceSourceEnum,
  talentPoolScopeEnum,
  talentPoolTypeEnum,
} from "../enums";
import { skills } from "../workforce";

export const candidates = pgTable("candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  currentTitle: text("current_title"),
  currentCompany: text("current_company"),
  city: text("city"),
  region: text("region"),
  yearsExperience: integer("years_experience"),
  availability: candidateAvailabilityEnum("availability").notNull().default("unknown"),
  consentStatus: consentStatusEnum("consent_status").notNull().default("unknown"),
  privacyClass: privacyClassEnum("privacy_class").notNull().default("restricted_pii"),
  militaryStatus: militaryStatusEnum("military_status").notNull().default("unknown"),
  compensationExpectations: text("compensation_expectations"),
  careerInterests: text("career_interests"),
  remotePreference: text("remote_preference"),
  relocationWillingness: text("relocation_willingness"),
  source: text("source"),
  linkedinUrl: text("linkedin_url"),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  currentResumeFileId: uuid("current_resume_file_id").references(() => files.id, {
    onDelete: "set null",
  }),
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true, mode: "date" }),
  lastProfileReviewAt: timestamp("last_profile_review_at", { withTimezone: true, mode: "date" }),
  doNotContact: boolean("do_not_contact").notNull().default(false),
  privacyDeletedAt: timestamp("privacy_deleted_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("candidates_organization_id_idx").on(table.organizationId),
  index("candidates_owner_user_id_idx").on(table.ownerUserId),
  index("candidates_current_resume_file_id_idx").on(table.currentResumeFileId),
  index("candidates_org_availability_idx").on(table.organizationId, table.availability),
  index("candidates_org_military_status_idx").on(table.organizationId, table.militaryStatus),
  index("candidates_full_name_trgm_idx").using("gin", sql`${table.fullName} gin_trgm_ops`),
  index("candidates_current_title_trgm_idx").using("gin", sql`${table.currentTitle} gin_trgm_ops`),
  unique("candidates_id_organization_uq").on(table.id, table.organizationId),
]);

export const candidateExperiences = pgTable("candidate_experiences", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, {
    onDelete: "cascade",
  }),
  employer: text("employer").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  ...timestamps(),
}, (table) => [
  index("candidate_experiences_candidate_id_idx").on(table.candidateId),
]);

export const candidateSkills = pgTable("candidate_skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  candidateId: uuid("candidate_id").notNull(),
  skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "restrict" }),
  yearsExperience: integer("years_experience"),
  proficiency: text("proficiency"),
  source: text("source"),
  confidence: integer("confidence"),
  humanVerified: boolean("human_verified").notNull().default(false),
  /** Classification. Human review is mapping_review_status, not a second status. */
  capabilityBasis: capabilityBasisEnum("capability_basis").notNull().default("explicit"),
  reviewStatus: mappingReviewStatusEnum("review_status").notNull().default("pending"),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  originatingAgentId: uuid("originating_agent_id").references(() => agents.id, { onDelete: "set null" }),
  /** Short why. Supporting rows live on candidate_skill_evidence. */
  evidenceSummary: text("evidence_summary"),
  ...timestamps(),
}, (table) => [
  unique("candidate_skills_id_organization_uq").on(table.id, table.organizationId),
  foreignKey({
    columns: [table.candidateId, table.organizationId],
    foreignColumns: [candidates.id, candidates.organizationId],
    name: "candidate_skills_candidate_org_fk",
  }).onDelete("cascade"),
  index("candidate_skills_organization_id_idx").on(table.organizationId),
  index("candidate_skills_candidate_id_idx").on(table.candidateId),
  index("candidate_skills_skill_id_idx").on(table.skillId),
  index("candidate_skills_org_skill_idx").on(table.organizationId, table.skillId),
  index("candidate_skills_reviewed_by_user_id_idx").on(table.reviewedByUserId),
  index("candidate_skills_originating_agent_id_idx").on(table.originatingAgentId),
  unique("candidate_skills_candidate_skill_uq").on(table.candidateId, table.skillId),
]);

export const talentPools = pgTable("talent_pools", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  poolType: talentPoolTypeEnum("pool_type").notNull().default("static"),
  scope: talentPoolScopeEnum("scope").notNull().default("organization"),
  description: text("description"),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  lastEvaluatedAt: timestamp("last_evaluated_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("talent_pools_organization_id_idx").on(table.organizationId),
  index("talent_pools_owner_user_id_idx").on(table.ownerUserId),
  unique("talent_pools_organization_slug_uq").on(table.organizationId, table.slug),
]);

export const talentPoolRules = pgTable("talent_pool_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  talentPoolId: uuid("talent_pool_id").notNull().references(() => talentPools.id, {
    onDelete: "cascade",
  }),
  ruleType: text("rule_type").notNull(),
  ruleValue: text("rule_value").notNull(),
  ...timestamps(),
}, (table) => [
  index("talent_pool_rules_talent_pool_id_idx").on(table.talentPoolId),
]);

export const candidateTalentPools = pgTable("candidate_talent_pools", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, {
    onDelete: "cascade",
  }),
  talentPoolId: uuid("talent_pool_id").notNull().references(() => talentPools.id, {
    onDelete: "cascade",
  }),
  source: poolMembershipSourceEnum("source").notNull().default("manual"),
  matchScore: integer("match_score"),
  removedAt: timestamp("removed_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("candidate_talent_pools_candidate_id_idx").on(table.candidateId),
  index("candidate_talent_pools_talent_pool_id_idx").on(table.talentPoolId),
  unique("candidate_talent_pools_candidate_pool_uq").on(table.candidateId, table.talentPoolId),
]);

/**
 * Person-level education. Works for military and non-military candidates.
 * Not workforce `education_partners`.
 */
export const candidateEducation = pgTable("candidate_education", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  candidateId: uuid("candidate_id").notNull(),
  institution: text("institution").notNull(),
  degreeOrCredential: text("degree_or_credential").notNull(),
  fieldOfStudy: text("field_of_study"),
  completionStatus: educationCompletionStatusEnum("completion_status").notNull().default("unknown"),
  completionDate: timestamp("completion_date", { withTimezone: true, mode: "date" }),
  completionYear: integer("completion_year"),
  source: profileEvidenceSourceEnum("source").notNull().default("recruiter"),
  sourceReference: text("source_reference"),
  humanVerified: boolean("human_verified").notNull().default(false),
  confidence: integer("confidence"),
  ...timestamps(),
}, (table) => [
  unique("candidate_education_id_organization_uq").on(table.id, table.organizationId),
  foreignKey({
    columns: [table.candidateId, table.organizationId],
    foreignColumns: [candidates.id, candidates.organizationId],
    name: "candidate_education_candidate_org_fk",
  }).onDelete("cascade"),
  index("candidate_education_organization_id_idx").on(table.organizationId),
  index("candidate_education_candidate_id_idx").on(table.candidateId),
]);

/** Person-level credentials. Not a verification service and not a global skill row. */
export const candidateCredentials = pgTable("candidate_credentials", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  candidateId: uuid("candidate_id").notNull(),
  name: text("name").notNull(),
  issuer: text("issuer"),
  credentialId: text("credential_id"),
  issuedAt: timestamp("issued_at", { withTimezone: true, mode: "date" }),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
  status: credentialStatusEnum("status").notNull().default("unknown"),
  source: profileEvidenceSourceEnum("source").notNull().default("recruiter"),
  sourceReference: text("source_reference"),
  humanVerified: boolean("human_verified").notNull().default(false),
  confidence: integer("confidence"),
  ...timestamps(),
}, (table) => [
  unique("candidate_credentials_id_organization_uq").on(table.id, table.organizationId),
  foreignKey({
    columns: [table.candidateId, table.organizationId],
    foreignColumns: [candidates.id, candidates.organizationId],
    name: "candidate_credentials_candidate_org_fk",
  }).onDelete("cascade"),
  index("candidate_credentials_organization_id_idx").on(table.organizationId),
  index("candidate_credentials_candidate_id_idx").on(table.candidateId),
]);

/**
 * Current clearance for the person. One row per candidate.
 * Historical tour clearance stays on candidate_military_experiences.clearance.
 * Source and human_verified do not mean Pier 24 verified the clearance.
 */
export const candidateClearances = pgTable("candidate_clearances", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  candidateId: uuid("candidate_id").notNull(),
  clearanceLevel: clearanceLevelEnum("clearance_level").notNull().default("unknown"),
  clearanceStatus: clearanceStatusEnum("clearance_status").notNull().default("unknown"),
  lastKnownActiveDate: timestamp("last_known_active_date", { withTimezone: true, mode: "date" }),
  source: profileEvidenceSourceEnum("source").notNull().default("candidate"),
  sourceReference: text("source_reference"),
  humanVerified: boolean("human_verified").notNull().default(false),
  ...timestamps(),
}, (table) => [
  unique("candidate_clearances_candidate_id_uq").on(table.candidateId),
  unique("candidate_clearances_id_organization_uq").on(table.id, table.organizationId),
  foreignKey({
    columns: [table.candidateId, table.organizationId],
    foreignColumns: [candidates.id, candidates.organizationId],
    name: "candidate_clearances_candidate_org_fk",
  }).onDelete("cascade"),
  index("candidate_clearances_organization_id_idx").on(table.organizationId),
  index("candidate_clearances_candidate_id_idx").on(table.candidateId),
]);

export const candidatesRelations = relations(candidates, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [candidates.organizationId],
    references: [organizations.id],
  }),
  experiences: many(candidateExperiences),
  skills: many(candidateSkills),
  poolMemberships: many(candidateTalentPools),
  education: many(candidateEducation),
  credentials: many(candidateCredentials),
  clearance: one(candidateClearances, {
    fields: [candidates.id],
    references: [candidateClearances.candidateId],
  }),
}));

export const candidateExperiencesRelations = relations(candidateExperiences, ({ one }) => ({
  candidate: one(candidates, {
    fields: [candidateExperiences.candidateId],
    references: [candidates.id],
  }),
}));

export const candidateSkillsRelations = relations(candidateSkills, ({ one }) => ({
  candidate: one(candidates, {
    fields: [candidateSkills.candidateId],
    references: [candidates.id],
  }),
  skill: one(skills, {
    fields: [candidateSkills.skillId],
    references: [skills.id],
  }),
}));

export const talentPoolsRelations = relations(talentPools, ({ many }) => ({
  rules: many(talentPoolRules),
  memberships: many(candidateTalentPools),
}));

export const talentPoolRulesRelations = relations(talentPoolRules, ({ one }) => ({
  talentPool: one(talentPools, {
    fields: [talentPoolRules.talentPoolId],
    references: [talentPools.id],
  }),
}));

export const candidateEducationRelations = relations(candidateEducation, ({ one }) => ({
  candidate: one(candidates, {
    fields: [candidateEducation.candidateId],
    references: [candidates.id],
  }),
}));

export const candidateCredentialsRelations = relations(candidateCredentials, ({ one }) => ({
  candidate: one(candidates, {
    fields: [candidateCredentials.candidateId],
    references: [candidates.id],
  }),
}));

export const candidateClearancesRelations = relations(candidateClearances, ({ one }) => ({
  candidate: one(candidates, {
    fields: [candidateClearances.candidateId],
    references: [candidates.id],
  }),
}));

export const candidateTalentPoolsRelations = relations(candidateTalentPools, ({ one }) => ({
  candidate: one(candidates, {
    fields: [candidateTalentPools.candidateId],
    references: [candidates.id],
  }),
  talentPool: one(talentPools, {
    fields: [candidateTalentPools.talentPoolId],
    references: [talentPools.id],
  }),
}));
