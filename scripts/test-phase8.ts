import "./load-env";

import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { eq } from "drizzle-orm";

import { getDb } from "../db";
import {
  auditEvents,
  candidates,
  opportunities,
  privacyDeletionRequests,
} from "../db/schema";
import { CANDIDATE_ID, COMPANY_ID, INTERNAL_ORG_ID, USER_IDS } from "../db/seed/constants";
import { seedFoundation } from "../db/seed";
import { evaluateOperationalAlerts } from "../lib/alerts/evaluate";
import { evaluateDataQuality } from "../lib/data-quality/evaluate";
import { getSystemHealth } from "../lib/health/status";
import { executePrivacyDeletion } from "../lib/privacy/deletion";
import { ROLE_PERMISSIONS } from "../lib/rbac/permissions";
import { getCompanyGraph } from "../lib/repositories/crm";
import { getCandidateWithRelationships } from "../lib/repositories/talent";
import { exportReportCsv } from "../lib/reporting/export";
import { getExecutiveCommandCenter } from "../lib/reporting/executive";
import { assertDevSeedAllowed, SeedGuardError } from "../lib/seed/guards";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const partner = {
  id: USER_IDS.managingPartner,
  status: "active" as const,
  organizationId: INTERNAL_ORG_ID,
  roleSlugs: ["managing-partner"],
  permissions: new Set(ROLE_PERMISSIONS["managing-partner"]),
};

const recruiter = {
  id: USER_IDS.recruiter,
  status: "active" as const,
  organizationId: INTERNAL_ORG_ID,
  roleSlugs: ["recruiter"],
  permissions: new Set(ROLE_PERMISSIONS.recruiter),
};

