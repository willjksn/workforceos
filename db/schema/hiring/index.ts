import { index, integer, jsonb, numeric, pgTable, text, timestamp, unique, uuid, boolean, date } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { organizations, users } from "../core";
import { companies } from "../crm";
import {
  applicationSourceEnum,
  applicationStatusEnum,
  backgroundCheckStatusEnum,
  clientVisibilityEnum,
  drugScreenStatusEnum,
  employeeStatusEnum,
  postingVisibilityEnum,
  questionTypeEnum,
  requisitionStatusEnum,
  scorecardRecommendationEnum,
  publicAccessTokenPurposeEnum,
  transactionalEmailStatusEnum,
} from "../enums";
import { jobs } from "../recruiting";
import { files } from "../system";
import { candidates } from "../talent";

export const jobRequisitions = pgTable("job_requisitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  department: text("department"),
  businessUnit: text("business_unit"),
  hiringManagerUserId: uuid("hiring_manager_user_id").references(() => users.id, { onDelete: "set null" }),
  recruiterUserId: uuid("recruiter_user_id").references(() => users.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  jobFamily: text("job_family"),
  employmentType: text("employment_type"),
  headcount: integer("headcount").notNull().default(1),
  replacementOrGrowth: text("replacement_or_growth"),
  replacementFor: text("replacement_for"),
  reason: text("reason"),
  location: text("location"),
  workplaceType: text("workplace_type"),
  compensationMin: numeric("compensation_min", { precision: 12, scale: 2 }),
  compensationMax: numeric("compensation_max", { precision: 12, scale: 2 }),
  compensationCurrency: text("compensation_currency").notNull().default("USD"),
  budgetStatus: text("budget_status"),
  targetStartDate: date("target_start_date"),
  requestedOpenDate: date("requested_open_date"),
  approvalStatus: text("approval_status").notNull().default("draft"),
  status: requisitionStatusEnum("status").notNull().default("draft"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps(),
}, (table) => [
  index("job_requisitions_organization_id_idx").on(table.organizationId),
  index("job_requisitions_company_id_idx").on(table.companyId),
  index("job_requisitions_hiring_manager_user_id_idx").on(table.hiringManagerUserId),
  index("job_requisitions_recruiter_user_id_idx").on(table.recruiterUserId),
  index("job_requisitions_created_by_user_id_idx").on(table.createdByUserId),
]);

export const jobDescriptionVersions = pgTable("job_description_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "restrict" }),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  aiModel: text("ai_model"),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
  status: text("status").notNull().default("draft"),
  ...timestamps(),
}, (table) => [
  index("job_description_versions_job_id_idx").on(table.jobId),
  unique("job_description_versions_job_version_uq").on(table.jobId, table.version),
  index("job_description_versions_created_by_user_id_idx").on(table.createdByUserId),
  index("job_description_versions_approved_by_user_id_idx").on(table.approvedByUserId),
]);

export const jobPostings = pgTable("job_postings", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "restrict" }),
  requisitionId: uuid("requisition_id").references(() => jobRequisitions.id, { onDelete: "set null" }),
  slug: text("slug").notNull(),
  publicTitle: text("public_title").notNull(),
  publicDescription: text("public_description").notNull(),
  location: text("location"),
  workplaceType: text("workplace_type"),
  employmentType: text("employment_type"),
  salaryDisplay: text("salary_display"),
  companyDisplay: text("company_display"),
  visibility: postingVisibilityEnum("visibility").notNull().default("internal_only"),
  clientVisibility: clientVisibilityEnum("client_visibility").notNull().default("confidential"),
  publicStatus: text("public_status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
  applicationOpen: boolean("application_open").notNull().default(false),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  skillbridgeEligible: boolean("skillbridge_eligible").notNull().default(false),
  skillbridgeDisclaimer: text("skillbridge_disclaimer"),
  ...timestamps(),
}, (table) => [
  index("job_postings_organization_id_idx").on(table.organizationId),
  index("job_postings_job_id_idx").on(table.jobId),
  unique("job_postings_org_slug_uq").on(table.organizationId, table.slug),
  index("job_postings_requisition_id_idx").on(table.requisitionId),
]);

export const applicationForms = pgTable("application_forms", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  jobContextType: text("job_context_type").notNull().default("client"),
  status: text("status").notNull().default("active"),
  ...timestamps(),
}, (table) => [
  index("application_forms_organization_id_idx").on(table.organizationId),
]);

