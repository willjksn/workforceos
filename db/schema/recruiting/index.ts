import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
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
  candidatePipelineStatusEnum,
  clientVisibilityEnum,
  guaranteeStatusEnum,
  interviewStatusEnum,
  careerSourceHealthEnum,
  careerSourceTypeEnum,
  jobContextTypeEnum,
  jobDemandHorizonEnum,
  jobStatusEnum,
  mappingReviewStatusEnum,
  offerStatusEnum,
  placementStatusEnum,
  postingVisibilityEnum,
  searchProjectStatusEnum,
  skillRequirementTypeEnum,
  submissionStatusEnum,
} from "../enums";
import { services } from "../services";
import { candidates } from "../talent";
import { skills } from "../workforce";
import { workforceRoles } from "../workforce/planning";

/**
 * Where an external employer-demand record came from.
 * Public discovery stores an adapter key and sync health. It does not store credentials.
 * M4 automates only the Greenhouse public job board. Other categories stay manual or CSV.
 */
export const careerSources = pgTable("career_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  sourceType: careerSourceTypeEnum("source_type").notNull(),
  name: text("name").notNull(),
  baseUrl: text("base_url"),
  careersUrl: text("careers_url"),
  /** Public adapter id such as greenhouse_public_board. Not a secret. */
  adapterKey: text("adapter_key"),
  healthStatus: careerSourceHealthEnum("health_status").notNull().default("not_yet_synced"),
  active: boolean("active").notNull().default(true),
  lastSuccessfulSyncAt: timestamp("last_successful_sync_at", { withTimezone: true, mode: "date" }),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true, mode: "date" }),
  lastError: text("last_error"),
  lastDiscoveredCount: integer("last_discovered_count"),
  ...timestamps(),
}, (table) => [
  unique("career_sources_id_organization_uq").on(table.id, table.organizationId),
  unique("career_sources_id_organization_company_uq").on(
    table.id,
    table.organizationId,
    table.companyId,
  ),
  foreignKey({
    columns: [table.companyId, table.organizationId],
    foreignColumns: [companies.id, companies.organizationId],
    name: "career_sources_company_organization_fk",
  }).onDelete("restrict"),
  index("career_sources_organization_id_idx").on(table.organizationId),
  index("career_sources_company_id_idx").on(table.companyId),
  index("career_sources_org_active_idx").on(table.organizationId, table.active),
]);

/** One discovery attempt. A failed run does not close jobs. */
export const careerSourceSyncRuns = pgTable("career_source_sync_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  careerSourceId: uuid("career_source_id").notNull(),
  status: text("status").notNull(),
  trigger: text("trigger").notNull(),
  listingComplete: boolean("listing_complete").notNull().default(false),
  discoveredCount: integer("discovered_count").notNull().default(0),
  newCount: integer("new_count").notNull().default(0),
  changedCount: integer("changed_count").notNull().default(0),
  unchangedCount: integer("unchanged_count").notNull().default(0),
  closedCount: integer("closed_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  error: text("error"),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  foreignKey({
    columns: [table.careerSourceId, table.organizationId],
    foreignColumns: [careerSources.id, careerSources.organizationId],
    name: "career_source_sync_runs_source_org_fk",
  }).onDelete("restrict"),
  index("career_source_sync_runs_organization_id_idx").on(table.organizationId),
  index("career_source_sync_runs_career_source_id_idx").on(table.careerSourceId),
  index("career_source_sync_runs_actor_user_id_idx").on(table.actorUserId),
  check(
    "career_source_sync_runs_status_chk",
    sql`${table.status} in ('succeeded', 'failed', 'refused')`,
  ),
  check(
    "career_source_sync_runs_trigger_chk",
    sql`${table.trigger} in ('manual', 'schedule')`,
  ),
]);

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  normalizedTitle: text("normalized_title"),
  status: jobStatusEnum("status").notNull().default("draft"),
  description: text("description"),
  locationId: uuid("location_id").references(() => companyLocations.id, { onDelete: "set null" }),
  locationLabel: text("location_label"),
  hiringManagerContactId: uuid("hiring_manager_contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  /**
   * Human confirmation that Pier 24 may route a person to an employer reviewer.
   * A company row or a hiring-manager contact does not turn a public posting into a client route.
   */
  authorizedEmployerRoute: boolean("authorized_employer_route").notNull().default(false),
  searchOwnerUserId: uuid("search_owner_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  reportingRelationship: text("reporting_relationship"),
  employmentType: text("employment_type"),
  workplaceType: text("workplace_type"),
  compensationMin: numeric("compensation_min", { precision: 12, scale: 2 }),
  compensationMax: numeric("compensation_max", { precision: 12, scale: 2 }),
  compensationCurrency: text("compensation_currency").notNull().default("USD"),
  bonus: text("bonus"),
  requiredExperienceYears: integer("required_experience_years"),
  education: text("education"),
  certifications: text("certifications"),
  travel: text("travel"),
  relocation: text("relocation"),
  scheduleShift: text("schedule_shift"),
  reasonOpen: text("reason_open"),
  targetStartDate: date("target_start_date"),
  interviewProcess: text("interview_process"),
  businessContext: text("business_context"),
  candidateValueProposition: text("candidate_value_proposition"),
  priorSearchFailureNotes: text("prior_search_failure_notes"),
  successMeasures: text("success_measures"),
  priority: text("priority").notNull().default("normal"),
  urgency: text("urgency").notNull().default("normal"),
  militaryCompatibility: text("military_compatibility"),
  jobContextType: jobContextTypeEnum("job_context_type").notNull().default("client"),
  /** current | evergreen | future. Existing rows stay current. */
  demandHorizon: jobDemandHorizonEnum("demand_horizon").notNull().default("current"),
  careerSourceId: uuid("career_source_id"),
  externalKey: text("external_key"),
  sourceUrl: text("source_url"),
  contentHash: text("content_hash"),
  closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
  /** When a successful discovery last saw this posting. Not a match score. */
  lastObservedAt: timestamp("last_observed_at", { withTimezone: true, mode: "date" }),
  /** Verbatim public salary text from the source. Empty when the source shows none. */
  publicCompensationText: text("public_compensation_text"),
  department: text("department"),
  postingVisibility: postingVisibilityEnum("posting_visibility").notNull().default("internal_only"),
  clientVisibility: clientVisibilityEnum("client_visibility").notNull().default("internal_only"),
  publicSlug: text("public_slug"),
  skillbridgeEligible: boolean("skillbridge_eligible").notNull().default(false),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true, mode: "date" }),
  internalTalentSearchStartedAt: timestamp("internal_talent_search_started_at", {
    withTimezone: true,
    mode: "date",
  }),
  internalTalentSearchCompletedAt: timestamp("internal_talent_search_completed_at", {
    withTimezone: true,
    mode: "date",
  }),
  internalCandidatesReviewedCount: integer("internal_candidates_reviewed_count"),
  internalCandidatesRecommendedCount: integer("internal_candidates_recommended_count"),
  ...timestamps(),
}, (table) => [
  index("jobs_organization_id_idx").on(table.organizationId),
  index("jobs_company_id_idx").on(table.companyId),
  index("jobs_location_id_idx").on(table.locationId),
  index("jobs_hiring_manager_contact_id_idx").on(table.hiringManagerContactId),
  index("jobs_search_owner_user_id_idx").on(table.searchOwnerUserId),
  index("jobs_org_status_idx").on(table.organizationId, table.status),
  unique("jobs_org_public_slug_uq").on(table.organizationId, table.publicSlug),
  index("jobs_title_trgm_idx").using("gin", sql`${table.title} gin_trgm_ops`),
  index("jobs_career_source_id_idx").on(table.careerSourceId),
  unique("jobs_career_source_external_key_uq").on(table.careerSourceId, table.externalKey),
  foreignKey({
    columns: [table.careerSourceId, table.organizationId],
    foreignColumns: [careerSources.id, careerSources.organizationId],
    name: "jobs_career_source_organization_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.careerSourceId, table.organizationId, table.companyId],
    foreignColumns: [careerSources.id, careerSources.organizationId, careerSources.companyId],
    name: "jobs_career_source_company_fk",
  }).onDelete("restrict"),
  check(
    "jobs_sourced_job_has_company",
    sql`${table.careerSourceId} is null or ${table.companyId} is not null`,
  ),
  unique("jobs_id_organization_uq").on(table.id, table.organizationId),
]);