async function main() {
  await seedFoundation();
  const db = getDb();
  const root = process.cwd();

  console.log("TEST 1 — executive dashboard uses real aggregates");
  const snapshot = await getExecutiveCommandCenter(INTERNAL_ORG_ID);
  assert(typeof snapshot.business.invoiced === "number", "Invoiced must be a stored aggregate");
  assert(snapshot.talent.totalCandidates >= 1, "Expected stored candidate count");
  assert(Array.isArray(snapshot.sales.priorityOpportunities), "Priority opportunities must come from stored CRM rows");

  console.log("TEST 2 — data quality flags work");
  const flags = await evaluateDataQuality(INTERNAL_ORG_ID);
  assert(flags.some((flag) => flag.code === "missing_company_fields"), "Missing company fields flag missing");
  assert(flags.every((flag) => typeof flag.count === "number"), "Data quality counts must be numeric");
  assert(
    flags.every((flag) => !/quality of hire/i.test(`${flag.title} ${flag.note}`)),
    "Data quality must not be labeled as quality-of-hire",
  );

  console.log("TEST 3 — alerts trigger correctly");
  const staleId = randomUUID();
  await db.insert(opportunities).values({
    id: staleId,
    organizationId: INTERNAL_ORG_ID,
    companyId: COMPANY_ID,
    name: "Phase 8 stale opportunity",
    stage: "qualified",
    updatedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
  });
  const alerts = await evaluateOperationalAlerts(INTERNAL_ORG_ID);
  assert(
    alerts.some((alert) => alert.code === "stale_opportunity" && alert.recordId === staleId),
    "Stale opportunity alert did not fire",
  );
  await db.update(opportunities).set({ archivedAt: new Date() }).where(eq(opportunities.id, staleId));

  console.log("TEST 4 — PII exports require permission");
  let piiBlocked = false;
  try {
    await exportReportCsv({
      actor: recruiter,
      organizationId: INTERNAL_ORG_ID,
      category: "talent",
      filters: {},
      includePii: true,
    });
  } catch {
    piiBlocked = true;
  }
  assert(piiBlocked, "Recruiter must not export Restricted PII");
  const allowed = await exportReportCsv({
    actor: partner,
    organizationId: INTERNAL_ORG_ID,
    category: "talent",
    filters: {},
    includePii: true,
  });
  assert(allowed.filename.includes("restricted"), "PII export filename should be marked restricted");
  const [piiAudit] = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.action, "report.exported_pii"))
    .limit(1);
  assert(piiAudit, "PII export must write an audit event");

  console.log("TEST 5 — IDOR / privilege escalation blocked");
  const foreign = await getCompanyGraph(COMPANY_ID, randomUUID());
  assert(foreign == null, "Company graph must not leak across organization scope");
  const hiddenCandidate = await getCandidateWithRelationships(CANDIDATE_ID, randomUUID());
  assert(hiddenCandidate == null, "Candidate record must not leak across organization scope");

  console.log("TEST 6 — rate limits work");
  const { consumeMemoryBucket, resetMemoryRateLimits } = await import("../lib/security/rate-limit");
  resetMemoryRateLimits();
  consumeMemoryBucket({ key: "phase8", limit: 2, windowSeconds: 60 });
  consumeMemoryBucket({ key: "phase8", limit: 2, windowSeconds: 60 });
  assert(consumeMemoryBucket({ key: "phase8", limit: 2, windowSeconds: 60 }).allowed === false, "Expected rate limit to block");

  console.log("TEST 7 — system health reports accurately");
  const health = await getSystemHealth();
  const database = health.checks.find((check) => check.title === "Database");
  assert(database?.ok, `Database health failed: ${database?.detail ?? "missing"}`);
  assert(
    health.checks.every((check) => !/sk_live|sk_test|postgres(?:ql)?:\/\/\S+|password=/i.test(check.detail)),
    "Health details leaked a secret",
  );
  assert(
    /phase(?:8|9|10)/.test(health.seedVersion),
    "Seed version should reflect Phase 8 or later",
  );

  console.log("TEST 8 — production seed cannot load fixtures");
  const env = process.env as { NODE_ENV?: string; ALLOW_DEV_SEED?: string };
  const previous = env.NODE_ENV;
  env.NODE_ENV = "production";
  delete env.ALLOW_DEV_SEED;
  const { resetServerEnvCache } = await import("../lib/env");
  resetServerEnvCache();
  let guarded = false;
  try {
    assertDevSeedAllowed();
  } catch (error) {
    guarded = error instanceof SeedGuardError;
  }
  env.NODE_ENV = previous;
  resetServerEnvCache();
  assert(guarded, "Development fixtures must be blocked when NODE_ENV=production");

  console.log("TEST 9 — privacy deletion works");
  const candidateId = randomUUID();
  await db.insert(candidates).values({
    id: candidateId,
    organizationId: INTERNAL_ORG_ID,
    fullName: "Phase 8 Privacy Subject",
    email: "phase8-privacy@example.test",
    phone: "555-0100",
    currentTitle: "Electrician",
  });
  const deleted = await executePrivacyDeletion({
    actor: partner,
    candidateId,
    reason: "Phase 8 acceptance privacy deletion",
  });
  assert(deleted.fullName === "REDACTED CANDIDATE", "Name was not anonymized");
  assert(deleted.email?.startsWith("redacted-"), "Email was not anonymized");
  assert(deleted.privacyDeletedAt, "privacy_deleted_at missing");
  assert(deleted.doNotContact, "Do-not-contact should be set");
  const [request] = await db
    .select()
    .from(privacyDeletionRequests)
    .where(eq(privacyDeletionRequests.candidateId, candidateId))
    .limit(1);
  assert(request?.status === "completed", "Privacy deletion request was not completed");
  const hidden = await getCandidateWithRelationships(candidateId, INTERNAL_ORG_ID);
  assert(hidden == null, "Privacy-deleted candidate should not appear in operating reads");

  console.log("TEST 10 — deployment docs are complete");
  for (const relative of [
    "docs/operations/WORKFORCEOS_OPERATING_PLAYBOOK.md",
    "docs/operations/ADMIN_RUNBOOK.md",
    "docs/operations/INCIDENT_RESPONSE.md",
    "docs/operations/MIGRATION_RUNBOOK.md",
    "docs/operations/PERFORMANCE_AUDIT.md",
    "docs/operations/DISASTER_RECOVERY.md",
    "docs/operations/PILOT_PLAN.md",
    "docs/requirements/POST_LAUNCH_BACKLOG.md",
    "docs/database/INDEX_REVIEW.md",
    "docs/architecture/DATABASE_DEPLOYMENT.md",
    "docs/architecture/VERCEL_DEPLOYMENT_CHECKLIST.md",
  ]) {
    assert(existsSync(path.join(root, relative)), `Missing ${relative}`);
  }

  console.log("TEST 11 — backup/recovery procedure documented");
  const { readFileSync } = await import("node:fs");
  const playbook = readFileSync(path.join(root, "docs/operations/WORKFORCEOS_OPERATING_PLAYBOOK.md"), "utf8");
  const databaseDoc = readFileSync(path.join(root, "docs/architecture/DATABASE_DEPLOYMENT.md"), "utf8");
  assert(/PITR|point-in-time/i.test(playbook) && /PITR|point-in-time/i.test(databaseDoc), "Backup/PITR procedure missing");
  assert(/rollback/i.test(playbook), "Rollback procedure missing");

  console.log("TEST 12 — prior phase scripts exist");
  for (const relative of [
    "scripts/test-phase2.ts",
    "scripts/test-db-acceptance.ts",
    "scripts/test-phase3.ts",
    "scripts/test-phase4.ts",
    "scripts/test-phase5.ts",
    "scripts/test-phase6.ts",
    "scripts/test-phase7.ts",
  ]) {
    assert(existsSync(path.join(root, relative)), `Missing ${relative}`);
  }

  console.log("Phase 8 acceptance passed.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