export const applicationFormVersions = pgTable("application_form_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  formId: uuid("form_id").notNull().references(() => applicationForms.id, { onDelete: "restrict" }),
  version: integer("version").notNull(),
  status: text("status").notNull().default("draft"),
  ...timestamps(),
}, (table) => [
  index("application_form_versions_form_id_idx").on(table.formId),
  unique("application_form_versions_form_version_uq").on(table.formId, table.version),
]);

export const applicationQuestions = pgTable("application_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  formVersionId: uuid("form_version_id").notNull().references(() => applicationFormVersions.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  label: text("label").notNull(),
  questionType: questionTypeEnum("question_type").notNull(),
  required: boolean("required").notNull().default(false),
  options: jsonb("options").$type<string[]>(),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps(),
}, (table) => [
  index("application_questions_form_version_id_idx").on(table.formVersionId),
  unique("application_questions_version_key_uq").on(table.formVersionId, table.key),
]);

export const jobApplicationFormLinks = pgTable("job_application_form_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  formId: uuid("form_id").notNull().references(() => applicationForms.id, { onDelete: "restrict" }),
  formVersionId: uuid("form_version_id").references(() => applicationFormVersions.id, { onDelete: "set null" }),
  ...timestamps(),
}, (table) => [
  unique("job_application_form_links_job_uq").on(table.jobId),
  index("job_application_form_links_form_id_idx").on(table.formId),
]);

export const applications = pgTable("applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, { onDelete: "restrict" }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "restrict" }),
  jobPostingId: uuid("job_posting_id").references(() => jobPostings.id, { onDelete: "set null" }),
  source: applicationSourceEnum("source").notNull().default("career_site"),
  sourceDetail: text("source_detail"),
  status: applicationStatusEnum("status").notNull().default("submitted"),
  currentStage: text("current_stage").notNull().default("applied"),
  pipeline: text("pipeline").notNull().default("client"),
  appliedAt: timestamp("applied_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true, mode: "date" }),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  recruiterUserId: uuid("recruiter_user_id").references(() => users.id, { onDelete: "set null" }),
  disposition: text("disposition"),
  dispositionReason: text("disposition_reason"),
  withdrawnAt: timestamp("withdrawn_at", { withTimezone: true, mode: "date" }),
  duplicateReviewRequired: boolean("duplicate_review_required").notNull().default(false),
  ...timestamps(),
}, (table) => [
  index("applications_organization_id_idx").on(table.organizationId),
  index("applications_candidate_id_idx").on(table.candidateId),
  index("applications_job_id_idx").on(table.jobId),
  index("applications_status_idx").on(table.organizationId, table.status),
  index("applications_stage_idx").on(table.organizationId, table.currentStage),
  index("applications_applied_at_idx").on(table.appliedAt),
  index("applications_owner_user_id_idx").on(table.ownerUserId),
  index("applications_job_posting_id_idx").on(table.jobPostingId),
]);

export const applicationAnswers = pgTable("application_answers", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").references(() => applicationQuestions.id, { onDelete: "set null" }),
  questionKey: text("question_key").notNull(),
  answer: text("answer"),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
  ...timestamps(),
}, (table) => [
  index("application_answers_application_id_idx").on(table.applicationId),
  index("application_answers_question_id_idx").on(table.questionId),
  index("application_answers_file_id_idx").on(table.fileId),
]);

export const applicationStageHistory = pgTable("application_stage_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "restrict" }),
  fromStage: text("from_stage"),
  toStage: text("to_stage").notNull(),
  changedByUserId: uuid("changed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason"),
  source: text("source").notNull().default("human"),
  ...timestamps(),
}, (table) => [
  index("application_stage_history_application_id_idx").on(table.applicationId),
  index("application_stage_history_changed_by_user_id_idx").on(table.changedByUserId),
]);

export const interviewPlans = pgTable("interview_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  ...timestamps(),
}, (table) => [
  index("interview_plans_organization_id_idx").on(table.organizationId),
  index("interview_plans_job_id_idx").on(table.jobId),
]);

export const interviewPlanStages = pgTable("interview_plan_stages", {
  id: uuid("id").defaultRandom().primaryKey(),
  planId: uuid("plan_id").notNull().references(() => interviewPlans.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(30),
  interviewType: text("interview_type").notNull().default("video"),
  instructions: text("instructions"),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps(),
}, (table) => [
  index("interview_plan_stages_plan_id_idx").on(table.planId),
]);

export const scorecardTemplates = pgTable("scorecard_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  ...timestamps(),
}, (table) => [
  index("scorecard_templates_organization_id_idx").on(table.organizationId),
]);

