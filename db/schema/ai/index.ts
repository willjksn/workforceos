import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAtOnly } from "../_common";
import { agents } from "../core";
import { approvals } from "../system";

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("completed"),
  inputSummary: text("input_summary"),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  ...createdAtOnly(),
}, (table) => [
  index("agent_runs_agent_id_idx").on(table.agentId),
]);

export const agentOutputs = pgTable("agent_outputs", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "restrict" }),
  agentRunId: uuid("agent_run_id").references(() => agentRuns.id, { onDelete: "set null" }),
  approvalId: uuid("approval_id").references(() => approvals.id, { onDelete: "set null" }),
  outputType: text("output_type").notNull(),
  summary: text("summary").notNull(),
  payload: jsonb("payload"),
  model: text("model"),
  modelVersion: text("model_version"),
  confidence: numeric("confidence", { precision: 5, scale: 4 }),
  sourceReferences: jsonb("source_references"),
  ...createdAtOnly(),
}, (table) => [
  index("agent_outputs_agent_id_idx").on(table.agentId),
  index("agent_outputs_agent_run_id_idx").on(table.agentRunId),
  index("agent_outputs_approval_id_idx").on(table.approvalId),
]);

export const agentPermissions = pgTable("agent_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  permissionSlug: text("permission_slug").notNull(),
  ...createdAtOnly(),
}, (table) => [
  index("agent_permissions_agent_id_idx").on(table.agentId),
]);

export const agentRunsRelations = relations(agentRuns, ({ one, many }) => ({
  agent: one(agents, {
    fields: [agentRuns.agentId],
    references: [agents.id],
  }),
  outputs: many(agentOutputs),
}));

export const agentOutputsRelations = relations(agentOutputs, ({ one }) => ({
  agent: one(agents, {
    fields: [agentOutputs.agentId],
    references: [agents.id],
  }),
  run: one(agentRuns, {
    fields: [agentOutputs.agentRunId],
    references: [agentRuns.id],
  }),
}));
