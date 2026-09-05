import { relations, sql } from "drizzle-orm";
import { index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { organizations } from "../core";
import {
  candidateAvailabilityEnum,
  consentStatusEnum,
  poolMembershipSourceEnum,
  privacyClassEnum,
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
  currentTitle: text("current_title"),
  availability: candidateAvailabilityEnum("availability").notNull().default("unknown"),
  consentStatus: consentStatusEnum("consent_status").notNull().default("unknown"),
  privacyClass: privacyClassEnum("privacy_class").notNull().default("restricted_pii"),
  ...timestamps(),
}, (table) => [
  index("candidates_organization_id_idx").on(table.organizationId),
  index("candidates_full_name_trgm_idx").using("gin", sql`${table.fullName} gin_trgm_ops`),
  index("candidates_current_title_trgm_idx").using("gin", sql`${table.currentTitle} gin_trgm_ops`),
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
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, {
    onDelete: "cascade",
  }),
  skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "restrict" }),
  ...timestamps(),
}, (table) => [
  index("candidate_skills_candidate_id_idx").on(table.candidateId),
  index("candidate_skills_skill_id_idx").on(table.skillId),
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
  ...timestamps(),
}, (table) => [
  index("talent_pools_organization_id_idx").on(table.organizationId),
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
  ...timestamps(),
}, (table) => [
  index("candidate_talent_pools_candidate_id_idx").on(table.candidateId),
  index("candidate_talent_pools_talent_pool_id_idx").on(table.talentPoolId),
  unique("candidate_talent_pools_candidate_pool_uq").on(table.candidateId, table.talentPoolId),
]);

export const candidatesRelations = relations(candidates, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [candidates.organizationId],
    references: [organizations.id],
  }),
  experiences: many(candidateExperiences),
  skills: many(candidateSkills),
  poolMemberships: many(candidateTalentPools),
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
