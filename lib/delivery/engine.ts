import { and, asc, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";

import { getDb } from "../../db";
import {
  billingEvents,
  companies,
  contracts,
  discoveries,
  esignEnvelopes,
  expansionRecommendations,
  legalPackages,
  legalTemplates,
  opportunities,
  projectCloseouts,
  projectDeliverables,
  projectIssues,
  projectKpis,
  projectMeetings,
  projectPhases,
  projectRisks,
  projects,
  projectTasks,
  projectTemplateDeliverables,
  projectTemplatePhases,
  projectTemplates,
  projectTemplateTasks,
  proposalVersions,
  proposals,
  serviceVersions,
  serviceWorkflowDefinitions,
  serviceWorkflows,
  services,
  solutionPlans,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { isLiveAiConfigured, resolveAiProviderName } from "../ai/capabilities";
import { getServerEnv } from "../env";
import { roleSlugsHavePermission } from "../rbac/permissions";
import {
  assertApprovedVersionImmutable,
  assertCanDeliverClientFacing,
  assertCanApproveProposal,
  assertCanSendProposal,
  assertCanSubmitProposalForReview,
  assertCloseoutAllowed,
  assertProjectCreationAllowed,
  assertProposalVersionMutable,
  DeliveryError,
  projectHealthFromRisks,
  sentProposalIsImmutable,
} from "./gates";
import { legalPackageForService, primaryContractType } from "./legal-packages";
import { assertPricingApproved, describePricingModel, pricingOutsideRange } from "./pricing";
import { expansionCodesFromVersion } from "./expansion";
import { createDeliveryBillingFoundation } from "../finance/engine";
import { LEGAL_DRAFT_SOW } from "../legal/labels";

export { DeliveryError };

type Actor = {
  organizationId: string;
  userId: string;
  roleSlugs?: string[];
};

async function audit(
  actor: Actor,
  action: string,
  recordType: string,
  recordId: string,
  after: unknown,
  before?: unknown,
  reason?: string,
) {
  await recordAuditEvent({
    organizationId: actor.organizationId,
    actor: { type: "human", userId: actor.userId },
    action,
    recordType,
    recordId,
    after,
    before,
    reason,
  });
}

export async function loadApprovedWorkflow(serviceCode: string) {
  const db = getDb();
  const [service] = await db.select().from(services).where(eq(services.code, serviceCode)).limit(1);
  if (!service) throw new DeliveryError(`Service not found: ${serviceCode}`);
  const versions = await db
    .select()
    .from(serviceVersions)
    .where(eq(serviceVersions.serviceId, service.id))
    .orderBy(desc(serviceVersions.createdAt));
  const approved = versions.find((row) => row.reviewStatus === "approved");
  if (!approved) throw new DeliveryError(`No approved version for ${serviceCode}`);
  const [definition] = await db
    .select()
    .from(serviceWorkflowDefinitions)
    .where(eq(serviceWorkflowDefinitions.serviceVersionId, approved.id))
    .limit(1);
  const steps = await db
    .select()
    .from(serviceWorkflows)
    .where(eq(serviceWorkflows.serviceVersionId, approved.id))
    .orderBy(asc(serviceWorkflows.stepNumber));
  const [template] = definition?.projectTemplateCode
    ? await db
        .select()
        .from(projectTemplates)
        .where(eq(projectTemplates.code, definition.projectTemplateCode))
        .limit(1)
    : [undefined];
  return { service, version: approved, versions, definition: definition ?? null, steps, template: template ?? null };
}

export async function createServiceVersion(input: {
  actor: Actor;
  serviceId: string;
  version: string;
  definition: string;
  copyFromVersionId?: string;
}) {
  const db = getDb();
  const [service] = await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1);
  if (!service) throw new DeliveryError("Service not found");
  const [existing] = await db
    .select()
    .from(serviceVersions)
    .where(and(eq(serviceVersions.serviceId, input.serviceId), eq(serviceVersions.version, input.version)))
    .limit(1);
  if (existing) {
    throw new DeliveryError("A service version with that number already exists");
  }
  let source: typeof serviceVersions.$inferSelect | undefined;
  if (input.copyFromVersionId) {
    [source] = await db
      .select()
      .from(serviceVersions)
      .where(eq(serviceVersions.id, input.copyFromVersionId))
      .limit(1);
  }
  const [created] = await db
    .insert(serviceVersions)
    .values({
      serviceId: input.serviceId,
      version: input.version,
      definition: input.definition,
      reviewStatus: "draft",
      effectiveDate: new Date(),
      scopeDefinition: source?.scopeDefinition,
      requiredInputs: source?.requiredInputs,
      deliverables: source?.deliverables,
      kpis: source?.kpis,
      clientResponsibilities: source?.clientResponsibilities,
      firmResponsibilities: source?.firmResponsibilities,
      legalRequirements: source?.legalRequirements,
      pricingGuidance: source?.pricingGuidance,
      expansionServices: source?.expansionServices,
      pricingModel: source?.pricingModel,
      minPrice: source?.minPrice,
      maxPrice: source?.maxPrice,
      percentageFee: source?.percentageFee,
      minimumFee: source?.minimumFee,
      defaultDurationDays: source?.defaultDurationDays,
      practiceArea: source?.practiceArea,
    })
    .returning();
  if (source) {
    const [def] = await db
      .select()
      .from(serviceWorkflowDefinitions)
      .where(eq(serviceWorkflowDefinitions.serviceVersionId, source.id))
      .limit(1);
    if (def) {
      await db.insert(serviceWorkflowDefinitions).values({
        serviceVersionId: created.id,
        qualificationTriggers: def.qualificationTriggers,
        requiredDiscoveryInputs: def.requiredDiscoveryInputs,
        dataCollection: def.dataCollection,
        aiResponsibilities: def.aiResponsibilities,
        humanResponsibilities: def.humanResponsibilities,
        approvalGates: def.approvalGates,
        deliverables: def.deliverables,
        legalPackage: def.legalPackage,
        projectTemplateCode: def.projectTemplateCode,
        billingRules: def.billingRules,
        kpis: def.kpis,
        completionRules: def.completionRules,
        expansionRules: def.expansionRules,
        exceptionHandling: def.exceptionHandling,
      });
    }
    const steps = await db
      .select()
      .from(serviceWorkflows)
      .where(eq(serviceWorkflows.serviceVersionId, source.id));
    for (const step of steps) {
      await db.insert(serviceWorkflows).values({
        serviceVersionId: created.id,
        stepNumber: step.stepNumber,
        name: step.name,
        instructions: step.instructions,
        requiresHumanApproval: step.requiresHumanApproval,
        stepType: step.stepType,
        responsibleRole: step.responsibleRole,
        requiredInputs: step.requiredInputs,
        outputType: step.outputType,
        blocking: step.blocking,
        completionCriteria: step.completionCriteria,
        nextStepNumber: step.nextStepNumber,
        exceptionPath: step.exceptionPath,
      });
    }
  }
  await audit(input.actor, "service_version.created", "service_version", created.id, created);
  return created;
}

export async function approveServiceVersion(input: { actor: Actor; serviceVersionId: string }) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(serviceVersions)
    .where(eq(serviceVersions.id, input.serviceVersionId))
    .limit(1);
  if (!before) throw new DeliveryError("Service version not found");
  if (before.reviewStatus === "approved") {
    throw new DeliveryError("Service version is already approved");
  }
  const [after] = await db
    .update(serviceVersions)
    .set({ reviewStatus: "approved", updatedAt: new Date() })
    .where(eq(serviceVersions.id, input.serviceVersionId))
    .returning();
  await audit(input.actor, "service_version.approved", "service_version", after.id, after, before);
  return after;
}

