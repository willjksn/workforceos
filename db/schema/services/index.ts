import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { agentRuns } from "../ai";
import { organizations, users } from "../core";
import { companies, opportunities } from "../crm";
import {
  discoveryStatusEnum,
  pricingModelEnum,
  proposalStatusEnum,
  reviewStatusEnum,
  serviceStatusEnum,
  solutionPlanStatusEnum,
  workflowStepTypeEnum,
} from "../enums";

export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: serviceStatusEnum("status").notNull().default("active"),
  description: text("description"),
  practiceArea: text("practice_area"),
  pricingModel: pricingModelEnum("pricing_model"),
  defaultMinPrice: numeric("default_min_price", { precision: 14, scale: 2 }),
  defaultMaxPrice: numeric("default_max_price", { precision: 14, scale: 2 }),
  defaultDurationDays: integer("default_duration_days"),
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
  effectiveDate: timestamp("effective_date", { withTimezone: true, mode: "date" }),
  scopeDefinition: text("scope_definition"),
  requiredInputs: jsonb("required_inputs").$type<string[]>(),
  deliverables: jsonb("deliverables").$type<string[]>(),
  kpis: jsonb("kpis").$type<string[]>(),
  clientResponsibilities: text("client_responsibilities"),
  firmResponsibilities: text("firm_responsibilities"),
  legalRequirements: text("legal_requirements"),
  pricingGuidance: text("pricing_guidance"),
  expansionServices: jsonb("expansion_services").$type<string[]>(),
  pricingModel: pricingModelEnum("pricing_model"),
  minPrice: numeric("min_price", { precision: 14, scale: 2 }),
  maxPrice: numeric("max_price", { precision: 14, scale: 2 }),
  percentageFee: numeric("percentage_fee", { precision: 6, scale: 3 }),
  minimumFee: numeric("minimum_fee", { precision: 14, scale: 2 }),
  defaultDurationDays: integer("default_duration_days"),
  practiceArea: text("practice_area"),
  ...timestamps(),
}, (table) => [
  index("service_versions_service_id_idx").on(table.serviceId),
  unique("service_versions_service_version_uq").on(table.serviceId, table.version),
]);

export const serviceWorkflowDefinitions = pgTable("service_workflow_definitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  serviceVersionId: uuid("service_version_id")
    .notNull()
    .references(() => serviceVersions.id, { onDelete: "cascade" }),
  qualificationTriggers: text("qualification_triggers"),
  requiredDiscoveryInputs: jsonb("required_discovery_inputs").$type<
    Array<{ key: string; label: string; required: boolean; section?: string }>
  >(),
  dataCollection: text("data_collection"),
  aiResponsibilities: text("ai_responsibilities"),
  humanResponsibilities: text("human_responsibilities"),
  approvalGates: text("approval_gates"),
  deliverables: text("deliverables"),
  legalPackage: jsonb("legal_package").$type<{ required: string[]; conditional: string[] }>(),
  projectTemplateCode: text("project_template_code"),
  billingRules: text("billing_rules"),
  kpis: text("kpis"),
  completionRules: text("completion_rules"),
  expansionRules: text("expansion_rules"),
  exceptionHandling: text("exception_handling"),
  ...timestamps(),
}, (table) => [
  unique("service_workflow_definitions_version_uq").on(table.serviceVersionId),
  index("service_workflow_definitions_service_version_id_idx").on(table.serviceVersionId),
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
  stepType: workflowStepTypeEnum("step_type"),
  responsibleRole: text("responsible_role"),
  requiredInputs: text("required_inputs"),
  outputType: text("output_type"),
  blocking: boolean("blocking").notNull().default(true),
  completionCriteria: text("completion_criteria"),
  nextStepNumber: integer("next_step_number"),
  exceptionPath: text("exception_path"),
  ...timestamps(),
}, (table) => [
  index("service_workflows_service_version_id_idx").on(table.serviceVersionId),
  unique("service_workflows_version_step_uq").on(table.serviceVersionId, table.stepNumber),
]);