export const jobSkills = pgTable("job_skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "restrict" }),
  requirementType: skillRequirementTypeEnum("requirement_type").notNull().default("required"),
  minimumYears: integer("minimum_years"),
  importanceWeight: integer("importance_weight").notNull().default(1),
  humanVerified: boolean("human_verified").notNull().default(false),
  /** Where the capability requirement came from. Existing rows are recruiter entry. */
  requirementSource: text("requirement_source").notNull().default("recruiter_entry"),
  sourceText: text("source_text"),
  reviewStatus: mappingReviewStatusEnum("review_status").notNull().default("approved"),
  confidence: integer("confidence"),
  originatingAgentId: uuid("originating_agent_id").references(() => agents.id, { onDelete: "set null" }),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("job_skills_job_id_idx").on(table.jobId),
  index("job_skills_skill_id_idx").on(table.skillId),
  index("job_skills_originating_agent_id_idx").on(table.originatingAgentId),
  index("job_skills_reviewed_by_user_id_idx").on(table.reviewedByUserId),
  unique("job_skills_job_skill_uq").on(table.jobId, table.skillId),
  check(
    "job_skills_requirement_source_chk",
    sql`${table.requirementSource} in ('public_job_description', 'structured_employer_feed', 'recruiter_entry', 'employer_provided', 'ai_extraction', 'reviewed_ai_extraction')`,
  ),
  check(
    "job_skills_confidence_chk",
    sql`${table.confidence} is null or (${table.confidence} >= 0 and ${table.confidence} <= 100)`,
  ),
]);

/**
 * Non-skill requirements for one job. Capability requirements stay on job_skills
 * and use the shared skills vocabulary. Each row cites the text it came from.
 */
