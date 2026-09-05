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
import { companies, companyLocations, contacts, opportunities } from "../crm";
import {
  apprenticeshipStatusEnum,
  careerPathEdgeTypeEnum,
  educationPartnerTypeEnum,
  laborMarketProviderEnum,
  partnershipStatusEnum,
  riskStatusEnum,
  skillRequirementTypeEnum,
  skillsGapScopeEnum,
  talentScarcityClassEnum,
  workforceAssessmentStatusEnum,
  workforceCriticalityEnum,
  workforceDataQualityEnum,
  workforceImportSourceEnum,
  workforcePipelineStatusEnum,
  workforceRecommendationStatusEnum,
  workforceRiskCategoryEnum,
  workforceRoadmapPeriodEnum,
  workforceSupplySourceTypeEnum,
} from "../enums";
import { projectDeliverables, projectTasks, projects } from "../projects";
import { services, solutionPlans } from "../services";
import { approvals } from "../system";
import { civilianOccupations, skills } from "./catalog";

function provenance() {
  return {
    source: text("source"),
    sourceDate: timestamp("source_date", { withTimezone: true, mode: "date" }),
    sourceVersion: text("source_version"),
    internalAssumption: text("internal_assumption"),
    analystOverride: text("analyst_override"),
    generatedByModel: text("generated_by_model"),
    generatedByModelVersion: text("generated_by_model_version"),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    reviewerUserId: uuid("reviewer_user_id").references(() => users.id, { onDelete: "set null" }),
    generatedAt: timestamp("generated_at", { withTimezone: true, mode: "date" }),
    dataQuality: workforceDataQualityEnum("data_quality").notNull().default("internal_only"),
    isFixture: boolean("is_fixture").notNull().default(false),
  };
}

export const workforceAssessments = pgTable("workforce_assessments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "restrict" }),
  solutionPlanId: uuid("solution_plan_id").references(() => solutionPlans.id, {
    onDelete: "restrict",
  }),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "restrict" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  status: workforceAssessmentStatusEnum("status").notNull().default("draft"),
  versionNumber: integer("version_number").notNull().default(1),
  supersedesAssessmentId: uuid("supersedes_assessment_id"),
  notes: text("notes"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: "date" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("workforce_assessments_organization_id_idx").on(table.organizationId),
  index("workforce_assessments_company_id_idx").on(table.companyId),
  index("workforce_assessments_opportunity_id_idx").on(table.opportunityId),
  index("workforce_assessments_solution_plan_id_idx").on(table.solutionPlanId),
  index("workforce_assessments_service_id_idx").on(table.serviceId),
  index("workforce_assessments_project_id_idx").on(table.projectId),
  index("workforce_assessments_created_by_user_id_idx").on(table.createdByUserId),
  index("workforce_assessments_approved_by_user_id_idx").on(table.approvedByUserId),
  index("workforce_assessments_supersedes_assessment_id_idx").on(table.supersedesAssessmentId),
  unique("workforce_assessments_company_version_uq").on(table.companyId, table.versionNumber),
]);

export const workforceAssessmentLocations = pgTable("workforce_assessment_locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").notNull().references(() => workforceAssessments.id, {
    onDelete: "cascade",
  }),
  companyLocationId: uuid("company_location_id").notNull().references(() => companyLocations.id, {
    onDelete: "restrict",
  }),
  ...timestamps(),
}, (table) => [
  index("workforce_assessment_locations_assessment_id_idx").on(table.assessmentId),
  index("workforce_assessment_locations_company_location_id_idx").on(table.companyLocationId),
  unique("workforce_assessment_locations_uq").on(table.assessmentId, table.companyLocationId),
]);

export const workforceAssessmentDataSources = pgTable("workforce_assessment_data_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").notNull().references(() => workforceAssessments.id, {
    onDelete: "cascade",
  }),
  sourceType: text("source_type").notNull(),
  sourceName: text("source_name").notNull(),
  sourceDate: timestamp("source_date", { withTimezone: true, mode: "date" }),
  sourceVersion: text("source_version"),
  notes: text("notes"),
  isFixture: boolean("is_fixture").notNull().default(false),
  ...timestamps(),
}, (table) => [
  index("workforce_assessment_data_sources_assessment_id_idx").on(table.assessmentId),
]);

export const workforceAssessmentAssumptions = pgTable("workforce_assessment_assumptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").notNull().references(() => workforceAssessments.id, {
    onDelete: "cascade",
  }),
  code: text("code").notNull(),
  label: text("label").notNull(),
  included: boolean("included").notNull().default(true),
  ratePercent: numeric("rate_percent", { precision: 8, scale: 4 }),
  quantity: integer("quantity"),
  explanation: text("explanation"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps(),
}, (table) => [
  index("workforce_assessment_assumptions_assessment_id_idx").on(table.assessmentId),
  index("workforce_assessment_assumptions_created_by_user_id_idx").on(table.createdByUserId),
  unique("workforce_assessment_assumptions_code_uq").on(table.assessmentId, table.code),
]);

