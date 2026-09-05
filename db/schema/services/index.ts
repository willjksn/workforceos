import { relations } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { organizations } from "../core";
import { opportunities } from "../crm";
import { reviewStatusEnum, serviceStatusEnum, solutionPlanStatusEnum } from "../enums";

export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: serviceStatusEnum("status").notNull().default("active"),
  description: text("description"),
  ...timestamps(),
}, (table) => [
  unique("services_code_uq").on(table.code),
]);

export const serviceVersions = pgTable("service_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "restrict" }),
  version: text("version").notNull(),
  definition: text("definition").notNull(),
  reviewStatus: reviewStatusEnum("review_status").notNull().default("approved"),
  ...timestamps(),
}, (table) => [
  index("service_versions_service_id_idx").on(table.serviceId),
  unique("service_versions_service_version_uq").on(table.serviceId, table.version),
]);

export const serviceWorkflows = pgTable("service_workflows", {
  id: uuid("id").defaultRandom().primaryKey(),
  serviceVersionId: uuid("service_version_id")
    .notNull()
    .references(() => serviceVersions.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(),
  name: text("name").notNull(),
  instructions: text("instructions").notNull(),
  requiresHumanApproval: boolean("requires_human_approval").notNull().default(false),
  ...timestamps(),
}, (table) => [
  index("service_workflows_service_version_id_idx").on(table.serviceVersionId),
  unique("service_workflows_version_step_uq").on(table.serviceVersionId, table.stepNumber),
]);

export const solutionPlans = pgTable("solution_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, {
    onDelete: "restrict",
  }),
  serviceVersionId: uuid("service_version_id")
    .notNull()
    .references(() => serviceVersions.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  status: solutionPlanStatusEnum("status").notNull().default("draft"),
  summary: text("summary"),
  ...timestamps(),
}, (table) => [
  index("solution_plans_organization_id_idx").on(table.organizationId),
  index("solution_plans_opportunity_id_idx").on(table.opportunityId),
  index("solution_plans_service_version_id_idx").on(table.serviceVersionId),
]);

export const servicesRelations = relations(services, ({ many }) => ({
  versions: many(serviceVersions),
}));

export const serviceVersionsRelations = relations(serviceVersions, ({ one, many }) => ({
  service: one(services, {
    fields: [serviceVersions.serviceId],
    references: [services.id],
  }),
  workflows: many(serviceWorkflows),
  solutionPlans: many(solutionPlans),
}));

export const serviceWorkflowsRelations = relations(serviceWorkflows, ({ one }) => ({
  serviceVersion: one(serviceVersions, {
    fields: [serviceWorkflows.serviceVersionId],
    references: [serviceVersions.id],
  }),
}));

export const solutionPlansRelations = relations(solutionPlans, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [solutionPlans.opportunityId],
    references: [opportunities.id],
  }),
  serviceVersion: one(serviceVersions, {
    fields: [solutionPlans.serviceVersionId],
    references: [serviceVersions.id],
  }),
}));
