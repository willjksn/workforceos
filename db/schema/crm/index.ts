import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { organizations } from "../core";
import {
  clientStatusEnum,
  companyTypeEnum,
  opportunityStageEnum,
  relationshipStrengthEnum,
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
  notes: text("notes"),
  ...timestamps(),
}, (table) => [
  index("companies_organization_id_idx").on(table.organizationId),
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
  title: text("title"),
  ...timestamps(),
}, (table) => [
  index("contacts_organization_id_idx").on(table.organizationId),
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
  detectedAt: timestamp("detected_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  ...timestamps(),
}, (table) => [
  index("opportunity_signals_company_id_idx").on(table.companyId),
]);

export const opportunities = pgTable("opportunities", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  stage: opportunityStageEnum("stage").notNull().default("identified"),
  notes: text("notes"),
  ...timestamps(),
}, (table) => [
  index("opportunities_organization_id_idx").on(table.organizationId),
  index("opportunities_company_id_idx").on(table.companyId),
]);

export const companiesRelations = relations(companies, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [companies.organizationId],
    references: [organizations.id],
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

export const opportunitiesRelations = relations(opportunities, ({ one }) => ({
  organization: one(organizations, {
    fields: [opportunities.organizationId],
    references: [organizations.id],
  }),
  company: one(companies, {
    fields: [opportunities.companyId],
    references: [companies.id],
  }),
}));