export const jobRequirements = pgTable("job_requirements", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  jobId: uuid("job_id").notNull(),
  kind: text("kind").notNull(),
  requirementType: skillRequirementTypeEnum("requirement_type").notNull().default("required"),
  label: text("label").notNull(),
  valueText: text("value_text"),
  requirementSource: text("requirement_source").notNull(),
  sourceText: text("source_text"),
  reviewStatus: mappingReviewStatusEnum("review_status").notNull().default("pending"),
  confidence: integer("confidence"),
  originatingAgentId: uuid("originating_agent_id").references(() => agents.id, { onDelete: "set null" }),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  unique("job_requirements_id_organization_uq").on(table.id, table.organizationId),
  foreignKey({
    columns: [table.jobId, table.organizationId],
    foreignColumns: [jobs.id, jobs.organizationId],
    name: "job_requirements_job_org_fk",
  }).onDelete("cascade"),
  index("job_requirements_organization_id_idx").on(table.organizationId),
  index("job_requirements_job_id_idx").on(table.jobId),
  index("job_requirements_job_review_idx").on(table.jobId, table.reviewStatus),
  index("job_requirements_originating_agent_id_idx").on(table.originatingAgentId),
  index("job_requirements_reviewed_by_user_id_idx").on(table.reviewedByUserId),
  unique("job_requirements_job_kind_label_uq").on(table.jobId, table.kind, table.label),
  check(
    "job_requirements_kind_chk",
    sql`${table.kind} in ('credential', 'education', 'clearance', 'experience', 'location', 'workplace', 'travel', 'license', 'job_family', 'occupation')`,
  ),
  check(
    "job_requirements_source_chk",
    sql`${table.requirementSource} in ('public_job_description', 'structured_employer_feed', 'recruiter_entry', 'employer_provided', 'ai_extraction', 'reviewed_ai_extraction')`,
  ),
  check(
    "job_requirements_confidence_chk",
    sql`${table.confidence} is null or (${table.confidence} >= 0 and ${table.confidence} <= 100)`,
  ),
]);

export const searchProjects = pgTable("search_projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  status: searchProjectStatusEnum("status").notNull().default("draft"),
  targetFillDate: date("target_fill_date"),
  feePercent: numeric("fee_percent", { precision: 5, scale: 2 }),
  feeAmount: numeric("fee_amount", { precision: 12, scale: 2 }),
  minimumFee: numeric("minimum_fee", { precision: 12, scale: 2 }),
  retainedSearchStructure: text("retained_search_structure"),
  guaranteeDays: integer("guarantee_days"),
  contractReference: text("contract_reference"),
  linkedinRecruiterProjectId: text("linkedin_recruiter_project_id"),
  linkedinRecruiterReferenceId: text("linkedin_recruiter_reference_id"),
  candidateProfile: text("candidate_profile"),
  targetIndustries: text("target_industries"),
  targetEmployers: text("target_employers"),
  targetGeography: text("target_geography"),
  talentPools: text("talent_pools"),
  militaryOccupations: text("military_occupations"),
  militaryInstallations: text("military_installations"),
  sourcingChannels: text("sourcing_channels"),
  booleanStrategy: text("boolean_strategy"),
  outreachApproach: text("outreach_approach"),
  expectedSearchDifficulty: text("expected_search_difficulty"),
  compensationRisks: text("compensation_risks"),
  likelyObjections: text("likely_objections"),
  strategyApprovedAt: timestamp("strategy_approved_at", { withTimezone: true, mode: "date" }),
  strategyApprovedByUserId: uuid("strategy_approved_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  internalSearchStartedAt: timestamp("internal_search_started_at", {
    withTimezone: true,
    mode: "date",
  }),
  internalSearchCompletedAt: timestamp("internal_search_completed_at", {
    withTimezone: true,
    mode: "date",
  }),
  ...timestamps(),
}, (table) => [
  index("search_projects_job_id_idx").on(table.jobId),
  index("search_projects_company_id_idx").on(table.companyId),
  index("search_projects_service_id_idx").on(table.serviceId),
  index("search_projects_owner_user_id_idx").on(table.ownerUserId),
  index("search_projects_strategy_approved_by_user_id_idx").on(table.strategyApprovedByUserId),
]);