export const workforceRoles = pgTable("workforce_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  assessmentId: uuid("assessment_id").references(() => workforceAssessments.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  civilianOccupationId: uuid("civilian_occupation_id").references(() => civilianOccupations.id, {
    onDelete: "set null",
  }),
  jobFamily: text("job_family"),
  companyLocationId: uuid("company_location_id").references(() => companyLocations.id, {
    onDelete: "set null",
  }),
  currentHeadcount: integer("current_headcount").notNull().default(0),
  requiredSkillsSummary: text("required_skills_summary"),
  criticality: workforceCriticalityEnum("criticality").notNull().default("moderate"),
  businessFunction: text("business_function"),
  shiftSchedule: text("shift_schedule"),
  minimumCredentials: text("minimum_credentials"),
  targetProficiency: text("target_proficiency"),
  futureDemandCategory: text("future_demand_category"),
  militaryCompatibility: text("military_compatibility"),
  talentScarcity: talentScarcityClassEnum("talent_scarcity").notNull().default("unknown"),
  replacementDifficulty: workforceCriticalityEnum("replacement_difficulty").notNull().default("moderate"),
  notes: text("notes"),
  isFixture: boolean("is_fixture").notNull().default(false),
  ...timestamps(),
}, (table) => [
  index("workforce_roles_organization_id_idx").on(table.organizationId),
  index("workforce_roles_company_id_idx").on(table.companyId),
  index("workforce_roles_assessment_id_idx").on(table.assessmentId),
  index("workforce_roles_civilian_occupation_id_idx").on(table.civilianOccupationId),
  index("workforce_roles_company_location_id_idx").on(table.companyLocationId),
]);

export const workforceRoleSkills = pgTable("workforce_role_skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  roleId: uuid("role_id").notNull().references(() => workforceRoles.id, { onDelete: "cascade" }),
  skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "restrict" }),
  requirementType: skillRequirementTypeEnum("requirement_type").notNull().default("required"),
  targetProficiency: text("target_proficiency"),
  yearsExperience: integer("years_experience"),
  ...timestamps(),
}, (table) => [
  index("workforce_role_skills_role_id_idx").on(table.roleId),
  index("workforce_role_skills_skill_id_idx").on(table.skillId),
  unique("workforce_role_skills_role_skill_uq").on(table.roleId, table.skillId),
]);

export const workforceImports = pgTable("workforce_imports", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").notNull().references(() => workforceAssessments.id, {
    onDelete: "cascade",
  }),
  sourceType: workforceImportSourceEnum("source_type").notNull(),
  fileName: text("file_name"),
  rowCount: integer("row_count").notNull().default(0),
  notes: text("notes"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  isFixture: boolean("is_fixture").notNull().default(false),
  ...timestamps(),
}, (table) => [
  index("workforce_imports_assessment_id_idx").on(table.assessmentId),
  index("workforce_imports_created_by_user_id_idx").on(table.createdByUserId),
]);

export const workforceBaselines = pgTable("workforce_baselines", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").notNull().references(() => workforceAssessments.id, {
    onDelete: "cascade",
  }),
  roleId: uuid("role_id").notNull().references(() => workforceRoles.id, { onDelete: "restrict" }),
  companyLocationId: uuid("company_location_id").references(() => companyLocations.id, {
    onDelete: "set null",
  }),
  importId: uuid("import_id").references(() => workforceImports.id, { onDelete: "set null" }),
  currentHeadcount: integer("current_headcount").notNull().default(0),
  vacancies: integer("vacancies").notNull().default(0),
  attritionRatePercent: numeric("attrition_rate_percent", { precision: 8, scale: 4 }),
  retirementEligibilityRatePercent: numeric("retirement_eligibility_rate_percent", {
    precision: 8,
    scale: 4,
  }),
  turnoverRatePercent: numeric("turnover_rate_percent", { precision: 8, scale: 4 }),
  averageTenureMonths: numeric("average_tenure_months", { precision: 8, scale: 2 }),
  internalMobilityRatePercent: numeric("internal_mobility_rate_percent", { precision: 8, scale: 4 }),
  currentPipelineCount: integer("current_pipeline_count").notNull().default(0),
  knownHiringPlan: integer("known_hiring_plan").notNull().default(0),
  trainingCapacity: integer("training_capacity").notNull().default(0),
  asOfDate: date("as_of_date", { mode: "date" }),
  ...provenance(),
  ...timestamps(),
}, (table) => [
  index("workforce_baselines_assessment_id_idx").on(table.assessmentId),
  index("workforce_baselines_role_id_idx").on(table.roleId),
  index("workforce_baselines_company_location_id_idx").on(table.companyLocationId),
  index("workforce_baselines_import_id_idx").on(table.importId),
  index("workforce_baselines_reviewer_user_id_idx").on(table.reviewerUserId),
  unique("workforce_baselines_assessment_role_location_uq").on(
    table.assessmentId,
    table.roleId,
    table.companyLocationId,
  ),
]);

export const workforceForecasts = pgTable("workforce_forecasts", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").notNull().references(() => workforceAssessments.id, {
    onDelete: "cascade",
  }),
  versionNumber: integer("version_number").notNull().default(1),
  name: text("name").notNull(),
  horizonMonths: integer("horizon_months").notNull(),
  status: text("status").notNull().default("draft"),
  calculationMethod: text("calculation_method").notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  ...provenance(),
  ...timestamps(),
}, (table) => [
  index("workforce_forecasts_assessment_id_idx").on(table.assessmentId),
  index("workforce_forecasts_created_by_user_id_idx").on(table.createdByUserId),
  index("workforce_forecasts_reviewed_by_user_id_idx").on(table.reviewedByUserId),
  index("workforce_forecasts_reviewer_user_id_idx").on(table.reviewerUserId),
  unique("workforce_forecasts_assessment_version_horizon_uq").on(
    table.assessmentId,
    table.versionNumber,
    table.horizonMonths,
  ),
]);

