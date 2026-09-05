import { date, index, integer, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { organizations, users } from "../core";
import { companies } from "../crm";
import {
  arAgingBucketEnum,
  billingEventStatusEnum,
  billingScheduleStatusEnum,
  billingTypeEnum,
  financeAdjustmentTypeEnum,
  invoiceStatusEnum,
  paymentReconciliationStatusEnum,
  revenueEventStatusEnum,
  revenueTriggerTypeEnum,
} from "../enums";
import { contracts } from "../legal";
import { projects } from "../projects";
import { placements } from "../recruiting";
import { services } from "../services";

export const financeOperatingAccounts = pgTable("finance_operating_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  status: text("status").notNull().default("open"),
  notes: text("notes"),
  ...timestamps(),
}, (table) => [
  index("finance_operating_accounts_organization_id_idx").on(table.organizationId),
  index("finance_operating_accounts_company_id_idx").on(table.companyId),
  index("finance_operating_accounts_project_id_idx").on(table.projectId),
]);

export const billingSchedules = pgTable("billing_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  cadence: text("cadence").notNull(),
  billingType: billingTypeEnum("billing_type").notNull().default("custom"),
  amount: numeric("amount", { precision: 14, scale: 2 }),
  percentage: numeric("percentage", { precision: 8, scale: 4 }),
  dueTrigger: text("due_trigger"),
  scheduledDate: date("scheduled_date", { mode: "date" }),
  recurrence: text("recurrence"),
  invoiceStatus: text("invoice_status").notNull().default("pending"),
  status: billingScheduleStatusEnum("status").notNull().default("active"),
  billingDay: integer("billing_day"),
  startDate: date("start_date", { mode: "date" }),
  endDate: date("end_date", { mode: "date" }),
  minimumTermMonths: integer("minimum_term_months"),
  nextInvoiceDate: date("next_invoice_date", { mode: "date" }),
  nextExpectedAt: date("next_expected_at", { mode: "date" }),
  renewalStatus: text("renewal_status"),
  pauseReason: text("pause_reason"),
  sourceRule: text("source_rule"),
  ...timestamps(),
}, (table) => [
  index("billing_schedules_organization_id_idx").on(table.organizationId),
  index("billing_schedules_company_id_idx").on(table.companyId),
  index("billing_schedules_project_id_idx").on(table.projectId),
  index("billing_schedules_contract_id_idx").on(table.contractId),
  index("billing_schedules_service_id_idx").on(table.serviceId),
]);

export const billingEvents = pgTable("billing_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
  scheduleId: uuid("schedule_id").references(() => billingSchedules.id, { onDelete: "set null" }),
  placementId: uuid("placement_id").references(() => placements.id, { onDelete: "set null" }),
  sourceMilestone: text("source_milestone"),
  triggerType: revenueTriggerTypeEnum("trigger_type"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  expectedDate: date("expected_date", { mode: "date" }),
  actualDate: date("actual_date", { mode: "date" }),
  status: billingEventStatusEnum("status").notNull().default("scheduled"),
  invoiceId: uuid("invoice_id"),
  sourceType: text("source_type"),
  sourceId: uuid("source_id"),
  notes: text("notes"),
  triggeredAt: timestamp("triggered_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("billing_events_organization_id_idx").on(table.organizationId),
  index("billing_events_company_id_idx").on(table.companyId),
  index("billing_events_project_id_idx").on(table.projectId),
  index("billing_events_contract_id_idx").on(table.contractId),
  index("billing_events_schedule_id_idx").on(table.scheduleId),
  index("billing_events_placement_id_idx").on(table.placementId),
  index("billing_events_invoice_id_idx").on(table.invoiceId),
]);

export const revenueEvents = pgTable("revenue_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
  placementId: uuid("placement_id").references(() => placements.id, { onDelete: "set null" }),
  billingEventId: uuid("billing_event_id").references(() => billingEvents.id, { onDelete: "set null" }),
  scheduleId: uuid("schedule_id").references(() => billingSchedules.id, { onDelete: "set null" }),
  source: text("source").notNull(),
  triggerType: revenueTriggerTypeEnum("trigger_type").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  expectedDate: date("expected_date", { mode: "date" }),
  actualDate: date("actual_date", { mode: "date" }),
  status: revenueEventStatusEnum("status").notNull().default("expected"),
  invoiceId: uuid("invoice_id"),
  notes: text("notes"),
  ...timestamps(),
}, (table) => [
  index("revenue_events_organization_id_idx").on(table.organizationId),
  index("revenue_events_company_id_idx").on(table.companyId),
  index("revenue_events_project_id_idx").on(table.projectId),
  index("revenue_events_contract_id_idx").on(table.contractId),
  index("revenue_events_service_id_idx").on(table.serviceId),
  index("revenue_events_placement_id_idx").on(table.placementId),
  index("revenue_events_billing_event_id_idx").on(table.billingEventId),
  index("revenue_events_schedule_id_idx").on(table.scheduleId),
  index("revenue_events_invoice_id_idx").on(table.invoiceId),
]);