export const candidateJobMatches = pgTable("candidate_job_matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  candidateId: uuid("candidate_id").notNull(),
  jobId: uuid("job_id").notNull(),
  score: numeric("score", { precision: 5, scale: 2 }).notNull(),
  skillsScore: numeric("skills_score", { precision: 5, scale: 2 }),
  experienceScore: numeric("experience_score", { precision: 5, scale: 2 }),
  industryScore: numeric("industry_score", { precision: 5, scale: 2 }),
  locationScore: numeric("location_score", { precision: 5, scale: 2 }),
  compensationScore: numeric("compensation_score", { precision: 5, scale: 2 }),
  certificationScore: numeric("certification_score", { precision: 5, scale: 2 }),
  militaryScore: numeric("military_score", { precision: 5, scale: 2 }),
  careerAlignmentScore: numeric("career_alignment_score", { precision: 5, scale: 2 }),
  priorFeedbackScore: numeric("prior_feedback_score", { precision: 5, scale: 2 }),
  explanation: text("explanation"),
  strengths: text("strengths"),
  gaps: text("gaps"),
  modelName: text("model_name"),
  modelVersion: text("model_version"),
  source: text("source"),
  humanReviewStatus: mappingReviewStatusEnum("human_review_status"),
  humanRating: integer("human_rating"),
  humanReviewedByUserId: uuid("human_reviewed_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  lastCalculatedAt: timestamp("last_calculated_at", { withTimezone: true, mode: "date" }),
  pipelineStatus: candidatePipelineStatusEnum("pipeline_status").notNull().default("sourced"),
  /** strong_match | possible_match | developmental_match | no_current_match. Null on rows from before M5. */
  matchCategory: text("match_category"),
  /** current | stale | queued | error. Existing rows start stale until recalculated. */
  freshness: text("freshness").notNull().default("stale"),
  inputHash: text("input_hash"),
  /** viable | not_viable | needs_information. Does not change the calculated category. */
  recruiterDisposition: text("recruiter_disposition"),
  dispositionNote: text("disposition_note"),
  dispositionByUserId: uuid("disposition_by_user_id").references(() => users.id, { onDelete: "set null" }),
  dispositionAt: timestamp("disposition_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  unique("candidate_job_matches_id_organization_uq").on(table.id, table.organizationId),
  foreignKey({
    columns: [table.candidateId, table.organizationId],
    foreignColumns: [candidates.id, candidates.organizationId],
    name: "candidate_job_matches_candidate_org_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.jobId, table.organizationId],
    foreignColumns: [jobs.id, jobs.organizationId],
    name: "candidate_job_matches_job_org_fk",
  }).onDelete("restrict"),
  index("candidate_job_matches_organization_id_idx").on(table.organizationId),
  index("candidate_job_matches_candidate_id_idx").on(table.candidateId),
  index("candidate_job_matches_job_id_idx").on(table.jobId),
  index("candidate_job_matches_human_reviewed_by_user_id_idx").on(table.humanReviewedByUserId),
  index("candidate_job_matches_disposition_by_user_id_idx").on(table.dispositionByUserId),
  index("candidate_job_matches_org_candidate_freshness_idx").on(table.organizationId, table.candidateId, table.freshness),
  index("candidate_job_matches_org_job_category_idx").on(table.organizationId, table.jobId, table.matchCategory),
  unique("candidate_job_matches_candidate_job_uq").on(table.candidateId, table.jobId),
  check(
    "candidate_job_matches_category_chk",
    sql`${table.matchCategory} is null or ${table.matchCategory} in ('strong_match', 'possible_match', 'developmental_match', 'no_current_match')`,
  ),
  check(
    "candidate_job_matches_freshness_chk",
    sql`${table.freshness} in ('current', 'stale', 'queued', 'error')`,
  ),
  check(
    "candidate_job_matches_disposition_chk",
    sql`${table.recruiterDisposition} is null or ${table.recruiterDisposition} in ('viable', 'not_viable', 'needs_information')`,
  ),
]);

/** Explainability lines for one match. Replaced when that match is recalculated. */
export const candidateJobMatchFactors = pgTable("candidate_job_match_factors", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  matchId: uuid("match_id").notNull(),
  factorGroup: text("factor_group").notNull(),
  dimension: text("dimension").notNull(),
  label: text("label").notNull(),
  detail: text("detail"),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps(),
}, (table) => [
  foreignKey({
    columns: [table.matchId, table.organizationId],
    foreignColumns: [candidateJobMatches.id, candidateJobMatches.organizationId],
    name: "candidate_job_match_factors_match_org_fk",
  }).onDelete("cascade"),
  index("candidate_job_match_factors_organization_id_idx").on(table.organizationId),
  index("candidate_job_match_factors_match_id_idx").on(table.matchId),
  check(
    "candidate_job_match_factors_group_chk",
    sql`${table.factorGroup} in ('aligned', 'documented_gap', 'unknown', 'preferred_gap', 'evidence')`,
  ),
  check(
    "candidate_job_match_factors_dimension_chk",
    sql`${table.dimension} in ('capability', 'credential', 'education', 'clearance', 'experience', 'location', 'timing', 'job_family', 'compensation', 'workplace')`,
  ),
]);

export const candidateScreenings = pgTable("candidate_screenings", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id").notNull().references(() => candidateJobMatches.id, {
    onDelete: "cascade",
  }),
  motivation: text("motivation"),
  compensation: text("compensation"),
  availability: text("availability"),
  locationRelocation: text("location_relocation"),
  workAuthorization: text("work_authorization"),
  travel: text("travel"),
  requiredCertifications: text("required_certifications"),
  requiredSkills: text("required_skills"),
  careerAlignment: text("career_alignment"),
  candidateQuestions: text("candidate_questions"),
  recruiterAssessment: text("recruiter_assessment"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps(),
}, (table) => [
  index("candidate_screenings_match_id_idx").on(table.matchId),
  index("candidate_screenings_created_by_user_id_idx").on(table.createdByUserId),
]);

export const submissions = pgTable("submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, {
    onDelete: "restrict",
  }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "restrict" }),
  matchId: uuid("match_id").references(() => candidateJobMatches.id, { onDelete: "set null" }),
  submittedByUserId: uuid("submitted_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  status: submissionStatusEnum("status").notNull().default("draft"),
  version: integer("version").notNull().default(1),
  outcome: text("outcome"),
  candidateSummary: text("candidate_summary"),
  relevantExperience: text("relevant_experience"),
  matchedRequirements: text("matched_requirements"),
  transferableSkills: text("transferable_skills"),
  militaryTranslation: text("military_translation"),
  compensation: text("compensation"),
  availability: text("availability"),
  location: text("location"),
  identifiedGaps: text("identified_gaps"),
  recruiterCommentary: text("recruiter_commentary"),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
  approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("submissions_candidate_id_idx").on(table.candidateId),
  index("submissions_job_id_idx").on(table.jobId),
  index("submissions_match_id_idx").on(table.matchId),
  index("submissions_submitted_by_user_id_idx").on(table.submittedByUserId),
  index("submissions_approved_by_user_id_idx").on(table.approvedByUserId),
]);

export const interviews = pgTable("interviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  submissionId: uuid("submission_id").references(() => submissions.id, {
    onDelete: "restrict",
  }),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, {
    onDelete: "restrict",
  }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "restrict" }),
  stage: text("stage"),
  format: text("format"),
  locationOrLink: text("location_or_link"),
  participants: text("participants"),
  status: interviewStatusEnum("status").notNull().default("scheduled"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: "date" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  candidatePrep: text("candidate_prep"),
  candidateFeedback: text("candidate_feedback"),
  clientFeedback: text("client_feedback"),
  clientFeedbackDueAt: timestamp("client_feedback_due_at", { withTimezone: true, mode: "date" }),
  outcome: text("outcome"),
  nextStep: text("next_step"),
  notes: text("notes"),
  applicationId: uuid("application_id"),
  ...timestamps(),
}, (table) => [
  index("interviews_submission_id_idx").on(table.submissionId),
  index("interviews_candidate_id_idx").on(table.candidateId),
  index("interviews_job_id_idx").on(table.jobId),
  index("interviews_application_id_idx").on(table.applicationId),
]);

