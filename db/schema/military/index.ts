import { relations, sql } from "drizzle-orm";
import { index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { candidates } from "../talent";
import {
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
  region: text("region"),
  country: text("country").notNull().default("US"),
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
  ...timestamps(),
}, (table) => [
  index("military_occupation_installations_occupation_id_idx").on(table.militaryOccupationId),
  index("military_occupation_installations_installation_id_idx").on(table.installationId),
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
  skillsSummary: text("skills_summary"),
  certifications: text("certifications"),
  gaps: text("gaps"),
  bridgeTraining: text("bridge_training"),
  explanation: text("explanation"),
  mappingQuality: text("mapping_quality").notNull().default("development_fixture"),
  ...timestamps(),
}, (table) => [
  index("military_civilian_mappings_military_id_idx").on(table.militaryOccupationId),
  index("military_civilian_mappings_civilian_id_idx").on(table.civilianOccupationId),
  unique("military_civilian_mappings_uq").on(table.militaryOccupationId, table.civilianOccupationId),
]);

export const militaryOccupationsRelations = relations(militaryOccupations, ({ many }) => ({
  skills: many(militaryOccupationSkills),
  installations: many(militaryOccupationInstallations),
  civilianMappings: many(militaryCivilianMappings),
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