export const workforceForecastComponents = pgTable("workforce_forecast_components", {
  id: uuid("id").defaultRandom().primaryKey(),
  forecastId: uuid("forecast_id").notNull().references(() => workforceForecasts.id, {
    onDelete: "cascade",
  }),
  code: text("code").notNull(),
  label: text("label").notNull(),
  included: boolean("included").notNull().default(true),
  ratePercent: numeric("rate_percent", { precision: 8, scale: 4 }),
  quantity: integer("quantity"),
  explanation: text("explanation"),
  sequence: integer("sequence").notNull().default(1),
  ...timestamps(),
}, (table) => [
  index("workforce_forecast_components_forecast_id_idx").on(table.forecastId),
  unique("workforce_forecast_components_code_uq").on(table.forecastId, table.code),
]);

export const workforceForecastOverrides = pgTable("workforce_forecast_overrides", {
  id: uuid("id").defaultRandom().primaryKey(),
  forecastId: uuid("forecast_id").notNull().references(() => workforceForecasts.id, {
    onDelete: "cascade",
  }),
  componentCode: text("component_code").notNull(),
  previousValue: text("previous_value"),
  newValue: text("new_value").notNull(),
  reason: text("reason").notNull(),
  actorUserId: uuid("actor_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  ...timestamps(),
}, (table) => [
  index("workforce_forecast_overrides_forecast_id_idx").on(table.forecastId),
  index("workforce_forecast_overrides_actor_user_id_idx").on(table.actorUserId),
]);

export const workforceForecastResults = pgTable("workforce_forecast_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  forecastId: uuid("forecast_id").notNull().references(() => workforceForecasts.id, {
    onDelete: "cascade",
  }),
  roleId: uuid("role_id").notNull().references(() => workforceRoles.id, { onDelete: "restrict" }),
  companyLocationId: uuid("company_location_id").references(() => companyLocations.id, {
    onDelete: "set null",
  }),
  horizonMonths: integer("horizon_months").notNull(),
  currentRequired: integer("current_required").notNull().default(0),
  growthDemand: integer("growth_demand").notNull().default(0),
  replacementDemand: integer("replacement_demand").notNull().default(0),
  backlogDemand: integer("backlog_demand").notNull().default(0),
  expectedInternalSupply: integer("expected_internal_supply").notNull().default(0),
  futureDemand: integer("future_demand").notNull().default(0),
  assumptionsSummary: text("assumptions_summary"),
  ...provenance(),
  ...timestamps(),
}, (table) => [
  index("workforce_forecast_results_forecast_id_idx").on(table.forecastId),
  index("workforce_forecast_results_role_id_idx").on(table.roleId),
  index("workforce_forecast_results_company_location_id_idx").on(table.companyLocationId),
  index("workforce_forecast_results_reviewer_user_id_idx").on(table.reviewerUserId),
  unique("workforce_forecast_results_forecast_role_loc_horizon_uq").on(
    table.forecastId,
    table.roleId,
    table.companyLocationId,
    table.horizonMonths,
  ),
]);

export const workforceSupplyEntries = pgTable("workforce_supply_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").notNull().references(() => workforceAssessments.id, {
    onDelete: "cascade",
  }),
  roleId: uuid("role_id").notNull().references(() => workforceRoles.id, { onDelete: "restrict" }),
  companyLocationId: uuid("company_location_id").references(() => companyLocations.id, {
    onDelete: "set null",
  }),
  sourceType: workforceSupplySourceTypeEnum("source_type").notNull(),
  estimatedSupply: integer("estimated_supply").notNull().default(0),
  readiness: text("readiness"),
  trainingRequired: text("training_required"),
  timeToReadinessDays: integer("time_to_readiness_days"),
  capacity: integer("capacity"),
  lastUpdated: timestamp("last_updated", { withTimezone: true, mode: "date" }),
  ...provenance(),
  ...timestamps(),
}, (table) => [
  index("workforce_supply_entries_assessment_id_idx").on(table.assessmentId),
  index("workforce_supply_entries_role_id_idx").on(table.roleId),
  index("workforce_supply_entries_company_location_id_idx").on(table.companyLocationId),
  index("workforce_supply_entries_reviewer_user_id_idx").on(table.reviewerUserId),
]);

export const workforceGapThresholds = pgTable("workforce_gap_thresholds", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  severity: workforceCriticalityEnum("severity").notNull(),
  minGap: integer("min_gap").notNull(),
  minGapPercent: numeric("min_gap_percent", { precision: 8, scale: 4 }).notNull(),
  ...timestamps(),
}, (table) => [
  index("workforce_gap_thresholds_organization_id_idx").on(table.organizationId),
  unique("workforce_gap_thresholds_org_severity_uq").on(table.organizationId, table.severity),
]);