export const offers = pgTable("offers", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, {
    onDelete: "restrict",
  }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "restrict" }),
  searchProjectId: uuid("search_project_id").references(() => searchProjects.id, {
    onDelete: "set null",
  }),
  status: offerStatusEnum("status").notNull().default("draft"),
  baseSalary: numeric("base_salary", { precision: 12, scale: 2 }),
  bonus: text("bonus"),
  otherCompensation: text("other_compensation"),
  offerDate: date("offer_date"),
  expirationDate: date("expiration_date"),
  negotiationNotes: text("negotiation_notes"),
  declineReason: text("decline_reason"),
  compensationGap: boolean("compensation_gap").notNull().default(false),
  candidateHesitation: boolean("candidate_hesitation").notNull().default(false),
  competingOffer: boolean("competing_offer").notNull().default(false),
  delayedClientProcess: boolean("delayed_client_process").notNull().default(false),
  relocationConcern: boolean("relocation_concern").notNull().default(false),
  notes: text("notes"),
  applicationId: uuid("application_id"),
  version: integer("version").notNull().default(1),
  ...timestamps(),
}, (table) => [
  index("offers_candidate_id_idx").on(table.candidateId),
  index("offers_job_id_idx").on(table.jobId),
  index("offers_search_project_id_idx").on(table.searchProjectId),
  index("offers_application_id_idx").on(table.applicationId),
]);

export const placements = pgTable("placements", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, {
    onDelete: "restrict",
  }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  searchProjectId: uuid("search_project_id").references(() => searchProjects.id, {
    onDelete: "set null",
  }),
  offerId: uuid("offer_id").references(() => offers.id, { onDelete: "set null" }),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, {
    onDelete: "set null",
  }),
  startDate: timestamp("start_date", { withTimezone: true, mode: "date" }),
  startingSalary: numeric("starting_salary", { precision: 12, scale: 2 }),
  feePercent: numeric("fee_percent", { precision: 5, scale: 2 }),
  placementFee: numeric("placement_fee", { precision: 12, scale: 2 }),
  guaranteeDays: integer("guarantee_days"),
  invoiceReference: text("invoice_reference"),
  billingEventQueuedAt: timestamp("billing_event_queued_at", { withTimezone: true, mode: "date" }),
  status: placementStatusEnum("status").notNull().default("pending_start"),
  ...timestamps(),
}, (table) => [
  index("placements_candidate_id_idx").on(table.candidateId),
  index("placements_job_id_idx").on(table.jobId),
  index("placements_company_id_idx").on(table.companyId),
  index("placements_search_project_id_idx").on(table.searchProjectId),
  index("placements_offer_id_idx").on(table.offerId),
  index("placements_opportunity_id_idx").on(table.opportunityId),
]);

export const placementGuarantees = pgTable("placement_guarantees", {
  id: uuid("id").defaultRandom().primaryKey(),
  placementId: uuid("placement_id").notNull().references(() => placements.id, {
    onDelete: "restrict",
  }),
  searchProjectId: uuid("search_project_id").references(() => searchProjects.id, {
    onDelete: "set null",
  }),
  guaranteeDays: integer("guarantee_days").notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  status: guaranteeStatusEnum("status").notNull().default("active"),
  replacementRequired: boolean("replacement_required").notNull().default(false),
  refundOrReplacementNotes: text("refund_or_replacement_notes"),
  sourceTerms: text("source_terms"),
  ...timestamps(),
}, (table) => [
  index("placement_guarantees_placement_id_idx").on(table.placementId),
  index("placement_guarantees_search_project_id_idx").on(table.searchProjectId),
]);

/**
 * One operational record for a reviewed match.
 * Match category stays on candidate_job_matches. This row is the routing and outreach state.
 * skillbridge_opportunities stays readable and is not written here.
 * submissions stays a formal client packet and is linked only when a person records one.
 */