export const discoveries = pgTable("discoveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, {
    onDelete: "restrict",
  }),
  serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "restrict" }),
  serviceVersionId: uuid("service_version_id").references(() => serviceVersions.id, {
    onDelete: "restrict",
  }),
  title: text("title").notNull(),
  status: discoveryStatusEnum("status").notNull().default("draft"),
  answers: jsonb("answers").$type<Record<string, string>>(),
  problemStatement: text("problem_statement"),
  businessImpact: text("business_impact"),
  rootCauses: text("root_causes"),
  requirements: text("requirements"),
  timeline: text("timeline"),
  budget: text("budget"),
  decisionMakers: text("decision_makers"),
  missingData: text("missing_data"),
  recommendedServiceCode: text("recommended_service_code"),
  recommendedNextServiceCode: text("recommended_next_service_code"),
  outputSummary: text("output_summary"),
  generatedByActorType: text("generated_by_actor_type"),
  generatedByModel: text("generated_by_model"),
  generatedByModelVersion: text("generated_by_model_version"),
  generatedConfidence: numeric("generated_confidence", { precision: 5, scale: 4 }),
  humanApprovedAt: timestamp("human_approved_at", { withTimezone: true, mode: "date" }),
  humanApprovedByUserId: uuid("human_approved_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  ...timestamps(),
}, (table) => [
  index("discoveries_organization_id_idx").on(table.organizationId),
  index("discoveries_company_id_idx").on(table.companyId),
  index("discoveries_opportunity_id_idx").on(table.opportunityId),
  index("discoveries_service_id_idx").on(table.serviceId),
  index("discoveries_service_version_id_idx").on(table.serviceVersionId),
  index("discoveries_human_approved_by_user_id_idx").on(table.humanApprovedByUserId),
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
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "restrict" }),
  discoveryId: uuid("discovery_id").references(() => discoveries.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  status: solutionPlanStatusEnum("status").notNull().default("draft"),
  summary: text("summary"),
  planVersion: integer("plan_version").notNull().default(1),
  problemStatement: text("problem_statement"),
  businessImpact: text("business_impact"),
  findings: text("findings"),
  recommendedScope: text("recommended_scope"),
  requiredInputs: text("required_inputs"),
  deliverables: text("deliverables"),
  phases: text("phases"),
  timeline: text("timeline"),
  clientResponsibilities: text("client_responsibilities"),
  firmResponsibilities: text("firm_responsibilities"),
  kpis: text("kpis"),
  risks: text("risks"),
  pricingModel: pricingModelEnum("pricing_model"),
  estimatedPrice: numeric("estimated_price", { precision: 14, scale: 2 }),
  recommendedPrice: numeric("recommended_price", { precision: 14, scale: 2 }),
  approvedPrice: numeric("approved_price", { precision: 14, scale: 2 }),
  pricingOverride: boolean("pricing_override").notNull().default(false),
  pricingOverrideReason: text("pricing_override_reason"),
  pricingApprovedByUserId: uuid("pricing_approved_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  pricingApprovedAt: timestamp("pricing_approved_at", { withTimezone: true, mode: "date" }),
  expansionOpportunities: text("expansion_opportunities"),
  generatedByAgentRunId: uuid("generated_by_agent_run_id").references(() => agentRuns.id, {
    onDelete: "set null",
  }),
  generatedByModel: text("generated_by_model"),
  generatedByModelVersion: text("generated_by_model_version"),
  generatedConfidence: numeric("generated_confidence", { precision: 5, scale: 4 }),
  sourceReferences: jsonb("source_references"),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("solution_plans_organization_id_idx").on(table.organizationId),
  index("solution_plans_opportunity_id_idx").on(table.opportunityId),
  index("solution_plans_service_version_id_idx").on(table.serviceVersionId),
  index("solution_plans_company_id_idx").on(table.companyId),
  index("solution_plans_discovery_id_idx").on(table.discoveryId),
  index("solution_plans_pricing_approved_by_user_id_idx").on(table.pricingApprovedByUserId),
  index("solution_plans_generated_by_agent_run_id_idx").on(table.generatedByAgentRunId),
  index("solution_plans_approved_by_user_id_idx").on(table.approvedByUserId),
]);