export const workforceGaps = pgTable("workforce_gaps", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").notNull().references(() => workforceAssessments.id, {
    onDelete: "cascade",
  }),
  forecastResultId: uuid("forecast_result_id").references(() => workforceForecastResults.id, {
    onDelete: "set null",
  }),
  roleId: uuid("role_id").notNull().references(() => workforceRoles.id, { onDelete: "restrict" }),
  companyLocationId: uuid("company_location_id").references(() => companyLocations.id, {
    onDelete: "set null",
  }),
  horizonMonths: integer("horizon_months").notNull(),
  demand: integer("demand").notNull().default(0),
  supply: integer("supply").notNull().default(0),
  gap: integer("gap").notNull().default(0),
  severity: workforceCriticalityEnum("severity").notNull().default("moderate"),
  risk: text("risk"),
  timeHorizon: text("time_horizon"),
  assumptionsSummary: text("assumptions_summary"),
  overrideReason: text("override_reason"),
  ...provenance(),
  ...timestamps(),
}, (table) => [
  index("workforce_gaps_assessment_id_idx").on(table.assessmentId),
  index("workforce_gaps_forecast_result_id_idx").on(table.forecastResultId),
  index("workforce_gaps_role_id_idx").on(table.roleId),
  index("workforce_gaps_company_location_id_idx").on(table.companyLocationId),
  index("workforce_gaps_reviewer_user_id_idx").on(table.reviewerUserId),
]);

export const talentScarcityIndicators = pgTable("talent_scarcity_indicators", {
  id: uuid("id").defaultRandom().primaryKey(),
  roleId: uuid("role_id").notNull().references(() => workforceRoles.id, { onDelete: "cascade" }),
  companyLocationId: uuid("company_location_id").references(() => companyLocations.id, {
    onDelete: "set null",
  }),
  laborSupplyEvidence: text("labor_supply_evidence"),
  hiringDifficulty: text("hiring_difficulty"),
  historicalTimeToFillDays: integer("historical_time_to_fill_days"),
  compensationPressure: text("compensation_pressure"),
  geographicAvailability: text("geographic_availability"),
  trainingCapacity: text("training_capacity"),
  credentialBarriers: text("credential_barriers"),
  competition: text("competition"),
  militarySupply: text("military_supply"),
  internalPipeline: text("internal_pipeline"),
  classification: talentScarcityClassEnum("classification").notNull().default("unknown"),
  ...provenance(),
  ...timestamps(),
}, (table) => [
  index("talent_scarcity_indicators_role_id_idx").on(table.roleId),
  index("talent_scarcity_indicators_company_location_id_idx").on(table.companyLocationId),
  index("talent_scarcity_indicators_reviewer_user_id_idx").on(table.reviewerUserId),
]);

export const educationPartners = pgTable("education_partners", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  partnerType: educationPartnerTypeEnum("partner_type").notNull(),
  partnershipStatus: partnershipStatusEnum("partnership_status").notNull().default("exploratory"),
  programsSummary: text("programs_summary"),
  occupationsSupported: text("occupations_supported"),
  credentials: text("credentials"),
  annualCapacity: integer("annual_capacity"),
  notes: text("notes"),
  outcomes: text("outcomes"),
  isFixture: boolean("is_fixture").notNull().default(false),
  ...timestamps(),
}, (table) => [
  index("education_partners_organization_id_idx").on(table.organizationId),
  index("education_partners_company_id_idx").on(table.companyId),
]);

export const educationPartnerLocations = pgTable("education_partner_locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  partnerId: uuid("partner_id").notNull().references(() => educationPartners.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  city: text("city"),
  region: text("region"),
  country: text("country"),
  ...timestamps(),
}, (table) => [
  index("education_partner_locations_partner_id_idx").on(table.partnerId),
]);

export const educationPartnerContacts = pgTable("education_partner_contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  partnerId: uuid("partner_id").notNull().references(() => educationPartners.id, {
    onDelete: "cascade",
  }),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "restrict" }),
  ...timestamps(),
}, (table) => [
  index("education_partner_contacts_partner_id_idx").on(table.partnerId),
  index("education_partner_contacts_contact_id_idx").on(table.contactId),
  unique("education_partner_contacts_uq").on(table.partnerId, table.contactId),
]);

export const educationPartnerClients = pgTable("education_partner_clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  partnerId: uuid("partner_id").notNull().references(() => educationPartners.id, {
    onDelete: "cascade",
  }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  ...timestamps(),
}, (table) => [
  index("education_partner_clients_partner_id_idx").on(table.partnerId),
  index("education_partner_clients_company_id_idx").on(table.companyId),
  unique("education_partner_clients_uq").on(table.partnerId, table.companyId),
]);

export const trainingPrograms = pgTable("training_programs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  partnerId: uuid("partner_id").references(() => educationPartners.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  durationDays: integer("duration_days"),
  cost: numeric("cost", { precision: 14, scale: 2 }),
  capacity: integer("capacity"),
  deliveryMethod: text("delivery_method"),
  location: text("location"),
  prerequisites: text("prerequisites"),
  completionRatePercent: numeric("completion_rate_percent", { precision: 8, scale: 4 }),
  placementRatePercent: numeric("placement_rate_percent", { precision: 8, scale: 4 }),
  credentials: text("credentials"),
  isFixture: boolean("is_fixture").notNull().default(false),
  ...timestamps(),
}, (table) => [
  index("training_programs_organization_id_idx").on(table.organizationId),
  index("training_programs_partner_id_idx").on(table.partnerId),
]);