export const opportunityEngagements = pgTable("opportunity_engagements", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  matchId: uuid("match_id").notNull(),
  candidateId: uuid("candidate_id").notNull(),
  jobId: uuid("job_id").notNull(),
  companyId: uuid("company_id"),
  mode: text("mode"),
  status: text("status").notNull().default("ready_for_review"),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  currentContactId: uuid("current_contact_id"),
  /** Points at a route inserted for this engagement. The route row carries the tenant key. */
  currentRouteId: uuid("current_route_id"),
  employerResponse: text("employer_response"),
  candidateResponse: text("candidate_response"),
  waitingOn: text("waiting_on").notNull().default("recruiter"),
  nextAction: text("next_action"),
  nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true, mode: "date" }),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  interviewStatus: text("interview_status"),
  interviewId: uuid("interview_id").references(() => interviews.id, { onDelete: "set null" }),
  submissionId: uuid("submission_id").references(() => submissions.id, { onDelete: "set null" }),
  placementId: uuid("placement_id").references(() => placements.id, { onDelete: "set null" }),
  closeReason: text("close_reason"),
  openedAt: timestamp("opened_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  unique("opportunity_engagements_id_organization_uq").on(table.id, table.organizationId),
  unique("opportunity_engagements_match_id_uq").on(table.matchId),
  foreignKey({
    columns: [table.matchId, table.organizationId],
    foreignColumns: [candidateJobMatches.id, candidateJobMatches.organizationId],
    name: "opportunity_engagements_match_org_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.candidateId, table.organizationId],
    foreignColumns: [candidates.id, candidates.organizationId],
    name: "opportunity_engagements_candidate_org_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.jobId, table.organizationId],
    foreignColumns: [jobs.id, jobs.organizationId],
    name: "opportunity_engagements_job_org_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.companyId, table.organizationId],
    foreignColumns: [companies.id, companies.organizationId],
    name: "opportunity_engagements_company_org_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.currentContactId, table.organizationId],
    foreignColumns: [contacts.id, contacts.organizationId],
    name: "opportunity_engagements_contact_org_fk",
  }).onDelete("set null"),
  index("opportunity_engagements_organization_id_idx").on(table.organizationId),
  index("opportunity_engagements_match_id_idx").on(table.matchId),
  index("opportunity_engagements_candidate_id_idx").on(table.candidateId),
  index("opportunity_engagements_job_id_idx").on(table.jobId),
  index("opportunity_engagements_company_id_idx").on(table.companyId),
  index("opportunity_engagements_owner_user_id_idx").on(table.ownerUserId),
  index("opportunity_engagements_current_contact_id_idx").on(table.currentContactId),
  index("opportunity_engagements_current_route_id_idx").on(table.currentRouteId),
  index("opportunity_engagements_interview_id_idx").on(table.interviewId),
  index("opportunity_engagements_submission_id_idx").on(table.submissionId),
  index("opportunity_engagements_placement_id_idx").on(table.placementId),
  index("opportunity_engagements_queue_idx").on(
    table.organizationId,
    table.status,
    table.ownerUserId,
    table.nextFollowUpAt,
  ),
  check(
    "opportunity_engagements_mode_chk",
    sql`${table.mode} is null or ${table.mode} in ('authorized_routing', 'public_outreach')`,
  ),
  check(
    "opportunity_engagements_status_chk",
    sql`${table.status} in ('ready_for_review', 'ready_for_outreach', 'routed', 'contacted', 'acknowledged', 'reviewing', 'interested', 'referred', 'interview', 'needs_follow_up', 'needs_information', 'no_fit', 'withdrawn', 'placed', 'closed')`,
  ),
  check(
    "opportunity_engagements_employer_response_chk",
    sql`${table.employerResponse} is null or ${table.employerResponse} in ('interested', 'possible_future_fit', 'not_a_fit', 'refer_to_another_manager', 'needs_more_information', 'no_response')`,
  ),
  check(
    "opportunity_engagements_candidate_response_chk",
    sql`${table.candidateResponse} is null or ${table.candidateResponse} in ('informed', 'interested', 'declined', 'needs_information')`,
  ),
  check(
    "opportunity_engagements_waiting_on_chk",
    sql`${table.waitingOn} in ('recruiter', 'employer', 'candidate')`,
  ),
  check(
    "opportunity_engagements_interview_status_chk",
    sql`${table.interviewStatus} is null or ${table.interviewStatus} in ('requested', 'scheduled', 'completed', 'cancelled')`,
  ),
]);

/** One routing or outreach attempt. A referral adds a row and leaves the earlier row in place. */
export const opportunityEngagementRoutes = pgTable("opportunity_engagement_routes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  engagementId: uuid("engagement_id").notNull(),
  priorRouteId: uuid("prior_route_id"),
  sequence: integer("sequence").notNull(),
  kind: text("kind").notNull(),
  contactId: uuid("contact_id"),
  responseStatus: text("response_status"),
  responseNote: text("response_note"),
  respondedAt: timestamp("responded_at", { withTimezone: true, mode: "date" }),
  respondedByLabel: text("responded_by_label"),
  sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
  followUpAt: timestamp("follow_up_at", { withTimezone: true, mode: "date" }),
  openedAt: timestamp("opened_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  unique("opportunity_engagement_routes_id_organization_uq").on(table.id, table.organizationId),
  unique("opportunity_engagement_routes_engagement_sequence_uq").on(table.engagementId, table.sequence),
  foreignKey({
    columns: [table.engagementId, table.organizationId],
    foreignColumns: [opportunityEngagements.id, opportunityEngagements.organizationId],
    name: "opportunity_engagement_routes_engagement_org_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.contactId, table.organizationId],
    foreignColumns: [contacts.id, contacts.organizationId],
    name: "opportunity_engagement_routes_contact_org_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.priorRouteId, table.organizationId],
    foreignColumns: [table.id, table.organizationId],
    name: "opportunity_engagement_routes_prior_org_fk",
  }).onDelete("restrict"),
  index("opportunity_engagement_routes_organization_id_idx").on(table.organizationId),
  index("opportunity_engagement_routes_engagement_id_idx").on(table.engagementId),
  index("opportunity_engagement_routes_contact_id_idx").on(table.contactId),
  index("opportunity_engagement_routes_prior_route_id_idx").on(table.priorRouteId),
  check(
    "opportunity_engagement_routes_kind_chk",
    sql`${table.kind} in ('talent_review', 'employer_outreach', 'referral')`,
  ),
  check(
    "opportunity_engagement_routes_response_chk",
    sql`${table.responseStatus} is null or ${table.responseStatus} in ('interested', 'possible_future_fit', 'not_a_fit', 'refer_to_another_manager', 'needs_more_information', 'no_response')`,
  ),
]);

