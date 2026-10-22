"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAnyAppPermission, requireAppPermission } from "@/lib/auth/guard";
import {
  draftCandidateCapabilities,
  reviewCandidateCapability,
  reviewOccupationCapability,
} from "@/lib/military-talent/capability-profile";
import { AuthorizationError } from "@/lib/rbac/permissions";

export type ActionState = { error?: string };

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError || error instanceof z.ZodError) {
    return { error: error instanceof z.ZodError ? error.issues[0]?.message : error.message };
  }
  if (error instanceof Error) return { error: error.message };
  return { error: "Unable to save the capability review" };
}

function isNextControlFlow(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error;
}

const reviewStatus = z.enum(["approved", "rejected", "needs_review"]);

export async function draftCandidateCapabilitiesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAnyAppPermission(["candidates.write", "military.review"]);
    const parsed = z
      .object({
        candidateId: z.string().uuid(),
        profileId: z.string().uuid(),
      })
      .parse({
        candidateId: formData.get("candidateId"),
        profileId: formData.get("profileId"),
      });
    await draftCandidateCapabilities({
      organizationId: principal.organizationId,
      candidateId: parsed.candidateId,
      actorUserId: principal.id,
    });
    redirect(`/app/military/skillbridge/${parsed.profileId}#capability-translation`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function reviewCandidateCapabilityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAnyAppPermission(["candidates.write", "military.review"]);
    const parsed = z
      .object({
        candidateSkillId: z.string().uuid(),
        profileId: z.string().uuid().optional(),
        status: reviewStatus,
        citation: z.string().trim().max(2000).optional(),
      })
      .parse({
        candidateSkillId: formData.get("candidateSkillId"),
        profileId: formData.get("profileId") || undefined,
        status: formData.get("status"),
        citation: formData.get("citation") ? String(formData.get("citation")) : undefined,
      });
    await reviewCandidateCapability({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      candidateSkillId: parsed.candidateSkillId,
      status: parsed.status,
      actorType: "human",
      citation: parsed.citation,
    });
    redirect(parsed.profileId ? `/app/military/skillbridge/${parsed.profileId}#capability-translation` : "/app/military/review");
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function reviewOccupationCapabilityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("military.review");
    const parsed = z
      .object({
        occupationSkillId: z.string().uuid(),
        status: reviewStatus,
        evidenceReference: z.string().trim().max(2000).optional(),
      })
      .parse({
        occupationSkillId: formData.get("occupationSkillId"),
        status: formData.get("status"),
        evidenceReference: formData.get("evidenceReference")
          ? String(formData.get("evidenceReference"))
          : undefined,
      });
    await reviewOccupationCapability({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      occupationSkillId: parsed.occupationSkillId,
      status: parsed.status,
      actorType: "human",
      evidenceReference: parsed.evidenceReference,
    });
    redirect("/app/military/review");
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}
