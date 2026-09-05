import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { boolean, date, index, integer, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { organizations, users } from "../core";
import {
  clientStatusEnum,
  companyTypeEnum,
  opportunityScoreBandEnum,
  opportunityStageEnum,
  relationshipStrengthEnum,
  signalReviewStatusEnum,
  signalTypeEnum,
} from "../enums";

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  name: text("name").notNull(),
  companyType: companyTypeEnum("company_type").notNull().default("prospect"),
  clientStatus: clientStatusEnum("client_status").notNull().default("prospect"),
  relationshipStrength: relationshipStrengthEnum("relationship_strength")
    .notNull()
    .default("unknown"),
  website: text("website"),
  industry: text("industry"),
  subIndustry: text("sub_industry"),
  employeeCount: integer("employee_count"),
  annualRevenue: numeric("annual_revenue", { precision: 14, scale: 2 }),
  accountOwnerUserId: uuid("account_owner_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  militaryFitScore: integer("military_fit_score"),
  workforceOpportunityScore: integer("workforce_opportunity_score"),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true, mode: "date" }),
  nextAction: text("next_action"),
  nextActionAt: timestamp("next_action_at", { withTimezone: true, mode: "date" }),
  notes: text("notes"),
  ...timestamps(),
}, (table) => [
  index("companies_organization_id_idx").on(table.organizationId),
  index("companies_account_owner_user_id_idx").on(table.accountOwnerUserId),
  index("companies_name_trgm_idx").using("gin", sql`${table.name} gin_trgm_ops`),
]);

export const companyLocations = pgTable("company_locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  city: text("city"),
  region: text("region"),
  country: text("country"),
  isPrimary: boolean("is_primary").notNull().default(false),
  ...timestamps(),
}, (table) => [
  index("company_locations_company_id_idx").on(table.companyId),
]);

export const contacts = pgTable("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  title: text("title"),
  department: text("department"),
  buyerPersona: text("buyer_persona"),
  seniority: text("seniority"),
  influenceLevel: text("influence_level"),
  relationshipStrength: relationshipStrengthEnum("relationship_strength")
    .notNull()
    .default("unknown"),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true, mode: "date" }),
  doNotContact: boolean("do_not_contact").notNull().default(false),
  communicationPreferences: text("communication_preferences"),
  ...timestamps(),
}, (table) => [
  index("contacts_organization_id_idx").on(table.organizationId),
  index("contacts_owner_user_id_idx").on(table.ownerUserId),
  index("contacts_org_last_contacted_idx").on(table.organizationId, table.lastContactedAt),
]);

export const companyContacts = pgTable("company_contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "restrict" }),
  roleTitle: text("role_title"),
  isPrimary: boolean("is_primary").notNull().default(false),
  ...timestamps(),
}, (table) => [
  index("company_contacts_company_id_idx").on(table.companyId),
  index("company_contacts_contact_id_idx").on(table.contactId),
  unique("company_contacts_company_contact_uq").on(table.companyId, table.contactId),
]);

export const opportunitySignals = pgTable("opportunity_signals", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  signalType: signalTypeEnum("signal_type").notNull(),
  title: text("title").notNull(),
  details: text("details"),
  evidence: text("evidence"),
  source: text("source"),
  confidence: integer("confidence"),
  businessImpact: text("business_impact"),
  reviewStatus: signalReviewStatusEnum("review_status").notNull().default("draft"),
  resultingOpportunityId: uuid("resulting_opportunity_id").references(() => opportunities.id, {
    onDelete: "set null",
  }),
  detectedAt: timestamp("detected_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  ...timestamps(),
}, (table) => [
  index("opportunity_signals_company_id_idx").on(table.companyId),
  index("opportunity_signals_resulting_opportunity_id_idx").on(table.resultingOpportunityId),
]);

export const opportunities = pgTable("opportunities", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  stage: opportunityStageEnum("stage").notNull().default("identified"),
  serviceCode: text("service_code"),
  valueAmount: numeric("value_amount", { precision: 12, scale: 2 }),
  probability: integer("probability"),
  opportunityScore: integer("opportunity_score"),
  scoreBand: opportunityScoreBandEnum("score_band"),
  urgency: text("urgency"),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  targetCloseDate: date("target_close_date", { mode: "date" }),
  primaryContactId: uuid("primary_contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  problemStatement: text("problem_statement"),
  businessImpact: text("business_impact"),
  lostReason: text("lost_reason"),
  notes: text("notes"),
  ...timestamps(),
}, (table) => [
  index("opportunities_organization_id_idx").on(table.organizationId),
  index("opportunities_company_id_idx").on(table.companyId),
  index("opportunities_owner_user_id_idx").on(table.ownerUserId),
  index("opportunities_primary_contact_id_idx").on(table.primaryContactId),
  index("opportunities_org_stage_idx").on(table.organizationId, table.stage),
  index("opportunities_org_updated_at_idx").on(table.organizationId, table.updatedAt),
]);

export const opportunityScores = pgTable("opportunity_scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, {
    onDelete: "cascade",
  }),
  icpFit: integer("icp_fit").notNull().default(0),
  triggerScore: integer("trigger_score").notNull().default(0),
  demonstratedPain: integer("demonstrated_pain").notNull().default(0),
  serviceFit: integer("service_fit").notNull().default(0),
  buyerAccess: integer("buyer_access").notNull().default(0),
  timingBudget: integer("timing_budget").notNull().default(0),
  total: integer("total").notNull().default(0),
  overrideScore: integer("override_score"),
  overrideReason: text("override_reason"),
  overrideUserId: uuid("override_user_id").references(() => users.id, { onDelete: "set null" }),
  overrideAt: timestamp("override_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("opportunity_scores_opportunity_id_idx").on(table.opportunityId),
  index("opportunity_scores_override_user_id_idx").on(table.overrideUserId),
  unique("opportunity_scores_opportunity_uq").on(table.opportunityId),
]);

export const companiesRelations = relations(companies, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [companies.organizationId],
    references: [organizations.id],
  }),
  accountOwner: one(users, {
    fields: [companies.accountOwnerUserId],
    references: [users.id],
  }),
  locations: many(companyLocations),
  companyContacts: many(companyContacts),
  signals: many(opportunitySignals),
  opportunities: many(opportunities),
}));

export const companyLocationsRelations = relations(companyLocations, ({ one }) => ({
  company: one(companies, {
    fields: [companyLocations.companyId],
    references: [companies.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ many }) => ({
  companyContacts: many(companyContacts),
}));

export const companyContactsRelations = relations(companyContacts, ({ one }) => ({
  company: one(companies, {
    fields: [companyContacts.companyId],
    references: [companies.id],
  }),
  contact: one(contacts, {
    fields: [companyContacts.contactId],
    references: [contacts.id],
  }),
}));

export const opportunitySignalsRelations = relations(opportunitySignals, ({ one }) => ({
  company: one(companies, {
    fields: [opportunitySignals.companyId],
    references: [companies.id],
  }),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [opportunities.organizationId],
    references: [organizations.id],
  }),
  company: one(companies, {
    fields: [opportunities.companyId],
    references: [companies.id],
  }),
  owner: one(users, {
    fields: [opportunities.ownerUserId],
    references: [users.id],
  }),
  primaryContact: one(contacts, {
    fields: [opportunities.primaryContactId],
    references: [contacts.id],
  }),
  score: many(opportunityScores),
}));
