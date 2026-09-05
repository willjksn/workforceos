import { relations } from "drizzle-orm";
import {
  boolean,
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
import { companies, opportunities } from "../crm";
import {
  militaryBranchEnum,
  skillbridgeAlertRuleCodeEnum,
  skillbridgeApprovalStatusEnum,
  skillbridgeCandidateStatusEnum,
  skillbridgeDocumentTypeEnum,
  skillbridgeIdealEmployerKindEnum,
  skillbridgeNoteKindEnum,
  skillbridgeNoteVisibilityEnum,
  skillbridgeOpportunityStageEnum,
  skillbridgeResumeStatusEnum,
  taskPriorityEnum,
} from "../enums";
import { militaryInstallations, militaryOccupations } from "../military";
import { jobs, searchProjects } from "../recruiting";
import { files } from "../system";
import { candidates } from "../talent";
import { civilianOccupations } from "../workforce";

export const skillbridgeProfiles = pgTable("skillbridge_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, {
    onDelete: "restrict",
  }),
  branch: militaryBranchEnum("branch"),
  militaryOccupationId: uuid("military_occupation_id").references(() => militaryOccupations.id, {
    onDelete: "set null",
  }),
  mosRateAfscDisplay: text("mos_rate_afsc_display"),
  rankCode: text("rank_code"),
  rankTitle: text("rank_title"),
  payGrade: text("pay_grade"),
  currentInstallationId: uuid("current_installation_id").references(() => militaryInstallations.id, {
    onDelete: "set null",
  }),
  currentDutyLocation: text("current_duty_location"),
  yearsOfService: integer("years_of_service"),
  endOfServiceDate: timestamp("end_of_service_date", { withTimezone: true, mode: "date" }),
  separationDate: timestamp("separation_date", { withTimezone: true, mode: "date" }),
  retirementDate: timestamp("retirement_date", { withTimezone: true, mode: "date" }),
  skillbridgeEligibilityDate: timestamp("skillbridge_eligibility_date", { withTimezone: true, mode: "date" }),
  skillbridgeWindowStart: timestamp("skillbridge_window_start", { withTimezone: true, mode: "date" }),
  skillbridgeWindowEnd: timestamp("skillbridge_window_end", { withTimezone: true, mode: "date" }),
  terminalLeaveStart: timestamp("terminal_leave_start", { withTimezone: true, mode: "date" }),
  candidateAvailableDate: timestamp("candidate_available_date", { withTimezone: true, mode: "date" }),
  skillbridgeApprovalStatus: skillbridgeApprovalStatusEnum("skillbridge_approval_status")
    .notNull()
    .default("unknown"),
  preferredLocationPrimary: text("preferred_location_primary"),
  relocationWillingness: text("relocation_willingness"),
  remotePreference: text("remote_preference"),
  idealIndustry: text("ideal_industry"),
  idealEmployerKind: skillbridgeIdealEmployerKindEnum("ideal_employer_kind")
    .notNull()
    .default("no_preference"),
  idealEmployer: text("ideal_employer"),
  idealEmployerNotes: text("ideal_employer_notes"),
  candidateStatus: skillbridgeCandidateStatusEnum("candidate_status").notNull().default("new"),
  resumeStatus: skillbridgeResumeStatusEnum("resume_status").notNull().default("missing"),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true, mode: "date" }),
  nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true, mode: "date" }),
  nextAction: text("next_action"),
  nextActionDueAt: timestamp("next_action_due_at", { withTimezone: true, mode: "date" }),
  nextActionPriority: taskPriorityEnum("next_action_priority").notNull().default("normal"),
  developmentFixture: boolean("development_fixture").notNull().default(false),
  ...timestamps(),
}, (table) => [
  unique("skillbridge_profiles_candidate_id_uq").on(table.candidateId),
  index("skillbridge_profiles_organization_id_idx").on(table.organizationId),
  index("skillbridge_profiles_candidate_id_idx").on(table.candidateId),
  index("skillbridge_profiles_military_occupation_id_idx").on(table.militaryOccupationId),
  index("skillbridge_profiles_current_installation_id_idx").on(table.currentInstallationId),
  index("skillbridge_profiles_owner_user_id_idx").on(table.ownerUserId),
  index("skillbridge_profiles_org_status_idx").on(table.organizationId, table.candidateStatus),
  index("skillbridge_profiles_window_start_idx").on(table.skillbridgeWindowStart),
  index("skillbridge_profiles_next_follow_up_idx").on(table.nextFollowUpAt),
  index("skillbridge_profiles_next_action_due_idx").on(table.nextActionDueAt),
]);

