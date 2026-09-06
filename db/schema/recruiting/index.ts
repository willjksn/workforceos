import { relations, sql } from "drizzle-orm";
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
import { organizations, users } from "../core";
import { companies, companyLocations, contacts, opportunities } from "../crm";
import {
  candidatePipelineStatusEnum,
  clientVisibilityEnum,
  guaranteeStatusEnum,
  interviewStatusEnum,
  jobContextTypeEnum,
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
]);

export const jobSkills = pgTable("job_skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "restrict" }),
  requirementType: skillRequirementTypeEnum("requirement_type").notNull().default("required"),
  minimumYears: integer("minimum_years"),
  importanceWeight: integer("importance_weight").notNull().default(1),
  humanVerified: boolean("human_verified").notNull().default(false),
  ...timestamps(),
}, (table) => [
  index("job_skills_job_id_idx").on(table.jobId),
  index("job_skills_skill_id_idx").on(table.skillId),
  unique("job_skills_job_skill_uq").on(table.jobId, table.skillId),
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
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, {
    onDelete: "restrict",
  }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "restrict" }),
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
  ...timestamps(),
}, (table) => [
  index("candidate_job_matches_candidate_id_idx").on(table.candidateId),
  index("candidate_job_matches_job_id_idx").on(table.jobId),
  index("candidate_job_matches_human_reviewed_by_user_id_idx").on(table.humanReviewedByUserId),
  unique("candidate_job_matches_candidate_job_uq").on(table.candidateId, table.jobId),
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

export const jobsRelations = relations(jobs, ({ many, one }) => ({
  skills: many(jobSkills),
  matches: many(candidateJobMatches),
  searchProjects: many(searchProjects),
  company: one(companies, { fields: [jobs.companyId], references: [companies.id] }),
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

export const searchProjectsRelations = relations(searchProjects, ({ one }) => ({
  job: one(jobs, { fields: [searchProjects.jobId], references: [jobs.id] }),
  company: one(companies, { fields: [searchProjects.companyId], references: [companies.id] }),
  service: one(services, { fields: [searchProjects.serviceId], references: [services.id] }),
}));

export const candidateJobMatchesRelations = relations(candidateJobMatches, ({ one, many }) => ({
  candidate: one(candidates, {
    fields: [candidateJobMatches.candidateId],
    references: [candidates.id],
  }),
  job: one(jobs, {
    fields: [candidateJobMatches.jobId],
    references: [jobs.id],
  }),
  screenings: many(candidateScreenings),
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
