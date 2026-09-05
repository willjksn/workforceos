import "./load-env";

import { createHash, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "../db";
import {
  agentOutputs,
  agents,
  candidateJobMatches,
  candidates,
  files,
} from "../db/schema";
import {
  approveRequest,
  requestApproval,
} from "../lib/approvals/service";
import { getCompanyGraph, updateCompanyName } from "../lib/repositories/crm";
import { getMilitaryOccupationBundle } from "../lib/repositories/military";
import { createProjectFromSolutionPlan, getServiceBundle } from "../lib/repositories/services";
import {
  anonymizeCandidateForPrivacyTest,
  archiveCandidate,
  getCandidateWithRelationships,
  searchActiveCandidates,
} from "../lib/repositories/talent";
import { getStorageProvider } from "../lib/storage";
import {
  CANDIDATE_ID,
  COMPANY_ID,
  INTERNAL_ORG_ID,
  SOLUTION_PLAN_ID,
  USER_IDS,
} from "../db/seed/constants";
import { seedFoundation } from "../db/seed";
import { auditEvents } from "../db/schema";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  await seedFoundation();
  const db = getDb();

  console.log("TEST 1 — company graph");
  const company = await getCompanyGraph(COMPANY_ID);
  assert(company, "Company fixture missing");
  assert(company.locations.length === 3, `Expected 3 locations, found ${company.locations.length}`);
  assert(company.contacts.length === 4, `Expected 4 contacts, found ${company.contacts.length}`);
  assert(company.signals.length === 2, `Expected 2 signals, found ${company.signals.length}`);
  assert(company.opportunities.length === 1, "Expected 1 opportunity");
  await updateCompanyName({
    organizationId: INTERNAL_ORG_ID,
    companyId: COMPANY_ID,
    name: "Harbor Manufacturing",
    actorUserId: USER_IDS.managingPartner,
  });
  const companyAudit = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.recordId, COMPANY_ID));
  assert(companyAudit.length > 0, "Expected audit events for company changes");

  console.log("TEST 2 — candidate relationships");
  const candidate = await getCandidateWithRelationships(CANDIDATE_ID);
  assert(candidate, "Candidate fixture missing");
  assert(candidate.experiences.length === 2, "Expected 2 experiences");
  assert(candidate.skills.length === 8, `Expected 8 skills, found ${candidate.skills.length}`);
  assert(candidate.pools.length === 4, `Expected 4 pools, found ${candidate.pools.length}`);
  const uniquePools = new Set(candidate.pools.map((row) => row.pool.id));
  assert(uniquePools.size === 4, "Candidate pool memberships must be unique");

  console.log("TEST 3 — job matches");
  assert(candidate.matches.length === 3, `Expected 3 matches, found ${candidate.matches.length}`);
  const scores = new Set(candidate.matches.map((row) => row.match.score));
  assert(scores.size === 3, "Each job match must have an independent score");

  console.log("TEST 4 — candidate remains one record");
  const candidateCount = await db
    .select()
    .from(candidates)
    .where(eq(candidates.email, "taylor.ellis@talent.example.test"));
  assert(candidateCount.length === 1, "Candidate must not be duplicated per job/client");
  const matchCount = await db
    .select()
    .from(candidateJobMatches)
    .where(eq(candidateJobMatches.candidateId, CANDIDATE_ID));
  assert(matchCount.length === 3, "One candidate has three independent job matches");

  console.log("TEST 5 — Navy EM mappings");
  const navyEm = await getMilitaryOccupationBundle("EM", "navy");
  assert(navyEm, "Navy EM fixture missing");
  assert(navyEm.skills.length >= 10, `Expected 10+ skills, found ${navyEm.skills.length}`);
  assert(navyEm.civilianRoles.length >= 2, "Expected multiple civilian mappings");
  assert(navyEm.installations.length >= 2, "Expected multiple installations");

  console.log("TEST 6 — Military Talent Opportunity Assessment");
  const service = await getServiceBundle("military-talent-opportunity-assessment");
  assert(service, "MTOA service missing");
  assert(service.versions.length >= 1, "Expected a service version");
  assert(service.workflows.length >= 1, "Expected a versioned workflow");

  console.log("TEST 7 — project from solution plan");
  const created = await createProjectFromSolutionPlan(SOLUTION_PLAN_ID, {
    organizationId: INTERNAL_ORG_ID,
    userId: USER_IDS.managingPartner,
    roleSlugs: ["managing-partner"],
  }, { overrideReason: "Acceptance test for uncontracted Harbor MTOA plan" });
  assert(created.project.id, "Project creation failed");
  assert(created.phases.length >= 4, "Expected delivery phases from the approved workflow template");

  console.log("TEST 8 — agent recommendation approval");
  const [agent] = await db.select().from(agents).limit(1);
  assert(agent, "Agent registry missing");
  const approval = await requestApproval({
    organizationId: INTERNAL_ORG_ID,
    recordType: "agent_output",
    recordId: randomUUID(),
    approvalType: "client_facing_recommendation",
    requestingAgentId: agent.id,
    assignedReviewerUserId: USER_IDS.managingPartner,
  });
  await db.insert(agentOutputs).values({
    agentId: agent.id,
    approvalId: approval.id,
    outputType: "recommendation",
    summary: "Development fixture recommendation",
    model: "development-fixture",
    modelVersion: "dev",
    confidence: "0.5000",
  });
  const approved = await approveRequest(
    approval.id,
    USER_IDS.managingPartner,
    "Approved in acceptance test",
  );
  assert(approved.status === "approved", "Human approval failed");
  const approvalAudit = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.recordId, approval.id));
  assert(approvalAudit.length >= 2, "Expected request and decision audit events");

  console.log("TEST 9 — archived candidate excluded from search");
  const disposableId = randomUUID();
  await db.insert(candidates).values({
    id: disposableId,
    organizationId: INTERNAL_ORG_ID,
    fullName: "Archive Test Candidate",
    email: `archive-${disposableId}@example.test`,
    privacyClass: "restricted_pii",
  });
  await archiveCandidate(disposableId);
  const active = await searchActiveCandidates(INTERNAL_ORG_ID);
  assert(
    active.every((row) => row.id !== disposableId),
    "Archived candidates must be excluded from normal search",
  );
  assert(
    active.some((row) => row.id === CANDIDATE_ID),
    "Active fixture candidate should remain searchable",
  );

  console.log("TEST 10 — privacy anonymization on disposable fixture");
  const privacyId = randomUUID();
  await db.insert(candidates).values({
    id: privacyId,
    organizationId: INTERNAL_ORG_ID,
    fullName: "Privacy Test Candidate",
    email: `privacy-${privacyId}@example.test`,
    currentTitle: "Temporary title",
    privacyClass: "restricted_pii",
  });
  const redacted = await anonymizeCandidateForPrivacyTest(privacyId);
  assert(redacted.fullName === "REDACTED CANDIDATE", "Name was not anonymized");
  assert(redacted.email?.startsWith("redacted-"), "Email was not anonymized");
  await archiveCandidate(privacyId);

  console.log("Storage adapter check");
  const storage = getStorageProvider();
  const key = `acceptance/${randomUUID()}.txt`;
  const body = new TextEncoder().encode("workforceos-acceptance");
  await storage.upload({
    key,
    body,
    mimeType: "text/plain",
    filename: "acceptance.txt",
  });
  const downloaded = await storage.download(key);
  assert(
    createHash("sha256").update(downloaded).digest("hex") ===
      createHash("sha256").update(body).digest("hex"),
    "Storage download did not match upload",
  );
  await db.insert(files).values({
    organizationId: INTERNAL_ORG_ID,
    storageProvider: storage.name,
    storageKey: key,
    filename: "acceptance.txt",
    mimeType: "text/plain",
    sizeBytes: body.byteLength,
    checksum: createHash("sha256").update(body).digest("hex"),
    privacyClass: "internal",
    uploadedByUserId: USER_IDS.managingPartner,
  });
  await storage.delete(key);

  console.log("Database acceptance tests passed");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