export const trainingProgramSkills = pgTable("training_program_skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  programId: uuid("program_id").notNull().references(() => trainingPrograms.id, {
    onDelete: "cascade",
  }),
  skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "restrict" }),
  ...timestamps(),
}, (table) => [
  index("training_program_skills_program_id_idx").on(table.programId),
  index("training_program_skills_skill_id_idx").on(table.skillId),
  unique("training_program_skills_uq").on(table.programId, table.skillId),
]);

export const trainingProgramOccupations = pgTable("training_program_occupations", {
  id: uuid("id").defaultRandom().primaryKey(),
  programId: uuid("program_id").notNull().references(() => trainingPrograms.id, {
    onDelete: "cascade",
  }),
  occupationId: uuid("occupation_id").notNull().references(() => civilianOccupations.id, {
    onDelete: "restrict",
  }),
  ...timestamps(),
}, (table) => [
  index("training_program_occupations_program_id_idx").on(table.programId),
  index("training_program_occupations_occupation_id_idx").on(table.occupationId),
  unique("training_program_occupations_uq").on(table.programId, table.occupationId),
]);

export const apprenticeships = pgTable("apprenticeships", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "restrict" }),
  partnerId: uuid("partner_id").references(() => educationPartners.id, { onDelete: "set null" }),
  occupationId: uuid("occupation_id").references(() => civilianOccupations.id, {
    onDelete: "set null",
  }),
  sponsorName: text("sponsor_name"),
  durationMonths: integer("duration_months"),
  trainingHours: integer("training_hours"),
  classroomHours: integer("classroom_hours"),
  targetEnrollment: integer("target_enrollment"),
  annualCapacity: integer("annual_capacity"),
  status: apprenticeshipStatusEnum("status").notNull().default("planned"),
  expectedCompletionRatePercent: numeric("expected_completion_rate_percent", {
    precision: 8,
    scale: 4,
  }),
  hiringConversionPercent: numeric("hiring_conversion_percent", { precision: 8, scale: 4 }),
  retentionRatePercent: numeric("retention_rate_percent", { precision: 8, scale: 4 }),
  notes: text("notes"),
  isFixture: boolean("is_fixture").notNull().default(false),
  ...timestamps(),
}, (table) => [
  index("apprenticeships_organization_id_idx").on(table.organizationId),
  index("apprenticeships_company_id_idx").on(table.companyId),
  index("apprenticeships_partner_id_idx").on(table.partnerId),
  index("apprenticeships_occupation_id_idx").on(table.occupationId),
]);

export const talentPipelines = pgTable("talent_pipelines", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  assessmentId: uuid("assessment_id").references(() => workforceAssessments.id, {
    onDelete: "set null",
  }),
  gapId: uuid("gap_id").references(() => workforceGaps.id, { onDelete: "set null" }),
  roleId: uuid("role_id").notNull().references(() => workforceRoles.id, { onDelete: "restrict" }),
  companyLocationId: uuid("company_location_id").references(() => companyLocations.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  sourceType: workforceSupplySourceTypeEnum("source_type").notNull(),
  status: workforcePipelineStatusEnum("status").notNull().default("planned"),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  partnerId: uuid("partner_id").references(() => educationPartners.id, { onDelete: "set null" }),
  targetCandidatesPerYear: integer("target_candidates_per_year").notNull().default(0),
  expectedConversionPercent: numeric("expected_conversion_percent", { precision: 8, scale: 4 }),
  trainingRequirements: text("training_requirements"),
  expectedTimeToReadyDays: integer("expected_time_to_ready_days"),
  budgetAssumption: text("budget_assumption"),
  kpis: text("kpis"),
  notes: text("notes"),
  isFixture: boolean("is_fixture").notNull().default(false),
  ...timestamps(),
}, (table) => [
  index("talent_pipelines_organization_id_idx").on(table.organizationId),
  index("talent_pipelines_company_id_idx").on(table.companyId),
  index("talent_pipelines_assessment_id_idx").on(table.assessmentId),
  index("talent_pipelines_gap_id_idx").on(table.gapId),
  index("talent_pipelines_role_id_idx").on(table.roleId),
  index("talent_pipelines_company_location_id_idx").on(table.companyLocationId),
  index("talent_pipelines_owner_user_id_idx").on(table.ownerUserId),
  index("talent_pipelines_partner_id_idx").on(table.partnerId),
]);

export const talentPipelineAllocations = pgTable("talent_pipeline_allocations", {
  id: uuid("id").defaultRandom().primaryKey(),
  pipelineId: uuid("pipeline_id").notNull().references(() => talentPipelines.id, {
    onDelete: "cascade",
  }),
  gapId: uuid("gap_id").notNull().references(() => workforceGaps.id, { onDelete: "cascade" }),
  sourceType: workforceSupplySourceTypeEnum("source_type").notNull(),
  plannedCount: integer("planned_count").notNull().default(0),
  actualCount: integer("actual_count").notNull().default(0),
  notes: text("notes"),
  ...timestamps(),
}, (table) => [
  index("talent_pipeline_allocations_pipeline_id_idx").on(table.pipelineId),
  index("talent_pipeline_allocations_gap_id_idx").on(table.gapId),
  unique("talent_pipeline_allocations_gap_source_uq").on(table.gapId, table.sourceType),
]);

