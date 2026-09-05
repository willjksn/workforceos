import { relations } from "drizzle-orm";
import {
  boolean,
  date,
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
import { agents, organizations, users } from "../core";
import { companies, opportunities } from "../crm";
import {
  deliverableStatusEnum,
  expansionStatusEnum,
  issueStatusEnum,
  meetingStatusEnum,
  projectStatusEnum,
  riskStatusEnum,
  taskPriorityEnum,
  taskStatusEnum,
} from "../enums";
import { files } from "../system";
import { services, serviceVersions, solutionPlans } from "../services";

export const projectTemplates = pgTable("project_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "restrict" }),
  serviceVersionId: uuid("service_version_id").references(() => serviceVersions.id, {
    onDelete: "set null",
  }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  ...timestamps(),
}, (table) => [
  unique("project_templates_code_uq").on(table.code),
  index("project_templates_service_id_idx").on(table.serviceId),
  index("project_templates_service_version_id_idx").on(table.serviceVersionId),
]);

export const projectTemplatePhases = pgTable("project_template_phases", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateId: uuid("template_id").notNull().references(() => projectTemplates.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  sequence: integer("sequence").notNull(),
  description: text("description"),
  ...timestamps(),
}, (table) => [
  index("project_template_phases_template_id_idx").on(table.templateId),
  unique("project_template_phases_template_sequence_uq").on(table.templateId, table.sequence),
]);

export const projectTemplateTasks = pgTable("project_template_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  phaseId: uuid("phase_id").notNull().references(() => projectTemplatePhases.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  description: text("description"),
  sequence: integer("sequence").notNull().default(1),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  completionCriteria: text("completion_criteria"),
  ...timestamps(),
}, (table) => [
  index("project_template_tasks_phase_id_idx").on(table.phaseId),
]);

export const projectTemplateDeliverables = pgTable("project_template_deliverables", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateId: uuid("template_id").notNull().references(() => projectTemplates.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  deliverableType: text("deliverable_type").notNull(),
  description: text("description"),
  required: boolean("required").notNull().default(true),
  clientFacing: boolean("client_facing").notNull().default(true),
  ...timestamps(),
}, (table) => [
  index("project_template_deliverables_template_id_idx").on(table.templateId),
]);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  solutionPlanId: uuid("solution_plan_id").references(() => solutionPlans.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "restrict" }),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "restrict" }),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "restrict" }),
  contractId: uuid("contract_id"),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  status: projectStatusEnum("status").notNull().default("planned"),
  health: text("health").notNull().default("healthy"),
  contractValue: numeric("contract_value", { precision: 14, scale: 2 }),
  startDate: date("start_date", { mode: "date" }),
  endDate: date("end_date", { mode: "date" }),
  nextMilestone: text("next_milestone"),
  contractOverride: boolean("contract_override").notNull().default(false),
  contractOverrideReason: text("contract_override_reason"),
  contractOverrideByUserId: uuid("contract_override_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  contractOverrideAt: timestamp("contract_override_at", { withTimezone: true, mode: "date" }),
  closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
  closeoutOverride: boolean("closeout_override").notNull().default(false),
  closeoutOverrideReason: text("closeout_override_reason"),
  ...timestamps(),
}, (table) => [
  index("projects_organization_id_idx").on(table.organizationId),
  index("projects_solution_plan_id_idx").on(table.solutionPlanId),
  index("projects_company_id_idx").on(table.companyId),
  index("projects_service_id_idx").on(table.serviceId),
  index("projects_opportunity_id_idx").on(table.opportunityId),
  index("projects_contract_id_idx").on(table.contractId),
  index("projects_owner_user_id_idx").on(table.ownerUserId),
  index("projects_contract_override_by_user_id_idx").on(table.contractOverrideByUserId),
]);

export const projectPhases = pgTable("project_phases", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sequence: integer("sequence").notNull(),
  description: text("description"),
  status: text("status").notNull().default("not_started"),
  ...timestamps(),
}, (table) => [
  index("project_phases_project_id_idx").on(table.projectId),
]);

export const projectTasks = pgTable("project_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  phaseId: uuid("phase_id").notNull().references(() => projectPhases.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: taskStatusEnum("status").notNull().default("pending"),
  description: text("description"),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
  priority: taskPriorityEnum("priority").notNull().default("normal"),
  dueDate: date("due_date", { mode: "date" }),
  dependsOnTaskId: uuid("depends_on_task_id"),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  completionCriteria: text("completion_criteria"),
  ...timestamps(),
}, (table) => [
  index("project_tasks_phase_id_idx").on(table.phaseId),
  index("project_tasks_owner_user_id_idx").on(table.ownerUserId),
  index("project_tasks_agent_id_idx").on(table.agentId),
  index("project_tasks_depends_on_task_id_idx").on(table.dependsOnTaskId),
]);