export const skillbridgePreferredLocations = pgTable("skillbridge_preferred_locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  skillbridgeProfileId: uuid("skillbridge_profile_id")
    .notNull()
    .references(() => skillbridgeProfiles.id, { onDelete: "cascade" }),
  locationLabel: text("location_label").notNull(),
  city: text("city"),
  region: text("region"),
  isPrimary: boolean("is_primary").notNull().default(false),
  ...timestamps(),
}, (table) => [
  index("skillbridge_preferred_locations_profile_id_idx").on(table.skillbridgeProfileId),
  unique("skillbridge_preferred_locations_profile_label_uq").on(
    table.skillbridgeProfileId,
    table.locationLabel,
  ),
]);

export const skillbridgeTargetRoles = pgTable("skillbridge_target_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  skillbridgeProfileId: uuid("skillbridge_profile_id")
    .notNull()
    .references(() => skillbridgeProfiles.id, { onDelete: "cascade" }),
  roleTitle: text("role_title").notNull(),
  civilianOccupationId: uuid("civilian_occupation_id").references(() => civilianOccupations.id, {
    onDelete: "set null",
  }),
  isPrimary: boolean("is_primary").notNull().default(false),
  ...timestamps(),
}, (table) => [
  index("skillbridge_target_roles_profile_id_idx").on(table.skillbridgeProfileId),
  index("skillbridge_target_roles_occupation_id_idx").on(table.civilianOccupationId),
  unique("skillbridge_target_roles_profile_title_uq").on(table.skillbridgeProfileId, table.roleTitle),
]);

export const skillbridgeOpportunities = pgTable("skillbridge_opportunities", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  skillbridgeProfileId: uuid("skillbridge_profile_id")
    .notNull()
    .references(() => skillbridgeProfiles.id, { onDelete: "restrict" }),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
  searchProjectId: uuid("search_project_id").references(() => searchProjects.id, {
    onDelete: "set null",
  }),
  stage: skillbridgeOpportunityStageEnum("stage").notNull().default("candidate_identified"),
  source: text("source"),
  matchScore: numeric("match_score", { precision: 5, scale: 2 }),
  matchExplanation: text("match_explanation"),
  candidateInterest: text("candidate_interest"),
  employerInterest: text("employer_interest"),
  submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
  lastEmployerContactAt: timestamp("last_employer_contact_at", { withTimezone: true, mode: "date" }),
  lastCandidateContactAt: timestamp("last_candidate_contact_at", { withTimezone: true, mode: "date" }),
  nextAction: text("next_action"),
  nextActionDueAt: timestamp("next_action_due_at", { withTimezone: true, mode: "date" }),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  outcome: text("outcome"),
  outcomeReason: text("outcome_reason"),
  ...timestamps(),
}, (table) => [
  index("skillbridge_opportunities_organization_id_idx").on(table.organizationId),
  index("skillbridge_opportunities_profile_id_idx").on(table.skillbridgeProfileId),
  index("skillbridge_opportunities_candidate_id_idx").on(table.candidateId),
  index("skillbridge_opportunities_company_id_idx").on(table.companyId),
  index("skillbridge_opportunities_job_id_idx").on(table.jobId),
  index("skillbridge_opportunities_opportunity_id_idx").on(table.opportunityId),
  index("skillbridge_opportunities_search_project_id_idx").on(table.searchProjectId),
  index("skillbridge_opportunities_owner_user_id_idx").on(table.ownerUserId),
  index("skillbridge_opportunities_org_stage_idx").on(table.organizationId, table.stage),
]);

export const skillbridgeOpportunityStageHistory = pgTable("skillbridge_opportunity_stage_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  skillbridgeOpportunityId: uuid("skillbridge_opportunity_id")
    .notNull()
    .references(() => skillbridgeOpportunities.id, { onDelete: "cascade" }),
  fromStage: skillbridgeOpportunityStageEnum("from_stage"),
  toStage: skillbridgeOpportunityStageEnum("to_stage").notNull(),
  changedByUserId: uuid("changed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  changedAt: timestamp("changed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  note: text("note"),
}, (table) => [
  index("skillbridge_opportunity_stage_history_opp_id_idx").on(table.skillbridgeOpportunityId),
  index("skillbridge_opportunity_stage_history_changed_by_idx").on(table.changedByUserId),
]);

