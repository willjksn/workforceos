"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import { AuthorizationError } from "@/lib/rbac/permissions";
import {
  approveWorkforcePlan,
  approveWorkforceRecommendation,
  calculateWorkforceGaps,
  createCareerPathway,
  createEducationPartner,
  createScenario,
  createTrainingProgram,
  createWorkforceAssessment,
  createWorkforcePipelinePlan,
  createWorkforceRole,
  createRoadmapProjectTasks,
  draftAiWorkforceRecommendation,
  generateDemandForecasts,
  submitWorkforcePlanForApproval,
  upsertBaseline,
  WorkforceError,
} from "@/lib/workforce/engine";

export type ActionState = { error?: string };

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError || error instanceof z.ZodError) {
    return { error: error instanceof z.ZodError ? error.issues[0]?.message : error.message };
  }
  if (error instanceof WorkforceError) return { error: error.message };
  if (error instanceof Error) return { error: error.message };
  return { error: "Unable to save" };
}

function isNextControlFlow(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error;
}

function actorFrom(principal: { id: string; organizationId: string; roleSlugs: string[] }) {
  return { organizationId: principal.organizationId, userId: principal.id, roleSlugs: principal.roleSlugs };
}

export async function createAssessmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("workforce.write");
    const parsed = z
      .object({
        companyId: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
      })
      .parse({ companyId: formData.get("companyId"), title: formData.get("title") });
    const created = await createWorkforceAssessment({ actor: actorFrom(principal), ...parsed });
    redirect(`/app/workforce/assessments/${created.id}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function createRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("workforce.write");
    const parsed = z
      .object({
        companyId: z.string().uuid(),
        assessmentId: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(200),
        currentHeadcount: z.coerce.number().int().min(0),
      })
      .parse({
        companyId: formData.get("companyId"),
        assessmentId: formData.get("assessmentId") || undefined,
        title: formData.get("title"),
        currentHeadcount: formData.get("currentHeadcount") || 0,
      });
    await createWorkforceRole({ actor: actorFrom(principal), ...parsed });
    redirect(`/app/workforce/roles`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function upsertBaselineAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("workforce.write");
    const parsed = z
      .object({
        assessmentId: z.string().uuid(),
        roleId: z.string().uuid(),
        currentHeadcount: z.coerce.number().int().min(0),
        vacancies: z.coerce.number().int().min(0),
        attritionRatePercent: z.coerce.number(),
        retirementEligibilityRatePercent: z.coerce.number(),
        growthIgnored: z.string().optional(),
      })
      .parse({
        assessmentId: formData.get("assessmentId"),
        roleId: formData.get("roleId"),
        currentHeadcount: formData.get("currentHeadcount"),
        vacancies: formData.get("vacancies") || 0,
        attritionRatePercent: formData.get("attritionRatePercent") || 0,
        retirementEligibilityRatePercent: formData.get("retirementEligibilityRatePercent") || 0,
      });
    await upsertBaseline({ actor: actorFrom(principal), ...parsed });
    redirect(`/app/workforce/assessments/${parsed.assessmentId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function generateForecastAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("forecasts.write");
    const parsed = z.object({ assessmentId: z.string().uuid() }).parse({
      assessmentId: formData.get("assessmentId"),
    });
    await generateDemandForecasts({ actor: actorFrom(principal), assessmentId: parsed.assessmentId });
    await calculateWorkforceGaps({ actor: actorFrom(principal), assessmentId: parsed.assessmentId });
    redirect(`/app/workforce/forecasts`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function createPartnerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("education_partners.write");
    const parsed = z
      .object({
        name: z.string().trim().min(1),
        partnerType: z.enum([
          "community_college",
          "university",
          "technical_school",
          "training_provider",
          "workforce_board",
          "other",
        ]),
      })
      .parse({ name: formData.get("name"), partnerType: formData.get("partnerType") });
    await createEducationPartner({ actor: actorFrom(principal), ...parsed });
    redirect("/app/workforce/education-partners");
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function createProgramAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("training_programs.write");
    const parsed = z.object({ name: z.string().trim().min(1) }).parse({ name: formData.get("name") });
    await createTrainingProgram({ actor: actorFrom(principal), ...parsed });
    redirect("/app/workforce/training-programs");
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function createPathwayAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("career_paths.write");
    const parsed = z
      .object({
        companyId: z.string().uuid(),
        name: z.string().trim().min(1),
        levels: z.string().trim().min(1),
      })
      .parse({
        companyId: formData.get("companyId"),
        name: formData.get("name"),
        levels: formData.get("levels"),
      });
    const created = await createCareerPathway({
      actor: actorFrom(principal),
      companyId: parsed.companyId,
      name: parsed.name,
      levels: parsed.levels.split("\n").map((title) => ({ title: title.trim() })).filter((row) => row.title),
    });
    redirect(`/app/workforce/career-pathways/${created.path.id}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function createScenarioAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("scenario_models.write");
    const parsed = z
      .object({
        assessmentId: z.string().uuid(),
        name: z.string().trim().min(1),
        growthDeltaPercent: z.coerce.number(),
        retirementDeltaPercent: z.coerce.number(),
      })
      .parse({
        assessmentId: formData.get("assessmentId"),
        name: formData.get("name"),
        growthDeltaPercent: formData.get("growthDeltaPercent") || 0,
        retirementDeltaPercent: formData.get("retirementDeltaPercent") || 0,
      });
    await createScenario({
      actor: actorFrom(principal),
      assessmentId: parsed.assessmentId,
      name: parsed.name,
      deltas: {
        growthDeltaPercent: parsed.growthDeltaPercent,
        retirementDeltaPercent: parsed.retirementDeltaPercent,
      },
    });
    redirect("/app/workforce/scenarios");
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function generatePlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("workforce.write");
    const parsed = z.object({ assessmentId: z.string().uuid() }).parse({
      assessmentId: formData.get("assessmentId"),
    });
    await createWorkforcePipelinePlan({ actor: actorFrom(principal), assessmentId: parsed.assessmentId });
    redirect(`/app/workforce/assessments/${parsed.assessmentId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function submitPlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("workforce.write");
    const parsed = z.object({ planId: z.string().uuid(), assessmentId: z.string().uuid() }).parse({
      planId: formData.get("planId"),
      assessmentId: formData.get("assessmentId"),
    });
    await submitWorkforcePlanForApproval({ actor: actorFrom(principal), planId: parsed.planId });
    redirect(`/app/workforce/assessments/${parsed.assessmentId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function approvePlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("workforce.approve");
    const parsed = z.object({ planId: z.string().uuid(), assessmentId: z.string().uuid() }).parse({
      planId: formData.get("planId"),
      assessmentId: formData.get("assessmentId"),
    });
    await approveWorkforcePlan({ actor: actorFrom(principal), planId: parsed.planId });
    redirect(`/app/workforce/assessments/${parsed.assessmentId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function createRoadmapTasksAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("projects.write");
    const parsed = z.object({ assessmentId: z.string().uuid() }).parse({
      assessmentId: formData.get("assessmentId"),
    });
    await createRoadmapProjectTasks({ actor: actorFrom(principal), assessmentId: parsed.assessmentId });
    redirect(`/app/workforce/assessments/${parsed.assessmentId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function draftRecommendationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("workforce.analyze");
    const parsed = z
      .object({
        assessmentId: z.string().uuid(),
        kind: z.enum(["analyst", "architect"]),
      })
      .parse({
        assessmentId: formData.get("assessmentId"),
        kind: formData.get("kind") || "analyst",
      });
    await draftAiWorkforceRecommendation({ actor: actorFrom(principal), ...parsed });
    redirect(`/app/workforce/assessments/${parsed.assessmentId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function approveRecommendationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("workforce.approve");
    const parsed = z
      .object({
        recommendationId: z.string().uuid(),
        assessmentId: z.string().uuid(),
      })
      .parse({
        recommendationId: formData.get("recommendationId"),
        assessmentId: formData.get("assessmentId"),
      });
    await approveWorkforceRecommendation({ actor: actorFrom(principal), recommendationId: parsed.recommendationId });
    redirect(`/app/workforce/assessments/${parsed.assessmentId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}
