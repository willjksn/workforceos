import { relations, sql } from "drizzle-orm";
import { index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";

export const skills = pgTable("skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  onetSource: text("onet_source"),
  onetVersion: text("onet_version"),
  ...timestamps(),
}, (table) => [
  unique("skills_slug_uq").on(table.slug),
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

export const skillsRelations = relations(skills, ({ many }) => ({
  occupationSkills: many(occupationSkills),
}));

export const civilianOccupationsRelations = relations(civilianOccupations, ({ many }) => ({
  occupationSkills: many(occupationSkills),
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