export const scorecardQuestions = pgTable("scorecard_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateId: uuid("template_id").notNull().references(() => scorecardTemplates.id, { onDelete: "cascade" }),
  section: text("section").notNull().default("general"),
  prompt: text("prompt").notNull(),
  questionType: text("question_type").notNull().default("rating"),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps(),
}, (table) => [
  index("scorecard_questions_template_id_idx").on(table.templateId),
]);

export const interviewScorecards = pgTable("interview_scorecards", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  interviewId: uuid("interview_id").notNull(),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
  interviewerUserId: uuid("interviewer_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  templateId: uuid("template_id").references(() => scorecardTemplates.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"),
  recommendation: scorecardRecommendationEnum("recommendation"),
  submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("interview_scorecards_organization_id_idx").on(table.organizationId),
  index("interview_scorecards_interview_id_idx").on(table.interviewId),
  index("interview_scorecards_application_id_idx").on(table.applicationId),
  index("interview_scorecards_interviewer_user_id_idx").on(table.interviewerUserId),
]);

export const scorecardResponses = pgTable("scorecard_responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  scorecardId: uuid("scorecard_id").notNull().references(() => interviewScorecards.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").references(() => scorecardQuestions.id, { onDelete: "set null" }),
  rating: integer("rating"),
  answer: text("answer"),
  ...timestamps(),
}, (table) => [
  index("scorecard_responses_scorecard_id_idx").on(table.scorecardId),
]);

export const backgroundChecks = pgTable("background_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, { onDelete: "restrict" }),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  provider: text("provider").notNull().default("manual"),
  providerCandidateId: text("provider_candidate_id"),
  providerReportId: text("provider_report_id"),
  status: backgroundCheckStatusEnum("status").notNull().default("not_started"),
  requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" }),
  consentStatus: text("consent_status").notNull().default("unknown"),
  invitationSentAt: timestamp("invitation_sent_at", { withTimezone: true, mode: "date" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  resultSummary: text("result_summary"),
  reviewStatus: text("review_status").notNull().default("pending"),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("background_checks_organization_id_idx").on(table.organizationId),
  index("background_checks_candidate_id_idx").on(table.candidateId),
  index("background_checks_application_id_idx").on(table.applicationId),
]);

export const drugScreens = pgTable("drug_screens", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, { onDelete: "restrict" }),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  provider: text("provider").notNull().default("manual"),
  status: drugScreenStatusEnum("status").notNull().default("not_started"),
  orderedAt: timestamp("ordered_at", { withTimezone: true, mode: "date" }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }),
  collectionSite: text("collection_site"),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  resultStatus: text("result_status"),
  reviewRequired: boolean("review_required").notNull().default(true),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  ...timestamps(),
}, (table) => [
  index("drug_screens_organization_id_idx").on(table.organizationId),
  index("drug_screens_candidate_id_idx").on(table.candidateId),
  index("drug_screens_application_id_idx").on(table.applicationId),
]);

export const preEmploymentRequirements = pgTable("pre_employment_requirements", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  checkType: text("check_type").notNull(),
  required: boolean("required").notNull().default(true),
  ...timestamps(),
}, (table) => [
  index("pre_employment_requirements_job_id_idx").on(table.jobId),
  unique("pre_employment_requirements_job_type_uq").on(table.jobId, table.checkType),
]);

export const applicationPreEmploymentChecks = pgTable("application_pre_employment_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  checkType: text("check_type").notNull(),
  status: text("status").notNull().default("not_started"),
  ...timestamps(),
}, (table) => [
  index("application_pre_employment_checks_application_id_idx").on(table.applicationId),
]);

export const referenceChecks = pgTable("reference_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  relationship: text("relationship"),
  contact: text("contact"),
  requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  notes: text("notes"),
  review: text("review"),
  ...timestamps(),
}, (table) => [
  index("reference_checks_application_id_idx").on(table.applicationId),
]);

export const prehireRecords = pgTable("prehire_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "restrict" }),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, { onDelete: "restrict" }),
  startDate: date("start_date"),
  managerUserId: uuid("manager_user_id").references(() => users.id, { onDelete: "set null" }),
  location: text("location"),
  blockers: text("blockers"),
  ...timestamps(),
}, (table) => [
  unique("prehire_records_application_uq").on(table.applicationId),
  index("prehire_records_candidate_id_idx").on(table.candidateId),
]);

