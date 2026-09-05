import { eq } from "drizzle-orm";

import type { getDb } from "../index";
import {
  companies,
  contracts,
  discoveries,
  opportunities,
  projectDeliverables,
  projectPhases,
  projects,
  projectTasks,
  proposals,
  proposalVersions,
  solutionPlans,
} from "../schema";
import { INTERNAL_ORG_ID, USER_IDS } from "./constants";
import { LAUNCH_SERVICE_CATALOG, versionIdForService } from "./service-catalog";

const pad = (value: number) => String(value).padStart(12, "0");

export const PHASE4_FIXTURES = LAUNCH_SERVICE_CATALOG.map((catalog, index) => {
  const n = index + 1;
  return {
    catalog,
    companyId: `00000000-0000-4000-8a01-${pad(n)}`,
    opportunityId: `00000000-0000-4000-8a02-${pad(n)}`,
    discoveryId: `00000000-0000-4000-8a03-${pad(n)}`,
    planId: `00000000-0000-4000-8a04-${pad(n)}`,
    proposalId: `00000000-0000-4000-8a05-${pad(n)}`,
    contractId: `00000000-0000-4000-8a06-${pad(n)}`,
    projectId: `00000000-0000-4000-8a07-${pad(n)}`,
  };
});

export async function seedPhase4Fixtures(db: ReturnType<typeof getDb>) {
  for (const [index, fixture] of PHASE4_FIXTURES.entries()) {
    const { catalog } = fixture;
    const versionId = versionIdForService(catalog.id);
    const executed = index === 0;
    const proposalApproved = index === 0;
    const projectActive = index === 0;

    await db
      .insert(companies)
      .values({
        id: fixture.companyId,
        organizationId: INTERNAL_ORG_ID,
        name: `[DEV] ${catalog.name} Client`,
        companyType: "client",
        clientStatus: "active",
        industry: "Development fixture",
        notes: "Phase 4 development fixture. Not live production data.",
      })
      .onConflictDoNothing();

    await db
      .insert(opportunities)
      .values({
        id: fixture.opportunityId,
        organizationId: INTERNAL_ORG_ID,
        companyId: fixture.companyId,
        name: `[DEV] ${catalog.name} opportunity`,
        stage: proposalApproved ? "proposal" : "discovery_complete",
        serviceCode: catalog.code,
        notes: "Phase 4 development fixture.",
      })
      .onConflictDoNothing();

    await db
      .insert(discoveries)
      .values({
        id: fixture.discoveryId,
        organizationId: INTERNAL_ORG_ID,
        companyId: fixture.companyId,
        opportunityId: fixture.opportunityId,
        serviceId: catalog.id,
        serviceVersionId: versionId,
        title: `[DEV] ${catalog.name} discovery`,
        status: "approved",
        answers: { fixture: "Phase 4 development fixture" },
        problemStatement: `Development fixture problem for ${catalog.name}.`,
        businessImpact: "Fixture impact only.",
        recommendedServiceCode: catalog.code,
        recommendedNextServiceCode: catalog.expansionServices[0] ?? null,
        humanApprovedByUserId: USER_IDS.managingPartner,
        humanApprovedAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(solutionPlans)
      .values({
        id: fixture.planId,
        organizationId: INTERNAL_ORG_ID,
        opportunityId: fixture.opportunityId,
        serviceVersionId: versionId,
        companyId: fixture.companyId,
        discoveryId: fixture.discoveryId,
        title: `[DEV] ${catalog.name} solution plan`,
        status: "approved",
        summary: catalog.scopeDefinition,
        problemStatement: `Development fixture problem for ${catalog.name}.`,
        recommendedScope: catalog.scopeDefinition,
        deliverables: catalog.deliverables.join("\n"),
        pricingModel: catalog.pricingModel,
        recommendedPrice: catalog.minPrice,
        approvedPrice: catalog.minPrice,
        approvedByUserId: USER_IDS.managingPartner,
        approvedAt: new Date(),
        generatedByModel: "workflow-template",
        generatedByModelVersion: "v1",
      })
      .onConflictDoNothing();

    await db
      .insert(proposals)
      .values({
        id: fixture.proposalId,
        organizationId: INTERNAL_ORG_ID,
        companyId: fixture.companyId,
        opportunityId: fixture.opportunityId,
        solutionPlanId: fixture.planId,
        serviceVersionId: versionId,
        title: `[DEV] ${catalog.name} proposal`,
        status: proposalApproved ? "approved" : "draft",
        approvedByUserId: proposalApproved ? USER_IDS.managingPartner : null,
        approvedAt: proposalApproved ? new Date() : null,
      })
      .onConflictDoNothing();

    await db
      .insert(proposalVersions)
      .values({
        proposalId: fixture.proposalId,
        versionNumber: 1,
        executiveSummary: catalog.definition,
        clientProblem: `Development fixture problem for ${catalog.name}.`,
        recommendedSolution: catalog.scopeDefinition,
        scope: catalog.scopeDefinition,
        deliverables: catalog.deliverables.join("\n"),
        timeline: `${catalog.defaultDurationDays} days`,
        pricingAmount: catalog.minPrice,
        nextSteps: "Internal approval, then client send.",
        createdByUserId: USER_IDS.managingPartner,
      })
      .onConflictDoNothing();

    const contractType = catalog.workflow.legalPackage.required[0] as typeof contracts.$inferInsert.contractType;
    await db
      .insert(contracts)
      .values({
        id: fixture.contractId,
        organizationId: INTERNAL_ORG_ID,
        companyId: fixture.companyId,
        serviceId: catalog.id,
        opportunityId: fixture.opportunityId,
        proposalId: fixture.proposalId,
        solutionPlanId: fixture.planId,
        contractType,
        title: `[DEV] ${catalog.name} contract`,
        status: executed ? "executed" : "draft",
        signatureStatus: executed ? "manual" : "not_sent",
        contractValue: catalog.minPrice,
        signerName: executed ? "Development Fixture Signer" : null,
        executionDate: executed ? new Date() : null,
        sow: "Development fixture contract. Placeholder legal language is not attorney-approved.",
      })
      .onConflictDoNothing();

    if (!projectActive) continue;

    await db
      .insert(projects)
      .values({
        id: fixture.projectId,
        organizationId: INTERNAL_ORG_ID,
        solutionPlanId: fixture.planId,
        companyId: fixture.companyId,
        serviceId: catalog.id,
        opportunityId: fixture.opportunityId,
        contractId: fixture.contractId,
        ownerUserId: USER_IDS.managingPartner,
        name: `[DEV] ${catalog.name} delivery`,
        status: "active",
        contractValue: catalog.minPrice,
      })
      .onConflictDoNothing();

    const existingPhases = await db
      .select()
      .from(projectPhases)
      .where(eq(projectPhases.projectId, fixture.projectId));
    if (existingPhases.length === 0) {
      for (const [phaseIndex, name] of catalog.projectPhases.entries()) {
        const [phase] = await db
          .insert(projectPhases)
          .values({
            projectId: fixture.projectId,
            name,
            sequence: phaseIndex + 1,
          })
          .returning();
        await db.insert(projectTasks).values({
          phaseId: phase.id,
          name: `${name} work`,
          status: "not_started",
        });
      }
      for (const deliverable of catalog.projectDeliverables) {
        await db.insert(projectDeliverables).values({
          projectId: fixture.projectId,
          name: deliverable.name,
          deliverableType: deliverable.deliverableType,
          required: deliverable.required,
          clientFacing: deliverable.clientFacing,
        });
      }
    }

    await db
      .update(contracts)
      .set({ projectId: fixture.projectId })
      .where(eq(contracts.id, fixture.contractId));
  }
}
