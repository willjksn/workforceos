import "./load-env";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "../db";
import { auditEvents, companies, opportunities } from "../db/schema";
import { ELECTRICAL_TECH_OCCUPATION_ID, INTERNAL_ORG_ID, USER_IDS } from "../db/seed/constants";
import { seedFoundation } from "../db/seed";
import {
  allocateGap,
  analyzeSkillsGap,
  approveWorkforcePlan,
  approveWorkforceRecommendation,
  calculateWorkforceGaps,
  createApprenticeship,
  createCareerPathway,
  createEducationPartner,
  createRoadmapProjectTasks,
  createScenario,
  compareScenarios,
  createTrainingProgram,
  createWorkforceAssessment,
  createWorkforcePipelinePlan,
  createWorkforceRole,
  draftAiWorkforceRecommendation,
  generateDemandForecasts,
  roleMilitaryOverlay,
  roleTalentNetworkOverlay,
  submitWorkforcePlanForApproval,
  upsertBaseline,
  upsertSupplyEntry,
  WorkforceError,
} from "../lib/workforce/engine";
import {
  approveDiscovery,
  approveSolutionPlanRecord,
  createContractPackage,
  createDeliveryProject,
  createDiscovery,
  createSolutionPlanFromDiscovery,
  executeContractManual,
} from "../lib/delivery/engine";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const actor = {
  organizationId: INTERNAL_ORG_ID,
  userId: USER_IDS.managingPartner,
  roleSlugs: ["managing-partner"],
};

const reader = {
  organizationId: INTERNAL_ORG_ID,
  userId: USER_IDS.readOnly,
  roleSlugs: ["read-only"],
};