export const careerPaths = pgTable("career_paths", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  description: text("description"),
  isFixture: boolean("is_fixture").notNull().default(false),
  ...timestamps(),
}, (table) => [
  index("career_paths_organization_id_idx").on(table.organizationId),
  index("career_paths_company_id_idx").on(table.companyId),
]);

export const careerPathLevels = pgTable("career_path_levels", {
  id: uuid("id").defaultRandom().primaryKey(),
  pathId: uuid("path_id").notNull().references(() => careerPaths.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  title: text("title").notNull(),
  civilianOccupationId: uuid("civilian_occupation_id").references(() => civilianOccupations.id, {
    onDelete: "set null",
  }),
  experience: text("experience"),
  training: text("training"),
  certifications: text("certifications"),
  readinessCriteria: text("readiness_criteria"),
  expectedTimeMonths: integer("expected_time_months"),
  leadershipRequirements: text("leadership_requirements"),
  compensationBand: text("compensation_band"),
  ...timestamps(),
}, (table) => [
  index("career_path_levels_path_id_idx").on(table.pathId),
  index("career_path_levels_civilian_occupation_id_idx").on(table.civilianOccupationId),
  unique("career_path_levels_path_sequence_uq").on(table.pathId, table.sequence),
]);

export const careerPathLevelSkills = pgTable("career_path_level_skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  levelId: uuid("level_id").notNull().references(() => careerPathLevels.id, { onDelete: "cascade" }),
  skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "restrict" }),
  ...timestamps(),
}, (table) => [
  index("career_path_level_skills_level_id_idx").on(table.levelId),
  index("career_path_level_skills_skill_id_idx").on(table.skillId),
  unique("career_path_level_skills_uq").on(table.levelId, table.skillId),
]);

export const careerPathEdges = pgTable("career_path_edges", {
  id: uuid("id").defaultRandom().primaryKey(),
  pathId: uuid("path_id").notNull().references(() => careerPaths.id, { onDelete: "cascade" }),
  fromLevelId: uuid("from_level_id").notNull().references(() => careerPathLevels.id, {
    onDelete: "cascade",
  }),
  toLevelId: uuid("to_level_id").notNull().references(() => careerPathLevels.id, {
    onDelete: "cascade",
  }),
  edgeType: careerPathEdgeTypeEnum("edge_type").notNull().default("sequential"),
  ...timestamps(),
}, (table) => [
  index("career_path_edges_path_id_idx").on(table.pathId),
  index("career_path_edges_from_level_id_idx").on(table.fromLevelId),
  index("career_path_edges_to_level_id_idx").on(table.toLevelId),
]);

export const skillsGapAnalyses = pgTable("skills_gap_analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").references(() => workforceAssessments.id, {
    onDelete: "cascade",
  }),
  roleId: uuid("role_id").notNull().references(() => workforceRoles.id, { onDelete: "restrict" }),
  scope: skillsGapScopeEnum("scope").notNull(),
  candidateId: uuid("candidate_id"),
  existingSkillsSummary: text("existing_skills_summary"),
  missingSkillsSummary: text("missing_skills_summary"),
  proficiencyGaps: text("proficiency_gaps"),
  certificationGaps: text("certification_gaps"),
  recommendedTraining: text("recommended_training"),
  readinessEstimate: text("readiness_estimate"),
  ...provenance(),
  ...timestamps(),
}, (table) => [
  index("skills_gap_analyses_assessment_id_idx").on(table.assessmentId),
  index("skills_gap_analyses_role_id_idx").on(table.roleId),
  index("skills_gap_analyses_candidate_id_idx").on(table.candidateId),
  index("skills_gap_analyses_reviewer_user_id_idx").on(table.reviewerUserId),
]);

export const skillsGapItems = pgTable("skills_gap_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  analysisId: uuid("analysis_id").notNull().references(() => skillsGapAnalyses.id, {
    onDelete: "cascade",
  }),
  skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "restrict" }),
  status: text("status").notNull(),
  notes: text("notes"),
  ...timestamps(),
}, (table) => [
  index("skills_gap_items_analysis_id_idx").on(table.analysisId),
  index("skills_gap_items_skill_id_idx").on(table.skillId),
]);

export const workforceScenarios = pgTable("workforce_scenarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").notNull().references(() => workforceAssessments.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  ...provenance(),
  ...timestamps(),
}, (table) => [
  index("workforce_scenarios_assessment_id_idx").on(table.assessmentId),
  index("workforce_scenarios_created_by_user_id_idx").on(table.createdByUserId),
  index("workforce_scenarios_reviewer_user_id_idx").on(table.reviewerUserId),
]);

