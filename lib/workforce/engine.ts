import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDb } from "../../db";
import {
  agents,
  agentOutputs,
  careerPathEdges,
  careerPathLevels,
  careerPaths,
  companies,
  companyLocations,
  educationPartners,
  occupationSkills,
  projectDeliverables,
  projectPhases,
  projectTasks,
  skills,
  talentPipelineAllocations,
  talentPipelines,
  trainingProgramOccupations,
  trainingProgramSkills,
  trainingPrograms,
  workforceAssessmentAssumptions,
  workforceAssessmentDataSources,
  workforceAssessmentLocations,
  workforceAssessments,
  workforceBaselines,
  workforceForecastComponents,
  workforceForecastOverrides,
  workforceForecastResults,
  workforceForecasts,
  workforceGapThresholds,
  workforceGaps,
  workforceImports,
  workforceKpis,
  workforcePipelinePlans,
  workforceRecommendations,
  workforceRisks,
  workforceRoadmapItems,
  workforceRoleSkills,
  workforceRoles,
  workforceScenarioInputs,
  workforceScenarioOutputs,
  workforceScenarios,
  workforceSupplyEntries,
  skillsGapAnalyses,
  skillsGapItems,
  apprenticeships,
  talentScarcityIndicators,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { approveRequest, assertAgentCannotSelfApprove, requestApproval } from "../approvals/service";
import { getServerEnv } from "../env";
import { roleSlugsHavePermission, type Permission } from "../rbac/permissions";
import { WorkforceError, assertAssessmentMutable, assertHumanApprovalActor } from "./errors";
import {
  FORECAST_HORIZONS,
  applyScenarioDeltas,
  computeDemandForecast,
  defaultForecastComponents,
  type ForecastComponentInput,
} from "./forecast";
import { classifyGapSeverity, computeGap, DEFAULT_GAP_THRESHOLDS, pipelineCoverage } from "./gaps";
import { excelImportNotConfigured, parseCsv } from "./import";
import { militaryOverlayForRole, talentNetworkOverlayForRole } from "./overlays";
import { renderWorkforcePlanHtml } from "./report";

export { WorkforceError, FORECAST_HORIZONS };

type Actor = {
  organizationId: string;
  userId: string;
  roleSlugs?: string[];
};

function requirePerm(actor: Actor, permission: Permission) {
  if (!roleSlugsHavePermission(actor.roleSlugs, permission)) {
    throw new WorkforceError(`Missing permission: ${permission}`);
  }
}

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

function num(value: string | number | null | undefined) {
  if (value == null || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function provenance(actor: Actor, extra?: { assumption?: string; quality?: "unknown" | "estimated" | "internal_only" | "sourced" | "reviewed"; fixture?: boolean; confidence?: string }) {
  return {
    source: extra?.fixture ? "development-fixture" : "internal_baseline",
    sourceDate: new Date(),
    sourceVersion: "phase5-v1",
    internalAssumption: extra?.assumption ?? "Planning estimate from client baseline and analyst assumptions.",
    generatedAt: new Date(),
    reviewerUserId: actor.userId,
    dataQuality: extra?.quality ?? "internal_only",
    isFixture: extra?.fixture ?? false,
    confidence: extra?.confidence ?? "0.6500",
  };
}

async function loadAssessment(assessmentId: string, organizationId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(workforceAssessments)
    .where(
      and(
        eq(workforceAssessments.id, assessmentId),
        eq(workforceAssessments.organizationId, organizationId),
        isNull(workforceAssessments.archivedAt),
      ),
    )
    .limit(1);
  if (!row) throw new WorkforceError("Workforce assessment not found");
  return row;
}

export async function createWorkforceAssessment(input: {
  actor: Actor;
  companyId: string;
  title: string;
  opportunityId?: string | null;
  solutionPlanId?: string | null;
  serviceId?: string | null;
  projectId?: string | null;
  notes?: string | null;
  locationIds?: string[];
}) {
  requirePerm(input.actor, "workforce.write");
  const db = getDb();
  const existing = await db
    .select({ versionNumber: workforceAssessments.versionNumber })
    .from(workforceAssessments)
    .where(
      and(
        eq(workforceAssessments.companyId, input.companyId),
        eq(workforceAssessments.organizationId, input.actor.organizationId),
      ),
    )
    .orderBy(desc(workforceAssessments.versionNumber));
  const versionNumber = (existing[0]?.versionNumber ?? 0) + 1;
  const [created] = await db
    .insert(workforceAssessments)
    .values({
      organizationId: input.actor.organizationId,
      companyId: input.companyId,
      opportunityId: input.opportunityId ?? null,
      solutionPlanId: input.solutionPlanId ?? null,
      serviceId: input.serviceId ?? null,
      projectId: input.projectId ?? null,
      title: input.title,
      status: "draft",
      versionNumber,
      notes: input.notes ?? null,
      createdByUserId: input.actor.userId,
    })
    .returning();
  await db.insert(workforceAssessmentDataSources).values({
    assessmentId: created.id,
    sourceType: "manual",
    sourceName: "Analyst entry",
    sourceDate: new Date(),
    sourceVersion: "phase5-v1",
    notes: "Client baseline and assumptions. Not live BLS/Census/O*NET.",
  });
  if (input.locationIds?.length) {
    await db.insert(workforceAssessmentLocations).values(
      input.locationIds.map((companyLocationId) => ({
        assessmentId: created.id,
        companyLocationId,
      })),
    );
  }
  await audit(input.actor, "workforce.assessment.created", "workforce_assessment", created.id, created);
  return created;
}

export async function createWorkforceRole(input: {
  actor: Actor;
  companyId: string;
  title: string;
  assessmentId?: string | null;
  civilianOccupationId?: string | null;
  jobFamily?: string | null;
  companyLocationId?: string | null;
  currentHeadcount?: number;
  criticality?: "critical" | "high" | "moderate" | "low";
  businessFunction?: string | null;
  shiftSchedule?: string | null;
  minimumCredentials?: string | null;
  targetProficiency?: string | null;
  futureDemandCategory?: string | null;
  militaryCompatibility?: string | null;
  talentScarcity?: "unknown" | "estimated" | "internal_only" | "scarce" | "moderate" | "abundant";
  replacementDifficulty?: "critical" | "high" | "moderate" | "low";
  skillIds?: string[];
}) {
  requirePerm(input.actor, "workforce.write");
  const db = getDb();
  const [created] = await db
    .insert(workforceRoles)
    .values({
      organizationId: input.actor.organizationId,
      companyId: input.companyId,
      assessmentId: input.assessmentId ?? null,
      title: input.title,
      civilianOccupationId: input.civilianOccupationId ?? null,
      jobFamily: input.jobFamily ?? null,
      companyLocationId: input.companyLocationId ?? null,
      currentHeadcount: input.currentHeadcount ?? 0,
      criticality: input.criticality ?? "moderate",
      businessFunction: input.businessFunction ?? null,
      shiftSchedule: input.shiftSchedule ?? null,
      minimumCredentials: input.minimumCredentials ?? null,
      targetProficiency: input.targetProficiency ?? null,
      futureDemandCategory: input.futureDemandCategory ?? null,
      militaryCompatibility: input.militaryCompatibility ?? null,
      talentScarcity: input.talentScarcity ?? "unknown",
      replacementDifficulty: input.replacementDifficulty ?? "moderate",
    })
    .returning();
  if (input.skillIds?.length) {
    await db.insert(workforceRoleSkills).values(
      input.skillIds.map((skillId) => ({
        roleId: created.id,
        skillId,
        requirementType: "required" as const,
      })),
    );
  }
  await audit(input.actor, "workforce.role.created", "workforce_role", created.id, created);
  return created;
}

export async function upsertBaseline(input: {
  actor: Actor;
  assessmentId: string;
  roleId: string;
  companyLocationId?: string | null;
  currentHeadcount: number;
  vacancies?: number;
  attritionRatePercent?: number | null;
  retirementEligibilityRatePercent?: number | null;
  turnoverRatePercent?: number | null;
  averageTenureMonths?: number | null;
  internalMobilityRatePercent?: number | null;
  currentPipelineCount?: number;
  knownHiringPlan?: number;
  trainingCapacity?: number;
  asOfDate?: Date | null;
  importId?: string | null;
}) {
  requirePerm(input.actor, "workforce.write");
  const assessment = await loadAssessment(input.assessmentId, input.actor.organizationId);
  assertAssessmentMutable(assessment.status);
  const db = getDb();
  const [existing] = await db
    .select()
    .from(workforceBaselines)
    .where(
      and(
        eq(workforceBaselines.assessmentId, input.assessmentId),
        eq(workforceBaselines.roleId, input.roleId),
        input.companyLocationId
          ? eq(workforceBaselines.companyLocationId, input.companyLocationId)
          : isNull(workforceBaselines.companyLocationId),
      ),
    )
    .limit(1);
  const values = {
    assessmentId: input.assessmentId,
    roleId: input.roleId,
    companyLocationId: input.companyLocationId ?? null,
    currentHeadcount: input.currentHeadcount,
    vacancies: input.vacancies ?? 0,
    attritionRatePercent: input.attritionRatePercent != null ? String(input.attritionRatePercent) : null,
    retirementEligibilityRatePercent:
      input.retirementEligibilityRatePercent != null ? String(input.retirementEligibilityRatePercent) : null,
    turnoverRatePercent: input.turnoverRatePercent != null ? String(input.turnoverRatePercent) : null,
    averageTenureMonths: input.averageTenureMonths != null ? String(input.averageTenureMonths) : null,
    internalMobilityRatePercent:
      input.internalMobilityRatePercent != null ? String(input.internalMobilityRatePercent) : null,
    currentPipelineCount: input.currentPipelineCount ?? 0,
    knownHiringPlan: input.knownHiringPlan ?? 0,
    trainingCapacity: input.trainingCapacity ?? 0,
    asOfDate: input.asOfDate ?? new Date(),
    importId: input.importId ?? null,
    ...provenance(input.actor),
    updatedAt: new Date(),
  };
  const [saved] = existing
    ? await db.update(workforceBaselines).set(values).where(eq(workforceBaselines.id, existing.id)).returning()
    : await db.insert(workforceBaselines).values(values).returning();
  await db
    .insert(workforceAssessmentAssumptions)
    .values([
      {
        assessmentId: input.assessmentId,
        code: `attrition:${input.roleId}`,
        label: "Attrition rate",
        included: true,
        ratePercent: values.attritionRatePercent,
        explanation: "Client-supplied or analyst-entered attrition assumption.",
        createdByUserId: input.actor.userId,
      },
      {
        assessmentId: input.assessmentId,
        code: `retirement:${input.roleId}`,
        label: "Retirement eligibility",
        included: true,
        ratePercent: values.retirementEligibilityRatePercent,
        explanation: "Client-supplied or analyst-entered retirement assumption.",
        createdByUserId: input.actor.userId,
      },
    ])
    .onConflictDoNothing();
  await audit(input.actor, "workforce.baseline.upserted", "workforce_baseline", saved.id, saved, existing);
  return saved;
}

export async function importBaselineCsv(input: {
  actor: Actor;
  assessmentId: string;
  csv: string;
  fileName?: string;
}) {
  requirePerm(input.actor, "workforce.write");
  const assessment = await loadAssessment(input.assessmentId, input.actor.organizationId);
  const db = getDb();
  const [record] = await db
    .insert(workforceImports)
    .values({
      assessmentId: assessment.id,
      sourceType: "csv",
      fileName: input.fileName ?? "baseline.csv",
      rowCount: 0,
      createdByUserId: input.actor.userId,
    })
    .returning();
  const rows = parseCsv(input.csv);
  const roles = await db.select().from(workforceRoles).where(eq(workforceRoles.assessmentId, assessment.id));
  let imported = 0;
  for (const row of rows) {
    const title = row["role title"] || row.title || row.role;
    const role = roles.find((item) => item.title.toLowerCase() === title.toLowerCase());
    if (!role) continue;
    await upsertBaseline({
      actor: input.actor,
      assessmentId: assessment.id,
      roleId: role.id,
      currentHeadcount: Number(row.headcount || row["current headcount"] || 0),
      vacancies: Number(row.vacancies || 0),
      attritionRatePercent: Number(row["attrition rate"] || row.attrition || 0),
      retirementEligibilityRatePercent: Number(row["retirement rate"] || row.retirement || 0),
      importId: record.id,
    });
    imported += 1;
  }
  const [updated] = await db
    .update(workforceImports)
    .set({ rowCount: imported, updatedAt: new Date() })
    .where(eq(workforceImports.id, record.id))
    .returning();
  await audit(input.actor, "workforce.import.csv", "workforce_import", record.id, updated);
  return updated;
}

export function rejectExcelImport() {
  throw new WorkforceError(excelImportNotConfigured());
}

export async function generateDemandForecasts(input: {
  actor: Actor;
  assessmentId: string;
  horizons?: number[];
  name?: string;
  components?: ForecastComponentInput[];
}) {
  requirePerm(input.actor, "forecasts.write");
  const assessment = await loadAssessment(input.assessmentId, input.actor.organizationId);
  assertAssessmentMutable(assessment.status);
  const db = getDb();
  const baselines = await db
    .select()
    .from(workforceBaselines)
    .where(eq(workforceBaselines.assessmentId, assessment.id));
  if (baselines.length === 0) throw new WorkforceError("Baselines are required before generating a forecast");
  const existing = await db
    .select({ versionNumber: workforceForecasts.versionNumber })
    .from(workforceForecasts)
    .where(eq(workforceForecasts.assessmentId, assessment.id))
    .orderBy(desc(workforceForecasts.versionNumber));
  const versionNumber = (existing[0]?.versionNumber ?? 0) + 1;
  const horizons = input.horizons?.length ? input.horizons : [...FORECAST_HORIZONS];
  const createdForecasts = [];
  const createdResults = [];
  for (const horizon of horizons) {
    const [forecast] = await db
      .insert(workforceForecasts)
      .values({
        assessmentId: assessment.id,
        versionNumber,
        name: input.name ?? `Demand forecast ${horizon} months`,
        horizonMonths: horizon,
        status: "draft",
        calculationMethod:
          "Configurable planning model: future demand = current required + growth + replacement + backlog - expected internal supply. Estimate only.",
        createdByUserId: input.actor.userId,
        ...provenance(input.actor, { quality: "estimated", confidence: "0.6000" }),
      })
      .returning();
    createdForecasts.push(forecast);
    await db.insert(workforceForecastComponents).values(
      (input.components ??
        defaultForecastComponents({
          attritionRatePercent: baselines[0] ? num(baselines[0].attritionRatePercent) : 0,
          retirementRatePercent: baselines[0] ? num(baselines[0].retirementEligibilityRatePercent) : 0,
          growthRatePercent: 0,
          backlog: baselines[0]?.vacancies ?? 0,
          internalMobilityRatePercent: baselines[0] ? num(baselines[0].internalMobilityRatePercent) : 0,
        })).map((component, index) => ({
        forecastId: forecast.id,
        code: component.code,
        label: component.label,
        included: component.included,
        ratePercent: component.ratePercent != null ? String(component.ratePercent) : null,
        quantity: component.quantity ?? null,
        explanation: component.explanation ?? null,
        sequence: index + 1,
      })),
    );
    for (const baseline of baselines) {
      const components =
        input.components ??
        defaultForecastComponents({
          attritionRatePercent: num(baseline.attritionRatePercent),
          retirementRatePercent: num(baseline.retirementEligibilityRatePercent),
          growthRatePercent: 0,
          backlog: baseline.vacancies,
          internalMobilityRatePercent: num(baseline.internalMobilityRatePercent),
        });
      const computed = computeDemandForecast({
        currentHeadcount: baseline.currentHeadcount,
        vacancies: baseline.vacancies,
        horizonMonths: horizon,
        components,
      });
      const [result] = await db
        .insert(workforceForecastResults)
        .values({
          forecastId: forecast.id,
          roleId: baseline.roleId,
          companyLocationId: baseline.companyLocationId,
          horizonMonths: horizon,
          currentRequired: computed.currentRequired,
          growthDemand: computed.growthDemand,
          replacementDemand: computed.replacementDemand,
          backlogDemand: computed.backlogDemand,
          expectedInternalSupply: computed.expectedInternalSupply,
          futureDemand: computed.futureDemand,
          assumptionsSummary: `Included: ${computed.includedCodes.join(", ") || "none"}. Excluded: ${computed.excludedCodes.join(", ") || "none"}.`,
          ...provenance(input.actor, {
            assumption: computed.calculationMethod,
            quality: "estimated",
            confidence: "0.6000",
          }),
        })
        .returning();
      createdResults.push(result);
    }
  }
  await audit(input.actor, "workforce.forecast.generated", "workforce_forecast", createdForecasts[0].id, {
    versionNumber,
    horizons,
    resultCount: createdResults.length,
  });
  return { versionNumber, forecasts: createdForecasts, results: createdResults };
}

export async function overrideForecastComponent(input: {
  actor: Actor;
  forecastId: string;
  componentCode: string;
  included?: boolean;
  ratePercent?: number | null;
  quantity?: number | null;
  reason: string;
}) {
  requirePerm(input.actor, "forecasts.write");
  const db = getDb();
  const [component] = await db
    .select()
    .from(workforceForecastComponents)
    .where(
      and(
        eq(workforceForecastComponents.forecastId, input.forecastId),
        eq(workforceForecastComponents.code, input.componentCode),
      ),
    )
    .limit(1);
  if (!component) throw new WorkforceError("Forecast component not found");
  const previous = {
    included: component.included,
    ratePercent: component.ratePercent,
    quantity: component.quantity,
  };
  const [updated] = await db
    .update(workforceForecastComponents)
    .set({
      included: input.included ?? component.included,
      ratePercent: input.ratePercent != null ? String(input.ratePercent) : component.ratePercent,
      quantity: input.quantity ?? component.quantity,
      updatedAt: new Date(),
    })
    .where(eq(workforceForecastComponents.id, component.id))
    .returning();
  await db.insert(workforceForecastOverrides).values({
    forecastId: input.forecastId,
    componentCode: input.componentCode,
    previousValue: JSON.stringify(previous),
    newValue: JSON.stringify({
      included: updated.included,
      ratePercent: updated.ratePercent,
      quantity: updated.quantity,
    }),
    reason: input.reason,
    actorUserId: input.actor.userId,
  });
  await audit(input.actor, "workforce.forecast.overridden", "workforce_forecast", input.forecastId, updated, previous, input.reason);
  return updated;
}

export async function upsertSupplyEntry(input: {
  actor: Actor;
  assessmentId: string;
  roleId: string;
  sourceType:
    | "internal_mobility"
    | "labor_market"
    | "military"
    | "apprenticeship"
    | "community_college"
    | "university"
    | "technical_school"
    | "training_program"
    | "talent_network"
    | "workforce_board"
    | "external_recruiting"
    | "other";
  estimatedSupply: number;
  companyLocationId?: string | null;
  readiness?: string | null;
  trainingRequired?: string | null;
  timeToReadinessDays?: number | null;
  capacity?: number | null;
  quality?: "unknown" | "estimated" | "internal_only" | "sourced" | "reviewed";
}) {
  requirePerm(input.actor, "workforce.write");
  const assessment = await loadAssessment(input.assessmentId, input.actor.organizationId);
  const db = getDb();
  const [created] = await db
    .insert(workforceSupplyEntries)
    .values({
      assessmentId: assessment.id,
      roleId: input.roleId,
      companyLocationId: input.companyLocationId ?? null,
      sourceType: input.sourceType,
      estimatedSupply: input.estimatedSupply,
      readiness: input.readiness ?? null,
      trainingRequired: input.trainingRequired ?? null,
      timeToReadinessDays: input.timeToReadinessDays ?? null,
      capacity: input.capacity ?? input.estimatedSupply,
      lastUpdated: new Date(),
      ...provenance(input.actor, { quality: input.quality ?? "estimated" }),
    })
    .returning();
  await audit(input.actor, "workforce.supply.upserted", "workforce_supply_entry", created.id, created);
  return created;
}

async function ensureGapThresholds(organizationId: string) {
  const db = getDb();
  const existing = await db
    .select()
    .from(workforceGapThresholds)
    .where(eq(workforceGapThresholds.organizationId, organizationId));
  if (existing.length > 0) return existing;
  await db.insert(workforceGapThresholds).values(
    DEFAULT_GAP_THRESHOLDS.map((row) => ({
      organizationId,
      severity: row.severity,
      minGap: row.minGap,
      minGapPercent: String(row.minGapPercent),
    })),
  );
  return db.select().from(workforceGapThresholds).where(eq(workforceGapThresholds.organizationId, organizationId));
}

export async function calculateWorkforceGaps(input: { actor: Actor; assessmentId: string; horizonMonths?: number }) {
  requirePerm(input.actor, "workforce.analyze");
  const assessment = await loadAssessment(input.assessmentId, input.actor.organizationId);
  const db = getDb();
  const thresholds = await ensureGapThresholds(input.actor.organizationId);
  const mapped = thresholds.map((row) => ({
    severity: row.severity,
    minGap: row.minGap,
    minGapPercent: num(row.minGapPercent),
  }));
  const results = await db
    .select()
    .from(workforceForecastResults)
    .innerJoin(workforceForecasts, eq(workforceForecastResults.forecastId, workforceForecasts.id))
    .where(
      and(
        eq(workforceForecasts.assessmentId, assessment.id),
        input.horizonMonths ? eq(workforceForecastResults.horizonMonths, input.horizonMonths) : sql`true`,
      ),
    );
  const supplyRows = await db
    .select()
    .from(workforceSupplyEntries)
    .where(eq(workforceSupplyEntries.assessmentId, assessment.id));
  const created = [];
  for (const row of results) {
    const result = row.workforce_forecast_results;
    const supply = supplyRows
      .filter((entry) => entry.roleId === result.roleId)
      .reduce((sum, entry) => sum + entry.estimatedSupply, 0);
    const gap = computeGap(result.futureDemand, supply);
    const severity = classifyGapSeverity(gap, result.futureDemand, mapped);
    const [saved] = await db
      .insert(workforceGaps)
      .values({
        assessmentId: assessment.id,
        forecastResultId: result.id,
        roleId: result.roleId,
        companyLocationId: result.companyLocationId,
        horizonMonths: result.horizonMonths,
        demand: result.futureDemand,
        supply,
        gap,
        severity,
        risk: severity === "critical" || severity === "high" ? "capacity" : "monitor",
        timeHorizon: `${result.horizonMonths} months`,
        assumptionsSummary: result.assumptionsSummary,
        ...provenance(input.actor, { quality: "estimated", confidence: result.confidence ?? "0.6000" }),
      })
      .returning();
    created.push(saved);
  }
  await audit(input.actor, "workforce.gaps.calculated", "workforce_gap", assessment.id, { count: created.length });
  return created;
}

export async function allocateGap(input: {
  actor: Actor;
  gapId: string;
  allocations: Array<{
    sourceType: (typeof talentPipelineAllocations.$inferInsert)["sourceType"];
    plannedCount: number;
    pipelineId?: string;
    actualCount?: number;
  }>;
}) {
  requirePerm(input.actor, "pipelines.write");
  const db = getDb();
  const [gap] = await db.select().from(workforceGaps).where(eq(workforceGaps.id, input.gapId)).limit(1);
  if (!gap) throw new WorkforceError("Workforce gap not found");
  const assessment = await loadAssessment(gap.assessmentId, input.actor.organizationId);
  const saved = [];
  for (const allocation of input.allocations) {
    let pipelineId = allocation.pipelineId;
    if (!pipelineId) {
      const [pipeline] = await db
        .insert(talentPipelines)
        .values({
          organizationId: assessment.organizationId,
          companyId: assessment.companyId,
          assessmentId: assessment.id,
          gapId: gap.id,
          roleId: gap.roleId,
          companyLocationId: gap.companyLocationId,
          name: `${allocation.sourceType} pipeline`,
          sourceType: allocation.sourceType,
          targetCandidatesPerYear: allocation.plannedCount,
          expectedConversionPercent: "70",
        })
        .returning();
      pipelineId = pipeline.id;
    }
    const [row] = await db
      .insert(talentPipelineAllocations)
      .values({
        pipelineId,
        gapId: gap.id,
        sourceType: allocation.sourceType,
        plannedCount: allocation.plannedCount,
        actualCount: allocation.actualCount ?? 0,
      })
      .onConflictDoUpdate({
        target: [talentPipelineAllocations.gapId, talentPipelineAllocations.sourceType],
        set: {
          plannedCount: allocation.plannedCount,
          actualCount: allocation.actualCount ?? 0,
          pipelineId,
          updatedAt: new Date(),
        },
      })
      .returning();
    saved.push(row);
  }
  const coverage = pipelineCoverage(
    gap.gap,
    saved.map((row) => ({ sourceType: row.sourceType, plannedCount: row.plannedCount, actualCount: row.actualCount })),
  );
  await audit(input.actor, "workforce.pipeline.allocated", "workforce_gap", gap.id, { allocations: saved, coverage });
  return { gap, allocations: saved, coverage };
}

export async function createEducationPartner(input: {
  actor: Actor;
  name: string;
  partnerType: (typeof educationPartners.$inferInsert)["partnerType"];
  companyId?: string | null;
  annualCapacity?: number | null;
  occupationsSupported?: string | null;
  credentials?: string | null;
}) {
  requirePerm(input.actor, "education_partners.write");
  const db = getDb();
  const [created] = await db
    .insert(educationPartners)
    .values({
      organizationId: input.actor.organizationId,
      companyId: input.companyId ?? null,
      name: input.name,
      partnerType: input.partnerType,
      partnershipStatus: "exploratory",
      annualCapacity: input.annualCapacity ?? null,
      occupationsSupported: input.occupationsSupported ?? null,
      credentials: input.credentials ?? null,
    })
    .returning();
  await audit(input.actor, "workforce.education_partner.created", "education_partner", created.id, created);
  return created;
}

export async function createTrainingProgram(input: {
  actor: Actor;
  name: string;
  partnerId?: string | null;
  skillIds?: string[];
  occupationIds?: string[];
  durationDays?: number | null;
  capacity?: number | null;
  deliveryMethod?: string | null;
  location?: string | null;
  credentials?: string | null;
  completionRatePercent?: number | null;
  placementRatePercent?: number | null;
}) {
  requirePerm(input.actor, "training_programs.write");
  if ((input.completionRatePercent != null || input.placementRatePercent != null) === false) {
    // do not fabricate
  }
  const db = getDb();
  const [created] = await db
    .insert(trainingPrograms)
    .values({
      organizationId: input.actor.organizationId,
      partnerId: input.partnerId ?? null,
      name: input.name,
      durationDays: input.durationDays ?? null,
      capacity: input.capacity ?? null,
      deliveryMethod: input.deliveryMethod ?? null,
      location: input.location ?? null,
      credentials: input.credentials ?? null,
      completionRatePercent: input.completionRatePercent != null ? String(input.completionRatePercent) : null,
      placementRatePercent: input.placementRatePercent != null ? String(input.placementRatePercent) : null,
    })
    .returning();
  if (input.skillIds?.length) {
    await db.insert(trainingProgramSkills).values(input.skillIds.map((skillId) => ({ programId: created.id, skillId })));
  }
  if (input.occupationIds?.length) {
    await db
      .insert(trainingProgramOccupations)
      .values(input.occupationIds.map((occupationId) => ({ programId: created.id, occupationId })));
  }
  await audit(input.actor, "workforce.training_program.created", "training_program", created.id, created);
  return created;
}

export async function createApprenticeship(input: {
  actor: Actor;
  companyId?: string | null;
  partnerId?: string | null;
  occupationId?: string | null;
  sponsorName?: string | null;
  durationMonths?: number | null;
  trainingHours?: number | null;
  classroomHours?: number | null;
  targetEnrollment?: number | null;
  annualCapacity?: number | null;
}) {
  requirePerm(input.actor, "workforce.write");
  const db = getDb();
  const [created] = await db
    .insert(apprenticeships)
    .values({
      organizationId: input.actor.organizationId,
      companyId: input.companyId ?? null,
      partnerId: input.partnerId ?? null,
      occupationId: input.occupationId ?? null,
      sponsorName: input.sponsorName ?? null,
      durationMonths: input.durationMonths ?? null,
      trainingHours: input.trainingHours ?? null,
      classroomHours: input.classroomHours ?? null,
      targetEnrollment: input.targetEnrollment ?? null,
      annualCapacity: input.annualCapacity ?? null,
      status: "planned",
    })
    .returning();
  await audit(input.actor, "workforce.apprenticeship.created", "apprenticeship", created.id, created);
  return created;
}

export async function createCareerPathway(input: {
  actor: Actor;
  companyId: string;
  name: string;
  description?: string | null;
  levels: Array<{
    title: string;
    civilianOccupationId?: string | null;
    skillIds?: string[];
    experience?: string | null;
    training?: string | null;
    certifications?: string | null;
    expectedTimeMonths?: number | null;
    leadershipRequirements?: string | null;
    compensationBand?: string | null;
  }>;
  lateralFromTo?: Array<[number, number]>;
}) {
  requirePerm(input.actor, "career_paths.write");
  const db = getDb();
  const [path] = await db
    .insert(careerPaths)
    .values({
      organizationId: input.actor.organizationId,
      companyId: input.companyId,
      name: input.name,
      description: input.description ?? null,
    })
    .returning();
  const levels = [];
  for (const [index, level] of input.levels.entries()) {
    const [created] = await db
      .insert(careerPathLevels)
      .values({
        pathId: path.id,
        sequence: index + 1,
        title: level.title,
        civilianOccupationId: level.civilianOccupationId ?? null,
        experience: level.experience ?? null,
        training: level.training ?? null,
        certifications: level.certifications ?? null,
        expectedTimeMonths: level.expectedTimeMonths ?? null,
        leadershipRequirements: level.leadershipRequirements ?? null,
        compensationBand: level.compensationBand ?? null,
      })
      .returning();
    levels.push(created);
  }
  for (let index = 0; index < levels.length - 1; index += 1) {
    await db.insert(careerPathEdges).values({
      pathId: path.id,
      fromLevelId: levels[index].id,
      toLevelId: levels[index + 1].id,
      edgeType: "sequential",
    });
  }
  for (const [from, to] of input.lateralFromTo ?? []) {
    if (levels[from] && levels[to]) {
      await db.insert(careerPathEdges).values({
        pathId: path.id,
        fromLevelId: levels[from].id,
        toLevelId: levels[to].id,
        edgeType: "lateral",
      });
    }
  }
  await audit(input.actor, "workforce.career_path.created", "career_path", path.id, { path, levels });
  return { path, levels };
}

export async function analyzeSkillsGap(input: {
  actor: Actor;
  roleId: string;
  assessmentId?: string | null;
  scope: "individual" | "aggregate" | "military_transition";
  currentSkillIds?: string[];
  candidateId?: string | null;
}) {
  requirePerm(input.actor, "workforce.analyze");
  const db = getDb();
  const [role] = await db.select().from(workforceRoles).where(eq(workforceRoles.id, input.roleId)).limit(1);
  if (!role || role.organizationId !== input.actor.organizationId) {
    throw new WorkforceError("Workforce role not found");
  }
  const required = await db.select().from(workforceRoleSkills).where(eq(workforceRoleSkills.roleId, role.id));
  let requiredSkillIds = required.map((row) => row.skillId);
  if (requiredSkillIds.length === 0 && role.civilianOccupationId) {
    const occupation = await db
      .select()
      .from(occupationSkills)
      .where(eq(occupationSkills.occupationId, role.civilianOccupationId));
    requiredSkillIds = occupation.map((row) => row.skillId);
  }
  const current = new Set(input.currentSkillIds ?? []);
  const missing = requiredSkillIds.filter((skillId) => !current.has(skillId));
  const existing = requiredSkillIds.filter((skillId) => current.has(skillId));
  const skillRows = requiredSkillIds.length
    ? await db.select().from(skills).where(inArray(skills.id, requiredSkillIds))
    : [];
  const nameById = Object.fromEntries(skillRows.map((row) => [row.id, row.name]));
  const [analysis] = await db
    .insert(skillsGapAnalyses)
    .values({
      assessmentId: input.assessmentId ?? role.assessmentId,
      roleId: role.id,
      scope: input.scope,
      candidateId: input.scope === "individual" ? input.candidateId ?? null : null,
      existingSkillsSummary: existing.map((id) => nameById[id]).filter(Boolean).join(", ") || "None recorded",
      missingSkillsSummary: missing.map((id) => nameById[id]).filter(Boolean).join(", ") || "None",
      proficiencyGaps: missing.length ? "Target proficiency not evidenced for missing skills." : "No proficiency gap recorded.",
      certificationGaps: role.minimumCredentials ?? "None recorded",
      recommendedTraining: missing.length
        ? `Training required for: ${missing.map((id) => nameById[id]).join(", ")}.`
        : "No additional training identified from stored skills.",
      readinessEstimate: missing.length ? "Not ready without training" : "Skills present in current profile",
      ...provenance(input.actor, { quality: "internal_only" }),
    })
    .returning();
  if (requiredSkillIds.length) {
    await db.insert(skillsGapItems).values(
      requiredSkillIds.map((skillId) => ({
        analysisId: analysis.id,
        skillId,
        status: missing.includes(skillId) ? "missing" : "existing",
      })),
    );
  }
  await audit(input.actor, "workforce.skills_gap.analyzed", "skills_gap_analysis", analysis.id, analysis);
  return { analysis, missingSkillIds: missing, existingSkillIds: existing };
}

export async function createScenario(input: {
  actor: Actor;
  assessmentId: string;
  name: string;
  description?: string | null;
  deltas: {
    growthDeltaPercent?: number | null;
    attritionDeltaPercent?: number | null;
    retirementDeltaPercent?: number | null;
    hiringDelta?: number | null;
    trainingCapacityDelta?: number | null;
    pipelineConversionDeltaPercent?: number | null;
    militaryContributionDelta?: number | null;
    internalMobilityDeltaPercent?: number | null;
  };
}) {
  requirePerm(input.actor, "scenario_models.write");
  const assessment = await loadAssessment(input.assessmentId, input.actor.organizationId);
  const db = getDb();
  const [scenario] = await db
    .insert(workforceScenarios)
    .values({
      assessmentId: assessment.id,
      name: input.name,
      description: input.description ?? null,
      createdByUserId: input.actor.userId,
      ...provenance(input.actor, {
        assumption: "Scenario output is a planning estimate, not a guaranteed forecast.",
        quality: "estimated",
      }),
    })
    .returning();
  await db.insert(workforceScenarioInputs).values({
    scenarioId: scenario.id,
    growthDeltaPercent: input.deltas.growthDeltaPercent != null ? String(input.deltas.growthDeltaPercent) : null,
    attritionDeltaPercent: input.deltas.attritionDeltaPercent != null ? String(input.deltas.attritionDeltaPercent) : null,
    retirementDeltaPercent: input.deltas.retirementDeltaPercent != null ? String(input.deltas.retirementDeltaPercent) : null,
    hiringDelta: input.deltas.hiringDelta ?? null,
    trainingCapacityDelta: input.deltas.trainingCapacityDelta ?? null,
    pipelineConversionDeltaPercent:
      input.deltas.pipelineConversionDeltaPercent != null ? String(input.deltas.pipelineConversionDeltaPercent) : null,
    militaryContributionDelta: input.deltas.militaryContributionDelta ?? null,
    internalMobilityDeltaPercent:
      input.deltas.internalMobilityDeltaPercent != null ? String(input.deltas.internalMobilityDeltaPercent) : null,
  });
  const baselines = await db.select().from(workforceBaselines).where(eq(workforceBaselines.assessmentId, assessment.id));
  const outputs = [];
  for (const baseline of baselines) {
    const components = applyScenarioDeltas(
      defaultForecastComponents({
        attritionRatePercent: num(baseline.attritionRatePercent),
        retirementRatePercent: num(baseline.retirementEligibilityRatePercent),
        growthRatePercent: 0,
        backlog: baseline.vacancies,
        internalMobilityRatePercent: num(baseline.internalMobilityRatePercent),
      }),
      input.deltas,
    );
    const computed = computeDemandForecast({
      currentHeadcount: baseline.currentHeadcount,
      vacancies: baseline.vacancies,
      horizonMonths: 24,
      components,
    });
    const supplyRows = await db
      .select()
      .from(workforceSupplyEntries)
      .where(and(eq(workforceSupplyEntries.assessmentId, assessment.id), eq(workforceSupplyEntries.roleId, baseline.roleId)));
    const supply =
      supplyRows.reduce((sum, row) => sum + row.estimatedSupply, 0) + (input.deltas.militaryContributionDelta ?? 0);
    const [output] = await db
      .insert(workforceScenarioOutputs)
      .values({
        scenarioId: scenario.id,
        roleId: baseline.roleId,
        horizonMonths: 24,
        projectedDemand: computed.futureDemand,
        projectedSupply: supply,
        resultingGap: computeGap(computed.futureDemand, supply),
        requiredPipelineCapacity: Math.max(0, computeGap(computed.futureDemand, supply)),
        estimatedTimeToReadinessDays: 180,
        majorRisks: "Scenario results are estimates. Capacity, conversion, and military contribution are assumptions.",
        keyAssumptions: computed.calculationMethod,
        ...provenance(input.actor, { quality: "estimated", confidence: "0.5500" }),
      })
      .returning();
    outputs.push(output);
  }
  await audit(input.actor, "workforce.scenario.created", "workforce_scenario", scenario.id, { scenario, outputs });
  return { scenario, outputs };
}

export async function compareScenarios(input: { actor: Actor; assessmentId: string; scenarioIds: string[] }) {
  requirePerm(input.actor, "scenario_models.read");
  const assessment = await loadAssessment(input.assessmentId, input.actor.organizationId);
  const db = getDb();
  const scenarios = await db
    .select()
    .from(workforceScenarios)
    .where(and(eq(workforceScenarios.assessmentId, assessment.id), inArray(workforceScenarios.id, input.scenarioIds)));
  const outputs = await db
    .select()
    .from(workforceScenarioOutputs)
    .where(inArray(workforceScenarioOutputs.scenarioId, input.scenarioIds));
  return {
    notice: "Scenario comparison is a planning estimate, not a guaranteed forecast.",
    scenarios,
    outputs,
  };
}

export async function draftAiWorkforceRecommendation(input: {
  actor: Actor;
  assessmentId: string;
  kind: "analyst" | "architect";
}) {
  requirePerm(input.actor, "workforce.analyze");
  const assessment = await loadAssessment(input.assessmentId, input.actor.organizationId);
  const env = getServerEnv();
  const db = getDb();
  const slug = input.kind === "architect" ? "workforce-architect" : "workforce-analyst";
  const [agent] = await db.select().from(agents).where(eq(agents.slug, slug)).limit(1);
  const gaps = await db.select().from(workforceGaps).where(eq(workforceGaps.assessmentId, assessment.id));
  const summary =
    input.kind === "architect"
      ? `Draft pipeline design from stored gaps (${gaps.length} records). Human approval required before client use.`
      : `Draft gap commentary from stored workforce data (${gaps.length} gaps). Do not treat as labor-market fact.`;
  const model = env.AI_PROVIDER ? env.AI_PROVIDER : "internal_heuristic";
  const modelVersion = env.AI_PROVIDER ? "configured" : "unconfigured-heuristic";
  const [recommendation] = await db
    .insert(workforceRecommendations)
    .values({
      assessmentId: assessment.id,
      title: input.kind === "architect" ? "Draft workforce architecture" : "Draft workforce analysis",
      body: summary,
      status: "pending_approval",
      generatedByActorType: "agent",
      generatedByAgentId: agent?.id ?? null,
      generatedByUserId: input.actor.userId,
      generatedByModel: model,
      generatedByModelVersion: modelVersion,
      confidence: "0.5000",
      dataQuality: "estimated",
      internalAssumption: "Drafted from stored WorkforceOS records only. No BLS/Census/O*NET values were invented.",
      generatedAt: new Date(),
    })
    .returning();
  const approval = await requestApproval({
    organizationId: input.actor.organizationId,
    recordType: "workforce_recommendation",
    recordId: recommendation.id,
    approvalType: "client_facing_workforce_recommendation",
    requestingUserId: null,
    requestingAgentId: agent?.id ?? null,
  });
  if (agent) {
    await db.insert(agentOutputs).values({
      agentId: agent.id,
      approvalId: approval.id,
      outputType: "workforce_recommendation",
      summary,
      model,
      modelVersion,
      confidence: "0.5000",
      sourceReferences: { assessmentId: assessment.id, gapCount: gaps.length },
    });
  }
  const [updated] = await db
    .update(workforceRecommendations)
    .set({ approvalId: approval.id, updatedAt: new Date() })
    .where(eq(workforceRecommendations.id, recommendation.id))
    .returning();
  await audit(input.actor, "workforce.recommendation.drafted", "workforce_recommendation", updated.id, updated);
  return { recommendation: updated, approval, agent };
}

export async function approveWorkforceRecommendation(input: {
  actor: Actor;
  recommendationId: string;
  notes?: string;
}) {
  requirePerm(input.actor, "workforce.approve");
  assertHumanApprovalActor("human");
  const db = getDb();
  const [recommendation] = await db
    .select()
    .from(workforceRecommendations)
    .where(eq(workforceRecommendations.id, input.recommendationId))
    .limit(1);
  if (!recommendation) throw new WorkforceError("Recommendation not found");
  if (recommendation.generatedByAgentId) {
    assertAgentCannotSelfApprove({
      requestingAgentId: recommendation.generatedByAgentId,
      decidingActorType: "human",
    });
  }
  if (!recommendation.approvalId) throw new WorkforceError("Recommendation has no approval request");
  const approval = await approveRequest(recommendation.approvalId, input.actor.userId, input.notes);
  const [updated] = await db
    .update(workforceRecommendations)
    .set({
      status: "approved",
      approvedByUserId: input.actor.userId,
      approvedAt: new Date(),
      reviewerUserId: input.actor.userId,
      updatedAt: new Date(),
    })
    .where(eq(workforceRecommendations.id, recommendation.id))
    .returning();
  await audit(input.actor, "workforce.recommendation.approved", "workforce_recommendation", updated.id, updated, recommendation);
  return { recommendation: updated, approval };
}

export async function createWorkforcePipelinePlan(input: { actor: Actor; assessmentId: string }) {
  requirePerm(input.actor, "workforce.write");
  const assessment = await loadAssessment(input.assessmentId, input.actor.organizationId);
  const db = getDb();
  const [company] = await db.select().from(companies).where(eq(companies.id, assessment.companyId)).limit(1);
  const gaps = await db.select().from(workforceGaps).where(eq(workforceGaps.assessmentId, assessment.id));
  const roles = await db.select().from(workforceRoles).where(eq(workforceRoles.assessmentId, assessment.id));
  const forecasts = await db.select().from(workforceForecasts).where(eq(workforceForecasts.assessmentId, assessment.id));
  const supply = await db.select().from(workforceSupplyEntries).where(eq(workforceSupplyEntries.assessmentId, assessment.id));
  const scenarios = await db.select().from(workforceScenarios).where(eq(workforceScenarios.assessmentId, assessment.id));
  const allocations = await db
    .select()
    .from(talentPipelineAllocations)
    .innerJoin(workforceGaps, eq(talentPipelineAllocations.gapId, workforceGaps.id))
    .where(eq(workforceGaps.assessmentId, assessment.id));
  const military = roles[0] ? await militaryOverlayForRole(roles[0].id) : null;
  const report = {
    client: company?.name ?? "Client",
    title: `${assessment.title} — Workforce Pipeline Plan`,
    executiveSummary: `Planning estimate for ${roles.length} workforce roles. ${gaps.length} gap records. Not a guaranteed forecast.`,
    currentWorkforceState: `Baselines and assumptions are stored on the assessment. Data quality is internal/estimated unless a configured labor-market source is attached.`,
    criticalOccupations: roles
      .filter((role) => role.criticality === "critical" || role.criticality === "high")
      .map((role) => role.title)
      .join(", ") || "None classified critical.",
    demandForecast: `${forecasts.length} forecast versions. Horizons 12/24/36 months where generated.`,
    talentSupply: `${supply.length} supply entries. Labor-market values are not invented.`,
    workforceGaps: gaps.map((gap) => `${gap.horizonMonths}mo gap ${gap.gap} (${gap.severity})`).join("; ") || "No gaps calculated.",
    militaryOpportunity: military
      ? `${military.occupations.length} mapped military occupations, ${military.installations.length} installations from stored Phase 3 mappings.`
      : "No military overlay generated.",
    educationTrainingOpportunity: "Education partners and training programs linked to this assessment, if created.",
    internalDevelopment: "Internal mobility is an assumption component, not an HRIS extract.",
    recommendedPipelineMix: allocations
      .map((row) => `${row.talent_pipeline_allocations.sourceType}: ${row.talent_pipeline_allocations.plannedCount}`)
      .join("; ") || "No allocation recorded.",
    scenarioAnalysis: `${scenarios.length} scenarios. Comparison is an estimate.`,
    implementationRoadmap: "0–90 days, 3–6 months, 6–12 months, 12–24 months actions after human approval.",
    kpis: "Forecast demand, projected gap, pipeline capacity. Financial KPIs are omitted without source data.",
    risks: "Skills shortage, attrition, retirement, capacity, and conversion risk are tracked when recorded.",
    assumptions: "See assessment assumptions, forecast components, and provenance fields.",
    provenance: "source=internal_baseline; version=phase5-v1; confidence stored per record; human approval required.",
  };
  const html = renderWorkforcePlanHtml(report);
  const existing = await db
    .select({ versionNumber: workforcePipelinePlans.versionNumber })
    .from(workforcePipelinePlans)
    .where(eq(workforcePipelinePlans.assessmentId, assessment.id))
    .orderBy(desc(workforcePipelinePlans.versionNumber));
  let deliverableId: string | null = null;
  if (assessment.projectId) {
    const [deliverable] = await db
      .insert(projectDeliverables)
      .values({
        projectId: assessment.projectId,
        name: "Workforce Pipeline Plan",
        deliverableType: "plan",
        description: "Expanded Phase 4 WPA deliverable. Client-facing after human approval.",
        status: "review",
        clientFacing: true,
        required: true,
        ownerUserId: input.actor.userId,
      })
      .returning();
    deliverableId = deliverable.id;
  }
  const [plan] = await db
    .insert(workforcePipelinePlans)
    .values({
      assessmentId: assessment.id,
      projectDeliverableId: deliverableId,
      versionNumber: (existing[0]?.versionNumber ?? 0) + 1,
      status: "draft",
      htmlBody: html,
      executiveSummary: report.executiveSummary,
      currentWorkforceState: report.currentWorkforceState,
      criticalOccupations: report.criticalOccupations,
      demandForecast: report.demandForecast,
      talentSupply: report.talentSupply,
      workforceGaps: report.workforceGaps,
      militaryOpportunity: report.militaryOpportunity,
      educationTrainingOpportunity: report.educationTrainingOpportunity,
      internalDevelopment: report.internalDevelopment,
      recommendedPipelineMix: report.recommendedPipelineMix,
      scenarioAnalysis: report.scenarioAnalysis,
      implementationRoadmap: report.implementationRoadmap,
      kpis: report.kpis,
      risks: report.risks,
      assumptions: `${report.assumptions} ${report.provenance}`,
      ...provenance(input.actor, { quality: "estimated" }),
    })
    .returning();
  await audit(input.actor, "workforce.plan.created", "workforce_pipeline_plan", plan.id, plan);
  return plan;
}

export async function submitWorkforcePlanForApproval(input: { actor: Actor; planId: string }) {
  requirePerm(input.actor, "workforce.write");
  const db = getDb();
  const [plan] = await db.select().from(workforcePipelinePlans).where(eq(workforcePipelinePlans.id, input.planId)).limit(1);
  if (!plan) throw new WorkforceError("Workforce pipeline plan not found");
  const approval = await requestApproval({
    organizationId: input.actor.organizationId,
    recordType: "workforce_pipeline_plan",
    recordId: plan.id,
    approvalType: "client_facing_workforce_plan",
    requestingUserId: input.actor.userId,
  });
  const [updated] = await db
    .update(workforcePipelinePlans)
    .set({ status: "pending_approval", approvalId: approval.id, updatedAt: new Date() })
    .where(eq(workforcePipelinePlans.id, plan.id))
    .returning();
  await audit(input.actor, "workforce.plan.submitted", "workforce_pipeline_plan", updated.id, updated, plan);
  return { plan: updated, approval };
}

export async function approveWorkforcePlan(input: { actor: Actor; planId: string; notes?: string }) {
  requirePerm(input.actor, "workforce.approve");
  assertHumanApprovalActor("human");
  const db = getDb();
  const [plan] = await db.select().from(workforcePipelinePlans).where(eq(workforcePipelinePlans.id, input.planId)).limit(1);
  if (!plan) throw new WorkforceError("Workforce pipeline plan not found");
  if (!plan.approvalId) throw new WorkforceError("Plan has no approval request");
  const approval = await approveRequest(plan.approvalId, input.actor.userId, input.notes);
  const [updated] = await db
    .update(workforcePipelinePlans)
    .set({
      status: "approved",
      approvedByUserId: input.actor.userId,
      approvedAt: new Date(),
      reviewerUserId: input.actor.userId,
      updatedAt: new Date(),
    })
    .where(eq(workforcePipelinePlans.id, plan.id))
    .returning();
  if (updated.projectDeliverableId) {
    await db
      .update(projectDeliverables)
      .set({
        status: "approved",
        approvedByUserId: input.actor.userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(projectDeliverables.id, updated.projectDeliverableId));
  }
  const assessment = await loadAssessment(updated.assessmentId, input.actor.organizationId);
  if (assessment.status !== "delivered" && assessment.status !== "completed") {
    await db
      .update(workforceAssessments)
      .set({ status: "human_review", approvedByUserId: input.actor.userId, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(workforceAssessments.id, assessment.id));
  }
  await audit(input.actor, "workforce.plan.approved", "workforce_pipeline_plan", updated.id, updated, plan);
  return { plan: updated, approval };
}

export async function createRoadmapProjectTasks(input: {
  actor: Actor;
  assessmentId: string;
  items?: Array<{
    period: "0_90_days" | "3_6_months" | "6_12_months" | "12_24_months";
    action: string;
    clientResponsibility?: string;
    firmResponsibility?: string;
    kpi?: string;
  }>;
}) {
  requirePerm(input.actor, "projects.write");
  const assessment = await loadAssessment(input.assessmentId, input.actor.organizationId);
  if (!assessment.projectId) {
    throw new WorkforceError("Assessment must be linked to an existing delivery project before creating roadmap tasks");
  }
  const db = getDb();
  const [approvedPlan] = await db
    .select()
    .from(workforcePipelinePlans)
    .where(and(eq(workforcePipelinePlans.assessmentId, assessment.id), eq(workforcePipelinePlans.status, "approved")))
    .orderBy(desc(workforcePipelinePlans.versionNumber))
    .limit(1);
  if (!approvedPlan) throw new WorkforceError("An approved Workforce Pipeline Plan is required before creating project tasks");
  const [phase] = await db
    .select()
    .from(projectPhases)
    .where(eq(projectPhases.projectId, assessment.projectId))
    .orderBy(asc(projectPhases.sequence))
    .limit(1);
  if (!phase) throw new WorkforceError("Delivery project has no phases");
  const defaults = input.items ?? [
    { period: "0_90_days" as const, action: "Confirm baseline data and critical roles with the client", kpi: "Baseline complete" },
    { period: "3_6_months" as const, action: "Stand up military and education pipeline sources", kpi: "Pipeline enrollment" },
    { period: "6_12_months" as const, action: "Launch apprenticeship or community college capacity", kpi: "Training completion" },
    { period: "12_24_months" as const, action: "Review conversion and residual gap", kpi: "Hiring conversion" },
  ];
  const created = [];
  for (const item of defaults) {
    const [task] = await db
      .insert(projectTasks)
      .values({
        phaseId: phase.id,
        name: item.action,
        description: `${item.period}: PierOne / client workforce roadmap action`,
        status: "not_started",
        ownerUserId: input.actor.userId,
        completionCriteria: item.kpi ?? null,
      })
      .returning();
    const [roadmap] = await db
      .insert(workforceRoadmapItems)
      .values({
        assessmentId: assessment.id,
        period: item.period,
        action: item.action,
        ownerUserId: input.actor.userId,
        clientResponsibility: item.clientResponsibility ?? "Provide data and decisions",
        firmResponsibility: item.firmResponsibility ?? "Facilitate planning and pipeline design",
        kpi: item.kpi ?? null,
        status: "planned",
        projectTaskId: task.id,
      })
      .returning();
    created.push({ task, roadmap });
  }
  await audit(input.actor, "workforce.roadmap.tasks_created", "workforce_assessment", assessment.id, {
    count: created.length,
  });
  return created;
}

export async function recordWorkforceKpis(input: { actor: Actor; assessmentId: string }) {
  requirePerm(input.actor, "workforce.write");
  const assessment = await loadAssessment(input.assessmentId, input.actor.organizationId);
  const db = getDb();
  const gaps = await db.select().from(workforceGaps).where(eq(workforceGaps.assessmentId, assessment.id));
  const allocations = await db
    .select()
    .from(talentPipelineAllocations)
    .innerJoin(workforceGaps, eq(talentPipelineAllocations.gapId, workforceGaps.id))
    .where(eq(workforceGaps.assessmentId, assessment.id));
  const demand = gaps.reduce((sum, row) => sum + row.demand, 0);
  const gap = gaps.reduce((sum, row) => sum + row.gap, 0);
  const capacity = allocations.reduce((sum, row) => sum + row.talent_pipeline_allocations.plannedCount, 0);
  const rows = [
    { code: "forecast_demand", label: "Forecast demand", value: demand, unit: "headcount" },
    { code: "projected_gap", label: "Projected gap", value: gap, unit: "headcount" },
    { code: "pipeline_capacity", label: "Pipeline capacity", value: capacity, unit: "headcount" },
  ];
  const saved = [];
  for (const row of rows) {
    const [kpi] = await db
      .insert(workforceKpis)
      .values({
        assessmentId: assessment.id,
        code: row.code,
        label: row.label,
        valueNumeric: String(row.value),
        unit: row.unit,
        asOfDate: new Date(),
        source: "internal_calculation",
      })
      .onConflictDoUpdate({
        target: [workforceKpis.assessmentId, workforceKpis.code],
        set: { valueNumeric: String(row.value), updatedAt: new Date() },
      })
      .returning();
    saved.push(kpi);
  }
  return saved;
}

export async function recordWorkforceRisk(input: {
  actor: Actor;
  assessmentId: string;
  roleId?: string | null;
  category: (typeof workforceRisks.$inferInsert)["category"];
  severity?: "critical" | "high" | "moderate" | "low";
  likelihood?: string;
  impact?: string;
  mitigation?: string | null;
}) {
  requirePerm(input.actor, "workforce.write");
  const assessment = await loadAssessment(input.assessmentId, input.actor.organizationId);
  const db = getDb();
  const [created] = await db
    .insert(workforceRisks)
    .values({
      assessmentId: assessment.id,
      roleId: input.roleId ?? null,
      category: input.category,
      severity: input.severity ?? "moderate",
      likelihood: input.likelihood ?? "medium",
      impact: input.impact ?? "medium",
      mitigation: input.mitigation ?? null,
      ownerUserId: input.actor.userId,
    })
    .returning();
  await audit(input.actor, "workforce.risk.created", "workforce_risk", created.id, created);
  return created;
}

export async function roleMilitaryOverlay(input: { actor: Actor; roleId: string }) {
  requirePerm(input.actor, "workforce.read");
  return militaryOverlayForRole(input.roleId);
}

export async function roleTalentNetworkOverlay(input: { actor: Actor; roleId: string }) {
  requirePerm(input.actor, "workforce.read");
  const db = getDb();
  const [role] = await db.select().from(workforceRoles).where(eq(workforceRoles.id, input.roleId)).limit(1);
  if (!role || role.organizationId !== input.actor.organizationId) throw new WorkforceError("Workforce role not found");
  const skillRows = await db.select().from(workforceRoleSkills).where(eq(workforceRoleSkills.roleId, role.id));
  const [location] = role.companyLocationId
    ? await db.select().from(companyLocations).where(eq(companyLocations.id, role.companyLocationId)).limit(1)
    : [undefined];
  return talentNetworkOverlayForRole({
    organizationId: input.actor.organizationId,
    roleId: role.id,
    skillIds: skillRows.map((row) => row.skillId),
    region: location?.region ?? null,
  });
}

export async function upsertScarcityIndicator(input: { actor: Actor; roleId: string }) {
  requirePerm(input.actor, "workforce.analyze");
  const overlay = await roleTalentNetworkOverlay(input);
  const military = await militaryOverlayForRole(input.roleId);
  const db = getDb();
  const classification =
    overlay.matchingCandidates === 0 && military.occupations.length === 0
      ? "unknown"
      : overlay.matchingCandidates > 0 && military.occupations.length === 0
        ? "internal_only"
        : "estimated";
  const [created] = await db
    .insert(talentScarcityIndicators)
    .values({
      roleId: input.roleId,
      laborSupplyEvidence: "External labor-market APIs are not configured. No BLS/Census values were invented.",
      internalPipeline: `${overlay.matchingCandidates} Talent Network matches (aggregate).`,
      militarySupply: `${military.occupations.length} stored military mappings.`,
      classification,
      ...provenance(input.actor, { quality: classification === "unknown" ? "unknown" : "internal_only" }),
    })
    .returning();
  return created;
}

export async function unauthorizedReadBlocked(actor: Actor) {
  requirePerm(actor, "workforce.read");
}