export function draftFromWorkflow(input: {
  version: typeof serviceVersions.$inferSelect;
  definition: typeof serviceWorkflowDefinitions.$inferSelect | null;
  discovery?: typeof discoveries.$inferSelect | null;
  answers?: Record<string, string>;
}) {
  const env = getServerEnv();
  const answers = input.discovery?.answers ?? input.answers ?? {};
  const answerText = Object.entries(answers)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  const problem =
    input.discovery?.problemStatement ||
    answers.roleTitle ||
    answers.roles ||
    answers.headcount ||
    input.version.scopeDefinition ||
    input.version.definition;
  return {
    problemStatement: problem,
    businessImpact: input.discovery?.businessImpact || answers.businessImpact || "Documented from discovery.",
    findings: answerText || input.version.definition,
    recommendedScope: input.version.scopeDefinition ?? input.version.definition,
    requiredInputs: (input.version.requiredInputs ?? []).join("\n"),
    deliverables: (input.version.deliverables ?? []).join("\n"),
    phases: input.definition?.projectTemplateCode ?? "",
    timeline: `${input.version.defaultDurationDays ?? 30} days`,
    clientResponsibilities: input.version.clientResponsibilities,
    firmResponsibilities: input.version.firmResponsibilities,
    kpis: (input.version.kpis ?? []).join("\n"),
    risks: input.definition?.exceptionHandling,
    pricingModel: input.version.pricingModel,
    estimatedPrice: input.version.minPrice,
    recommendedPrice: input.version.minPrice,
    expansionOpportunities: (input.version.expansionServices ?? []).join(", "),
    generatedByModel: isLiveAiConfigured(env) ? resolveAiProviderName(env) : "workflow-template",
    generatedByModelVersion: input.version.version,
    generatedConfidence: "0.7000",
    sourceReferences: {
      serviceVersionId: input.version.id,
      workflowDefinitionId: input.definition?.id,
      discoveryId: input.discovery?.id,
    },
  };
}

export async function createDiscovery(input: {
  actor: Actor;
  companyId: string;
  opportunityId: string;
  serviceCode: string;
  title: string;
  answers?: Record<string, string>;
}) {
  const workflow = await loadApprovedWorkflow(input.serviceCode);
  const db = getDb();
  const [opportunity] = await db
    .select()
    .from(opportunities)
    .where(
      and(
        eq(opportunities.id, input.opportunityId),
        eq(opportunities.organizationId, input.actor.organizationId),
      ),
    )
    .limit(1);
  if (!opportunity) throw new DeliveryError("Opportunity not found");
  const draft = draftFromWorkflow({
    version: workflow.version,
    definition: workflow.definition,
    answers: input.answers,
  });
  const [created] = await db
    .insert(discoveries)
    .values({
      organizationId: input.actor.organizationId,
      companyId: input.companyId,
      opportunityId: opportunity.id,
      serviceId: workflow.service.id,
      serviceVersionId: workflow.version.id,
      title: input.title,
      status: "draft",
      answers: input.answers ?? {},
      problemStatement: draft.problemStatement,
      businessImpact: draft.businessImpact,
      rootCauses: input.answers?.rootCauses ?? input.answers?.processDelays ?? null,
      requirements: draft.requiredInputs,
      timeline: input.answers?.timeline ?? input.answers?.targetStart ?? draft.timeline,
      budget: input.answers?.budget ?? input.answers?.compensation ?? null,
      decisionMakers: input.answers?.decisionMakers ?? input.answers?.hiringManagers ?? null,
      missingData: input.answers?.missingData ?? null,
      recommendedServiceCode: workflow.service.code,
      recommendedNextServiceCode: workflow.version.expansionServices?.[0] ?? null,
      outputSummary: draft.findings,
      generatedByActorType: "system",
      generatedByModel: draft.generatedByModel,
      generatedByModelVersion: draft.generatedByModelVersion,
      generatedConfidence: draft.generatedConfidence,
    })
    .returning();
  await audit(input.actor, "discovery.created", "discovery", created.id, created);
  return created;
}

export async function approveDiscovery(input: { actor: Actor; discoveryId: string }) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(discoveries)
    .where(
      and(eq(discoveries.id, input.discoveryId), eq(discoveries.organizationId, input.actor.organizationId)),
    )
    .limit(1);
  if (!before) throw new DeliveryError("Discovery not found");
  const [after] = await db
    .update(discoveries)
    .set({
      status: "approved",
      humanApprovedAt: new Date(),
      humanApprovedByUserId: input.actor.userId,
      updatedAt: new Date(),
    })
    .where(eq(discoveries.id, input.discoveryId))
    .returning();
  await audit(input.actor, "discovery.approved", "discovery", after.id, after, before);
  return after;
}