export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, { onDelete: "restrict" }),
  employeeNumber: text("employee_number"),
  status: employeeStatusEnum("status").notNull().default("prehire"),
  hireDate: date("hire_date"),
  startDate: date("start_date"),
  jobTitle: text("job_title"),
  department: text("department"),
  managerEmployeeId: uuid("manager_employee_id"),
  workLocation: text("work_location"),
  employmentType: text("employment_type"),
  workEmail: text("work_email"),
  terminatedAt: timestamp("terminated_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("employees_organization_id_idx").on(table.organizationId),
  index("employees_candidate_id_idx").on(table.candidateId),
  unique("employees_org_candidate_uq").on(table.organizationId, table.candidateId),
]);

export const onboardingTemplates = pgTable("onboarding_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  ...timestamps(),
}, (table) => [
  unique("onboarding_templates_org_slug_uq").on(table.organizationId, table.slug),
]);

export const onboardingTemplateTasks = pgTable("onboarding_template_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateId: uuid("template_id").notNull().references(() => onboardingTemplates.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  ownerRole: text("owner_role").notNull().default("new_hire"),
  dueOffsetDays: integer("due_offset_days").notNull().default(0),
  phase: text("phase").notNull().default("before_start"),
  blocking: boolean("blocking").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps(),
}, (table) => [
  index("onboarding_template_tasks_template_id_idx").on(table.templateId),
]);

export const onboardingInstances = pgTable("onboarding_instances", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "restrict" }),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "set null" }),
  templateId: uuid("template_id").references(() => onboardingTemplates.id, { onDelete: "set null" }),
  startDate: date("start_date"),
  status: text("status").notNull().default("active"),
  ...timestamps(),
}, (table) => [
  unique("onboarding_instances_application_uq").on(table.applicationId),
  index("onboarding_instances_employee_id_idx").on(table.employeeId),
]);

export const onboardingTasks = pgTable("onboarding_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  instanceId: uuid("instance_id").notNull().references(() => onboardingInstances.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  ownerRole: text("owner_role").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
  status: text("status").notNull().default("pending"),
  phase: text("phase").notNull().default("before_start"),
  blocking: boolean("blocking").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("onboarding_tasks_instance_id_idx").on(table.instanceId),
]);

export const transactionalEmailEvents = pgTable("transactional_email_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  provider: text("provider").notNull(),
  template: text("template").notNull(),
  recipient: text("recipient").notNull(),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  status: transactionalEmailStatusEnum("status").notNull().default("queued"),
  providerMessageId: text("provider_message_id"),
  error: text("error"),
  sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("transactional_email_events_organization_id_idx").on(table.organizationId),
  index("transactional_email_events_entity_idx").on(table.entityType, table.entityId),
]);

export const interviewCalendarEvents = pgTable("interview_calendar_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  interviewId: uuid("interview_id").notNull(),
  provider: text("provider").notNull(),
  externalEventId: text("external_event_id"),
  calendarOwner: text("calendar_owner"),
  startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }).notNull(),
  timezone: text("timezone").notNull().default("America/New_York"),
  meetingUrl: text("meeting_url"),
  status: text("status").notNull().default("scheduled"),
  ...timestamps(),
}, (table) => [
  unique("interview_calendar_events_interview_uq").on(table.interviewId),
]);

export const candidateDedupeFlags = pgTable("candidate_dedupe_flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
  candidateIds: jsonb("candidate_ids").$type<string[]>().notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending_review"),
  ...timestamps(),
}, (table) => [
  index("candidate_dedupe_flags_organization_id_idx").on(table.organizationId),
]);

/** Tokenized public ATS links. Not a client SaaS login and not PierOne staff Academy onboarding. */
export const publicAccessTokens = pgTable("public_access_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  purpose: publicAccessTokenPurposeEnum("purpose").notNull(),
  tokenHash: text("token_hash").notNull(),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "restrict" }),
  onboardingInstanceId: uuid("onboarding_instance_id").references(() => onboardingInstances.id, { onDelete: "restrict" }),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps(),
}, (table) => [
  unique("public_access_tokens_token_hash_uq").on(table.tokenHash),
  index("public_access_tokens_organization_id_idx").on(table.organizationId),
  index("public_access_tokens_application_id_idx").on(table.applicationId),
  index("public_access_tokens_onboarding_instance_id_idx").on(table.onboardingInstanceId),
  index("public_access_tokens_created_by_user_id_idx").on(table.createdByUserId),
  index("public_access_tokens_purpose_expires_idx").on(table.purpose, table.expiresAt),
]);
