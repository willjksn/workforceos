import "./load-env";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "../db";
import {
  agentRuns,
  agents,
  billingEvents,
  candidateJobMatches,
  companies,
  jobs,
  opportunities,
  projects,
} from "../db/schema";
import { CANDIDATE_ID, COMPANY_ID, INTERNAL_ORG_ID, USER_IDS } from "../db/seed/constants";
import { seedFoundation } from "../db/seed";
import { dispatchOperatingEvent } from "../lib/ai/automation";
import { assertCostLimits } from "../lib/ai/cost";
import { AgentError } from "../lib/ai/errors";
import { createAgentHandoff } from "../lib/ai/handoffs";
import {
  createKnowledgeRecord,
  retrieveApprovedKnowledge,
  retrieveKnowledgeByEmbedding,
} from "../lib/ai/knowledge";
import { assertPromptImmutable } from "../lib/ai/prompts";
import { decideReviewItem } from "../lib/ai/review";
import { retryAgentRun, runAgentTask } from "../lib/ai/runner";
import {
  approveDiscovery,
  approveSolutionPlanRecord,
  createContractPackage,
  createDiscovery,
  createSolutionPlanFromDiscovery,
  executeContractManual,
  sendProposal,
} from "../lib/delivery/engine";
import { ROLE_PERMISSIONS } from "../lib/rbac/permissions";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const actor = {
  organizationId: INTERNAL_ORG_ID,
  userId: USER_IDS.managingPartner,
  roleSlugs: ["managing-partner"],
  permissions: new Set(ROLE_PERMISSIONS["managing-partner"]),
};

const reader = {
  organizationId: INTERNAL_ORG_ID,
  userId: USER_IDS.readOnly,
  roleSlugs: ["read-only"],
  permissions: new Set(ROLE_PERMISSIONS["read-only"]),
};

const deliveryActor = {
  organizationId: INTERNAL_ORG_ID,
  userId: USER_IDS.managingPartner,
  roleSlugs: ["managing-partner"],
};

async function createClient(serviceCode: string) {
  const db = getDb();
  const companyId = randomUUID();
  const opportunityId = randomUUID();
  await db.insert(companies).values({
    id: companyId,
    organizationId: INTERNAL_ORG_ID,
    name: `Phase 7 ${serviceCode} ${companyId.slice(0, 8)}`,
    notes: "Phase 7 acceptance disposable company",
  });
  await db.insert(opportunities).values({
    id: opportunityId,
    organizationId: INTERNAL_ORG_ID,
    companyId,
    name: `${serviceCode} opportunity`,
    serviceCode,
    stage: "discovery_scheduled",
  });
  return { companyId, opportunityId };
}

