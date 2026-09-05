import { boolean, date, index, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { organizations, users } from "../core";
import { companies, opportunities } from "../crm";
import {
  contractStatusEnum,
  esignStatusEnum,
  legalTemplateStatusEnum,
  legalTemplateTypeEnum,
  reviewStatusEnum,
} from "../enums";
import { projects } from "../projects";
import { proposals, services, solutionPlans } from "../services";
import { files } from "../system";

export const legalTemplates = pgTable("legal_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "restrict",
  }),
  templateType: legalTemplateTypeEnum("template_type").notNull(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  jurisdiction: text("jurisdiction"),
  effectiveDate: date("effective_date", { mode: "date" }),
  lastLegalReviewAt: timestamp("last_legal_review_at", { withTimezone: true, mode: "date" }),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  attorneyApproved: boolean("attorney_approved").notNull().default(false),
  status: legalTemplateStatusEnum("status").notNull().default("draft"),
  body: text("body"),
  notes: text("notes"),
  ...timestamps(),
}, (table) => [
  unique("legal_templates_type_version_uq").on(table.templateType, table.version),
  index("legal_templates_organization_id_idx").on(table.organizationId),
  index("legal_templates_owner_user_id_idx").on(table.ownerUserId),
]);

export const contracts = pgTable("contracts", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
  proposalId: uuid("proposal_id").references(() => proposals.id, { onDelete: "set null" }),
  solutionPlanId: uuid("solution_plan_id").references(() => solutionPlans.id, {
    onDelete: "set null",
  }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  contractType: legalTemplateTypeEnum("contract_type").notNull(),
  templateId: uuid("template_id").references(() => legalTemplates.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  sow: text("sow"),
  contractValue: numeric("contract_value", { precision: 14, scale: 2 }),
  signerName: text("signer_name"),
  signerEmail: text("signer_email"),
  signatureStatus: esignStatusEnum("signature_status").notNull().default("not_sent"),
  status: contractStatusEnum("status").notNull().default("draft"),
  executionDate: date("execution_date", { mode: "date" }),
  effectiveDate: date("effective_date", { mode: "date" }),
  expirationDate: date("expiration_date", { mode: "date" }),
  renewalDate: date("renewal_date", { mode: "date" }),
  terminationDate: date("termination_date", { mode: "date" }),
  paymentTerms: text("payment_terms"),
  guaranteeTerms: text("guarantee_terms"),
  insuranceRequirements: text("insurance_requirements"),
  dataRequirements: text("data_requirements"),
  specialClauses: text("special_clauses"),
  amendments: text("amendments"),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
  ...timestamps(),
}, (table) => [
  index("contracts_organization_id_idx").on(table.organizationId),
  index("contracts_company_id_idx").on(table.companyId),
  index("contracts_service_id_idx").on(table.serviceId),
  index("contracts_opportunity_id_idx").on(table.opportunityId),
  index("contracts_proposal_id_idx").on(table.proposalId),
  index("contracts_solution_plan_id_idx").on(table.solutionPlanId),
  index("contracts_project_id_idx").on(table.projectId),
  index("contracts_template_id_idx").on(table.templateId),
  index("contracts_file_id_idx").on(table.fileId),
]);

export const esignEnvelopes = pgTable("esign_envelopes", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractId: uuid("contract_id").notNull().references(() => contracts.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("manual"),
  providerEnvelopeId: text("provider_envelope_id"),
  status: esignStatusEnum("status").notNull().default("not_sent"),
  sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  lastError: text("last_error"),
  auditCertificateKey: text("audit_certificate_key"),
  ...timestamps(),
}, (table) => [
  index("esign_envelopes_contract_id_idx").on(table.contractId),
]);

export const legalPackages = pgTable("legal_packages", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  status: reviewStatusEnum("status").notNull().default("draft"),
  ...timestamps(),
}, (table) => [
  index("legal_packages_organization_id_idx").on(table.organizationId),
  index("legal_packages_service_id_idx").on(table.serviceId),
  index("legal_packages_project_id_idx").on(table.projectId),
  index("legal_packages_company_id_idx").on(table.companyId),
  index("legal_packages_file_id_idx").on(table.fileId),
  index("legal_packages_contract_id_idx").on(table.contractId),
]);
