"use server";

import { z } from "zod";

import { skillbridgeOpportunities } from "@/db/schema";
import { requireAppPermission } from "@/lib/auth/guard";
import { AuthorizationError } from "@/lib/rbac/permissions";
import {
  addSkillBridgeFollowUp,
  addSkillBridgeNote,
  advanceSkillBridgeOpportunityStage,
  createSkillBridgeOpportunity,
  updateSkillBridgeProfile,
} from "@/lib/skillbridge/service";

export type ActionState = { error?: string };

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError || error instanceof z.ZodError) {
    return { error: error instanceof z.ZodError ? error.issues[0]?.message : error.message };
  }
  if (error instanceof Error) return { error: error.message };
  return { error: "Unable to save SkillBridge record" };
}

export async function addSkillBridgeOpportunityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("skillbridge.write");
    const parsed = z
      .object({
        profileId: z.string().uuid(),
        companyId: z.string().uuid(),
        jobId: z.string().uuid().optional(),
      })
      .parse({
        profileId: formData.get("profileId"),
        companyId: formData.get("companyId"),
        jobId: formData.get("jobId") || undefined,
      });
    await createSkillBridgeOpportunity({
      actor: { organizationId: principal.organizationId, userId: principal.id },
      profileId: parsed.profileId,
      companyId: parsed.companyId,
      jobId: parsed.jobId,
    });
    return {};
  } catch (error) {
    return fail(error);
  }
}

export async function advanceSkillBridgeStageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("skillbridge.write");
    const parsed = z
      .object({
        opportunityId: z.string().uuid(),
        toStage: z.string(),
      })
      .parse({
        opportunityId: formData.get("opportunityId"),
        toStage: formData.get("toStage"),
      });
    await advanceSkillBridgeOpportunityStage({
      actor: { organizationId: principal.organizationId, userId: principal.id },
      opportunityId: parsed.opportunityId,
      toStage: parsed.toStage as (typeof skillbridgeOpportunities.$inferSelect)["stage"],
    });
    return {};
  } catch (error) {
    return fail(error);
  }
}

export async function addSkillBridgeFollowUpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("skillbridge.write");
    const parsed = z
      .object({
        profileId: z.string().uuid(),
        subject: z.string().trim().min(1).max(200),
        days: z.coerce.number().int().min(1).max(180).default(7),
      })
      .parse({
        profileId: formData.get("profileId"),
        subject: formData.get("subject"),
        days: formData.get("days") || 7,
      });
    await addSkillBridgeFollowUp({
      actor: { organizationId: principal.organizationId, userId: principal.id },
      profileId: parsed.profileId,
      subject: parsed.subject,
      followUpAt: new Date(Date.now() + parsed.days * 86400000),
    });
    return {};
  } catch (error) {
    return fail(error);
  }
}

export async function addSkillBridgeNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("skillbridge.write");
    const parsed = z
      .object({
        profileId: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
        kind: z.string().optional(),
      })
      .parse({
        profileId: formData.get("profileId"),
        body: formData.get("body"),
        kind: formData.get("kind") || "other",
      });
    await addSkillBridgeNote({
      actor: { organizationId: principal.organizationId, userId: principal.id },
      profileId: parsed.profileId,
      body: parsed.body,
      kind: parsed.kind as never,
    });
    return {};
  } catch (error) {
    return fail(error);
  }
}

export async function assignSkillBridgeOwnerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("skillbridge.manage");
    const parsed = z
      .object({
        profileId: z.string().uuid(),
        ownerUserId: z.string().uuid(),
      })
      .parse({
        profileId: formData.get("profileId"),
        ownerUserId: formData.get("ownerUserId"),
      });
    await updateSkillBridgeProfile({
      actor: { organizationId: principal.organizationId, userId: principal.id },
      profileId: parsed.profileId,
      patch: { ownerUserId: parsed.ownerUserId },
    });
    return {};
  } catch (error) {
    return fail(error);
  }
}
