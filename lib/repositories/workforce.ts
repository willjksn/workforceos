import { and, desc, eq, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import {
  apprenticeships,
  careerPathLevels,
  careerPaths,
  companies,
  educationPartners,
  skills,
  talentPipelines,
  trainingPrograms,
  workforceAssessments,
  workforceForecasts,
  workforceGaps,
  workforcePipelinePlans,
  workforceRecommendations,
  workforceRisks,
  workforceRoles,
  workforceScenarios,
  workforceSupplyEntries,
} from "../../db/schema";

export async function listWorkforceAssessments(organizationId: string) {
  const db = getDb();
  return db
    .select({
      assessment: workforceAssessments,
      companyName: companies.name,
    })
    .from(workforceAssessments)
    .innerJoin(companies, eq(workforceAssessments.companyId, companies.id))
    .where(and(eq(workforceAssessments.organizationId, organizationId), isNull(workforceAssessments.archivedAt)))
    .orderBy(desc(workforceAssessments.updatedAt));
}

export async function listWorkforceRoles(organizationId: string, companyId?: string) {
  const db = getDb();
  const filters = [
    eq(workforceRoles.organizationId, organizationId),
    isNull(workforceRoles.archivedAt),
  ];
  if (companyId) filters.push(eq(workforceRoles.companyId, companyId));
  return db
    .select()
    .from(workforceRoles)
    .where(and(...filters))
    .orderBy(workforceRoles.title);
}

export async function listWorkforceGaps(organizationId: string) {
  const db = getDb();
  return db
    .select({
      gap: workforceGaps,
      roleTitle: workforceRoles.title,
      companyName: companies.name,
    })
    .from(workforceGaps)
    .innerJoin(workforceRoles, eq(workforceGaps.roleId, workforceRoles.id))
    .innerJoin(companies, eq(workforceRoles.companyId, companies.id))
    .innerJoin(workforceAssessments, eq(workforceGaps.assessmentId, workforceAssessments.id))
    .where(and(eq(workforceAssessments.organizationId, organizationId), isNull(workforceGaps.archivedAt)))
    .orderBy(desc(workforceGaps.gap));
}

export async function listTalentPipelines(organizationId: string) {
  const db = getDb();
  return db
    .select({
      pipeline: talentPipelines,
      companyName: companies.name,
      roleTitle: workforceRoles.title,
    })
    .from(talentPipelines)
    .innerJoin(companies, eq(talentPipelines.companyId, companies.id))
    .innerJoin(workforceRoles, eq(talentPipelines.roleId, workforceRoles.id))
    .where(and(eq(talentPipelines.organizationId, organizationId), isNull(talentPipelines.archivedAt)))
    .orderBy(talentPipelines.name);
}

export async function getCompanyWorkforceSnapshot(companyId: string, organizationId: string) {
  const db = getDb();
  const [assessments, roles, gaps, pipelines, paths, partners, risks, forecasts] = await Promise.all([
    db
      .select()
      .from(workforceAssessments)
      .where(and(eq(workforceAssessments.companyId, companyId), eq(workforceAssessments.organizationId, organizationId))),
    db.select().from(workforceRoles).where(and(eq(workforceRoles.companyId, companyId), eq(workforceRoles.organizationId, organizationId))),
    listWorkforceGaps(organizationId),
    db.select().from(talentPipelines).where(and(eq(talentPipelines.companyId, companyId), eq(talentPipelines.organizationId, organizationId))),
    db.select().from(careerPaths).where(and(eq(careerPaths.companyId, companyId), eq(careerPaths.organizationId, organizationId))),
    db.select().from(educationPartners).where(eq(educationPartners.organizationId, organizationId)),
    db
      .select()
      .from(workforceRisks)
      .innerJoin(workforceAssessments, eq(workforceRisks.assessmentId, workforceAssessments.id))
      .where(eq(workforceAssessments.companyId, companyId)),
    db
      .select()
      .from(workforceForecasts)
      .innerJoin(workforceAssessments, eq(workforceForecasts.assessmentId, workforceAssessments.id))
      .where(eq(workforceAssessments.companyId, companyId)),
  ]);
  return {
    assessments,
    roles,
    criticalRoles: roles.filter((role) => role.criticality === "critical" || role.criticality === "high"),
    gaps: gaps.filter((row) => row.gap.assessmentId && assessments.some((item) => item.id === row.gap.assessmentId)),
    pipelines,
    careerPaths: paths,
    educationPartners: partners.filter((partner) => !partner.companyId || partner.companyId === companyId),
    risks: risks.map((row) => row.workforce_risks),
    forecasts: forecasts.map((row) => row.workforce_forecasts),
  };
}

export async function getWorkforceCommandSnapshot(organizationId: string) {
  const db = getDb();
  const assessments = await db
    .select()
    .from(workforceAssessments)
    .where(and(eq(workforceAssessments.organizationId, organizationId), isNull(workforceAssessments.archivedAt)));
  const gaps = await listWorkforceGaps(organizationId);
  const recommendations = await db
    .select()
    .from(workforceRecommendations)
    .innerJoin(workforceAssessments, eq(workforceRecommendations.assessmentId, workforceAssessments.id))
    .where(
      and(
        eq(workforceAssessments.organizationId, organizationId),
        eq(workforceRecommendations.status, "pending_approval"),
      ),
    );
  const pipelines = await db
    .select()
    .from(talentPipelines)
    .where(and(eq(talentPipelines.organizationId, organizationId), eq(talentPipelines.status, "at_risk")));
  const highRiskRoles = (await listWorkforceRoles(organizationId)).filter(
    (role) => role.criticality === "critical" || role.replacementDifficulty === "critical",
  );
  const inProgress = assessments.filter((row) =>
    ["draft", "data_collection", "analysis", "human_review"].includes(row.status),
  );
  const criticalGaps = gaps.filter((row) => row.gap.severity === "critical" || row.gap.severity === "high");
  return {
    criticalGaps,
    assessmentsInProgress: inProgress,
    pipelineCapacityRisk: pipelines,
    recommendationsAwaitingApproval: recommendations.map((row) => row.workforce_recommendations),
    highRiskRoles,
  };
}

export async function listSkillsCatalog() {
  const db = getDb();
  return db.select().from(skills).orderBy(skills.skillFamily, skills.name);
}

export async function listEducationPartners(organizationId: string) {
  const db = getDb();
  return db
    .select()
    .from(educationPartners)
    .where(and(eq(educationPartners.organizationId, organizationId), isNull(educationPartners.archivedAt)))
    .orderBy(educationPartners.name);
}

export async function listTrainingPrograms(organizationId: string) {
  const db = getDb();
  return db
    .select()
    .from(trainingPrograms)
    .where(and(eq(trainingPrograms.organizationId, organizationId), isNull(trainingPrograms.archivedAt)))
    .orderBy(trainingPrograms.name);
}

export async function listCareerPaths(organizationId: string) {
  const db = getDb();
  const paths = await db
    .select()
    .from(careerPaths)
    .where(and(eq(careerPaths.organizationId, organizationId), isNull(careerPaths.archivedAt)));
  const levels = paths.length
    ? await db.select().from(careerPathLevels)
    : [];
  return paths.map((path) => ({
    path,
    levels: levels.filter((level) => level.pathId === path.id).sort((a, b) => a.sequence - b.sequence),
  }));
}

export async function listScenarios(organizationId: string) {
  const db = getDb();
  return db
    .select({
      scenario: workforceScenarios,
      assessmentTitle: workforceAssessments.title,
    })
    .from(workforceScenarios)
    .innerJoin(workforceAssessments, eq(workforceScenarios.assessmentId, workforceAssessments.id))
    .where(eq(workforceAssessments.organizationId, organizationId))
    .orderBy(workforceScenarios.name);
}

export async function listForecasts(organizationId: string) {
  const db = getDb();
  return db
    .select({
      forecast: workforceForecasts,
      assessmentTitle: workforceAssessments.title,
    })
    .from(workforceForecasts)
    .innerJoin(workforceAssessments, eq(workforceForecasts.assessmentId, workforceAssessments.id))
    .where(eq(workforceAssessments.organizationId, organizationId))
    .orderBy(desc(workforceForecasts.createdAt));
}

export async function listSupply(organizationId: string) {
  const db = getDb();
  return db
    .select({
      entry: workforceSupplyEntries,
      roleTitle: workforceRoles.title,
    })
    .from(workforceSupplyEntries)
    .innerJoin(workforceRoles, eq(workforceSupplyEntries.roleId, workforceRoles.id))
    .where(eq(workforceRoles.organizationId, organizationId));
}

export async function listApprenticeships(organizationId: string) {
  const db = getDb();
  return db
    .select()
    .from(apprenticeships)
    .where(and(eq(apprenticeships.organizationId, organizationId), isNull(apprenticeships.archivedAt)));
}

export async function getAssessmentGraph(assessmentId: string, organizationId: string) {
  const db = getDb();
  const [assessment] = await db
    .select()
    .from(workforceAssessments)
    .where(
      and(
        eq(workforceAssessments.id, assessmentId),
        eq(workforceAssessments.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!assessment) return null;
  const [company] = await db.select().from(companies).where(eq(companies.id, assessment.companyId)).limit(1);
  const [roles, forecasts, gaps, supply, scenarios, plans, recommendations, risks] = await Promise.all([
    db.select().from(workforceRoles).where(eq(workforceRoles.assessmentId, assessment.id)),
    db.select().from(workforceForecasts).where(eq(workforceForecasts.assessmentId, assessment.id)),
    db.select().from(workforceGaps).where(eq(workforceGaps.assessmentId, assessment.id)),
    db.select().from(workforceSupplyEntries).where(eq(workforceSupplyEntries.assessmentId, assessment.id)),
    db.select().from(workforceScenarios).where(eq(workforceScenarios.assessmentId, assessment.id)),
    db
      .select()
      .from(workforcePipelinePlans)
      .where(eq(workforcePipelinePlans.assessmentId, assessment.id))
      .orderBy(desc(workforcePipelinePlans.versionNumber)),
    db.select().from(workforceRecommendations).where(eq(workforceRecommendations.assessmentId, assessment.id)),
    db.select().from(workforceRisks).where(eq(workforceRisks.assessmentId, assessment.id)),
  ]);
  return { assessment, company, roles, forecasts, gaps, supply, scenarios, plans, recommendations, risks };
}

export async function getTalentPipeline(pipelineId: string, organizationId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      pipeline: talentPipelines,
      companyName: companies.name,
      roleTitle: workforceRoles.title,
    })
    .from(talentPipelines)
    .innerJoin(companies, eq(talentPipelines.companyId, companies.id))
    .innerJoin(workforceRoles, eq(talentPipelines.roleId, workforceRoles.id))
    .where(and(eq(talentPipelines.id, pipelineId), eq(talentPipelines.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

export async function getCareerPath(pathId: string, organizationId: string) {
  const db = getDb();
  const [path] = await db
    .select()
    .from(careerPaths)
    .where(and(eq(careerPaths.id, pathId), eq(careerPaths.organizationId, organizationId)))
    .limit(1);
  if (!path) return null;
  const levels = await db.select().from(careerPathLevels).where(eq(careerPathLevels.pathId, path.id));
  return { path, levels: levels.sort((a, b) => a.sequence - b.sequence) };
}

export async function listWorkforcePlans(organizationId: string) {
  const db = getDb();
  return db
    .select({
      plan: workforcePipelinePlans,
      assessmentTitle: workforceAssessments.title,
    })
    .from(workforcePipelinePlans)
    .innerJoin(workforceAssessments, eq(workforcePipelinePlans.assessmentId, workforceAssessments.id))
    .where(eq(workforceAssessments.organizationId, organizationId));
}