export const proposals = pgTable("proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, {
    onDelete: "restrict",
  }),
  solutionPlanId: uuid("solution_plan_id").notNull().references(() => solutionPlans.id, {
    onDelete: "restrict",
  }),
  serviceVersionId: uuid("service_version_id").notNull().references(() => serviceVersions.id, {
    onDelete: "restrict",
  }),
  title: text("title").notNull(),
  status: proposalStatusEnum("status").notNull().default("draft"),
  currentVersionNumber: integer("current_version_number").notNull().default(1),
  sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
  viewedAt: timestamp("viewed_at", { withTimezone: true, mode: "date" }),
  decidedAt: timestamp("decided_at", { withTimezone: true, mode: "date" }),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
  supersededByProposalId: uuid("superseded_by_proposal_id"),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("proposals_organization_id_idx").on(table.organizationId),
  index("proposals_company_id_idx").on(table.companyId),
  index("proposals_opportunity_id_idx").on(table.opportunityId),
  index("proposals_solution_plan_id_idx").on(table.solutionPlanId),
  index("proposals_service_version_id_idx").on(table.serviceVersionId),
  index("proposals_approved_by_user_id_idx").on(table.approvedByUserId),
]);

export const proposalVersions = pgTable("proposal_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  proposalId: uuid("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  executiveSummary: text("executive_summary"),
  clientProblem: text("client_problem"),
  recommendedSolution: text("recommended_solution"),
  scope: text("scope"),
  deliverables: text("deliverables"),
  timeline: text("timeline"),
  clientResponsibilities: text("client_responsibilities"),
  firmResponsibilities: text("firm_responsibilities"),
  kpis: text("kpis"),
  pricing: text("pricing"),
  pricingAmount: numeric("pricing_amount", { precision: 14, scale: 2 }),
  paymentTerms: text("payment_terms"),
  assumptions: text("assumptions"),
  exclusions: text("exclusions"),
  nextSteps: text("next_steps"),
  htmlBody: text("html_body"),
  generatedByModel: text("generated_by_model"),
  generatedByModelVersion: text("generated_by_model_version"),
  generatedConfidence: numeric("generated_confidence", { precision: 5, scale: 4 }),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps(),
}, (table) => [
  index("proposal_versions_proposal_id_idx").on(table.proposalId),
  unique("proposal_versions_proposal_version_uq").on(table.proposalId, table.versionNumber),
  index("proposal_versions_created_by_user_id_idx").on(table.createdByUserId),
]);

export const servicesRelations = relations(services, ({ many }) => ({
  versions: many(serviceVersions),
  discoveries: many(discoveries),
}));

export const serviceVersionsRelations = relations(serviceVersions, ({ one, many }) => ({
  service: one(services, {
    fields: [serviceVersions.serviceId],
    references: [services.id],
  }),
  workflows: many(serviceWorkflows),
  workflowDefinition: many(serviceWorkflowDefinitions),
  solutionPlans: many(solutionPlans),
}));

export const serviceWorkflowDefinitionsRelations = relations(serviceWorkflowDefinitions, ({ one }) => ({
  serviceVersion: one(serviceVersions, {
    fields: [serviceWorkflowDefinitions.serviceVersionId],
    references: [serviceVersions.id],
  }),
}));

export const serviceWorkflowsRelations = relations(serviceWorkflows, ({ one }) => ({
  serviceVersion: one(serviceVersions, {
    fields: [serviceWorkflows.serviceVersionId],
    references: [serviceVersions.id],
  }),
}));

export const discoveriesRelations = relations(discoveries, ({ one }) => ({
  company: one(companies, {
    fields: [discoveries.companyId],
    references: [companies.id],
  }),
  opportunity: one(opportunities, {
    fields: [discoveries.opportunityId],
    references: [opportunities.id],
  }),
  service: one(services, {
    fields: [discoveries.serviceId],
    references: [services.id],
  }),
}));

export const solutionPlansRelations = relations(solutionPlans, ({ one, many }) => ({
  opportunity: one(opportunities, {
    fields: [solutionPlans.opportunityId],
    references: [opportunities.id],
  }),
  serviceVersion: one(serviceVersions, {
    fields: [solutionPlans.serviceVersionId],
    references: [serviceVersions.id],
  }),
  discovery: one(discoveries, {
    fields: [solutionPlans.discoveryId],
    references: [discoveries.id],
  }),
  proposals: many(proposals),
}));

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  solutionPlan: one(solutionPlans, {
    fields: [proposals.solutionPlanId],
    references: [solutionPlans.id],
  }),
  versions: many(proposalVersions),
}));

export const proposalVersionsRelations = relations(proposalVersions, ({ one }) => ({
  proposal: one(proposals, {
    fields: [proposalVersions.proposalId],
    references: [proposals.id],
  }),
}));