export const skillbridgeNotes = pgTable("skillbridge_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  skillbridgeProfileId: uuid("skillbridge_profile_id")
    .notNull()
    .references(() => skillbridgeProfiles.id, { onDelete: "cascade" }),
  skillbridgeOpportunityId: uuid("skillbridge_opportunity_id").references(
    () => skillbridgeOpportunities.id,
    { onDelete: "set null" },
  ),
  kind: skillbridgeNoteKindEnum("kind").notNull().default("other"),
  visibility: skillbridgeNoteVisibilityEnum("visibility").notNull().default("internal"),
  body: text("body").notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps(),
}, (table) => [
  index("skillbridge_notes_organization_id_idx").on(table.organizationId),
  index("skillbridge_notes_profile_id_idx").on(table.skillbridgeProfileId),
  index("skillbridge_notes_opportunity_id_idx").on(table.skillbridgeOpportunityId),
  index("skillbridge_notes_created_by_user_id_idx").on(table.createdByUserId),
]);

export const skillbridgeDocuments = pgTable("skillbridge_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  skillbridgeProfileId: uuid("skillbridge_profile_id")
    .notNull()
    .references(() => skillbridgeProfiles.id, { onDelete: "cascade" }),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, {
    onDelete: "restrict",
  }),
  fileId: uuid("file_id").notNull().references(() => files.id, { onDelete: "restrict" }),
  documentType: skillbridgeDocumentTypeEnum("document_type").notNull().default("other"),
  isCurrent: boolean("is_current").notNull().default(true),
  ...timestamps(),
}, (table) => [
  index("skillbridge_documents_organization_id_idx").on(table.organizationId),
  index("skillbridge_documents_profile_id_idx").on(table.skillbridgeProfileId),
  index("skillbridge_documents_candidate_id_idx").on(table.candidateId),
  index("skillbridge_documents_file_id_idx").on(table.fileId),
]);

export const skillbridgeAlertRules = pgTable("skillbridge_alert_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  code: skillbridgeAlertRuleCodeEnum("code").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  thresholdDays: integer("threshold_days").notNull(),
  ...timestamps(),
}, (table) => [
  unique("skillbridge_alert_rules_org_code_uq").on(table.organizationId, table.code),
  index("skillbridge_alert_rules_organization_id_idx").on(table.organizationId),
]);

export const skillbridgeProfilesRelations = relations(skillbridgeProfiles, ({ one, many }) => ({
  candidate: one(candidates, {
    fields: [skillbridgeProfiles.candidateId],
    references: [candidates.id],
  }),
  occupation: one(militaryOccupations, {
    fields: [skillbridgeProfiles.militaryOccupationId],
    references: [militaryOccupations.id],
  }),
  installation: one(militaryInstallations, {
    fields: [skillbridgeProfiles.currentInstallationId],
    references: [militaryInstallations.id],
  }),
  owner: one(users, {
    fields: [skillbridgeProfiles.ownerUserId],
    references: [users.id],
  }),
  preferredLocations: many(skillbridgePreferredLocations),
  targetRoles: many(skillbridgeTargetRoles),
  opportunities: many(skillbridgeOpportunities),
  notes: many(skillbridgeNotes),
  documents: many(skillbridgeDocuments),
}));

export const skillbridgePreferredLocationsRelations = relations(
  skillbridgePreferredLocations,
  ({ one }) => ({
    profile: one(skillbridgeProfiles, {
      fields: [skillbridgePreferredLocations.skillbridgeProfileId],
      references: [skillbridgeProfiles.id],
    }),
  }),
);

export const skillbridgeTargetRolesRelations = relations(skillbridgeTargetRoles, ({ one }) => ({
  profile: one(skillbridgeProfiles, {
    fields: [skillbridgeTargetRoles.skillbridgeProfileId],
    references: [skillbridgeProfiles.id],
  }),
  occupation: one(civilianOccupations, {
    fields: [skillbridgeTargetRoles.civilianOccupationId],
    references: [civilianOccupations.id],
  }),
}));

export const skillbridgeOpportunitiesRelations = relations(
  skillbridgeOpportunities,
  ({ one, many }) => ({
    profile: one(skillbridgeProfiles, {
      fields: [skillbridgeOpportunities.skillbridgeProfileId],
      references: [skillbridgeProfiles.id],
    }),
    candidate: one(candidates, {
      fields: [skillbridgeOpportunities.candidateId],
      references: [candidates.id],
    }),
    company: one(companies, {
      fields: [skillbridgeOpportunities.companyId],
      references: [companies.id],
    }),
    job: one(jobs, {
      fields: [skillbridgeOpportunities.jobId],
      references: [jobs.id],
    }),
    stageHistory: many(skillbridgeOpportunityStageHistory),
  }),
);

export const skillbridgeOpportunityStageHistoryRelations = relations(
  skillbridgeOpportunityStageHistory,
  ({ one }) => ({
    opportunity: one(skillbridgeOpportunities, {
      fields: [skillbridgeOpportunityStageHistory.skillbridgeOpportunityId],
      references: [skillbridgeOpportunities.id],
    }),
  }),
);