export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
  scheduleId: uuid("schedule_id").references(() => billingSchedules.id, { onDelete: "set null" }),
  billingEventId: uuid("billing_event_id").references(() => billingEvents.id, { onDelete: "set null" }),
  revenueEventId: uuid("revenue_event_id"),
  invoiceNumber: text("invoice_number").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  balanceDue: numeric("balance_due", { precision: 14, scale: 2 }).notNull(),
  issuedDate: date("issued_date", { mode: "date" }),
  dueDate: date("due_date", { mode: "date" }),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  nextAction: text("next_action"),
  disputeStatus: text("dispute_status"),
  agingBucket: arAgingBucketEnum("aging_bucket"),
  notes: text("notes"),
  ...timestamps(),
}, (table) => [
  unique("invoices_organization_number_uq").on(table.organizationId, table.invoiceNumber),
  index("invoices_organization_id_idx").on(table.organizationId),
  index("invoices_company_id_idx").on(table.companyId),
  index("invoices_contract_id_idx").on(table.contractId),
  index("invoices_project_id_idx").on(table.projectId),
  index("invoices_service_id_idx").on(table.serviceId),
  index("invoices_schedule_id_idx").on(table.scheduleId),
  index("invoices_billing_event_id_idx").on(table.billingEventId),
  index("invoices_owner_user_id_idx").on(table.ownerUserId),
  index("invoices_org_status_due_idx").on(table.organizationId, table.status, table.dueDate),
]);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  paymentDate: date("payment_date", { mode: "date" }).notNull(),
  externalTransactionReference: text("external_transaction_reference"),
  methodSummary: text("method_summary"),
  sourceSystem: text("source_system").notNull().default("workforceos"),
  reconciliationStatus: paymentReconciliationStatusEnum("reconciliation_status").notNull().default("unmatched"),
  notes: text("notes"),
  ...timestamps(),
}, (table) => [
  index("payments_organization_id_idx").on(table.organizationId),
  index("payments_invoice_id_idx").on(table.invoiceId),
]);

export const financeCostEntries = pgTable("finance_cost_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  incurredDate: date("incurred_date", { mode: "date" }),
  notes: text("notes"),
  enteredByUserId: uuid("entered_by_user_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps(),
}, (table) => [
  index("finance_cost_entries_organization_id_idx").on(table.organizationId),
  index("finance_cost_entries_company_id_idx").on(table.companyId),
  index("finance_cost_entries_project_id_idx").on(table.projectId),
  index("finance_cost_entries_contract_id_idx").on(table.contractId),
  index("finance_cost_entries_entered_by_user_id_idx").on(table.enteredByUserId),
]);

export const financeAdjustments = pgTable("finance_adjustments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  scheduleId: uuid("schedule_id").references(() => billingSchedules.id, { onDelete: "set null" }),
  placementId: uuid("placement_id").references(() => placements.id, { onDelete: "set null" }),
  adjustmentType: financeAdjustmentTypeEnum("adjustment_type").notNull(),
  originalAmount: numeric("original_amount", { precision: 14, scale: 2 }),
  adjustedAmount: numeric("adjusted_amount", { precision: 14, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  requestedByUserId: uuid("requested_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvalId: uuid("approval_id"),
  decidedAt: timestamp("decided_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("finance_adjustments_organization_id_idx").on(table.organizationId),
  index("finance_adjustments_company_id_idx").on(table.companyId),
  index("finance_adjustments_project_id_idx").on(table.projectId),
  index("finance_adjustments_contract_id_idx").on(table.contractId),
  index("finance_adjustments_invoice_id_idx").on(table.invoiceId),
  index("finance_adjustments_schedule_id_idx").on(table.scheduleId),
  index("finance_adjustments_placement_id_idx").on(table.placementId),
  index("finance_adjustments_requested_by_user_id_idx").on(table.requestedByUserId),
  index("finance_adjustments_approved_by_user_id_idx").on(table.approvedByUserId),
]);
