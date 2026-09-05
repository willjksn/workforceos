import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { organizations } from "../core";
import { companies } from "../crm";
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
