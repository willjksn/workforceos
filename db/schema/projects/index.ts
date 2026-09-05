import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { organizations } from "../core";
import { projectStatusEnum, taskStatusEnum } from "../enums";
import { solutionPlans } from "../services";

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  solutionPlanId: uuid("solution_plan_id").references(() => solutionPlans.id, {
    onDelete: "restrict",
  }),
  name: text("name").notNull(),
  status: projectStatusEnum("status").notNull().default("planned"),
  ...timestamps(),
}, (table) => [
  index("projects_organization_id_idx").on(table.organizationId),
  index("projects_solution_plan_id_idx").on(table.solutionPlanId),
]);

export const projectPhases = pgTable("project_phases", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sequence: integer("sequence").notNull(),
  ...timestamps(),
}, (table) => [
  index("project_phases_project_id_idx").on(table.projectId),
]);

export const projectTasks = pgTable("project_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  phaseId: uuid("phase_id").notNull().references(() => projectPhases.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: taskStatusEnum("status").notNull().default("pending"),
  ...timestamps(),
}, (table) => [
  index("project_tasks_phase_id_idx").on(table.phaseId),
]);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  solutionPlan: one(solutionPlans, {
    fields: [projects.solutionPlanId],
    references: [solutionPlans.id],
  }),
  phases: many(projectPhases),
}));

export const projectPhasesRelations = relations(projectPhases, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectPhases.projectId],
    references: [projects.id],
  }),
  tasks: many(projectTasks),
}));

export const projectTasksRelations = relations(projectTasks, ({ one }) => ({
  phase: one(projectPhases, {
    fields: [projectTasks.phaseId],
    references: [projectPhases.id],
  }),
}));