/** Draft or delivery record. The body is stored once. A provider event does not copy it again. */
export const opportunityEngagementMessages = pgTable("opportunity_engagement_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  engagementId: uuid("engagement_id").notNull(),
  routeId: uuid("route_id"),
  channel: text("channel").notNull(),
  contactId: uuid("contact_id"),
  recipientLabel: text("recipient_label").notNull(),
  subject: text("subject"),
  template: text("template"),
  body: text("body"),
  deliveryState: text("delivery_state").notNull(),
  provider: text("provider"),
  providerMessageId: text("provider_message_id"),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  draftedAt: timestamp("drafted_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  foreignKey({
    columns: [table.engagementId, table.organizationId],
    foreignColumns: [opportunityEngagements.id, opportunityEngagements.organizationId],
    name: "opportunity_engagement_messages_engagement_org_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.routeId, table.organizationId],
    foreignColumns: [opportunityEngagementRoutes.id, opportunityEngagementRoutes.organizationId],
    name: "opportunity_engagement_messages_route_org_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.contactId, table.organizationId],
    foreignColumns: [contacts.id, contacts.organizationId],
    name: "opportunity_engagement_messages_contact_org_fk",
  }).onDelete("restrict"),
  index("opportunity_engagement_messages_organization_id_idx").on(table.organizationId),
  index("opportunity_engagement_messages_engagement_id_idx").on(table.engagementId),
  index("opportunity_engagement_messages_route_id_idx").on(table.routeId),
  index("opportunity_engagement_messages_contact_id_idx").on(table.contactId),
  index("opportunity_engagement_messages_actor_user_id_idx").on(table.actorUserId),
  check(
    "opportunity_engagement_messages_channel_chk",
    sql`${table.channel} in ('email', 'phone', 'meeting', 'manual')`,
  ),
  check(
    "opportunity_engagement_messages_delivery_chk",
    sql`${table.deliveryState} in ('draft', 'copied', 'manual_sent', 'sent', 'failed', 'not_configured')`,
  ),
]);

export const opportunityEngagementEvents = pgTable("opportunity_engagement_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  engagementId: uuid("engagement_id").notNull(),
  routeId: uuid("route_id"),
  eventType: text("event_type").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  note: text("note"),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.engagementId, table.organizationId],
    foreignColumns: [opportunityEngagements.id, opportunityEngagements.organizationId],
    name: "opportunity_engagement_events_engagement_org_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.routeId, table.organizationId],
    foreignColumns: [opportunityEngagementRoutes.id, opportunityEngagementRoutes.organizationId],
    name: "opportunity_engagement_events_route_org_fk",
  }).onDelete("restrict"),
  index("opportunity_engagement_events_organization_id_idx").on(table.organizationId),
  index("opportunity_engagement_events_engagement_id_idx").on(table.engagementId),
  index("opportunity_engagement_events_route_id_idx").on(table.routeId),
  index("opportunity_engagement_events_actor_user_id_idx").on(table.actorUserId),
  index("opportunity_engagement_events_occurred_at_idx").on(table.occurredAt),
]);

export const careerSourcesRelations = relations(careerSources, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [careerSources.organizationId],
    references: [organizations.id],
  }),
  company: one(companies, { fields: [careerSources.companyId], references: [companies.id] }),
  jobs: many(jobs),
  syncRuns: many(careerSourceSyncRuns),
}));

export const careerSourceSyncRunsRelations = relations(careerSourceSyncRuns, ({ one }) => ({
  organization: one(organizations, {
    fields: [careerSourceSyncRuns.organizationId],
    references: [organizations.id],
  }),
  careerSource: one(careerSources, {
    fields: [careerSourceSyncRuns.careerSourceId],
    references: [careerSources.id],
  }),
  actor: one(users, {
    fields: [careerSourceSyncRuns.actorUserId],
    references: [users.id],
  }),
}));

/**
 * A planning role may correspond to zero, one, or many live jobs.
 * The role is not merged into jobs. Closed jobs stay linked and are not current openings.
 */
export const workforceRoleJobs = pgTable("workforce_role_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  roleId: uuid("role_id").notNull(),
  jobId: uuid("job_id").notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps(),
}, (table) => [
  unique("workforce_role_jobs_role_job_uq").on(table.roleId, table.jobId),
  foreignKey({
    columns: [table.roleId, table.organizationId],
    foreignColumns: [workforceRoles.id, workforceRoles.organizationId],
    name: "workforce_role_jobs_role_org_fk",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.jobId, table.organizationId],
    foreignColumns: [jobs.id, jobs.organizationId],
    name: "workforce_role_jobs_job_org_fk",
  }).onDelete("restrict"),
  index("workforce_role_jobs_organization_id_idx").on(table.organizationId),
  index("workforce_role_jobs_role_id_idx").on(table.roleId),
  index("workforce_role_jobs_job_id_idx").on(table.jobId),
  index("workforce_role_jobs_created_by_idx").on(table.createdByUserId),
]);

export const workforceRoleJobsRelations = relations(workforceRoleJobs, ({ one }) => ({
  role: one(workforceRoles, {
    fields: [workforceRoleJobs.roleId],
    references: [workforceRoles.id],
  }),
  job: one(jobs, {
    fields: [workforceRoleJobs.jobId],
    references: [jobs.id],
  }),
}));

export const jobsRelations = relations(jobs, ({ many, one }) => ({
  skills: many(jobSkills),
  requirements: many(jobRequirements),
  matches: many(candidateJobMatches),
  workforceRoleLinks: many(workforceRoleJobs),
  searchProjects: many(searchProjects),
  company: one(companies, { fields: [jobs.companyId], references: [companies.id] }),
  careerSource: one(careerSources, {
    fields: [jobs.careerSourceId],
    references: [careerSources.id],
  }),
  hiringManager: one(contacts, {
    fields: [jobs.hiringManagerContactId],
    references: [contacts.id],
  }),
}));

