"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAnyAppPermission, requireAppPermission } from "@/lib/auth/guard";
import {
  draftJobRequirements,
  OpportunityMatchError,
  recalculateCandidateOpportunities,
  recalculateJobTalent,
  reviewJobRequirement,
  reviewJobSkillRequirement,
  setMatchDisposition,
} from "@/lib/recruiting/opportunity-matching";

type ActionState = { error?: string; message?: string };

function failure(error: unknown): ActionState {
  if (error instanceof OpportunityMatchError) return { error: error.message };
  return { error: "The match action could not be saved." };
}

export async function recalculateCandidateMatchesAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAnyAppPermission(["candidates.write", "jobs.write"]);
  const parsed = z.object({ candidateId: z.string().uuid() }).safeParse({ candidateId: formData.get("candidateId") });
  if (!parsed.success) return { error: "Candidate is required." };
  try {
    const result = await recalculateCandidateOpportunities({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      candidateId: parsed.data.candidateId,
    });
    revalidatePath("/app/military/skillbridge");
    return { message: `Calculated ${result.persisted} opportunity matches from ${result.evaluated} open jobs.` };
  } catch (error) {
    return failure(error);
  }
}

export async function recalculateJobMatchesAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAppPermission("jobs.write");
  const parsed = z.object({ jobId: z.string().uuid() }).safeParse({ jobId: formData.get("jobId") });
  if (!parsed.success) return { error: "Job is required." };
  try {
    const result = await recalculateJobTalent({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      jobId: parsed.data.jobId,
    });
    revalidatePath(`/app/jobs/${parsed.data.jobId}`);
    return { message: `Calculated ${result.persisted} talent matches from ${result.evaluated} candidates.` };
  } catch (error) {
    return failure(error);
  }
}

export async function setMatchDispositionAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAnyAppPermission(["candidates.write", "jobs.write"]);
  const parsed = z.object({
    matchId: z.string().uuid(),
    disposition: z.enum(["viable", "not_viable", "needs_information"]),
    returnPath: z.string().min(1),
  }).safeParse({
    matchId: formData.get("matchId"),
    disposition: formData.get("disposition"),
    returnPath: formData.get("returnPath"),
  });
  if (!parsed.success) return { error: "Disposition is required." };
  try {
    await setMatchDisposition({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      matchId: parsed.data.matchId,
      disposition: parsed.data.disposition,
    });
    revalidatePath(parsed.data.returnPath);
    return { message: "Disposition saved. The calculated match was not changed." };
  } catch (error) {
    return failure(error);
  }
}

export async function reviewJobRequirementAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAppPermission("jobs.write");
  const parsed = z.object({
    jobId: z.string().uuid(),
    requirementId: z.string().uuid().optional(),
    jobSkillId: z.string().uuid().optional(),
    reviewStatus: z.enum(["approved", "rejected", "needs_review"]),
  }).safeParse({
    jobId: formData.get("jobId"),
    requirementId: formData.get("requirementId") || undefined,
    jobSkillId: formData.get("jobSkillId") || undefined,
    reviewStatus: formData.get("reviewStatus"),
  });
  if (!parsed.success || (!parsed.data.requirementId && !parsed.data.jobSkillId)) {
    return { error: "Requirement review is incomplete." };
  }
  try {
    if (parsed.data.requirementId) {
      await reviewJobRequirement({
        organizationId: principal.organizationId,
        actorUserId: principal.id,
        requirementId: parsed.data.requirementId,
        reviewStatus: parsed.data.reviewStatus,
      });
    } else if (parsed.data.jobSkillId) {
      await reviewJobSkillRequirement({
        organizationId: principal.organizationId,
        actorUserId: principal.id,
        jobSkillId: parsed.data.jobSkillId,
        reviewStatus: parsed.data.reviewStatus,
      });
    }
    revalidatePath(`/app/jobs/${parsed.data.jobId}`);
    return { message: "Requirement review saved." };
  } catch (error) {
    return failure(error);
  }
}

export async function draftJobRequirementsAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAppPermission("jobs.write");
  const parsed = z.object({ jobId: z.string().uuid() }).safeParse({ jobId: formData.get("jobId") });
  if (!parsed.success) return { error: "Job is required." };
  try {
    const result = await draftJobRequirements({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      jobId: parsed.data.jobId,
    });
    revalidatePath(`/app/jobs/${parsed.data.jobId}`);
    return { message: `Drafted ${result.drafted} requirements for review. Pending rows do not change matches.` };
  } catch (error) {
    return failure(error);
  }
}
