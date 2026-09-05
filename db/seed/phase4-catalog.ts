import { eq } from "drizzle-orm";

import type { getDb } from "../index";
import {
  legalTemplates,
  projectTemplateDeliverables,
  projectTemplatePhases,
  projectTemplates,
  projectTemplateTasks,
  serviceVersions,
  serviceWorkflowDefinitions,
  serviceWorkflows,
  services,
} from "../schema";
import { LAUNCH_SERVICE_CATALOG, versionIdForService } from "./service-catalog";

const now = () => new Date();

export async function seedLaunchServiceCatalog(db: ReturnType<typeof getDb>) {
  for (const catalog of LAUNCH_SERVICE_CATALOG) {
    const versionId = versionIdForService(catalog.id);
    await db
      .insert(services)
      .values({
        id: catalog.id,
        code: catalog.code,
        name: catalog.name,
        status: "active",
        description: catalog.definition,
        practiceArea: catalog.practiceArea,
        pricingModel: catalog.pricingModel,
        defaultMinPrice: catalog.minPrice,
        defaultMaxPrice: catalog.maxPrice,
        defaultDurationDays: catalog.defaultDurationDays,
      })
      .onConflictDoUpdate({
        target: services.code,
        set: {
          name: catalog.name,
          description: catalog.definition,
          practiceArea: catalog.practiceArea,
          pricingModel: catalog.pricingModel,
          defaultMinPrice: catalog.minPrice,
          defaultMaxPrice: catalog.maxPrice,
          defaultDurationDays: catalog.defaultDurationDays,
          updatedAt: now(),
        },
      });

    const [existingVersion] = await db
      .select()
      .from(serviceVersions)
      .where(eq(serviceVersions.id, versionId))
      .limit(1);
    const approvedLocked = existingVersion?.reviewStatus === "approved" && existingVersion.pricingModel != null;

    if (!existingVersion) {
      await db.insert(serviceVersions).values({
        id: versionId,
        serviceId: catalog.id,
        version: "v1",
        definition: catalog.definition,
        reviewStatus: "approved",
        effectiveDate: new Date("2026-01-01T00:00:00.000Z"),
        scopeDefinition: catalog.scopeDefinition,
        requiredInputs: catalog.requiredInputs,
        deliverables: catalog.deliverables,
        kpis: catalog.kpis,
        clientResponsibilities: catalog.clientResponsibilities,
        firmResponsibilities: catalog.firmResponsibilities,
        legalRequirements: catalog.legalRequirements,
        pricingGuidance: catalog.pricingGuidance,
        expansionServices: catalog.expansionServices,
        pricingModel: catalog.pricingModel,
        minPrice: catalog.minPrice,
        maxPrice: catalog.maxPrice,
        percentageFee: catalog.percentageFee,
        minimumFee: catalog.minimumFee,
        defaultDurationDays: catalog.defaultDurationDays,
        practiceArea: catalog.practiceArea,
      });
    } else if (!approvedLocked) {
      await db
        .update(serviceVersions)
        .set({
          definition: catalog.definition,
          scopeDefinition: catalog.scopeDefinition,
          requiredInputs: catalog.requiredInputs,
          deliverables: catalog.deliverables,
          kpis: catalog.kpis,
          clientResponsibilities: catalog.clientResponsibilities,
          firmResponsibilities: catalog.firmResponsibilities,
          legalRequirements: catalog.legalRequirements,
          pricingGuidance: catalog.pricingGuidance,
          expansionServices: catalog.expansionServices,
          pricingModel: catalog.pricingModel,
          minPrice: catalog.minPrice,
          maxPrice: catalog.maxPrice,
          percentageFee: catalog.percentageFee,
          minimumFee: catalog.minimumFee,
          defaultDurationDays: catalog.defaultDurationDays,
          practiceArea: catalog.practiceArea,
          updatedAt: now(),
        })
        .where(eq(serviceVersions.id, versionId));
    }

    const workflowDefinitionValues = {
      serviceVersionId: versionId,
      qualificationTriggers: catalog.workflow.qualificationTriggers,
      requiredDiscoveryInputs: catalog.workflow.discoveryQuestions,
      dataCollection: catalog.workflow.dataCollection,
      aiResponsibilities: catalog.workflow.aiResponsibilities,
      humanResponsibilities: catalog.workflow.humanResponsibilities,
      approvalGates: catalog.workflow.approvalGates,
      deliverables: catalog.workflow.deliverables,
      legalPackage: catalog.workflow.legalPackage,
      projectTemplateCode: catalog.workflow.projectTemplateCode,
      billingRules: catalog.workflow.billingRules,
      kpis: catalog.workflow.kpis,
      completionRules: catalog.workflow.completionRules,
      expansionRules: catalog.workflow.expansionRules,
      exceptionHandling: catalog.workflow.exceptionHandling,
    };
    const definitionInsert = db.insert(serviceWorkflowDefinitions).values(workflowDefinitionValues);
    if (approvedLocked) {
      await definitionInsert.onConflictDoNothing();
    } else {
      await definitionInsert.onConflictDoUpdate({
        target: serviceWorkflowDefinitions.serviceVersionId,
        set: {
          qualificationTriggers: catalog.workflow.qualificationTriggers,
          requiredDiscoveryInputs: catalog.workflow.discoveryQuestions,
          dataCollection: catalog.workflow.dataCollection,
          aiResponsibilities: catalog.workflow.aiResponsibilities,
          humanResponsibilities: catalog.workflow.humanResponsibilities,
          approvalGates: catalog.workflow.approvalGates,
          deliverables: catalog.workflow.deliverables,
          legalPackage: catalog.workflow.legalPackage,
          projectTemplateCode: catalog.workflow.projectTemplateCode,
          billingRules: catalog.workflow.billingRules,
          kpis: catalog.workflow.kpis,
          completionRules: catalog.workflow.completionRules,
          expansionRules: catalog.workflow.expansionRules,
          exceptionHandling: catalog.workflow.exceptionHandling,
          updatedAt: now(),
        },
      });
    }

    for (const [index, step] of catalog.steps.entries()) {
      const stepInsert = db.insert(serviceWorkflows).values({
        serviceVersionId: versionId,
        stepNumber: index + 1,
        name: step.name,
        instructions: step.instructions,
        requiresHumanApproval: step.requiresHumanApproval,
        stepType: step.stepType,
        responsibleRole: step.responsibleRole,
        requiredInputs: step.requiredInputs,
        outputType: step.outputType,
        blocking: step.blocking,
        completionCriteria: step.completionCriteria,
        nextStepNumber: index + 2 <= catalog.steps.length ? index + 2 : null,
        exceptionPath: step.exceptionPath,
      });
      if (approvedLocked) {
        await stepInsert.onConflictDoNothing();
      } else {
        await stepInsert.onConflictDoUpdate({
          target: [serviceWorkflows.serviceVersionId, serviceWorkflows.stepNumber],
          set: {
            name: step.name,
            instructions: step.instructions,
            requiresHumanApproval: step.requiresHumanApproval,
            stepType: step.stepType,
            responsibleRole: step.responsibleRole,
            requiredInputs: step.requiredInputs,
            outputType: step.outputType,
            blocking: step.blocking,
            completionCriteria: step.completionCriteria,
            nextStepNumber: index + 2 <= catalog.steps.length ? index + 2 : null,
            exceptionPath: step.exceptionPath,
            updatedAt: now(),
          },
        });
      }
    }

    await db
      .insert(projectTemplates)
      .values({
        serviceId: catalog.id,
        serviceVersionId: versionId,
        code: catalog.workflow.projectTemplateCode,
        name: `${catalog.name} delivery`,
        description: catalog.scopeDefinition,
      })
      .onConflictDoUpdate({
        target: projectTemplates.code,
        set: {
          name: `${catalog.name} delivery`,
          description: catalog.scopeDefinition,
          serviceVersionId: versionId,
          updatedAt: now(),
        },
      });

    const [template] = await db
      .select()
      .from(projectTemplates)
      .where(eq(projectTemplates.code, catalog.workflow.projectTemplateCode))
      .limit(1);
    if (!template) continue;

    const existingPhases = await db
      .select()
      .from(projectTemplatePhases)
      .where(eq(projectTemplatePhases.templateId, template.id));
    if (existingPhases.length === 0) {
      for (const [index, name] of catalog.projectPhases.entries()) {
        const [phase] = await db
          .insert(projectTemplatePhases)
          .values({
            templateId: template.id,
            name,
            sequence: index + 1,
          })
          .returning();
        await db.insert(projectTemplateTasks).values({
          phaseId: phase.id,
          name: `${name} work`,
          sequence: 1,
          requiresApproval: name.toLowerCase().includes("review") || name.toLowerCase().includes("presentation"),
          completionCriteria: `Complete ${name}`,
        });
      }
    }

    const existingDeliverables = await db
      .select()
      .from(projectTemplateDeliverables)
      .where(eq(projectTemplateDeliverables.templateId, template.id));
    if (existingDeliverables.length === 0) {
      for (const deliverable of catalog.projectDeliverables) {
        await db.insert(projectTemplateDeliverables).values({
          templateId: template.id,
          name: deliverable.name,
          deliverableType: deliverable.deliverableType,
          required: deliverable.required,
          clientFacing: deliverable.clientFacing,
        });
      }
    }
  }

  const templates: Array<{
    type: typeof legalTemplates.$inferInsert.templateType;
    name: string;
  }> = [
    { type: "msa", name: "Master Services Agreement" },
    { type: "direct_hire_search_agreement", name: "Direct Hire Search Agreement" },
    { type: "retained_search_agreement", name: "Retained Search Agreement" },
    { type: "fractional_ta_sow", name: "Fractional TA Statement of Work" },
    { type: "consulting_sow", name: "Consulting Statement of Work" },
    { type: "military_talent_assessment_sow", name: "Military Talent Assessment SOW" },
    { type: "ta_performance_assessment_sow", name: "TA Performance Assessment SOW" },
    { type: "workforce_assessment_sow", name: "Workforce Assessment SOW" },
    { type: "nda", name: "Nondisclosure Agreement" },
    { type: "dpa", name: "Data Processing Provisions" },
    { type: "subcontractor_agreement", name: "Subcontractor Agreement" },
    { type: "employee_agreement", name: "Employee Agreement" },
    { type: "confidentiality_ip_agreement", name: "Confidentiality / IP Agreement" },
    { type: "independent_contractor_agreement", name: "Independent Contractor Agreement" },
  ];

  for (const template of templates) {
    await db
      .insert(legalTemplates)
      .values({
        templateType: template.type,
        name: template.name,
        version: "v1-placeholder",
        jurisdiction: "US",
        attorneyApproved: false,
        status: "draft",
        body: `${template.name} placeholder. This is structural language only and is not attorney-approved.`,
        notes: "Not attorney-approved. Replace after legal review.",
      })
      .onConflictDoNothing();
  }
}
