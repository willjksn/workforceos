import { relations, sql } from "drizzle-orm";
import { index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { skillFamilyEnum } from "../enums";

/** Lightweight grouping for skills. Not a second skill taxonomy. */
export const competencyClusters = pgTable("competency_clusters", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  ...timestamps(),
}, (table) => [
  unique("competency_clusters_slug_uq").on(table.slug),
]);

/**
 * Employer-neutral job-family vocabulary for translation.
 * workforce_roles.job_family, skillbridge_target_roles.job_family, and
 * job_requisitions.job_family stay free text. jobs has no job_family column.
 */
export const jobFamilies = pgTable("job_families", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  ...timestamps(),
}, (table) => [
  unique("job_families_slug_uq").on(table.slug),
]);

export const skills = pgTable("skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  /** Category. skill_family remains the category; there is no second category column. */
  skillFamily: skillFamilyEnum("skill_family").notNull().default("technical"),
  competencyClusterId: uuid("competency_cluster_id").references(() => competencyClusters.id, {
    onDelete: "set null",
  }),
  /** Generic provenance. O*NET fields stay on onet_source / onet_version. */
  source: text("source"),
  sourceVersion: text("source_version"),
  onetSource: text("onet_source"),
  onetVersion: text("onet_version"),
  ...timestamps(),
}, (table) => [
  unique("skills_slug_uq").on(table.slug),
  index("skills_competency_cluster_id_idx").on(table.competencyClusterId),
]);

export const skillAliases = pgTable("skill_aliases", {
  id: uuid("id").defaultRandom().primaryKey(),
  skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
  alias: text("alias").notNull(),
  ...timestamps(),
}, (table) => [
  index("skill_aliases_skill_id_idx").on(table.skillId),
  unique("skill_aliases_skill_alias_uq").on(table.skillId, table.alias),
]);

export const civilianOccupations = pgTable("civilian_occupations", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  code: text("code"),
  description: text("description"),
  onetCode: text("onet_code"),
  onetSource: text("onet_source"),
  onetVersion: text("onet_version"),
  ...timestamps(),
}, (table) => [
  unique("civilian_occupations_code_uq").on(table.code),
  index("civilian_occupations_title_trgm_idx").using("gin", sql`${table.title} gin_trgm_ops`),
  index("civilian_occupations_code_trgm_idx").using("gin", sql`${table.code} gin_trgm_ops`),
]);

export const occupationAlternateTitles = pgTable("occupation_alternate_titles", {
  id: uuid("id").defaultRandom().primaryKey(),
  occupationId: uuid("occupation_id")
    .notNull()
    .references(() => civilianOccupations.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  onetSource: text("onet_source"),
  onetVersion: text("onet_version"),
  ...timestamps(),
}, (table) => [
  index("occupation_alternate_titles_occupation_id_idx").on(table.occupationId),
  unique("occupation_alternate_titles_uq").on(table.occupationId, table.title),
]);

export const civilianOccupationJobFamilies = pgTable("civilian_occupation_job_families", {
  id: uuid("id").defaultRandom().primaryKey(),
  occupationId: uuid("occupation_id")
    .notNull()
    .references(() => civilianOccupations.id, { onDelete: "cascade" }),
  jobFamilyId: uuid("job_family_id").notNull().references(() => jobFamilies.id, { onDelete: "restrict" }),
  ...timestamps(),
}, (table) => [
  index("civilian_occupation_job_families_occupation_id_idx").on(table.occupationId),
  index("civilian_occupation_job_families_job_family_id_idx").on(table.jobFamilyId),
  unique("civilian_occupation_job_families_uq").on(table.occupationId, table.jobFamilyId),
]);

export const occupationSkills = pgTable("occupation_skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  occupationId: uuid("occupation_id")
    .notNull()
    .references(() => civilianOccupations.id, { onDelete: "cascade" }),
  skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
  ...timestamps(),
}, (table) => [
  index("occupation_skills_occupation_id_idx").on(table.occupationId),
  index("occupation_skills_skill_id_idx").on(table.skillId),
  unique("occupation_skills_occupation_skill_uq").on(table.occupationId, table.skillId),
]);

export const skillsRelations = relations(skills, ({ one, many }) => ({
  competencyCluster: one(competencyClusters, {
    fields: [skills.competencyClusterId],
    references: [competencyClusters.id],
  }),
  aliases: many(skillAliases),
  occupationSkills: many(occupationSkills),
}));

export const competencyClustersRelations = relations(competencyClusters, ({ many }) => ({
  skills: many(skills),
}));

export const jobFamiliesRelations = relations(jobFamilies, ({ many }) => ({
  occupations: many(civilianOccupationJobFamilies),
}));

export const skillAliasesRelations = relations(skillAliases, ({ one }) => ({
  skill: one(skills, {
    fields: [skillAliases.skillId],
    references: [skills.id],
  }),
}));

export const civilianOccupationsRelations = relations(civilianOccupations, ({ many }) => ({
  occupationSkills: many(occupationSkills),
  alternateTitles: many(occupationAlternateTitles),
  jobFamilies: many(civilianOccupationJobFamilies),
}));

export const civilianOccupationJobFamiliesRelations = relations(
  civilianOccupationJobFamilies,
  ({ one }) => ({
    occupation: one(civilianOccupations, {
      fields: [civilianOccupationJobFamilies.occupationId],
      references: [civilianOccupations.id],
    }),
    jobFamily: one(jobFamilies, {
      fields: [civilianOccupationJobFamilies.jobFamilyId],
      references: [jobFamilies.id],
    }),
  }),
);

export const occupationAlternateTitlesRelations = relations(occupationAlternateTitles, ({ one }) => ({
  occupation: one(civilianOccupations, {
    fields: [occupationAlternateTitles.occupationId],
    references: [civilianOccupations.id],
  }),
}));

export const occupationSkillsRelations = relations(occupationSkills, ({ one }) => ({
  occupation: one(civilianOccupations, {
    fields: [occupationSkills.occupationId],
    references: [civilianOccupations.id],
  }),
  skill: one(skills, {
    fields: [occupationSkills.skillId],
    references: [skills.id],
  }),
}));
