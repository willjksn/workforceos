import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../_common";
import { organizations } from "../core";
import { companies } from "../crm";
import { reviewStatusEnum } from "../enums";
import { projects } from "../projects";
import { services } from "../services";
import { files } from "../system";

export const legalPackages = pgTable("legal_packages", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
    onDelete: "restrict",
  }),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
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
]);