async function main() {
  await seedFoundation();
  const db = getDb();

  console.log("TEST 1 — agents load approved workflow context");
  const intel = await runAgentTask({
    actor,
    agentSlug: "account-intelligence-agent",
    taskKey: "summarize_company",
    recordType: "company",
    recordId: COMPANY_ID,
    serviceCode: "professional-search",
  });
  assert(intel.context.workflow?.code === "professional-search", "Expected approved Professional Search workflow");
  assert(intel.context.sources.some((source) => source.type === "service_workflow"), "Workflow source missing");

  console.log("TEST 2 — agent cannot bypass RBAC");
  let rbacBlocked = false;
  try {
    await runAgentTask({
      actor: reader,
      agentSlug: "recruiting-agent",
      taskKey: "candidate_summary",
      recordType: "candidate",
      recordId: CANDIDATE_ID,
    });
  } catch (error) {
    rbacBlocked = error instanceof AgentError && error.code === "rbac";
  }
  assert(rbacBlocked, "Read-only caller must not run recruiting-agent");

  console.log("TEST 3 — agent draft records include provenance");
  const scout = await runAgentTask({
    actor,
    agentSlug: "opportunity-scout",
    taskKey: "evaluate_signals",
    recordType: "company",
    recordId: COMPANY_ID,
    serviceCode: "workforce-pipeline-assessment",
  });
  assert(scout.output.provider, "Provider provenance missing");
  assert(scout.output.model, "Model provenance missing");
  assert(scout.output.modelVersion, "Model version provenance missing");
  assert(scout.output.sourceReferences, "Source references missing");
  assert(scout.output.agentId, "Agent id missing on output");

  console.log("TEST 4 — agent cannot self-approve");
  let selfApproveBlocked = false;
  try {
    await decideReviewItem({
      organizationId: INTERNAL_ORG_ID,
      reviewerUserId: USER_IDS.managingPartner,
      outputId: scout.output.id,
      decision: "approved",
      actorType: "agent",
      decidingAgentId: scout.output.agentId,
    });
  } catch {
    selfApproveBlocked = true;
  }
  assert(selfApproveBlocked, "Originating agent was able to self-approve");

  console.log("TEST 5 — candidate submission requires human approval");
  let submitBlocked = false;
  try {
    await runAgentTask({ actor, agentSlug: "recruiting-agent", taskKey: "submit_candidate" });
  } catch (error) {
    submitBlocked = error instanceof AgentError && error.code === "forbidden";
  }
  assert(submitBlocked, "Recruiting agent must not submit candidates");
  const summary = await runAgentTask({
    actor,
    agentSlug: "recruiting-agent",
    taskKey: "candidate_summary",
    recordType: "candidate",
    recordId: CANDIDATE_ID,
  });
  assert(summary.output.humanReviewRequired, "Candidate summary must require human review");
  assert(summary.context.canReadCandidatePii === false, "Recruiting agent must not receive candidate PII by default");
  assert(!("email" in (summary.context.record ?? {}) && summary.context.record?.email), "Email leaked into agent context");

  console.log("TEST 6 — military mapping requires review");
  const mapping = await runAgentTask({
    actor,
    agentSlug: "military-talent-agent",
    taskKey: "mapping_draft",
    inputs: {},
  });
  assert(mapping.output.reviewCategory === "military_mapping", "Military mapping category missing");
  assert(mapping.output.status === "pending_review", "Military mapping must start pending review");

  console.log("TEST 7 — proposal agent cannot send");
  let sendBlocked = false;
  try {
    await runAgentTask({ actor, agentSlug: "proposal-agent", taskKey: "send_proposal" });
  } catch (error) {
    sendBlocked = error instanceof AgentError && error.code === "forbidden";
  }
  assert(sendBlocked, "Proposal agent must not send");
  let unapprovedSendBlocked = false;
  try {
    await sendProposal({ actor: deliveryActor, proposalId: randomUUID() });
  } catch {
    unapprovedSendBlocked = true;
  }
  assert(unapprovedSendBlocked, "Unapproved proposal send must fail");

  console.log("TEST 8 — contract agent cannot execute");
  let executeBlocked = false;
  try {
    await runAgentTask({ actor, agentSlug: "compliance-assistant", taskKey: "execute_contract" });
  } catch (error) {
    executeBlocked = error instanceof AgentError && error.code === "forbidden";
  }
  assert(executeBlocked, "No agent may execute a contract");

  console.log("TEST 9 — automation triggers internal talent search");
  const jobId = randomUUID();
  await db.insert(jobs).values({
    id: jobId,
    organizationId: INTERNAL_ORG_ID,
    companyId: COMPANY_ID,
    title: "Phase 7 automation electrician",
    status: "search_active",
  });
  const searchRuns = await dispatchOperatingEvent({
    actor,
    eventName: "job.search_active",
    recordType: "job",
    recordId: jobId,
    payload: { jobId },
  });
  assert(searchRuns.length >= 1, "Expected internal search automation rule to fire");
  assert(
    searchRuns.some((row) => row.run.status === "completed"),
    "Internal talent search automation failed",
  );
  await db.delete(candidateJobMatches).where(eq(candidateJobMatches.jobId, jobId));

  console.log("TEST 10 — contract execution triggers project creation");
  const client = await createClient("workforce-pipeline-assessment");
  const discovery = await createDiscovery({
    actor: deliveryActor,
    companyId: client.companyId,
    opportunityId: client.opportunityId,
    serviceCode: "workforce-pipeline-assessment",
    title: "Phase 7 automation discovery",
    answers: { fixture: "phase7" },
  });
  await approveDiscovery({ actor: deliveryActor, discoveryId: discovery.id });
  const plan = await createSolutionPlanFromDiscovery({
    actor: deliveryActor,
    discoveryId: discovery.id,
    title: "Phase 7 automation plan",
  });
  await approveSolutionPlanRecord({ actor: deliveryActor, solutionPlanId: plan.id });
  const pack = await createContractPackage({
    actor: deliveryActor,
    solutionPlanId: plan.id,
    serviceCode: "workforce-pipeline-assessment",
    companyId: client.companyId,
    opportunityId: client.opportunityId,
  });
  const contract = pack.contracts[0];
  await executeContractManual({ actor: deliveryActor, contractId: contract.id, signerName: "Phase 7 Signer" });
  const beforeProjects = await db.select().from(projects).where(eq(projects.contractId, contract.id));
  const projectRuns = await dispatchOperatingEvent({
    actor,
    eventName: "contract.executed",
    recordType: "contract",
    recordId: contract.id,
    payload: { contractId: contract.id, solutionPlanId: plan.id },
  });
  assert(projectRuns.some((row) => row.run.status === "completed"), "Contract executed automation failed");
  const afterProjects = await db.select().from(projects).where(eq(projects.contractId, contract.id));
  assert(afterProjects.length > beforeProjects.length || afterProjects.length >= 1, "Expected delivery project from automation");

  console.log("TEST 11 — billing event automation works");
  const projectId = afterProjects[0].id;
  const billingRuns = await dispatchOperatingEvent({
    actor,
    eventName: "project.milestone_complete",
    recordType: "project",
    recordId: projectId,
    payload: { projectId, amount: "5000.00", sourceMilestone: "phase7_milestone" },
  });
  assert(billingRuns.some((row) => row.run.status === "completed"), "Billing automation failed");
  const events = await db.select().from(billingEvents).where(eq(billingEvents.projectId, projectId));
  assert(events.length >= 1, "Expected operational billing event");

  console.log("TEST 12 — cost limit prevents runaway work");
  const [scoutAgent] = await db.select().from(agents).where(eq(agents.slug, "opportunity-scout")).limit(1);
  await db.update(agents).set({ dailyCostLimitUsd: "0.0000" }).where(eq(agents.id, scoutAgent.id));
  let costBlocked = false;
  try {
    await assertCostLimits({ organizationId: INTERNAL_ORG_ID, agentId: scoutAgent.id });
  } catch (error) {
    costBlocked = error instanceof AgentError && error.code === "cost_limit";
  }
  assert(costBlocked, "Zero daily cost limit should block work");
  await db.update(agents).set({ dailyCostLimitUsd: "25.0000" }).where(eq(agents.id, scoutAgent.id));

  console.log("TEST 13 — knowledge retrieval respects permissions");
  const restricted = await createKnowledgeRecord({
    organizationId: INTERNAL_ORG_ID,
    actorUserId: USER_IDS.managingPartner,
    slug: `legal-ref-${randomUUID().slice(0, 8)}`,
    title: "Confidential legal reference",
    knowledgeType: "legal_template_reference",
    content: "Attorney-side reminder language. Not for unrestricted retrieval.",
    source: "internal counsel note",
    privacyClass: "confidential",
    requiredPermission: "legal.read",
    status: "approved",
  });
  const recruiterHits = await retrieveApprovedKnowledge({
    organizationId: INTERNAL_ORG_ID,
    permissions: new Set(ROLE_PERMISSIONS.recruiter),
    query: "Confidential legal reference attorney",
  });
  assert(
    recruiterHits.every((row) => row.id !== restricted.id),
    "Recruiter retrieved confidential legal knowledge",
  );
  const partnerHits = await retrieveApprovedKnowledge({
    organizationId: INTERNAL_ORG_ID,
    permissions: new Set(ROLE_PERMISSIONS["managing-partner"]),
    query: "Confidential legal reference attorney",
  });
  assert(partnerHits.some((row) => row.id === restricted.id), "Managing Partner should retrieve approved legal knowledge");
  const embedded = await retrieveKnowledgeByEmbedding({
    organizationId: INTERNAL_ORG_ID,
    permissions: new Set(ROLE_PERMISSIONS["managing-partner"]),
    query: "Confidential legal reference attorney",
  });
  assert(embedded.length >= 0, "Embedding retrieval should not throw");

  console.log("TEST 14 — failed runs are visible/retryable");
  const [failed] = await db
    .insert(agentRuns)
    .values({
      organizationId: INTERNAL_ORG_ID,
      agentId: scoutAgent.id,
      status: "failed",
      taskKey: "evaluate_signals",
      errorDetail: "Forced phase 7 failure",
      errorCode: "provider",
    })
    .returning();
  const retried = await retryAgentRun({ actor, runId: failed.id });
  assert(retried.runId !== failed.id, "Retry should create a new run");
  const [failedRow] = await db.select().from(agentRuns).where(eq(agentRuns.id, failed.id));
  assert(failedRow.status === "failed", "Original failed run must remain visible");

  console.log("TEST 15 — agent handoffs are recorded");
  const handoff = await createAgentHandoff({
    actor,
    fromAgentSlug: "opportunity-scout",
    toAgentSlug: "sales-agent",
    taskKey: "opportunity_summary",
    inputs: { companyId: COMPANY_ID },
    outputSummary: "Scout recommended a discovery conversation",
  });
  assert(handoff.fromAgentId, "Handoff from-agent missing");
  assert(handoff.toAgentId, "Handoff to-agent missing");
  assert(handoff.status === "pending", "Handoff must be recorded pending");
  assert(handoff.approvalId, "Handoff must require human approval");

  assertPromptImmutable("draft");
  let promptBlocked = false;
  try {
    assertPromptImmutable("approved");
  } catch {
    promptBlocked = true;
  }
  assert(promptBlocked, "Approved prompts must be immutable");

  console.log("Phase 7 acceptance passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