export async function createSolutionPlanFromDiscovery(input: {
  actor: Actor;
  discoveryId: string;
  title?: string;
  recommendedPrice?: string | null;
  overrideReason?: string | null;
}) {
  const db = getDb();
  const [discovery] = await db
    .select()
    .from(discoveries)
    .where(
      and(eq(discoveries.id, input.discoveryId), eq(discoveries.organizationId, input.actor.organizationId)),
    )
    .limit(1);
  if (!discovery) throw new DeliveryError("Discovery not found");
  const [service] = await db.select().from(services).where(eq(services.id, discovery.serviceId)).limit(1);
  if (!service) throw new DeliveryError("Service not found");
  const workflow = await loadApprovedWorkflow(service.code);
  const draft = draftFromWorkflow({
    version: workflow.version,
    definition: workflow.definition,
    discovery,
  });
  const price = input.recommendedPrice ?? draft.recommendedPrice;
  const outside = pricingOutsideRange({
    price,
    minPrice: workflow.version.minPrice,
    maxPrice: workflow.version.maxPrice,
  });
  if (outside) {
    if (!roleSlugsHavePermission(input.actor.roleSlugs, "pricing.approve")) {
      throw new DeliveryError(
        "Pricing outside the configured range requires pricing.approve and an override reason",
      );
    }
    assertPricingApproved({
      price,
      minPrice: workflow.version.minPrice,
      maxPrice: workflow.version.maxPrice,
      overrideReason: input.overrideReason,
      pricingApprovedByUserId: input.actor.userId,
    });
  }
  const [plan] = await db
    .insert(solutionPlans)
    .values({
      organizationId: input.actor.organizationId,
      opportunityId: discovery.opportunityId,
      serviceVersionId: workflow.version.id,
      companyId: discovery.companyId,
      discoveryId: discovery.id,
      title: input.title ?? `${service.name} solution plan`,
      status: "draft",
      summary: draft.recommendedScope,
      problemStatement: draft.problemStatement,
      businessImpact: draft.businessImpact,
      findings: draft.findings,
      recommendedScope: draft.recommendedScope,
      requiredInputs: draft.requiredInputs,
      deliverables: draft.deliverables,
      phases: draft.phases,
      timeline: draft.timeline,
      clientResponsibilities: draft.clientResponsibilities,
      firmResponsibilities: draft.firmResponsibilities,
      kpis: draft.kpis,
      risks: draft.risks,
      pricingModel: draft.pricingModel,
      estimatedPrice: draft.estimatedPrice,
      recommendedPrice: price,
      approvedPrice: outside ? null : price,
      pricingOverride: outside,
      pricingOverrideReason: outside ? input.overrideReason : null,
      pricingApprovedByUserId: outside ? input.actor.userId : null,
      pricingApprovedAt: outside ? new Date() : null,
      expansionOpportunities: draft.expansionOpportunities,
      generatedByModel: draft.generatedByModel,
      generatedByModelVersion: draft.generatedByModelVersion,
      generatedConfidence: draft.generatedConfidence,
      sourceReferences: draft.sourceReferences,
    })
    .returning();
  await audit(input.actor, "solution_plan.created", "solution_plan", plan.id, plan);
  if (outside) {
    await audit(input.actor, "pricing.override", "solution_plan", plan.id, plan, undefined, input.overrideReason ?? undefined);
  }
  return plan;
}

export async function approveSolutionPlanRecord(input: { actor: Actor; solutionPlanId: string }) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(solutionPlans)
    .where(
      and(
        eq(solutionPlans.id, input.solutionPlanId),
        eq(solutionPlans.organizationId, input.actor.organizationId),
      ),
    )
    .limit(1);
  if (!before) throw new DeliveryError("Solution plan not found");
  const [after] = await db
    .update(solutionPlans)
    .set({
      status: "approved",
      approvedByUserId: input.actor.userId,
      approvedAt: new Date(),
      approvedPrice: before.approvedPrice ?? before.recommendedPrice,
      updatedAt: new Date(),
    })
    .where(eq(solutionPlans.id, input.solutionPlanId))
    .returning();
  await audit(input.actor, "solution_plan.approved", "solution_plan", after.id, after, before);
  return after;
}

export async function createProposalFromPlan(input: { actor: Actor; solutionPlanId: string }) {
  const db = getDb();
  const [plan] = await db
    .select()
    .from(solutionPlans)
    .where(
      and(
        eq(solutionPlans.id, input.solutionPlanId),
        eq(solutionPlans.organizationId, input.actor.organizationId),
      ),
    )
    .limit(1);
  if (!plan) throw new DeliveryError("Solution plan not found");
  if (plan.status !== "approved") {
    throw new DeliveryError("Proposal requires an approved solution plan");
  }
  const [version] = await db
    .select()
    .from(serviceVersions)
    .where(eq(serviceVersions.id, plan.serviceVersionId))
    .limit(1);
  if (!version) throw new DeliveryError("Service version not found");
  const [opportunity] = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.id, plan.opportunityId))
    .limit(1);
  if (!opportunity) throw new DeliveryError("Opportunity not found");
  const companyId = plan.companyId ?? opportunity.companyId;
  const html = renderProposalHtml({
    client: "",
    title: plan.title,
    scope: plan.recommendedScope,
    deliverables: plan.deliverables,
    timeline: plan.timeline,
    pricing: plan.approvedPrice ?? plan.recommendedPrice,
    terms: plan.clientResponsibilities,
    nextSteps: "Human-approved proposal can be sent after internal approval.",
  });
  const [proposal] = await db
    .insert(proposals)
    .values({
      organizationId: input.actor.organizationId,
      companyId,
      opportunityId: plan.opportunityId,
      solutionPlanId: plan.id,
      serviceVersionId: plan.serviceVersionId,
      title: plan.title,
      status: "draft",
      currentVersionNumber: 1,
    })
    .returning();
  const [proposalVersion] = await db
    .insert(proposalVersions)
    .values({
      proposalId: proposal.id,
      versionNumber: 1,
      executiveSummary: plan.summary,
      clientProblem: plan.problemStatement,
      recommendedSolution: plan.recommendedScope,
      scope: plan.recommendedScope,
      deliverables: plan.deliverables,
      timeline: plan.timeline,
      clientResponsibilities: plan.clientResponsibilities,
      firmResponsibilities: plan.firmResponsibilities,
      kpis: plan.kpis,
      pricing: describePricingModel(plan.pricingModel),
      pricingAmount: plan.approvedPrice ?? plan.recommendedPrice,
      paymentTerms: "Per executed contract",
      assumptions: plan.requiredInputs,
      exclusions: "Temp staffing, payroll, and work outside the approved service version.",
      nextSteps: "Internal approval, then send to the client.",
      htmlBody: html,
      generatedByModel: plan.generatedByModel,
      generatedByModelVersion: plan.generatedByModelVersion,
      generatedConfidence: plan.generatedConfidence,
      createdByUserId: input.actor.userId,
    })
    .returning();
  await audit(input.actor, "proposal.created", "proposal", proposal.id, { proposal, proposalVersion });
  return { proposal, version: proposalVersion };
}

