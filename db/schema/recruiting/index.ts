import { relations, sql } from "drizzle-orm";
import { index, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { companies, opportunities } from "../crm";
import { organizations, users } from "../core";
import {
  candidatePipelineStatusEnum,
  interviewStatusEnum,
  jobStatusEnum,
  offerStatusEnum,
  skillRequirementTypeEnum,
} from "../enums";
import { candidates } from "../talent";
import { skills } from "../workforce";

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  status: jobStatusEnum("status").notNull().default("draft"),
  description: text("description"),
  ...timestamps(),
}, (table) => [
  index("jobs_organization_id_idx").on(table.organizationId),
  index("jobs_company_id_idx").on(table.companyId),
  index("jobs_title_trgm_idx").using("gin", sql`${table.title} gin_trgm_ops`),
]);

export const jobSkills = pgTable("job_skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "restrict" }),
  requirementType: skillRequirementTypeEnum("requirement_type").notNull().default("required"),
  ...timestamps(),
}, (table) => [
  index("job_skills_job_id_idx").on(table.jobId),
  index("job_skills_skill_id_idx").on(table.skillId),
  unique("job_skills_job_skill_uq").on(table.jobId, table.skillId),
]);

export const searchProjects = pgTable("search_projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  internalSearchCompletedAt: timestamp("internal_search_completed_at", {
    withTimezone: true,
    mode: "date",
  }),
  ...timestamps(),
}, (table) => [
  index("search_projects_job_id_idx").on(table.jobId),
]);

export const candidateJobMatches = pgTable("candidate_job_matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, {
    onDelete: "restrict",
  }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "restrict" }),
  score: numeric("score", { precision: 5, scale: 2 }).notNull(),
  explanation: text("explanation"),
  pipelineStatus: candidatePipelineStatusEnum("pipeline_status").notNull().default("sourced"),
  ...timestamps(),
}, (table) => [
  index("candidate_job_matches_candidate_id_idx").on(table.candidateId),
  index("candidate_job_matches_job_id_idx").on(table.jobId),
  unique("candidate_job_matches_candidate_job_uq").on(table.candidateId, table.jobId),
]);

export const submissions = pgTable("submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, {
    onDelete: "restrict",
  }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "restrict" }),
  submittedByUserId: uuid("submitted_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  notes: text("notes"),
  ...timestamps(),
}, (table) => [
  index("submissions_candidate_id_idx").on(table.candidateId),
  index("submissions_job_id_idx").on(table.jobId),
  index("submissions_submitted_by_user_id_idx").on(table.submittedByUserId),
]);

export const interviews = pgTable("interviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  submissionId: uuid("submission_id").notNull().references(() => submissions.id, {
    onDelete: "restrict",
  }),
  status: interviewStatusEnum("status").notNull().default("scheduled"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: "date" }),
  notes: text("notes"),
  ...timestamps(),
}, (table) => [
  index("interviews_submission_id_idx").on(table.submissionId),
]);

export const offers = pgTable("offers", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, {
    onDelete: "restrict",
  }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "restrict" }),
  status: offerStatusEnum("status").notNull().default("draft"),
  notes: text("notes"),
  ...timestamps(),
}, (table) => [
  index("offers_candidate_id_idx").on(table.candidateId),
  index("offers_job_id_idx").on(table.jobId),
]);

export const placements = pgTable("placements", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, {
    onDelete: "restrict",
  }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "restrict" }),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, {
    onDelete: "set null",
  }),
  startDate: timestamp("start_date", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("placements_candidate_id_idx").on(table.candidateId),
  index("placements_job_id_idx").on(table.jobId),
  index("placements_opportunity_id_idx").on(table.opportunityId),
]);

export const jobsRelations = relations(jobs, ({ many }) => ({
  skills: many(jobSkills),
  matches: many(candidateJobMatches),
  searchProjects: many(searchProjects),
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

export const candidateJobMatchesRelations = relations(candidateJobMatches, ({ one }) => ({
  candidate: one(candidates, {
    fields: [candidateJobMatches.candidateId],
    references: [candidates.id],
  }),
  job: one(jobs, {
    fields: [candidateJobMatches.jobId],
    references: [jobs.id],
  }),
}));
