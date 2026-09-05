import { and, eq } from "drizzle-orm";

import { getDb } from "../../db";
import {
  candidates,
  companies,
  contracts,
  jobs,
  opportunities,
  opportunitySignals,
  projectMeetings,
  projects,
  proposals,
  solutionPlans,
} from "../../db/schema";
import { loadApprovedWorkflow } from "../delivery/engine";
import type { Permission } from "../rbac/permissions";
import { retrieveApprovedKnowledge } from "./knowledge";

export type AgentSource = { type: string; id?: string; label: string };

export type AgentContext = {
  organizationId: string;
  agentSlug: string;
  taskKey: string;
  recordType?: string | null;
  recordId?: string | null;
  permissions: Permission[];
  canReadCandidatePii: boolean;
  workflow?: { code: string; version: string; steps: string[] } | null;
  record: Record<string, unknown> | null;
  knowledge: Array<{ id: string; title: string; source: string | null; excerpt: string }>;
  sources: AgentSource[];
};

function stripCandidatePii(row: Record<string, unknown>, canReadPii: boolean) {
  if (canReadPii) return row;
  const copy = { ...row };
  delete copy.email;
  delete copy.phone;
  delete copy.linkedinUrl;
  delete copy.address1;
  delete copy.address2;
  delete copy.resumeText;
  copy.emailHidden = true;
  return copy;
}

export async function buildAgentContext(input: {
  organizationId: string;
  agentSlug: string;
  taskKey: string;
  recordType?: string | null;
  recordId?: string | null;
  permissions: ReadonlySet<string>;
  serviceCode?: string | null;
}): Promise<AgentContext> {
  const permissions = [...input.permissions] as Permission[];
  const canReadCandidatePii = input.permissions.has("candidate_pii.read");
  const sources: AgentSource[] = [{ type: "database", label: "WorkforceOS PostgreSQL" }];
  let record: Record<string, unknown> | null = null;
  let workflow: AgentContext["workflow"] = null;
  let serviceCode = input.serviceCode ?? null;

  if (input.recordType && input.recordId) {
    record = await loadRecord(input.organizationId, input.recordType, input.recordId, canReadCandidatePii);
    if (record) {
      sources.push({
        type: input.recordType,
        id: input.recordId,
        label: String(record.name ?? record.title ?? input.recordType),
      });
      if (typeof record.serviceCode === "string") serviceCode = record.serviceCode;
    }
  }

  if (
    serviceCode &&
    (input.permissions.has("services.read") ||
      input.permissions.has("solutions.read") ||
      input.permissions.has("jobs.read"))
  ) {
    try {
      const loaded = await loadApprovedWorkflow(serviceCode);
      workflow = {
        code: loaded.service.code,
        version: loaded.version.version,
        steps: loaded.steps.map((step) => `${step.stepNumber}. ${step.name}`),
      };
      sources.push({
        type: "service_workflow",
        id: loaded.version.id,
        label: `${loaded.service.code} ${loaded.version.version}`,
      });
    } catch {
      workflow = null;
    }
  }

  const knowledge = await retrieveApprovedKnowledge({
    organizationId: input.organizationId,
    permissions: input.permissions,
    query: `${input.agentSlug} ${input.taskKey} ${input.recordType ?? ""}`,
    limit: 5,
  });
  for (const item of knowledge) {
    sources.push({ type: "knowledge_record", id: item.id, label: item.title });
  }

  return {
    organizationId: input.organizationId,
    agentSlug: input.agentSlug,
    taskKey: input.taskKey,
    recordType: input.recordType,
    recordId: input.recordId,
    permissions,
    canReadCandidatePii,
    workflow,
    record,
    knowledge,
    sources,
  };
}

async function loadRecord(
  organizationId: string,
  recordType: string,
  recordId: string,
  canReadPii: boolean,
): Promise<Record<string, unknown> | null> {
  const db = getDb();
  if (recordType === "company") {
    const [row] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, recordId), eq(companies.organizationId, organizationId)))
      .limit(1);
    return row ? { ...row } : null;
  }
  if (recordType === "opportunity") {
    const [row] = await db
      .select()
      .from(opportunities)
      .where(and(eq(opportunities.id, recordId), eq(opportunities.organizationId, organizationId)))
      .limit(1);
    return row ? { ...row } : null;
  }
  if (recordType === "opportunity_signal") {
    const [row] = await db.select().from(opportunitySignals).where(eq(opportunitySignals.id, recordId)).limit(1);
    return row ? { ...row } : null;
  }
  if (recordType === "candidate") {
    const [row] = await db
      .select()
      .from(candidates)
      .where(and(eq(candidates.id, recordId), eq(candidates.organizationId, organizationId)))
      .limit(1);
    return row ? stripCandidatePii({ ...row }, canReadPii) : null;
  }
  if (recordType === "job") {
    const [row] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, recordId), eq(jobs.organizationId, organizationId)))
      .limit(1);
    return row ? { ...row } : null;
  }
  if (recordType === "solution_plan") {
    const [row] = await db
      .select()
      .from(solutionPlans)
      .where(and(eq(solutionPlans.id, recordId), eq(solutionPlans.organizationId, organizationId)))
      .limit(1);
    return row ? { ...row } : null;
  }
  if (recordType === "proposal") {
    const [row] = await db
      .select()
      .from(proposals)
      .where(and(eq(proposals.id, recordId), eq(proposals.organizationId, organizationId)))
      .limit(1);
    return row ? { ...row } : null;
  }
  if (recordType === "contract") {
    const [row] = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.id, recordId), eq(contracts.organizationId, organizationId)))
      .limit(1);
    return row ? { ...row } : null;
  }
  if (recordType === "project") {
    const [row] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, recordId), eq(projects.organizationId, organizationId)))
      .limit(1);
    return row ? { ...row } : null;
  }
  if (recordType === "project_meeting") {
    const [row] = await db.select().from(projectMeetings).where(eq(projectMeetings.id, recordId)).limit(1);
    return row ? { ...row } : null;
  }
  return { recordType, recordId };
}