export const workforceScenarioInputs = pgTable("workforce_scenario_inputs", {
  id: uuid("id").defaultRandom().primaryKey(),
  scenarioId: uuid("scenario_id").notNull().references(() => workforceScenarios.id, {
    onDelete: "cascade",
  }),
  growthDeltaPercent: numeric("growth_delta_percent", { precision: 8, scale: 4 }),
  attritionDeltaPercent: numeric("attrition_delta_percent", { precision: 8, scale: 4 }),
  retirementDeltaPercent: numeric("retirement_delta_percent", { precision: 8, scale: 4 }),
  hiringDelta: integer("hiring_delta"),
  trainingCapacityDelta: integer("training_capacity_delta"),
  pipelineConversionDeltaPercent: numeric("pipeline_conversion_delta_percent", {
    precision: 8,
    scale: 4,
  }),
  militaryContributionDelta: integer("military_contribution_delta"),
  internalMobilityDeltaPercent: numeric("internal_mobility_delta_percent", {
    precision: 8,
    scale: 4,
  }),
  ...timestamps(),
}, (table) => [
  index("workforce_scenario_inputs_scenario_id_idx").on(table.scenarioId),
  unique("workforce_scenario_inputs_scenario_uq").on(table.scenarioId),
]);

export const workforceScenarioOutputs = pgTable("workforce_scenario_outputs", {
  id: uuid("id").defaultRandom().primaryKey(),
  scenarioId: uuid("scenario_id").notNull().references(() => workforceScenarios.id, {
    onDelete: "cascade",
  }),
  roleId: uuid("role_id").notNull().references(() => workforceRoles.id, { onDelete: "restrict" }),
  horizonMonths: integer("horizon_months").notNull(),
  projectedDemand: integer("projected_demand").notNull().default(0),
  projectedSupply: integer("projected_supply").notNull().default(0),
  resultingGap: integer("resulting_gap").notNull().default(0),
  requiredPipelineCapacity: integer("required_pipeline_capacity").notNull().default(0),
  estimatedTimeToReadinessDays: integer("estimated_time_to_readiness_days"),
  majorRisks: text("major_risks"),
  keyAssumptions: text("key_assumptions"),
  ...provenance(),
  ...timestamps(),
}, (table) => [
  index("workforce_scenario_outputs_scenario_id_idx").on(table.scenarioId),
  index("workforce_scenario_outputs_role_id_idx").on(table.roleId),
  index("workforce_scenario_outputs_reviewer_user_id_idx").on(table.reviewerUserId),
]);

export const workforceRecommendations = pgTable("workforce_recommendations", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").notNull().references(() => workforceAssessments.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: workforceRecommendationStatusEnum("status").notNull().default("draft"),
  generatedByActorType: text("generated_by_actor_type").notNull().default("human"),
  generatedByAgentId: uuid("generated_by_agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  generatedByUserId: uuid("generated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  approvalId: uuid("approval_id").references(() => approvals.id, { onDelete: "set null" }),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
  ...provenance(),
  ...timestamps(),
}, (table) => [
  index("workforce_recommendations_assessment_id_idx").on(table.assessmentId),
  index("workforce_recommendations_generated_by_agent_id_idx").on(table.generatedByAgentId),
  index("workforce_recommendations_generated_by_user_id_idx").on(table.generatedByUserId),
  index("workforce_recommendations_approval_id_idx").on(table.approvalId),
  index("workforce_recommendations_approved_by_user_id_idx").on(table.approvedByUserId),
  index("workforce_recommendations_reviewer_user_id_idx").on(table.reviewerUserId),
]);

export const workforceRoadmapItems = pgTable("workforce_roadmap_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").notNull().references(() => workforceAssessments.id, {
    onDelete: "cascade",
  }),
  recommendationId: uuid("recommendation_id").references(() => workforceRecommendations.id, {
    onDelete: "set null",
  }),
  period: workforceRoadmapPeriodEnum("period").notNull(),
  action: text("action").notNull(),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  clientResponsibility: text("client_responsibility"),
  firmResponsibility: text("firm_responsibility"),
  dependency: text("dependency"),
  duePeriod: text("due_period"),
  kpi: text("kpi"),
  status: text("status").notNull().default("planned"),
  projectTaskId: uuid("project_task_id").references(() => projectTasks.id, { onDelete: "set null" }),
  ...timestamps(),
}, (table) => [
  index("workforce_roadmap_items_assessment_id_idx").on(table.assessmentId),
  index("workforce_roadmap_items_recommendation_id_idx").on(table.recommendationId),
  index("workforce_roadmap_items_owner_user_id_idx").on(table.ownerUserId),
  index("workforce_roadmap_items_project_task_id_idx").on(table.projectTaskId),
]);

export const workforceKpis = pgTable("workforce_kpis", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").notNull().references(() => workforceAssessments.id, {
    onDelete: "cascade",
  }),
  code: text("code").notNull(),
  label: text("label").notNull(),
  valueNumeric: numeric("value_numeric", { precision: 14, scale: 4 }),
  unit: text("unit"),
  asOfDate: date("as_of_date", { mode: "date" }),
  source: text("source"),
  isFixture: boolean("is_fixture").notNull().default(false),
  ...timestamps(),
}, (table) => [
  index("workforce_kpis_assessment_id_idx").on(table.assessmentId),
  unique("workforce_kpis_assessment_code_uq").on(table.assessmentId, table.code),
]);

