import { date, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { organizations } from "../core";
import { companies } from "../crm";
import { billingEventStatusEnum } from "../enums";
import { contracts } from "../legal";
import { projects } from "../projects";

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
  name: text("name").notNull(),
  cadence: text("cadence").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }),
  nextExpectedAt: date("next_expected_at", { mode: "date" }),
  sourceRule: text("source_rule"),
  ...timestamps(),
}, (table) => [
  index("billing_schedules_organization_id_idx").on(table.organizationId),
  index("billing_schedules_company_id_idx").on(table.companyId),
  index("billing_schedules_project_id_idx").on(table.projectId),
  index("billing_schedules_contract_id_idx").on(table.contractId),
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
  sourceMilestone: text("source_milestone"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  expectedDate: date("expected_date", { mode: "date" }),
  status: billingEventStatusEnum("status").notNull().default("scheduled"),
  notes: text("notes"),
  triggeredAt: timestamp("triggered_at", { withTimezone: true, mode: "date" }),
  ...timestamps(),
}, (table) => [
  index("billing_events_organization_id_idx").on(table.organizationId),
  index("billing_events_company_id_idx").on(table.companyId),
  index("billing_events_project_id_idx").on(table.projectId),
  index("billing_events_contract_id_idx").on(table.contractId),
  index("billing_events_schedule_id_idx").on(table.scheduleId),
]);