export const projectDeliverables = pgTable("project_deliverables", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  deliverableType: text("deliverable_type").notNull(),
  description: text("description"),
  dueDate: date("due_date", { mode: "date" }),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
  versionNumber: integer("version_number").notNull().default(1),
  status: deliverableStatusEnum("status").notNull().default("not_started"),
  clientFacing: boolean("client_facing").notNull().default(true),
  required: boolean("required").notNull().default(true),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
  clientDeliveredAt: timestamp("client_delivered_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("project_deliverables_project_id_idx").on(table.projectId),
  index("project_deliverables_owner_user_id_idx").on(table.ownerUserId),
  index("project_deliverables_file_id_idx").on(table.fileId),
  index("project_deliverables_approved_by_user_id_idx").on(table.approvedByUserId),
]);

export const projectRisks = pgTable("project_risks", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  probability: text("probability").notNull().default("medium"),
  impact: text("impact").notNull().default("medium"),
  severity: text("severity").notNull().default("medium"),
  mitigation: text("mitigation"),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  status: riskStatusEnum("status").notNull().default("open"),
  material: boolean("material").notNull().default(true),
  ...timestamps(),
}, (table) => [
  index("project_risks_project_id_idx").on(table.projectId),
  index("project_risks_owner_user_id_idx").on(table.ownerUserId),
]);

export const projectIssues = pgTable("project_issues", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  severity: text("severity").notNull().default("medium"),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action"),
  status: issueStatusEnum("status").notNull().default("open"),
  resolution: text("resolution"),
  ...timestamps(),
}, (table) => [
  index("project_issues_project_id_idx").on(table.projectId),
  index("project_issues_owner_user_id_idx").on(table.ownerUserId),
]);

export const projectKpis = pgTable("project_kpis", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  definition: text("definition"),
  value: text("value"),
  unit: text("unit"),
  source: text("source"),
  capturedAt: timestamp("captured_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("project_kpis_project_id_idx").on(table.projectId),
]);

export const projectMeetings = pgTable("project_meetings", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }),
  notes: text("notes"),
  actions: text("actions"),
  status: meetingStatusEnum("status").notNull().default("scheduled"),
  ...timestamps(),
}, (table) => [
  index("project_meetings_project_id_idx").on(table.projectId),
]);

export const projectCloseouts = pgTable("project_closeouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  lessonsLearned: text("lessons_learned"),
  clientFeedback: text("client_feedback"),
  knowledgeCapture: text("knowledge_capture"),
  kpiSnapshot: text("kpi_snapshot"),
  completedByUserId: uuid("completed_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  ...timestamps(),
}, (table) => [
  unique("project_closeouts_project_uq").on(table.projectId),
  index("project_closeouts_completed_by_user_id_idx").on(table.completedByUserId),
]);

export const expansionRecommendations = pgTable("expansion_recommendations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  sourceServiceCode: text("source_service_code").notNull(),
  recommendedServiceCode: text("recommended_service_code").notNull(),
  rationale: text("rationale"),
  status: expansionStatusEnum("status").notNull().default("suggested"),
  resultingOpportunityId: uuid("resulting_opportunity_id").references(() => opportunities.id, {
    onDelete: "set null",
  }),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps(),
}, (table) => [
  index("expansion_recommendations_organization_id_idx").on(table.organizationId),
  index("expansion_recommendations_company_id_idx").on(table.companyId),
  index("expansion_recommendations_project_id_idx").on(table.projectId),
  index("expansion_recommendations_resulting_opportunity_id_idx").on(table.resultingOpportunityId),
  index("expansion_recommendations_reviewed_by_user_id_idx").on(table.reviewedByUserId),
]);

export const projectTemplatesRelations = relations(projectTemplates, ({ one, many }) => ({
  service: one(services, {
    fields: [projectTemplates.serviceId],
    references: [services.id],
  }),
  phases: many(projectTemplatePhases),
  deliverables: many(projectTemplateDeliverables),
}));

export const projectTemplatePhasesRelations = relations(projectTemplatePhases, ({ one, many }) => ({
  template: one(projectTemplates, {
    fields: [projectTemplatePhases.templateId],
    references: [projectTemplates.id],
  }),
  tasks: many(projectTemplateTasks),
}));

export const projectTemplateTasksRelations = relations(projectTemplateTasks, ({ one }) => ({
  phase: one(projectTemplatePhases, {
    fields: [projectTemplateTasks.phaseId],
    references: [projectTemplatePhases.id],
  }),
}));

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
  deliverables: many(projectDeliverables),
  risks: many(projectRisks),
  issues: many(projectIssues),
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
