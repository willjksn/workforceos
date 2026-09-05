"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import { MTOA_SERVICE_CODE } from "@/lib/military/mtoa";
import { AuthorizationError } from "@/lib/rbac/permissions";
import {
  approveSolutionPlan,
  createDraftSolutionPlan,
  createProjectFromSolutionPlan,
} from "@/lib/repositories/services";
import { reviewMilitaryMapping } from "@/lib/repositories/military";
import { emptyToNull } from "@/lib/validation/forms";

export type ActionState = { error?: string };

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError || error instanceof z.ZodError) {
    return { error: error instanceof z.ZodError ? error.issues[0]?.message : error.message };
  }
  if (error instanceof Error) return { error: error.message };
  return { error: "Unable to save" };
}

function isNextControlFlow(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error;
}

export async function createMtoaPlanAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("solutions.write");
    const parsed = z
      .object({
        opportunityId: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        summary: z.string().trim().max(4000).optional(),
      })
      .parse({
        opportunityId: formData.get("opportunityId"),
        title: formData.get("title"),
        summary: emptyToNull(formData.get("summary")) ?? undefined,
      });
    await createDraftSolutionPlan({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      serviceCode: MTOA_SERVICE_CODE,
      opportunityId: parsed.opportunityId,
      title: parsed.title,
      summary: parsed.summary ?? null,
    });
    redirect(`/app/services/${MTOA_SERVICE_CODE}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function approveMtoaPlanAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("solutions.write");
    const parsed = z.object({ solutionPlanId: z.string().uuid() }).parse({
      solutionPlanId: formData.get("solutionPlanId"),
    });
    await approveSolutionPlan({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      solutionPlanId: parsed.solutionPlanId,
    });
    redirect(`/app/services/${MTOA_SERVICE_CODE}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function createMtoaProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("projects.write");
    const parsed = z.object({ solutionPlanId: z.string().uuid() }).parse({
      solutionPlanId: formData.get("solutionPlanId"),
    });
    await createProjectFromSolutionPlan(parsed.solutionPlanId, {
      organizationId: principal.organizationId,
      userId: principal.id,
      roleSlugs: principal.roleSlugs,
    });
    redirect(`/app/services/${MTOA_SERVICE_CODE}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function reviewMilitaryMappingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("military.review");
    const parsed = z
      .object({
        mappingId: z.string().uuid(),
        status: z.enum(["approved", "rejected", "needs_review"]),
      })
      .parse({
        mappingId: formData.get("mappingId"),
        status: formData.get("status"),
      });
    await reviewMilitaryMapping({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      mappingId: parsed.mappingId,
      status: parsed.status,
      actorType: "human",
    });
    redirect("/app/military/review");
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}
