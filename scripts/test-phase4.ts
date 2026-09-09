import "./load-env";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "../db";
import { auditEvents, expansionRecommendations, projectDeliverables, projects } from "../db/schema";
import { INTERNAL_ORG_ID, USER_IDS } from "../db/seed/constants";
import { seedFoundation } from "../db/seed";
import { SERVICE_IDS } from "../db/seed/service-catalog";
import {
  approveDeliverable,
  approveDiscovery,
  approveProposal,
  approveSolutionPlanRecord,
  closeProject,
  createContractPackage,
  createDeliveryProject,
  createDiscovery,
  createProposalFromPlan,
  createProposalVersion,
  createServiceVersion,
  createSolutionPlanFromDiscovery,
  DeliveryError,
  executeContractManual,
  loadApprovedWorkflow,
  markDeliverableDelivered,
  sendProposal,
  submitProposalForReview,
  triggerBillingEvent,
} from "../lib/delivery/engine";
import { companies, opportunities } from "../db/schema";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const actor = {
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
    name: `Phase 4 ${serviceCode} ${companyId.slice(0, 8)}`,
    notes: "Phase 4 acceptance disposable company",
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

async function engagement(serviceCode: string, title: string) {
  const client = await createClient(serviceCode);
  const discovery = await createDiscovery({
    actor,
    companyId: client.companyId,
    opportunityId: client.opportunityId,
    serviceCode,
    title: `${title} discovery`,
    answers: { fixture: title },
  });
  await approveDiscovery({ actor, discoveryId: discovery.id });
  const plan = await createSolutionPlanFromDiscovery({
    actor,
    discoveryId: discovery.id,
    title: `${title} plan`,
  });
  const approved = await approveSolutionPlanRecord({ actor, solutionPlanId: plan.id });
  return { ...client, discovery, plan: approved };
}

async function main() {
  await seedFoundation();
  const db = getDb();

  console.log("TEST 1 — Professional Search opportunity, discovery, approved solution plan");
  const search = await engagement("professional-search", "PS");
  assert(search.plan.status === "approved", "Solution plan was not approved");
  const workflow = await loadApprovedWorkflow("professional-search");
  assert(workflow.steps.length > 0, "Approved workflow missing");
  assert(workflow.version.reviewStatus === "approved", "Active version is not approved");

  console.log("TEST 2 — Generate proposal from solution plan, internal review, then human-approve");
  const proposalBundle = await createProposalFromPlan({ actor, solutionPlanId: search.plan.id });
  const reviewed = await submitProposalForReview({ actor, proposalId: proposalBundle.proposal.id });
  assert(reviewed.status === "internal_review", "Proposal was not submitted for internal review");
  const approvedProposal = await approveProposal({ actor, proposalId: reviewed.id });
  assert(approvedProposal.status === "approved", "Proposal was not approved");

  console.log("TEST 3 — Create contract package for Professional Search");
  const pack = await createContractPackage({
    actor,
    serviceCode: "professional-search",
    companyId: search.companyId,
    opportunityId: search.opportunityId,
    proposalId: approvedProposal.id,
    solutionPlanId: search.plan.id,
  });
  assert(pack.contracts.length >= 1, "Contract package missing");
  assert(
    pack.contracts.some((row) => row.contractType === "direct_hire_search_agreement"),
    "Professional Search package should include a Direct Hire Search Agreement",
  );

  console.log("TEST 4 — Execute contract and create project from approved workflow");
  const executed = await executeContractManual({
    actor,
    contractId: pack.contracts[0].id,
    signerName: "Phase 4 Reviewer",
  });
  assert(executed.status === "executed", "Contract was not executed");
  const createdProject = await createDeliveryProject({
    actor,
    solutionPlanId: search.plan.id,
    contractId: executed.id,
  });
  assert(createdProject.project.status === "active", "Project was not created active");

  console.log("TEST 5 — Project contains workflow phases, tasks, and deliverables");
  assert(createdProject.phases.length >= 8, "Professional Search template should create intake-through-guarantee phases");
  const deliverables = await db
    .select()
    .from(projectDeliverables)
    .where(eq(projectDeliverables.projectId, createdProject.project.id));
  assert(deliverables.length >= 1, "Deliverables missing");

  console.log("TEST 6 — Military Talent Assessment service-specific workflow");
  const mtoa = await engagement("military-talent-opportunity-assessment", "MTOA");
  const mtoaWorkflow = await loadApprovedWorkflow("military-talent-opportunity-assessment");
  assert(mtoaWorkflow.definition?.projectTemplateCode === "military-talent-assessment-delivery", "MTOA template missing");
  assert(mtoa.discovery.recommendedServiceCode === "military-talent-opportunity-assessment", "MTOA discovery service mismatch");

  console.log("TEST 7 — TA Performance Assessment workflow");
  const ta = await engagement("ta-performance-assessment", "TA");
  const taWorkflow = await loadApprovedWorkflow("ta-performance-assessment");
  assert(taWorkflow.steps.some((step) => step.requiresHumanApproval), "TA human review step missing");
  assert(ta.plan.pricingModel === "fixed_project", "TA pricing model mismatch");

  console.log("TEST 8 — Fractional Talent Partner recurring structure");
  const fractional = await engagement("fractional-talent-partner", "FTP");
  const ftpWorkflow = await loadApprovedWorkflow("fractional-talent-partner");
  assert(ftpWorkflow.version.pricingModel === "monthly_recurring", "Fractional pricing must be monthly");
  const ftpPack = await createContractPackage({
    actor,
    serviceCode: "fractional-talent-partner",
    companyId: fractional.companyId,
    opportunityId: fractional.opportunityId,
    solutionPlanId: fractional.plan.id,
  });
  const ftpContract = await executeContractManual({
    actor,
    contractId: ftpPack.contracts[0].id,
    signerName: "Phase 4 Reviewer",
  });
  const ftpProject = await createDeliveryProject({
    actor,
    solutionPlanId: fractional.plan.id,
    contractId: ftpContract.id,
  });
  assert(ftpProject.phases.some((phase) => phase.name === "Weekly Reporting"), "Fractional weekly reporting phase missing");

  console.log("TEST 9 — Workforce Pipeline Assessment project phases");
  const workforce = await engagement("workforce-pipeline-assessment", "WPA");
  const wpaPack = await createContractPackage({
    actor,
    serviceCode: "workforce-pipeline-assessment",
    companyId: workforce.companyId,
    opportunityId: workforce.opportunityId,
    solutionPlanId: workforce.plan.id,
  });
  const wpaContract = await executeContractManual({
    actor,
    contractId: wpaPack.contracts[0].id,
    signerName: "Phase 4 Reviewer",
  });
  const wpaProject = await createDeliveryProject({
    actor,
    solutionPlanId: workforce.plan.id,
    contractId: wpaContract.id,
  });
  assert(wpaProject.phases.some((phase) => phase.name === "Military Overlay"), "Workforce military overlay phase missing");
  assert(wpaProject.phases.length >= 10, "Workforce template should include ten phases");

  console.log("TEST 10 — Unapproved proposal cannot be sent");
  const unsent = await createProposalFromPlan({ actor, solutionPlanId: mtoa.plan.id });
  let sendFailed = false;
  try {
    await sendProposal({ actor, proposalId: unsent.proposal.id });
  } catch (error) {
    sendFailed = error instanceof DeliveryError;
  }
  assert(sendFailed, "Unapproved proposal send must fail");

  console.log("TEST 11 — Client-facing deliverable without approval must fail");
  const [unapproved] = deliverables;
  let deliverFailed = false;
  try {
    await markDeliverableDelivered({ actor, deliverableId: unapproved.id });
  } catch (error) {
    deliverFailed = error instanceof DeliveryError;
  }
  assert(deliverFailed, "Unapproved client-facing deliverable must not be delivered");

  console.log("TEST 12 — Pricing outside range requires approval");
  let priceFailed = false;
  try {
    await createSolutionPlanFromDiscovery({
      actor: { ...actor, userId: USER_IDS.recruiter, roleSlugs: ["recruiter"] },
      discoveryId: search.discovery.id,
      recommendedPrice: "999999",
    });
  } catch {
    priceFailed = true;
  }
  const overridePlan = await createSolutionPlanFromDiscovery({
    actor,
    discoveryId: search.discovery.id,
    recommendedPrice: "999999",
    overrideReason: "Named exception for acceptance test",
  });
  assert(priceFailed, "Out-of-range price without override must fail");
  assert(overridePlan.pricingOverride, "Override was not recorded");

  console.log("TEST 13 — Unexecuted contract blocks project creation");
  const blockedPack = await createContractPackage({
    actor,
    serviceCode: "ta-performance-assessment",
    companyId: ta.companyId,
    opportunityId: ta.opportunityId,
    solutionPlanId: ta.plan.id,
  });
  let blocked = false;
  try {
    await createDeliveryProject({
      actor: { ...actor, roleSlugs: ["workforce-consultant"] },
      solutionPlanId: ta.plan.id,
      contractId: blockedPack.contracts[0].id,
    });
  } catch (error) {
    blocked = error instanceof DeliveryError;
  }
  assert(blocked, "Unexecuted contract must block project creation");

  console.log("TEST 14 — Authorized override is audited");
  const overridden = await createDeliveryProject({
    actor,
    solutionPlanId: ta.plan.id,
    overrideReason: "Managing Partner notice to proceed",
  });
  const overrideAudit = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.recordId, overridden.project.id));
  assert(
    overrideAudit.some((row) => row.action === "project.created" && row.reason?.includes("notice to proceed")),
    "Override audit missing",
  );

  console.log("TEST 15 — Closeout fails when required deliverables are incomplete");
  let closeFailed = false;
  try {
    await closeProject({ actor, projectId: createdProject.project.id });
  } catch (error) {
    closeFailed = error instanceof DeliveryError;
  }
  assert(closeFailed, "Closeout must fail while required deliverables are incomplete");

  console.log("TEST 16 — Closeout creates expansion recommendation");
  for (const deliverable of deliverables) {
    await approveDeliverable({ actor, deliverableId: deliverable.id });
    await markDeliverableDelivered({ actor, deliverableId: deliverable.id });
  }
  await closeProject({
    actor,
    projectId: createdProject.project.id,
    lessonsLearned: "Phase 4 acceptance",
  });
  const closed = await db.select().from(projects).where(eq(projects.id, createdProject.project.id)).limit(1);
  assert(closed[0]?.status === "completed", "Project was not completed");
  const expansions = await db
    .select()
    .from(expansionRecommendations)
    .where(eq(expansionRecommendations.projectId, createdProject.project.id));
  assert(expansions.length >= 1, "Closeout must create expansion recommendations");

  console.log("TEST 17 — Billing event generated from project/contract event");
  const billing = await triggerBillingEvent({
    actor,
    projectId: ftpProject.project.id,
    amount: "8000",
    sourceMilestone: "monthly_retainer",
  });
  assert(billing.status === "triggered", "Billing event was not triggered");

  console.log("service version immutability");
  let immutable = false;
  try {
    await createServiceVersion({
      actor,
      serviceId: SERVICE_IDS["professional-search"],
      version: workflow.version.version,
      definition: "should fail",
    });
  } catch {
    immutable = true;
  }
  assert(immutable, "Duplicate approved version number must fail");
  const next = await createServiceVersion({
    actor,
    serviceId: SERVICE_IDS["professional-search"],
    version: `v2-test-${randomUUID().slice(0, 8)}`,
    definition: "New draft version",
    copyFromVersionId: workflow.version.id,
  });
  assert(next.reviewStatus === "draft", "New versions start as drafts");

  console.log("proposal versioning after send");
  await sendProposal({ actor, proposalId: approvedProposal.id });
  const versioned = await createProposalVersion({ actor, proposalId: approvedProposal.id });
  assert(versioned.version.versionNumber === 2, "Sent proposal must version rather than overwrite");

  console.log("Phase 4 acceptance passed");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