async function main() {
  await seedFoundation();
  const db = getDb();
  const companyId = randomUUID();
  await db.insert(companies).values({
    id: companyId,
    organizationId: INTERNAL_ORG_ID,
    name: `Phase 5 energy ${companyId.slice(0, 8)}`,
    notes: "Phase 5 acceptance disposable company",
  });

  console.log("TEST 1 — Create workforce assessment");
  const assessment = await createWorkforceAssessment({
    actor,
    companyId,
    title: "Phase 5 pipeline assessment",
  });
  assert(assessment.status === "draft", "Assessment should start draft");

  console.log("TEST 2 — Create 5 workforce roles");
  const titles = [
    "Electrical Technician",
    "Maintenance Technician",
    "Engineering Technician",
    "Operations Technician",
    "Maintenance Supervisor",
  ];
  const roles = [];
  for (const title of titles) {
    roles.push(
      await createWorkforceRole({
        actor,
        companyId,
        assessmentId: assessment.id,
        title,
        civilianOccupationId: title === "Electrical Technician" ? ELECTRICAL_TECH_OCCUPATION_ID : null,
        currentHeadcount: 20,
        criticality: title.includes("Supervisor") || title.includes("Electrical") ? "critical" : "high",
      }),
    );
  }
  assert(roles.length === 5, "Expected 5 roles");

  console.log("TEST 3 — Create baseline headcount and assumptions");
  for (const role of roles) {
    await upsertBaseline({
      actor,
      assessmentId: assessment.id,
      roleId: role.id,
      currentHeadcount: 20,
      vacancies: 4,
      attritionRatePercent: 10,
      retirementEligibilityRatePercent: 5,
      internalMobilityRatePercent: 3,
    });
  }

  console.log("TEST 4 — Generate 12/24/36-month demand forecast");
  const forecast = await generateDemandForecasts({ actor, assessmentId: assessment.id });
  assert(forecast.forecasts.length === 3, "Expected 12/24/36 forecasts");
  assert(forecast.results.some((row) => row.horizonMonths === 12), "Missing 12-month result");
  assert(forecast.results.some((row) => row.horizonMonths === 36), "Missing 36-month result");
  assert(forecast.results.every((row) => row.confidence), "Forecasts must store confidence");

  console.log("TEST 5 — Create supply model");
  for (const role of roles) {
    await upsertSupplyEntry({
      actor,
      assessmentId: assessment.id,
      roleId: role.id,
      sourceType: "internal_mobility",
      estimatedSupply: 3,
    });
    await upsertSupplyEntry({
      actor,
      assessmentId: assessment.id,
      roleId: role.id,
      sourceType: "talent_network",
      estimatedSupply: 2,
      quality: "internal_only",
    });
  }

  console.log("TEST 6 — Calculate workforce gaps");
  const gaps = await calculateWorkforceGaps({ actor, assessmentId: assessment.id, horizonMonths: 24 });
  assert(gaps.length >= 5, "Expected gaps for each role");
  assert(gaps.every((gap) => ["critical", "high", "moderate", "low"].includes(gap.severity)), "Severity must be stored");

  console.log("TEST 7 — Military overlay returns occupations/installations");
  const military = await roleMilitaryOverlay({ actor, roleId: roles[0].id });
  assert(military.occupations.length >= 1, "Electrical technician should map to stored military occupations");
  assert(military.installations.length >= 1, "Expected installations from Phase 3 mappings");

  console.log("TEST 8 — Internal Talent Network aggregate supply");
  const talent = await roleTalentNetworkOverlay({ actor, roleId: roles[0].id });
  assert(talent.matchingCandidates >= 0, "Aggregate count required");
  assert(talent.notes.includes("PII"), "Executive overlay must stay aggregate");

  console.log("TEST 9 — Allocate gap across sources");
  const allocation = await allocateGap({
    actor,
    gapId: gaps[0].id,
    allocations: [
      { sourceType: "military", plannedCount: 25 },
      { sourceType: "apprenticeship", plannedCount: 20 },
      { sourceType: "community_college", plannedCount: 20 },
      { sourceType: "internal_mobility", plannedCount: 15 },
      { sourceType: "external_recruiting", plannedCount: 20 },
    ],
  });
  assert(allocation.allocations.length === 5, "Expected five source allocations");

  console.log("TEST 10 — Pipeline plan warns when capacity < gap");
  const short = await allocateGap({
    actor,
    gapId: gaps[1].id,
    allocations: [{ sourceType: "external_recruiting", plannedCount: 1 }],
  });
  assert(short.coverage.warning, "Expected capacity warning");
  assert(short.coverage.coversGap === false, "1 planned should not cover a larger gap");

  console.log("TEST 11 — Create education partner");
  const partner = await createEducationPartner({
    actor,
    name: "Phase 5 Community College",
    partnerType: "community_college",
    companyId,
  });
  assert(partner.id, "Partner missing");

  console.log("TEST 12 — Create training program");
  const program = await createTrainingProgram({
    actor,
    name: "Phase 5 electrical bridge",
    partnerId: partner.id,
  });
  assert(program.completionRatePercent == null, "Do not fabricate completion rates");

  console.log("TEST 13 — Create career pathway with multiple levels");
  const path = await createCareerPathway({
    actor,
    companyId,
    name: "Technician path",
    levels: [
      { title: "Technician I" },
      { title: "Technician II" },
      { title: "Senior Technician" },
      { title: "Lead Technician" },
      { title: "Supervisor" },
    ],
  });
  assert(path.levels.length === 5, "Expected five levels");

  console.log("TEST 14 — Skills gap analysis identifies missing skill");
  const skillGap = await analyzeSkillsGap({
    actor,
    roleId: roles[0].id,
    assessmentId: assessment.id,
    scope: "aggregate",
    currentSkillIds: [],
  });
  assert(
    skillGap.missingSkillIds.length > 0 || skillGap.analysis.missingSkillsSummary !== "None",
    "Expected a missing skill when current skills are empty",
  );

  console.log("TEST 15 — Create two scenarios and compare");
  const base = await createScenario({
    actor,
    assessmentId: assessment.id,
    name: "Base growth",
    deltas: { growthDeltaPercent: 0 },
  });
  const high = await createScenario({
    actor,
    assessmentId: assessment.id,
    name: "High growth",
    deltas: { growthDeltaPercent: 10 },
  });
  const compared = await compareScenarios({
    actor,
    assessmentId: assessment.id,
    scenarioIds: [base.scenario.id, high.scenario.id],
  });
  assert(compared.scenarios.length === 2, "Expected two scenarios");
  assert(compared.notice.includes("not a guaranteed"), "Scenarios must not be presented as certain");

  console.log("TEST 16 — AI-created recommendation requires human approval");
  const draft = await draftAiWorkforceRecommendation({
    actor,
    assessmentId: assessment.id,
    kind: "analyst",
  });
  assert(draft.recommendation.status === "pending_approval", "AI draft must not be auto-approved");
  assert(draft.recommendation.generatedByActorType === "agent", "Draft should be agent-originated");

  console.log("TEST 17 — Human approval recorded/audited");
  const approved = await approveWorkforceRecommendation({
    actor,
    recommendationId: draft.recommendation.id,
    notes: "Phase 5 human review",
  });
  assert(approved.recommendation.status === "approved", "Human approval failed");
  const recommendationAudit = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.recordId, draft.recommendation.id));
  assert(recommendationAudit.length >= 1, "Expected recommendation audit events");

  console.log("TEST 18 — Create Workforce Pipeline Plan deliverable");
  const [opportunity] = await db
    .insert(opportunities)
    .values({
      organizationId: INTERNAL_ORG_ID,
      companyId,
      name: "Phase 5 WPA",
      serviceCode: "workforce-pipeline-assessment",
      stage: "discovery_scheduled",
    })
    .returning();
  const discovery = await createDiscovery({
    actor,
    companyId,
    opportunityId: opportunity.id,
    serviceCode: "workforce-pipeline-assessment",
    title: "Phase 5 WPA discovery",
    answers: { fixture: "true" },
  });
  await approveDiscovery({ actor, discoveryId: discovery.id });
  const plan = await createSolutionPlanFromDiscovery({ actor, discoveryId: discovery.id, title: "Phase 5 WPA plan" });
  await approveSolutionPlanRecord({ actor, solutionPlanId: plan.id });
  const pack = await createContractPackage({
    actor,
    serviceCode: "workforce-pipeline-assessment",
    companyId,
    opportunityId: plan.opportunityId,
    solutionPlanId: plan.id,
  });
  await executeContractManual({ actor, contractId: pack.contracts[0].id, signerName: "Phase 5 Reviewer" });
  const project = await createDeliveryProject({ actor, solutionPlanId: plan.id, contractId: pack.contracts[0].id });
  const linked = await createWorkforceAssessment({
    actor,
    companyId,
    title: "Phase 5 linked WPA",
    projectId: project.project.id,
    opportunityId: plan.opportunityId,
    solutionPlanId: plan.id,
  });
  for (const title of titles) {
    const role = await createWorkforceRole({
      actor,
      companyId,
      assessmentId: linked.id,
      title: `${title} linked`,
      currentHeadcount: 10,
    });
    await upsertBaseline({
      actor,
      assessmentId: linked.id,
      roleId: role.id,
      currentHeadcount: 10,
      vacancies: 2,
      attritionRatePercent: 8,
    });
  }
  await generateDemandForecasts({ actor, assessmentId: linked.id });
  await calculateWorkforceGaps({ actor, assessmentId: linked.id });
  const pipelinePlan = await createWorkforcePipelinePlan({ actor, assessmentId: linked.id });
  assert(pipelinePlan.htmlBody?.includes("PierOne"), "Plan should use PierOne report layout");

  console.log("TEST 19 — Approved roadmap creates project tasks");
  const submitted = await submitWorkforcePlanForApproval({ actor, planId: pipelinePlan.id });
  await approveWorkforcePlan({ actor, planId: submitted.plan.id });
  const tasks = await createRoadmapProjectTasks({ actor, assessmentId: linked.id });
  assert(tasks.length >= 4, "Expected roadmap tasks on the delivery project");

  console.log("TEST 20 — Unauthorized user cannot access restricted workforce writes");
  let blocked = false;
  try {
    await createWorkforceAssessment({
      actor: reader,
      companyId,
      title: "Should fail",
    });
  } catch (error) {
    blocked = error instanceof WorkforceError;
  }
  assert(blocked, "Read-only user must not create assessments");

  await createApprenticeship({ actor, companyId, sponsorName: "Phase 5 sponsor" });
  console.log("Phase 5 acceptance passed");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
