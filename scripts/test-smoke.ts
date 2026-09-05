import "./load-env";

import { eq } from "drizzle-orm";

import { getDb } from "../db";
import { auditEvents, projects } from "../db/schema";
import { CANDIDATE_ID, COMPANY_ID, INTERNAL_ORG_ID, USER_IDS } from "../db/seed/constants";
import { seedFoundation } from "../db/seed";
import { runAgentTask } from "../lib/ai/runner";
import { recordAuditEvent } from "../lib/audit/record-audit-event";
import { isClerkConfigured } from "../lib/env";
import { financeOverview } from "../lib/finance/engine";
import { getSystemHealth } from "../lib/health/status";
import { getIntegrationHubStatus } from "../lib/integrations/hub";
import { ROLE_PERMISSIONS, can } from "../lib/rbac/permissions";
import { getCompanyGraph, updateCompanyName } from "../lib/repositories/crm";
import { getMilitaryOccupationBundle } from "../lib/repositories/military";
import { getServiceBundle } from "../lib/repositories/services";
import { getCandidateWithRelationships } from "../lib/repositories/talent";
import { getExecutiveCommandCenter } from "../lib/reporting/executive";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const actor = {
  organizationId: INTERNAL_ORG_ID,
  userId: USER_IDS.managingPartner,
  roleSlugs: ["managing-partner"],
  permissions: new Set(ROLE_PERMISSIONS["managing-partner"]),
};

async function main() {
  await seedFoundation();
  const db = getDb();

  console.log("SMOKE 1 — sign-in configuration");
  assert(typeof isClerkConfigured() === "boolean", "Clerk configuration probe failed");

  console.log("SMOKE 2 — database read");
  const graph = await getCompanyGraph(COMPANY_ID, INTERNAL_ORG_ID);
  assert(graph?.company.name, "Company read failed");

  console.log("SMOKE 3 — database write");
  const original = graph.company.name;
  const updated = await updateCompanyName({
    organizationId: INTERNAL_ORG_ID,
    companyId: COMPANY_ID,
    name: original,
    actorUserId: actor.userId,
  });
  assert(updated?.id === COMPANY_ID, "Company write failed");

  console.log("SMOKE 4 — RBAC");
  const recruiter = {
    id: USER_IDS.recruiter,
    status: "active" as const,
    organizationId: INTERNAL_ORG_ID,
    roleSlugs: ["recruiter"],
    permissions: new Set(ROLE_PERMISSIONS.recruiter),
  };
  assert(can(recruiter, "jobs.write"), "Recruiter should write jobs");
  assert(!can(recruiter, "admin.roles"), "Recruiter must not configure roles");
  assert(!can(recruiter, "reports.export_pii"), "Recruiter must not export Restricted PII");

  console.log("SMOKE 5 — audit");
  await recordAuditEvent({
    organizationId: INTERNAL_ORG_ID,
    actor: { type: "system" },
    action: "smoke.ping",
    recordType: "organization",
    recordId: INTERNAL_ORG_ID,
    after: { ok: true },
  });
  const [audit] = await db.select().from(auditEvents).where(eq(auditEvents.action, "smoke.ping")).limit(1);
  assert(audit, "Audit write failed");

  console.log("SMOKE 6 — company / candidate / job");
  const candidate = await getCandidateWithRelationships(CANDIDATE_ID, INTERNAL_ORG_ID);
  assert(candidate?.candidate.id === CANDIDATE_ID, "Candidate read failed");

  console.log("SMOKE 7 — military mapping");
  const occupation = await getMilitaryOccupationBundle("EM", "navy");
  assert(occupation, "Navy EM mapping missing");

  console.log("SMOKE 8 — service workflow");
  const service = await getServiceBundle("professional-search");
  assert(service?.service && service.workflows.length > 0, "Professional Search workflow missing");

  console.log("SMOKE 9 — project");
  const projectRows = await db.select({ id: projects.id }).from(projects).where(eq(projects.organizationId, INTERNAL_ORG_ID)).limit(1);
  assert(Array.isArray(projectRows), "Project list failed");

  console.log("SMOKE 10 — billing");
  const finance = await financeOverview(INTERNAL_ORG_ID);
  assert(typeof finance.invoicedRevenue === "number", "Finance overview failed");

  console.log("SMOKE 11 — AI draft/review surface");
  const run = await runAgentTask({
    actor,
    agentSlug: "account-intelligence-agent",
    taskKey: "summarize_company",
    recordType: "company",
    recordId: COMPANY_ID,
    serviceCode: "professional-search",
  });
  assert(run.runId, "AI draft run failed");

  console.log("SMOKE 12 — integration health");
  const integrations = await getIntegrationHubStatus();
  assert(integrations.length > 0, "Integration hub status missing");
  const health = await getSystemHealth();
  assert(health.checks.some((check) => check.title === "Database" && check.ok), "System health database check failed");
  const command = await getExecutiveCommandCenter(INTERNAL_ORG_ID);
  assert(command.generatedAt instanceof Date, "Command Center snapshot failed");

  console.log("Smoke tests passed.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
