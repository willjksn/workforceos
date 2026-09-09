import { relations } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { organizations, users } from "../core";
import { companies, contacts, opportunities } from "../crm";
import { jobs } from "../recruiting";
import {
  publicContentPlacementEnum,
  publicContentStyleVariantEnum,
  publicContentTypeEnum,
  websiteInquiryServiceInterestEnum,
  websiteInquiryStatusEnum,
} from "../enums";

export const publicIntakeSettings = pgTable(
  "public_intake_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    inquiryOwnerUserId: uuid("inquiry_owner_user_id").references(() => users.id, { onDelete: "set null" }),
    inquiryOwnerRoleSlug: text("inquiry_owner_role_slug").notNull().default("managing-partner"),
    militaryTalentOwnerUserId: uuid("military_talent_owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    militaryTalentOwnerRoleSlug: text("military_talent_owner_role_slug")
      .notNull()
      .default("military-talent-partner"),
    applicationNotifyUserId: uuid("application_notify_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    applicationNotifyRoleSlug: text("application_notify_role_slug").notNull().default("recruiter"),
    ...timestamps(),
  },
  (table) => [
    unique("public_intake_settings_organization_uq").on(table.organizationId),
    index("public_intake_settings_inquiry_owner_user_id_idx").on(table.inquiryOwnerUserId),
    index("public_intake_settings_military_talent_owner_user_id_idx").on(table.militaryTalentOwnerUserId),
    index("public_intake_settings_application_notify_user_id_idx").on(table.applicationNotifyUserId),
  ],
);

export const websiteInquiries = pgTable(
  "website_inquiries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    companyName: text("company_name").notNull(),
    companyWebsite: text("company_website"),
    title: text("title"),
    serviceInterest: websiteInquiryServiceInterestEnum("service_interest").notNull(),
    challenge: text("challenge").notNull(),
    timeline: text("timeline"),
    roleCount: text("role_count"),
    location: text("location"),
    referralSource: text("referral_source"),
    source: text("source").notNull().default("pierone_public_website"),
    subsource: text("subsource"),
    landingUrl: text("landing_url"),
    referrer: text("referrer"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    companyMatchStatus: text("company_match_status").notNull().default("unresolved"),
    contactMatchStatus: text("contact_match_status").notNull().default("new"),
    status: websiteInquiryStatusEnum("status").notNull().default("new"),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    ...timestamps(),
  },
  (table) => [
    index("website_inquiries_organization_id_idx").on(table.organizationId),
    index("website_inquiries_company_id_idx").on(table.companyId),
    index("website_inquiries_contact_id_idx").on(table.contactId),
    index("website_inquiries_opportunity_id_idx").on(table.opportunityId),
    index("website_inquiries_owner_user_id_idx").on(table.ownerUserId),
    index("website_inquiries_status_idx").on(table.organizationId, table.status),
    index("website_inquiries_submitted_at_idx").on(table.submittedAt),
    index("website_inquiries_email_idx").on(table.organizationId, table.email),
  ],
);

export const publicContentItems = pgTable(
  "public_content_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    contentType: publicContentTypeEnum("content_type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    ctaLabel: text("cta_label"),
    ctaUrl: text("cta_url"),
    linkedJobId: uuid("linked_job_id").references(() => jobs.id, { onDelete: "set null" }),
    industryCode: text("industry_code"),
    placement: publicContentPlacementEnum("placement").notNull().default("home"),
    styleVariant: publicContentStyleVariantEnum("style_variant"),
    featureImageKey: text("feature_image_key"),
    priority: integer("priority").notNull().default(100),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
    isActive: boolean("is_active").notNull().default(false),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (table) => [
    index("public_content_items_organization_id_idx").on(table.organizationId),
    index("public_content_items_linked_job_id_idx").on(table.linkedJobId),
    index("public_content_items_created_by_user_id_idx").on(table.createdByUserId),
    index("public_content_items_updated_by_user_id_idx").on(table.updatedByUserId),
    index("public_content_items_org_type_idx").on(table.organizationId, table.contentType),
    index("public_content_items_org_active_idx").on(table.organizationId, table.isActive),
  ],
);

export const publicContentItemsRelations = relations(publicContentItems, ({ one }) => ({
  organization: one(organizations, {
    fields: [publicContentItems.organizationId],
    references: [organizations.id],
  }),
  linkedJob: one(jobs, {
    fields: [publicContentItems.linkedJobId],
    references: [jobs.id],
  }),
  createdBy: one(users, {
    fields: [publicContentItems.createdByUserId],
    references: [users.id],
  }),
  updatedBy: one(users, {
    fields: [publicContentItems.updatedByUserId],
    references: [users.id],
  }),
}));

export const websiteInquiriesRelations = relations(websiteInquiries, ({ one }) => ({
  organization: one(organizations, {
    fields: [websiteInquiries.organizationId],
    references: [organizations.id],
  }),
  company: one(companies, {
    fields: [websiteInquiries.companyId],
    references: [companies.id],
  }),
  contact: one(contacts, {
    fields: [websiteInquiries.contactId],
    references: [contacts.id],
  }),
  opportunity: one(opportunities, {
    fields: [websiteInquiries.opportunityId],
    references: [opportunities.id],
  }),
  owner: one(users, {
    fields: [websiteInquiries.ownerUserId],
    references: [users.id],
  }),
}));