export const workforceRisks = pgTable("workforce_risks", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").notNull().references(() => workforceAssessments.id, {
    onDelete: "cascade",
  }),
  roleId: uuid("role_id").references(() => workforceRoles.id, { onDelete: "set null" }),
  category: workforceRiskCategoryEnum("category").notNull(),
  severity: workforceCriticalityEnum("severity").notNull().default("moderate"),
  likelihood: text("likelihood").notNull().default("medium"),
  impact: text("impact").notNull().default("medium"),
  mitigation: text("mitigation"),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  status: riskStatusEnum("status").notNull().default("open"),
  ...timestamps(),
}, (table) => [
  index("workforce_risks_assessment_id_idx").on(table.assessmentId),
  index("workforce_risks_role_id_idx").on(table.roleId),
  index("workforce_risks_owner_user_id_idx").on(table.ownerUserId),
]);

export const workforcePipelinePlans = pgTable("workforce_pipeline_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").notNull().references(() => workforceAssessments.id, {
    onDelete: "cascade",
  }),
  projectDeliverableId: uuid("project_deliverable_id").references(() => projectDeliverables.id, {
    onDelete: "set null",
  }),
  versionNumber: integer("version_number").notNull().default(1),
  status: workforceRecommendationStatusEnum("status").notNull().default("draft"),
  htmlBody: text("html_body"),
  executiveSummary: text("executive_summary"),
  currentWorkforceState: text("current_workforce_state"),
  criticalOccupations: text("critical_occupations"),
  demandForecast: text("demand_forecast"),
  talentSupply: text("talent_supply"),
  workforceGaps: text("workforce_gaps"),
  militaryOpportunity: text("military_opportunity"),
  educationTrainingOpportunity: text("education_training_opportunity"),
  internalDevelopment: text("internal_development"),
  recommendedPipelineMix: text("recommended_pipeline_mix"),
  scenarioAnalysis: text("scenario_analysis"),
  implementationRoadmap: text("implementation_roadmap"),
  kpis: text("kpis"),
  risks: text("risks"),
  assumptions: text("assumptions"),
  approvalId: uuid("approval_id").references(() => approvals.id, { onDelete: "set null" }),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
  ...provenance(),
  ...timestamps(),
}, (table) => [
  index("workforce_pipeline_plans_assessment_id_idx").on(table.assessmentId),
  index("workforce_pipeline_plans_project_deliverable_id_idx").on(table.projectDeliverableId),
  index("workforce_pipeline_plans_approval_id_idx").on(table.approvalId),
  index("workforce_pipeline_plans_approved_by_user_id_idx").on(table.approvedByUserId),
  index("workforce_pipeline_plans_reviewer_user_id_idx").on(table.reviewerUserId),
  unique("workforce_pipeline_plans_assessment_version_uq").on(table.assessmentId, table.versionNumber),
]);

export const laborMarketSourceMetadata = pgTable("labor_market_source_metadata", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  provider: laborMarketProviderEnum("provider").notNull(),
  configured: boolean("configured").notNull().default(false),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true, mode: "date" }),
  notes: text("notes"),
  ...timestamps(),
}, (table) => [
  index("labor_market_source_metadata_organization_id_idx").on(table.organizationId),
  unique("labor_market_source_metadata_org_provider_uq").on(table.organizationId, table.provider),
]);

export const laborMarketObservations = pgTable("labor_market_observations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  provider: laborMarketProviderEnum("provider").notNull(),
  geography: text("geography"),
  occupationCode: text("occupation_code"),
  metric: text("metric").notNull(),
  valueNumeric: numeric("value_numeric", { precision: 14, scale: 4 }),
  asOfDate: date("as_of_date", { mode: "date" }),
  sourceVersion: text("source_version"),
  isFixture: boolean("is_fixture").notNull().default(true),
  notes: text("notes"),
  ...timestamps(),
}, (table) => [
  index("labor_market_observations_organization_id_idx").on(table.organizationId),
]);

export const workforceGeographies = pgTable("workforce_geographies", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  geographyType: text("geography_type").notNull(),
  name: text("name").notNull(),
  city: text("city"),
  region: text("region"),
  country: text("country"),
  referenceTable: text("reference_table"),
  referenceId: uuid("reference_id"),
  ...timestamps(),
}, (table) => [
  index("workforce_geographies_organization_id_idx").on(table.organizationId),
  index("workforce_geographies_reference_id_idx").on(table.referenceId),
]);

export const workforceAssessmentsRelations = relations(workforceAssessments, ({ one, many }) => ({
  company: one(companies, {
    fields: [workforceAssessments.companyId],
    references: [companies.id],
  }),
  project: one(projects, {
    fields: [workforceAssessments.projectId],
    references: [projects.id],
  }),
  roles: many(workforceRoles),
  forecasts: many(workforceForecasts),
  gaps: many(workforceGaps),
}));

export const workforceRolesRelations = relations(workforceRoles, ({ one, many }) => ({
  company: one(companies, {
    fields: [workforceRoles.companyId],
    references: [companies.id],
  }),
  occupation: one(civilianOccupations, {
    fields: [workforceRoles.civilianOccupationId],
    references: [civilianOccupations.id],
  }),
  location: one(companyLocations, {
    fields: [workforceRoles.companyLocationId],
    references: [companyLocations.id],
  }),
  skills: many(workforceRoleSkills),
}));
