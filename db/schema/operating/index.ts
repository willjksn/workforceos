import { relations } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { agents, organizations, users } from "../core";
import { companies, contacts, opportunities } from "../crm";
import {
  activityTypeEnum,
  designationTypeEnum,
  engagementDirectionEnum,
  engagementTypeEnum,
  inAppNotificationKindEnum,
} from "../enums";
import { jobs } from "../recruiting";
import { candidates } from "../talent";

export const activities = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  activityType: activityTypeEnum("activity_type").notNull(),
  subject: text("subject").notNull(),
  details: text("details"),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "set null" }),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
  nextAction: text("next_action"),
  followUpAt: timestamp("follow_up_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("activities_organization_id_idx").on(table.organizationId),
  index("activities_created_by_user_id_idx").on(table.createdByUserId),
  index("activities_company_id_idx").on(table.companyId),
  index("activities_contact_id_idx").on(table.contactId),
  index("activities_candidate_id_idx").on(table.candidateId),
  index("activities_opportunity_id_idx").on(table.opportunityId),
  index("activities_occurred_at_idx").on(table.occurredAt),
]);

export const candidateEngagements = pgTable("candidate_engagements", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, {
    onDelete: "restrict",
  }),
  engagementType: engagementTypeEnum("engagement_type").notNull(),
  channel: text("channel"),
  subject: text("subject"),
  summary: text("summary"),
  direction: engagementDirectionEnum("direction").notNull().default("outbound"),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  responseStatus: text("response_status"),
  relatedCompanyId: uuid("related_company_id").references(() => companies.id, {
    onDelete: "set null",
  }),
  relatedJobId: uuid("related_job_id").references(() => jobs.id, { onDelete: "set null" }),
  nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("candidate_engagements_candidate_id_idx").on(table.candidateId),
  index("candidate_engagements_user_id_idx").on(table.userId),
  index("candidate_engagements_agent_id_idx").on(table.agentId),
  index("candidate_engagements_related_company_id_idx").on(table.relatedCompanyId),
  index("candidate_engagements_related_job_id_idx").on(table.relatedJobId),
]);

export const candidateDesignations = pgTable("candidate_designations", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id, {
    onDelete: "restrict",
  }),
  designationType: designationTypeEnum("designation_type").notNull(),
  relatedJobId: uuid("related_job_id").references(() => jobs.id, { onDelete: "set null" }),
  relatedCompanyId: uuid("related_company_id").references(() => companies.id, {
    onDelete: "set null",
  }),
  reason: text("reason"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  ...timestamps(),
}, (table) => [
  index("candidate_designations_candidate_id_idx").on(table.candidateId),
  index("candidate_designations_related_job_id_idx").on(table.relatedJobId),
  index("candidate_designations_related_company_id_idx").on(table.relatedCompanyId),
  index("candidate_designations_created_by_user_id_idx").on(table.createdByUserId),
]);

export const savedViews = pgTable("saved_views", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  module: text("module").notNull(),
  name: text("name").notNull(),
  filters: jsonb("filters").notNull(),
  sort: text("sort"),
  visibleColumns: jsonb("visible_columns"),
  isDefault: boolean("is_default").notNull().default(false),
  shared: boolean("shared").notNull().default(false),
  ...timestamps(),
}, (table) => [
  index("saved_views_organization_id_idx").on(table.organizationId),
  index("saved_views_user_id_idx").on(table.userId),
  unique("saved_views_user_module_name_uq").on(table.userId, table.module, table.name),
]);

export const inAppNotifications = pgTable("in_app_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: inAppNotificationKindEnum("kind").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  href: text("href"),
  recordType: text("record_type"),
  recordId: uuid("record_id"),
  readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("in_app_notifications_organization_id_idx").on(table.organizationId),
  index("in_app_notifications_user_id_idx").on(table.userId),
  index("in_app_notifications_user_read_idx").on(table.userId, table.readAt),
  uniqueIndex("in_app_notifications_user_kind_record_uq").on(table.userId, table.kind, table.recordId),
]);

export const activitiesRelations = relations(activities, ({ one }) => ({
  company: one(companies, {
    fields: [activities.companyId],
    references: [companies.id],
  }),
  contact: one(contacts, {
    fields: [activities.contactId],
    references: [contacts.id],
  }),
  candidate: one(candidates, {
    fields: [activities.candidateId],
    references: [candidates.id],
  }),
  opportunity: one(opportunities, {
    fields: [activities.opportunityId],
    references: [opportunities.id],
  }),
}));