export const jobSkillsRelations = relations(jobSkills, ({ one }) => ({
  job: one(jobs, {
    fields: [jobSkills.jobId],
    references: [jobs.id],
  }),
  skill: one(skills, {
    fields: [jobSkills.skillId],
    references: [skills.id],
  }),
}));

export const jobRequirementsRelations = relations(jobRequirements, ({ one }) => ({
  organization: one(organizations, {
    fields: [jobRequirements.organizationId],
    references: [organizations.id],
  }),
  job: one(jobs, {
    fields: [jobRequirements.jobId],
    references: [jobs.id],
  }),
}));

export const searchProjectsRelations = relations(searchProjects, ({ one }) => ({
  job: one(jobs, { fields: [searchProjects.jobId], references: [jobs.id] }),
  company: one(companies, { fields: [searchProjects.companyId], references: [companies.id] }),
  service: one(services, { fields: [searchProjects.serviceId], references: [services.id] }),
}));

export const candidateJobMatchesRelations = relations(candidateJobMatches, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [candidateJobMatches.organizationId],
    references: [organizations.id],
  }),
  candidate: one(candidates, {
    fields: [candidateJobMatches.candidateId],
    references: [candidates.id],
  }),
  job: one(jobs, {
    fields: [candidateJobMatches.jobId],
    references: [jobs.id],
  }),
  factors: many(candidateJobMatchFactors),
  screenings: many(candidateScreenings),
}));

export const candidateJobMatchFactorsRelations = relations(candidateJobMatchFactors, ({ one }) => ({
  organization: one(organizations, {
    fields: [candidateJobMatchFactors.organizationId],
    references: [organizations.id],
  }),
  match: one(candidateJobMatches, {
    fields: [candidateJobMatchFactors.matchId],
    references: [candidateJobMatches.id],
  }),
}));

export const candidateScreeningsRelations = relations(candidateScreenings, ({ one }) => ({
  match: one(candidateJobMatches, {
    fields: [candidateScreenings.matchId],
    references: [candidateJobMatches.id],
  }),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  candidate: one(candidates, { fields: [submissions.candidateId], references: [candidates.id] }),
  job: one(jobs, { fields: [submissions.jobId], references: [jobs.id] }),
  interviews: many(interviews),
}));

export const interviewsRelations = relations(interviews, ({ one }) => ({
  submission: one(submissions, {
    fields: [interviews.submissionId],
    references: [submissions.id],
  }),
  candidate: one(candidates, { fields: [interviews.candidateId], references: [candidates.id] }),
  job: one(jobs, { fields: [interviews.jobId], references: [jobs.id] }),
}));

export const offersRelations = relations(offers, ({ one }) => ({
  candidate: one(candidates, { fields: [offers.candidateId], references: [candidates.id] }),
  job: one(jobs, { fields: [offers.jobId], references: [jobs.id] }),
}));

export const placementsRelations = relations(placements, ({ one, many }) => ({
  candidate: one(candidates, { fields: [placements.candidateId], references: [candidates.id] }),
  job: one(jobs, { fields: [placements.jobId], references: [jobs.id] }),
  guarantees: many(placementGuarantees),
}));

export const placementGuaranteesRelations = relations(placementGuarantees, ({ one }) => ({
  placement: one(placements, {
    fields: [placementGuarantees.placementId],
    references: [placements.id],
  }),
}));

export const opportunityEngagementsRelations = relations(opportunityEngagements, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [opportunityEngagements.organizationId],
    references: [organizations.id],
  }),
  match: one(candidateJobMatches, {
    fields: [opportunityEngagements.matchId],
    references: [candidateJobMatches.id],
  }),
  candidate: one(candidates, {
    fields: [opportunityEngagements.candidateId],
    references: [candidates.id],
  }),
  job: one(jobs, {
    fields: [opportunityEngagements.jobId],
    references: [jobs.id],
  }),
  company: one(companies, {
    fields: [opportunityEngagements.companyId],
    references: [companies.id],
  }),
  owner: one(users, {
    fields: [opportunityEngagements.ownerUserId],
    references: [users.id],
  }),
  contact: one(contacts, {
    fields: [opportunityEngagements.currentContactId],
    references: [contacts.id],
  }),
  routes: many(opportunityEngagementRoutes),
  messages: many(opportunityEngagementMessages),
  events: many(opportunityEngagementEvents),
}));

export const opportunityEngagementRoutesRelations = relations(opportunityEngagementRoutes, ({ one }) => ({
  engagement: one(opportunityEngagements, {
    fields: [opportunityEngagementRoutes.engagementId],
    references: [opportunityEngagements.id],
  }),
  contact: one(contacts, {
    fields: [opportunityEngagementRoutes.contactId],
    references: [contacts.id],
  }),
}));

export const opportunityEngagementMessagesRelations = relations(opportunityEngagementMessages, ({ one }) => ({
  engagement: one(opportunityEngagements, {
    fields: [opportunityEngagementMessages.engagementId],
    references: [opportunityEngagements.id],
  }),
  route: one(opportunityEngagementRoutes, {
    fields: [opportunityEngagementMessages.routeId],
    references: [opportunityEngagementRoutes.id],
  }),
}));

export const opportunityEngagementEventsRelations = relations(opportunityEngagementEvents, ({ one }) => ({
  engagement: one(opportunityEngagements, {
    fields: [opportunityEngagementEvents.engagementId],
    references: [opportunityEngagements.id],
  }),
}));