export function renderProposalHtml(input: {
  client: string;
  title: string;
  date?: string;
  scope?: string | null;
  deliverables?: string | null;
  timeline?: string | null;
  pricing?: string | number | null;
  terms?: string | null;
  nextSteps?: string | null;
}) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(input.title)}</title>
<style>
  body { font-family: Georgia, serif; color: #0b1f33; margin: 48px; }
  h1 { font-size: 28px; margin-bottom: 8px; }
  .brand { color: #2f6f7e; letter-spacing: 0.12em; text-transform: uppercase; font-size: 12px; }
  h2 { font-size: 16px; margin-top: 28px; }
  p, li { line-height: 1.5; }
</style></head>
<body>
  <p class="brand">PierOne Partners</p>
  <h1>${escapeHtml(input.title)}</h1>
  <p>${escapeHtml(input.client || "Client")} · ${escapeHtml(input.date ?? new Date().toLocaleDateString())}</p>
  <h2>Scope</h2><p>${escapeHtml(input.scope)}</p>
  <h2>Deliverables</h2><p>${escapeHtml(input.deliverables)}</p>
  <h2>Timeline</h2><p>${escapeHtml(input.timeline)}</p>
  <h2>Pricing</h2><p>${escapeHtml(String(input.pricing ?? ""))}</p>
  <h2>Terms</h2><p>${escapeHtml(input.terms)}</p>
  <h2>Next steps</h2><p>${escapeHtml(input.nextSteps)}</p>
</body></html>`;
}

function escapeHtml(value?: string | null) {
  return (value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function submitProposalForReview(input: { actor: Actor; proposalId: string }) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.id, input.proposalId), eq(proposals.organizationId, input.actor.organizationId)))
    .limit(1);
  if (!before) throw new DeliveryError("Proposal not found");
  assertCanSubmitProposalForReview(before.status);
  const [after] = await db
    .update(proposals)
    .set({ status: "internal_review", updatedAt: new Date() })
    .where(eq(proposals.id, input.proposalId))
    .returning();
  await audit(input.actor, "proposal.internal_review", "proposal", after.id, after, before);
  return after;
}

export async function approveProposal(input: { actor: Actor; proposalId: string }) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.id, input.proposalId), eq(proposals.organizationId, input.actor.organizationId)))
    .limit(1);
  if (!before) throw new DeliveryError("Proposal not found");
  assertCanApproveProposal(before.status);
  const [after] = await db
    .update(proposals)
    .set({
      status: "approved",
      approvedByUserId: input.actor.userId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(proposals.id, input.proposalId))
    .returning();
  await audit(input.actor, "proposal.approved", "proposal", after.id, after, before);
  return after;
}

export async function sendProposal(input: { actor: Actor; proposalId: string }) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.id, input.proposalId), eq(proposals.organizationId, input.actor.organizationId)))
    .limit(1);
  if (!before) throw new DeliveryError("Proposal not found");
  assertCanSendProposal(before.status);
  const [after] = await db
    .update(proposals)
    .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
    .where(eq(proposals.id, input.proposalId))
    .returning();
  await audit(input.actor, "proposal.sent", "proposal", after.id, after, before);
  return after;
}

export async function createProposalVersion(input: { actor: Actor; proposalId: string }) {
  const db = getDb();
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.id, input.proposalId), eq(proposals.organizationId, input.actor.organizationId)))
    .limit(1);
  if (!proposal) throw new DeliveryError("Proposal not found");
  const [current] = await db
    .select()
    .from(proposalVersions)
    .where(
      and(
        eq(proposalVersions.proposalId, proposal.id),
        eq(proposalVersions.versionNumber, proposal.currentVersionNumber),
      ),
    )
    .limit(1);
  if (!current) throw new DeliveryError("Current proposal version not found");
  if (sentProposalIsImmutable(proposal.status)) {
    const nextNumber = proposal.currentVersionNumber + 1;
    const [created] = await db
      .insert(proposalVersions)
      .values({
        proposalId: proposal.id,
        versionNumber: nextNumber,
        executiveSummary: current.executiveSummary,
        clientProblem: current.clientProblem,
        recommendedSolution: current.recommendedSolution,
        scope: current.scope,
        deliverables: current.deliverables,
        timeline: current.timeline,
        clientResponsibilities: current.clientResponsibilities,
        firmResponsibilities: current.firmResponsibilities,
        kpis: current.kpis,
        pricing: current.pricing,
        pricingAmount: current.pricingAmount,
        paymentTerms: current.paymentTerms,
        assumptions: current.assumptions,
        exclusions: current.exclusions,
        nextSteps: current.nextSteps,
        htmlBody: current.htmlBody,
        createdByUserId: input.actor.userId,
      })
      .returning();
    const [superseded] = await db
      .update(proposals)
      .set({
        status: "draft",
        currentVersionNumber: nextNumber,
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, proposal.id))
      .returning();
    await audit(input.actor, "proposal.version_created", "proposal", proposal.id, created, current);
    return { proposal: superseded, version: created };
  }
  assertProposalVersionMutable(proposal.status);
  throw new DeliveryError("Edit the current draft instead of creating a version until the proposal is sent");
}

export async function createContractPackage(input: {
  actor: Actor;
  proposalId?: string;
  solutionPlanId?: string;
  serviceCode: string;
  companyId: string;
  opportunityId?: string | null;
  retained?: boolean;
}) {
  const workflow = await loadApprovedWorkflow(input.serviceCode);
  const spec = legalPackageForService(workflow.definition?.legalPackage, input.serviceCode);
  const types = input.retained
    ? spec.required.map((type) => (type === "direct_hire_search_agreement" ? "retained_search_agreement" : type))
    : spec.required;
  const db = getDb();
  const created = [];
  for (const templateType of types) {
    const [template] = await db
      .select()
      .from(legalTemplates)
      .where(eq(legalTemplates.templateType, templateType as typeof legalTemplates.$inferSelect.templateType))
      .limit(1);
    const [contract] = await db
      .insert(contracts)
      .values({
        organizationId: input.actor.organizationId,
        companyId: input.companyId,
        serviceId: workflow.service.id,
        opportunityId: input.opportunityId ?? null,
        proposalId: input.proposalId ?? null,
        solutionPlanId: input.solutionPlanId ?? null,
        contractType: templateType as typeof contracts.$inferSelect.contractType,
        templateId: template?.id ?? null,
        title: `${workflow.service.name} · ${template?.name ?? templateType}`,
        status: "draft",
        sow: template?.body ?? LEGAL_DRAFT_SOW,
      })
      .returning();
    created.push(contract);
    await db.insert(legalPackages).values({
      organizationId: input.actor.organizationId,
      serviceId: workflow.service.id,
      companyId: input.companyId,
      contractId: contract.id,
      title: contract.title,
      status: "draft",
    });
    await audit(input.actor, "contract.created", "contract", contract.id, contract);
  }
  return { contracts: created, spec };
}

export async function executeContractManual(input: {
  actor: Actor;
  contractId: string;
  signerName: string;
  executionDate?: string;
}) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(contracts)
    .where(and(eq(contracts.id, input.contractId), eq(contracts.organizationId, input.actor.organizationId)))
    .limit(1);
  if (!before) throw new DeliveryError("Contract not found");
  const executed = input.executionDate ? new Date(input.executionDate) : new Date();
  const [after] = await db
    .update(contracts)
    .set({
      status: "executed",
      signatureStatus: "manual",
      signerName: input.signerName,
      executionDate: executed,
      effectiveDate: executed,
      updatedAt: new Date(),
    })
    .where(eq(contracts.id, input.contractId))
    .returning();
  await db.insert(esignEnvelopes).values({
    contractId: after.id,
    provider: "manual",
    status: "manual",
    completedAt: new Date(),
  });
  await audit(input.actor, "contract.executed", "contract", after.id, after, before);
  return after;
}

export async function sendContractForSignature(input: {
  actor: Actor;
  contractId: string;
  signerEmail?: string | null;
}) {
  const db = getDb();
  const [contract] = await db
    .select()
    .from(contracts)
    .where(and(eq(contracts.id, input.contractId), eq(contracts.organizationId, input.actor.organizationId)))
    .limit(1);
  if (!contract) throw new DeliveryError("Contract not found");
  const { getEsignAdapter } = await import("../integrations/esign");
  const envelope = await getEsignAdapter().createEnvelope({
    contractId: contract.id,
    signerEmail: input.signerEmail,
    title: contract.title,
  });
  const [row] = await db
    .insert(esignEnvelopes)
    .values({
      contractId: contract.id,
      provider: envelope.provider,
      providerEnvelopeId: envelope.envelopeId ?? null,
      status: envelope.status === "not_configured" || envelope.status === "manual" || envelope.status === "error"
        ? "not_sent"
        : envelope.status === "completed"
          ? "sent"
          : envelope.status === "created" || envelope.status === "sent"
            ? envelope.status
            : "not_sent",
      lastError: envelope.error ?? null,
    })
    .returning();
  await db
    .update(contracts)
    .set({
      signatureStatus: envelope.status === "not_configured" ? "not_sent" : "sent",
      updatedAt: new Date(),
    })
    .where(eq(contracts.id, contract.id));
  await audit(input.actor, "docusign.envelope_created", "esign_envelope", row.id, row, {
    contractStatus: contract.status,
    executed: false,
  });
  return { contract, envelope, row };
}

export async function createDeliveryProject(input: {
  actor: Actor;
  solutionPlanId: string;
  contractId?: string | null;
  overrideReason?: string | null;
}) {
  const db = getDb();
  const [plan] = await db
    .select()
    .from(solutionPlans)
    .where(
      and(
        eq(solutionPlans.id, input.solutionPlanId),
        eq(solutionPlans.organizationId, input.actor.organizationId),
      ),
    )
    .limit(1);
  if (!plan) throw new DeliveryError("Solution plan not found");
  const [version] = await db
    .select()
    .from(serviceVersions)
    .where(eq(serviceVersions.id, plan.serviceVersionId))
    .limit(1);
  if (!version) throw new DeliveryError("Service version not found");
  const [service] = await db.select().from(services).where(eq(services.id, version.serviceId)).limit(1);
  if (!service) throw new DeliveryError("Service not found");
  const [opportunity] = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.id, plan.opportunityId))
    .limit(1);
  let contract: typeof contracts.$inferSelect | undefined;
  if (input.contractId) {
    [contract] = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.id, input.contractId), eq(contracts.organizationId, input.actor.organizationId)))
      .limit(1);
  } else {
    const rows = await db
      .select()
      .from(contracts)
      .where(
        and(
          eq(contracts.solutionPlanId, plan.id),
          eq(contracts.organizationId, input.actor.organizationId),
          eq(contracts.status, "executed"),
        ),
      )
      .limit(1);
    contract = rows[0];
  }
  assertProjectCreationAllowed({
    planStatus: plan.status,
    contractStatus: contract?.status,
    overrideReason: input.overrideReason,
    roleSlugs: input.actor.roleSlugs,
  });
  const workflow = await loadApprovedWorkflow(service.code);
  const [template] = workflow.definition?.projectTemplateCode
    ? await db
        .select()
        .from(projectTemplates)
        .where(eq(projectTemplates.code, workflow.definition.projectTemplateCode))
        .limit(1)
    : [undefined];
  const override = Boolean(input.overrideReason && !contract);
  const [project] = await db
    .insert(projects)
    .values({
      organizationId: plan.organizationId,
      solutionPlanId: plan.id,
      companyId: plan.companyId ?? opportunity?.companyId ?? null,
      serviceId: service.id,
      opportunityId: plan.opportunityId,
      contractId: contract?.id ?? null,
      ownerUserId: input.actor.userId,
      name: `${plan.title} delivery`,
      status: "active",
      contractValue: contract?.contractValue ?? plan.approvedPrice ?? plan.recommendedPrice,
      contractOverride: override,
      contractOverrideReason: override ? input.overrideReason : null,
      contractOverrideByUserId: override ? input.actor.userId : null,
      contractOverrideAt: override ? new Date() : null,
      nextMilestone: template ? undefined : workflow.steps[0]?.name,
    })
    .returning();
  if (contract) {
    await db
      .update(contracts)
      .set({ projectId: project.id, updatedAt: new Date() })
      .where(eq(contracts.id, contract.id));
  }
  const phases = [];
  if (template) {
    const templatePhases = await db
      .select()
      .from(projectTemplatePhases)
      .where(eq(projectTemplatePhases.templateId, template.id))
      .orderBy(asc(projectTemplatePhases.sequence));
    for (const templatePhase of templatePhases) {
      const [phase] = await db
        .insert(projectPhases)
        .values({
          projectId: project.id,
          name: templatePhase.name,
          sequence: templatePhase.sequence,
          description: templatePhase.description,
        })
        .returning();
      const templateTasks = await db
        .select()
        .from(projectTemplateTasks)
        .where(eq(projectTemplateTasks.phaseId, templatePhase.id))
        .orderBy(asc(projectTemplateTasks.sequence));
      for (const templateTask of templateTasks) {
        await db.insert(projectTasks).values({
          phaseId: phase.id,
          name: templateTask.name,
          description: templateTask.description,
          status: "not_started",
          requiresApproval: templateTask.requiresApproval,
          completionCriteria: templateTask.completionCriteria,
        });
      }
      phases.push(phase);
    }
    const templateDeliverables = await db
      .select()
      .from(projectTemplateDeliverables)
      .where(eq(projectTemplateDeliverables.templateId, template.id));
    for (const deliverable of templateDeliverables) {
      await db.insert(projectDeliverables).values({
        projectId: project.id,
        name: deliverable.name,
        deliverableType: deliverable.deliverableType,
        description: deliverable.description,
        required: deliverable.required,
        clientFacing: deliverable.clientFacing,
        status: "not_started",
      });
    }
  } else {
    for (const [index, step] of workflow.steps.entries()) {
      const [phase] = await db
        .insert(projectPhases)
        .values({ projectId: project.id, name: step.name, sequence: index + 1 })
        .returning();
      await db.insert(projectTasks).values({
        phaseId: phase.id,
        name: `${step.name} work`,
        status: "not_started",
        requiresApproval: step.requiresHumanApproval,
      });
      phases.push(phase);
    }
  }
  await createBillingFoundation({
    actor: input.actor,
    project,
    serviceCode: service.code,
    contract,
    plan,
  });
  await audit(
    input.actor,
    "project.created",
    "project",
    project.id,
    project,
    undefined,
    override ? input.overrideReason ?? undefined : undefined,
  );
  return { project, phases, plan, opportunity, contract: contract ?? null };
}

async function createBillingFoundation(input: {
  actor: Actor;
  project: typeof projects.$inferSelect;
  serviceCode: string;
  contract?: typeof contracts.$inferSelect;
  plan: typeof solutionPlans.$inferSelect;
}) {
  await createDeliveryBillingFoundation({
    actor: input.actor,
    project: input.project,
    serviceCode: input.serviceCode,
    serviceId: input.project.serviceId,
    contract: input.contract ?? null,
    storedAmount: input.contract?.monthlyFee ?? input.contract?.contractValue ?? input.plan.approvedPrice ?? input.plan.recommendedPrice,
  });
}

export async function triggerBillingEvent(input: {
  actor: Actor;
  projectId: string;
  amount: string;
  sourceMilestone: string;
}) {
  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, input.projectId), eq(projects.organizationId, input.actor.organizationId)))
    .limit(1);
  if (!project) throw new DeliveryError("Project not found");
  const [event] = await db
    .insert(billingEvents)
    .values({
      organizationId: input.actor.organizationId,
      companyId: project.companyId,
      projectId: project.id,
      contractId: project.contractId,
      sourceMilestone: input.sourceMilestone,
      amount: input.amount,
      expectedDate: new Date(),
      status: "triggered",
      triggeredAt: new Date(),
      notes: "Operational billing trigger only. No QuickBooks invoice was created.",
    })
    .returning();
  await audit(input.actor, "billing_event.created", "billing_event", event.id, event);
  return event;
}

export async function approveDeliverable(input: { actor: Actor; deliverableId: string }) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(projectDeliverables)
    .where(eq(projectDeliverables.id, input.deliverableId))
    .limit(1);
  if (!before) throw new DeliveryError("Deliverable not found");
  const [after] = await db
    .update(projectDeliverables)
    .set({
      status: "approved",
      approvedByUserId: input.actor.userId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(projectDeliverables.id, input.deliverableId))
    .returning();
  await audit(input.actor, "deliverable.approved", "project_deliverable", after.id, after, before);
  return after;
}

export async function markDeliverableDelivered(input: { actor: Actor; deliverableId: string }) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(projectDeliverables)
    .where(eq(projectDeliverables.id, input.deliverableId))
    .limit(1);
  if (!before) throw new DeliveryError("Deliverable not found");
  assertCanDeliverClientFacing({
    clientFacing: before.clientFacing,
    status: before.status,
    approvedAt: before.approvedAt,
  });
  const [after] = await db
    .update(projectDeliverables)
    .set({
      status: "delivered",
      clientDeliveredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(projectDeliverables.id, input.deliverableId))
    .returning();
  await audit(input.actor, "deliverable.delivered", "project_deliverable", after.id, after, before);
  return after;
}

export async function addProjectRisk(input: {
  actor: Actor;
  projectId: string;
  description: string;
  severity?: string;
  probability?: string;
  impact?: string;
}) {
  const db = getDb();
  const [risk] = await db
    .insert(projectRisks)
    .values({
      projectId: input.projectId,
      description: input.description,
      severity: input.severity ?? "high",
      probability: input.probability ?? "medium",
      impact: input.impact ?? "high",
      material: true,
      ownerUserId: input.actor.userId,
    })
    .returning();
  await reconcileProjectHealth(input.projectId);
  await audit(input.actor, "project_risk.created", "project_risk", risk.id, risk);
  return risk;
}

export async function reconcileProjectHealth(projectId: string) {
  const db = getDb();
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return null;
  const risks = await db.select().from(projectRisks).where(eq(projectRisks.projectId, projectId));
  const health = projectHealthFromRisks(risks);
  if (health === "at_risk" && project.status === "active") {
    const [after] = await db
      .update(projects)
      .set({ status: "at_risk", health: "at_risk", updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();
    return after;
  }
  if (health === "healthy" && project.status === "at_risk") {
    return project;
  }
  if (project.health !== health) {
    const [after] = await db
      .update(projects)
      .set({ health, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();
    return after;
  }
  return project;
}

export async function closeProject(input: {
  actor: Actor;
  projectId: string;
  lessonsLearned?: string;
  clientFeedback?: string;
  knowledgeCapture?: string;
  overrideReason?: string | null;
}) {
  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, input.projectId), eq(projects.organizationId, input.actor.organizationId)))
    .limit(1);
  if (!project) throw new DeliveryError("Project not found");
  const deliverables = await db
    .select()
    .from(projectDeliverables)
    .where(eq(projectDeliverables.projectId, project.id));
  const requiredIncomplete = deliverables.some(
    (row) => row.required && row.status !== "delivered" && row.status !== "approved",
  );
  const approvalsIncomplete = deliverables.some(
    (row) => row.clientFacing && row.required && !row.approvedAt,
  );
  assertCloseoutAllowed({
    requiredDeliverablesIncomplete: requiredIncomplete,
    approvalsIncomplete,
    overrideReason: input.overrideReason,
    roleSlugs: input.actor.roleSlugs,
  });
  const [service] = project.serviceId
    ? await db.select().from(services).where(eq(services.id, project.serviceId)).limit(1)
    : [undefined];
  const [version] = project.solutionPlanId
    ? await db
        .select()
        .from(solutionPlans)
        .where(eq(solutionPlans.id, project.solutionPlanId))
        .then(async (rows) => {
          const plan = rows[0];
          if (!plan) return [undefined];
          return db.select().from(serviceVersions).where(eq(serviceVersions.id, plan.serviceVersionId)).limit(1);
        })
    : [undefined];
  const [after] = await db
    .update(projects)
    .set({
      status: "completed",
      closedAt: new Date(),
      closeoutOverride: Boolean(input.overrideReason),
      closeoutOverrideReason: input.overrideReason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, project.id))
    .returning();
  await db.insert(projectCloseouts).values({
    projectId: project.id,
    lessonsLearned: input.lessonsLearned,
    clientFeedback: input.clientFeedback,
    knowledgeCapture: input.knowledgeCapture,
    kpiSnapshot: "Recorded KPIs only; values are not fabricated.",
    completedByUserId: input.actor.userId,
  });
  if (service && project.companyId) {
    const codes = expansionCodesFromVersion(version?.expansionServices, service.code);
    for (const code of codes) {
      await db.insert(expansionRecommendations).values({
        organizationId: input.actor.organizationId,
        companyId: project.companyId,
        projectId: project.id,
        sourceServiceCode: service.code,
        recommendedServiceCode: code,
        rationale: "Suggested from the approved service version expansion list. Human review required.",
        status: "suggested",
      });
    }
  }
  if (after.contractValue) {
    await triggerBillingEvent({
      actor: input.actor,
      projectId: after.id,
      amount: after.contractValue,
      sourceMilestone: "closeout",
    });
  }
  await audit(input.actor, "project.closeout", "project", after.id, after, project, input.overrideReason ?? undefined);
  return after;
}

export async function listOpportunityCommercialPath(organizationId: string, opportunityId: string) {
  const db = getDb();
  const [discoveryRows, planRows, proposalRows, contractRows, projectRows] = await Promise.all([
    db
      .select({
        id: discoveries.id,
        title: discoveries.title,
        status: discoveries.status,
      })
      .from(discoveries)
      .where(
        and(
          eq(discoveries.organizationId, organizationId),
          eq(discoveries.opportunityId, opportunityId),
          isNull(discoveries.archivedAt),
        ),
      )
      .orderBy(desc(discoveries.updatedAt)),
    db
      .select({
        id: solutionPlans.id,
        title: solutionPlans.title,
        status: solutionPlans.status,
      })
      .from(solutionPlans)
      .where(
        and(
          eq(solutionPlans.organizationId, organizationId),
          eq(solutionPlans.opportunityId, opportunityId),
          isNull(solutionPlans.archivedAt),
        ),
      )
      .orderBy(desc(solutionPlans.updatedAt)),
    db
      .select({
        id: proposals.id,
        title: proposals.title,
        status: proposals.status,
        solutionPlanId: proposals.solutionPlanId,
      })
      .from(proposals)
      .where(
        and(
          eq(proposals.organizationId, organizationId),
          eq(proposals.opportunityId, opportunityId),
          isNull(proposals.archivedAt),
        ),
      )
      .orderBy(desc(proposals.updatedAt)),
    db
      .select({
        id: contracts.id,
        title: contracts.title,
        status: contracts.status,
        solutionPlanId: contracts.solutionPlanId,
      })
      .from(contracts)
      .where(
        and(
          eq(contracts.organizationId, organizationId),
          eq(contracts.opportunityId, opportunityId),
          isNull(contracts.archivedAt),
        ),
      )
      .orderBy(desc(contracts.updatedAt)),
    db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
      })
      .from(projects)
      .where(and(eq(projects.organizationId, organizationId), eq(projects.opportunityId, opportunityId)))
      .orderBy(desc(projects.updatedAt)),
  ]);
  return {
    discoveries: discoveryRows,
    plans: planRows,
    proposals: proposalRows,
    contracts: contractRows,
    projects: projectRows,
  };
}

export async function listDiscoveries(organizationId: string) {
  const db = getDb();
  return db
    .select({
      discovery: discoveries,
      companyName: companies.name,
      opportunityName: opportunities.name,
      serviceName: services.name,
      serviceCode: services.code,
    })
    .from(discoveries)
    .innerJoin(companies, eq(discoveries.companyId, companies.id))
    .innerJoin(opportunities, eq(discoveries.opportunityId, opportunities.id))
    .innerJoin(services, eq(discoveries.serviceId, services.id))
    .where(and(eq(discoveries.organizationId, organizationId), isNull(discoveries.archivedAt)))
    .orderBy(desc(discoveries.updatedAt));
}

export async function getDiscovery(id: string, organizationId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      discovery: discoveries,
      companyName: companies.name,
      opportunityName: opportunities.name,
      serviceName: services.name,
      serviceCode: services.code,
    })
    .from(discoveries)
    .innerJoin(companies, eq(discoveries.companyId, companies.id))
    .innerJoin(opportunities, eq(discoveries.opportunityId, opportunities.id))
    .innerJoin(services, eq(discoveries.serviceId, services.id))
    .where(and(eq(discoveries.id, id), eq(discoveries.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

export async function listSolutionPlans(organizationId: string) {
  const db = getDb();
  return db
    .select({
      plan: solutionPlans,
      companyName: companies.name,
      opportunityName: opportunities.name,
      serviceName: services.name,
      serviceCode: services.code,
      version: serviceVersions.version,
    })
    .from(solutionPlans)
    .innerJoin(opportunities, eq(solutionPlans.opportunityId, opportunities.id))
    .innerJoin(companies, eq(opportunities.companyId, companies.id))
    .innerJoin(serviceVersions, eq(solutionPlans.serviceVersionId, serviceVersions.id))
    .innerJoin(services, eq(serviceVersions.serviceId, services.id))
    .where(and(eq(solutionPlans.organizationId, organizationId), isNull(solutionPlans.archivedAt)))
    .orderBy(desc(solutionPlans.updatedAt));
}

export async function getSolutionPlan(id: string, organizationId: string) {
  const rows = await listSolutionPlans(organizationId);
  return rows.find((row) => row.plan.id === id) ?? null;
}

export async function listProposals(organizationId: string, status?: string) {
  const db = getDb();
  const rows = await db
    .select({
      proposal: proposals,
      companyName: companies.name,
      serviceCode: services.code,
    })
    .from(proposals)
    .innerJoin(companies, eq(proposals.companyId, companies.id))
    .innerJoin(serviceVersions, eq(proposals.serviceVersionId, serviceVersions.id))
    .innerJoin(services, eq(serviceVersions.serviceId, services.id))
    .where(and(eq(proposals.organizationId, organizationId), isNull(proposals.archivedAt)))
    .orderBy(desc(proposals.updatedAt));
  if (!status) return rows;
  return rows.filter((row) => row.proposal.status === status);
}

export async function getProposalBundle(id: string, organizationId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      proposal: proposals,
      companyName: companies.name,
      plan: solutionPlans,
      serviceCode: services.code,
    })
    .from(proposals)
    .innerJoin(companies, eq(proposals.companyId, companies.id))
    .innerJoin(solutionPlans, eq(proposals.solutionPlanId, solutionPlans.id))
    .innerJoin(serviceVersions, eq(proposals.serviceVersionId, serviceVersions.id))
    .innerJoin(services, eq(serviceVersions.serviceId, services.id))
    .where(and(eq(proposals.id, id), eq(proposals.organizationId, organizationId)))
    .limit(1);
  if (!row) return null;
  const versions = await db
    .select()
    .from(proposalVersions)
    .where(eq(proposalVersions.proposalId, id))
    .orderBy(desc(proposalVersions.versionNumber));
  return { ...row, versions };
}

export async function listContracts(organizationId: string, filter?: string) {
  const db = getDb();
  const now = new Date();
  const soon = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      contract: contracts,
      companyName: companies.name,
      serviceName: services.name,
    })
    .from(contracts)
    .innerJoin(companies, eq(contracts.companyId, companies.id))
    .leftJoin(services, eq(contracts.serviceId, services.id))
    .where(and(eq(contracts.organizationId, organizationId), isNull(contracts.archivedAt)))
    .orderBy(desc(contracts.updatedAt));
  if (filter === "executed") return rows.filter((row) => row.contract.status === "executed");
  if (filter === "expiring") {
    return rows.filter(
      (row) =>
        row.contract.expirationDate &&
        row.contract.expirationDate >= now &&
        row.contract.expirationDate <= soon,
    );
  }
  if (filter === "compliance") {
    return rows.filter((row) => row.contract.status === "executed" || row.contract.status === "client_review");
  }
  return rows;
}

export async function getContract(id: string, organizationId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      contract: contracts,
      companyName: companies.name,
      serviceName: services.name,
    })
    .from(contracts)
    .innerJoin(companies, eq(contracts.companyId, companies.id))
    .leftJoin(services, eq(contracts.serviceId, services.id))
    .where(and(eq(contracts.id, id), eq(contracts.organizationId, organizationId)))
    .limit(1);
  if (!row) return null;
  const envelopes = await db.select().from(esignEnvelopes).where(eq(esignEnvelopes.contractId, id));
  return { ...row, envelopes };
}

export async function listLegalTemplates() {
  const db = getDb();
  return db.select().from(legalTemplates).orderBy(legalTemplates.name);
}

export async function listDeliveryProjects(organizationId: string, filter?: string) {
  const db = getDb();
  const rows = await db
    .select({
      project: projects,
      companyName: companies.name,
      serviceName: services.name,
    })
    .from(projects)
    .leftJoin(companies, eq(projects.companyId, companies.id))
    .leftJoin(services, eq(projects.serviceId, services.id))
    .where(and(eq(projects.organizationId, organizationId), isNull(projects.archivedAt)))
    .orderBy(desc(projects.updatedAt));
  if (filter === "active") return rows.filter((row) => row.project.status === "active" || row.project.status === "at_risk");
  if (filter === "at_risk") return rows.filter((row) => row.project.status === "at_risk" || row.project.health === "at_risk");
  if (filter === "completed") return rows.filter((row) => row.project.status === "completed");
  return rows;
}

export async function getProjectBundle(id: string, organizationId: string) {
  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
    .limit(1);
  if (!project) return null;
  const phases = await db
    .select()
    .from(projectPhases)
    .where(eq(projectPhases.projectId, id))
    .orderBy(asc(projectPhases.sequence));
  const tasks = [];
  for (const phase of phases) {
    const phaseTasks = await db.select().from(projectTasks).where(eq(projectTasks.phaseId, phase.id));
    tasks.push(...phaseTasks.map((task) => ({ ...task, phaseName: phase.name })));
  }
  const [deliverables, risks, issues, kpis, meetings, billing, expansions, closeout] = await Promise.all([
    db.select().from(projectDeliverables).where(eq(projectDeliverables.projectId, id)),
    db.select().from(projectRisks).where(eq(projectRisks.projectId, id)),
    db.select().from(projectIssues).where(eq(projectIssues.projectId, id)),
    db.select().from(projectKpis).where(eq(projectKpis.projectId, id)),
    db.select().from(projectMeetings).where(eq(projectMeetings.projectId, id)),
    db.select().from(billingEvents).where(eq(billingEvents.projectId, id)),
    db.select().from(expansionRecommendations).where(eq(expansionRecommendations.projectId, id)),
    db.select().from(projectCloseouts).where(eq(projectCloseouts.projectId, id)).limit(1),
  ]);
  return { project, phases, tasks, deliverables, risks, issues, kpis, meetings, billing, expansions, closeout: closeout[0] ?? null };
}

export async function listDeliverables(organizationId: string, overdueOnly = false) {
  const db = getDb();
  const rows = await db
    .select({
      deliverable: projectDeliverables,
      project: projects,
    })
    .from(projectDeliverables)
    .innerJoin(projects, eq(projectDeliverables.projectId, projects.id))
    .where(and(eq(projects.organizationId, organizationId), isNull(projectDeliverables.archivedAt)));
  if (!overdueOnly) return rows;
  const today = new Date();
  return rows.filter(
    (row) =>
      row.deliverable.dueDate &&
      row.deliverable.dueDate < today &&
      row.deliverable.status !== "delivered",
  );
}

export async function listBillingEvents(organizationId: string) {
  const db = getDb();
  return db
    .select({
      event: billingEvents,
      companyName: companies.name,
      projectName: projects.name,
    })
    .from(billingEvents)
    .leftJoin(companies, eq(billingEvents.companyId, companies.id))
    .leftJoin(projects, eq(billingEvents.projectId, projects.id))
    .where(eq(billingEvents.organizationId, organizationId))
    .orderBy(desc(billingEvents.createdAt));
}

export async function companyDeliverySnapshot(companyId: string, organizationId: string) {
  const db = getDb();
  const [plans, proposalRows, contractRows, projectRows, billing, expansions] = await Promise.all([
    db.select().from(solutionPlans).where(and(eq(solutionPlans.companyId, companyId), eq(solutionPlans.organizationId, organizationId))),
    db.select().from(proposals).where(and(eq(proposals.companyId, companyId), eq(proposals.organizationId, organizationId))),
    db.select().from(contracts).where(and(eq(contracts.companyId, companyId), eq(contracts.organizationId, organizationId))),
    db.select().from(projects).where(and(eq(projects.companyId, companyId), eq(projects.organizationId, organizationId))),
    db.select().from(billingEvents).where(and(eq(billingEvents.companyId, companyId), eq(billingEvents.organizationId, organizationId))),
    db.select().from(expansionRecommendations).where(and(eq(expansionRecommendations.companyId, companyId), eq(expansionRecommendations.organizationId, organizationId))),
  ]);
  return { plans, proposals: proposalRows, contracts: contractRows, projects: projectRows, billing, expansions };
}

export async function phase4CommandSnapshot(organizationId: string) {
  const db = getDb();
  const now = new Date();
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const [awaitingProposals, awaitingContracts, atRisk, overdueDeliverables, upcomingBilling, closing, expansions] =
    await Promise.all([
      db
        .select()
        .from(proposals)
        .where(and(eq(proposals.organizationId, organizationId), inArray(proposals.status, ["draft", "internal_review"]))),
      db
        .select()
        .from(contracts)
        .where(
          and(
            eq(contracts.organizationId, organizationId),
            inArray(contracts.status, ["draft", "internal_review", "client_review", "sent_for_signature"]),
          ),
        ),
      db
        .select()
        .from(projects)
        .where(and(eq(projects.organizationId, organizationId), or(eq(projects.status, "at_risk"), eq(projects.health, "at_risk")))),
      db
        .select({
          deliverable: projectDeliverables,
        })
        .from(projectDeliverables)
        .innerJoin(projects, eq(projectDeliverables.projectId, projects.id))
        .where(
          and(
            eq(projects.organizationId, organizationId),
            lte(projectDeliverables.dueDate, now),
          ),
        ),
      db
        .select()
        .from(billingEvents)
        .where(
          and(
            eq(billingEvents.organizationId, organizationId),
            inArray(billingEvents.status, ["scheduled", "triggered"]),
            lte(billingEvents.expectedDate, soon),
          ),
        ),
      db
        .select()
        .from(projects)
        .where(and(eq(projects.organizationId, organizationId), eq(projects.status, "active"), lte(projects.endDate, soon))),
      db
        .select()
        .from(expansionRecommendations)
        .where(and(eq(expansionRecommendations.organizationId, organizationId), eq(expansionRecommendations.status, "suggested"))),
    ]);
  return {
    proposalsAwaitingApproval: awaitingProposals.length,
    contractsAwaitingSignature: awaitingContracts.length,
    projectsAtRisk: atRisk.length,
    deliverablesOverdue: overdueDeliverables.filter((row) => row.deliverable.status !== "delivered").length,
    billingUpcoming: upcomingBilling.length,
    engagementsClosingSoon: closing.length,
    expansionOpportunities: expansions.length,
  };
}

export function primaryContractTypeFor(serviceCode: string) {
  return primaryContractType(legalPackageForService(undefined, serviceCode));
}

export { assertApprovedVersionImmutable };
