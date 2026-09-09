"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAnyAppPermission, requireAppPermission } from "@/lib/auth/guard";
import { ACADEMY_READ_PERMISSIONS } from "@/lib/academy/access";
import {
  acknowledgeStaffPolicy,
  isEquipmentItemKey,
  isStaffOnboardingCadence,
  isStaffPolicyKey,
  recordStaffOnboardingWeek4Review,
  setStaffEquipmentItem,
  setStaffOnboardingCadence,
  setStaffOnboardingMilestone,
  setUserManager,
} from "@/lib/staff-onboarding";
import { AuthorizationError } from "@/lib/rbac/permissions";
import { emptyToNull } from "@/lib/validation/forms";

export type StaffOnboardingActionState = { error?: string; message?: string };

function fail(error: unknown): StaffOnboardingActionState {
  if (error instanceof AuthorizationError || error instanceof z.ZodError) {
    return { error: error instanceof z.ZodError ? error.issues[0]?.message : error.message };
  }
  if (error instanceof Error) return { error: error.message };
  return { error: "Unable to save staff onboarding." };
}

function refreshOnboarding(userId: string) {
  revalidatePath("/app/academy/onboarding");
  revalidatePath("/app/academy");
  revalidatePath("/app/admin/users");
  revalidatePath(`/app/admin/users/${userId}`);
  revalidatePath(`/app/admin/users/${userId}/onboarding`);
}

export async function acknowledgeStaffPolicyAction(
  _prev: StaffOnboardingActionState,
  formData: FormData,
): Promise<StaffOnboardingActionState> {
  try {
    const principal = await requireAnyAppPermission(ACADEMY_READ_PERMISSIONS);
    const parsed = z
      .object({
        userId: z.string().uuid(),
        policyKey: z.string().refine(isStaffPolicyKey, "Unknown staff policy."),
      })
      .parse({
        userId: formData.get("userId") ?? principal.id,
        policyKey: formData.get("policyKey"),
      });
    await acknowledgeStaffPolicy({
      actor: principal,
      userId: parsed.userId,
      policyKey: parsed.policyKey,
    });
    refreshOnboarding(parsed.userId);
    return { message: "Policy acknowledgement saved." };
  } catch (error) {
    return fail(error);
  }
}

export async function setStaffEquipmentItemAction(
  _prev: StaffOnboardingActionState,
  formData: FormData,
): Promise<StaffOnboardingActionState> {
  try {
    const principal = await requireAnyAppPermission(ACADEMY_READ_PERMISSIONS);
    const parsed = z
      .object({
        userId: z.string().uuid(),
        itemKey: z.string().refine(isEquipmentItemKey, "Unknown equipment item."),
        complete: z.enum(["yes", "no"]),
      })
      .parse({
        userId: formData.get("userId") ?? principal.id,
        itemKey: formData.get("itemKey"),
        complete: formData.get("complete") === "no" ? "no" : "yes",
      });
    await setStaffEquipmentItem({
      actor: principal,
      userId: parsed.userId,
      itemKey: parsed.itemKey,
      complete: parsed.complete === "yes",
    });
    refreshOnboarding(parsed.userId);
    return { message: "Systems checklist saved." };
  } catch (error) {
    return fail(error);
  }
}

export async function setStaffOnboardingMilestoneAction(
  _prev: StaffOnboardingActionState,
  formData: FormData,
): Promise<StaffOnboardingActionState> {
  try {
    const principal = await requireAnyAppPermission(ACADEMY_READ_PERMISSIONS);
    const parsed = z
      .object({
        userId: z.string().uuid(),
        milestone: z.enum(["week2_shadow", "week3_supervised"]),
        complete: z.enum(["yes", "no"]),
      })
      .parse({
        userId: formData.get("userId") ?? principal.id,
        milestone: formData.get("milestone"),
        complete: formData.get("complete") === "no" ? "no" : "yes",
      });
    await setStaffOnboardingMilestone({
      actor: principal,
      userId: parsed.userId,
      milestone: parsed.milestone,
      complete: parsed.complete === "yes",
    });
    refreshOnboarding(parsed.userId);
    return { message: "Onboarding milestone saved." };
  } catch (error) {
    return fail(error);
  }
}

export async function recordStaffOnboardingWeek4ReviewAction(
  _prev: StaffOnboardingActionState,
  formData: FormData,
): Promise<StaffOnboardingActionState> {
  try {
    const principal = await requireAppPermission("admin.users");
    const parsed = z
      .object({
        userId: z.string().uuid(),
        notes: z.string().trim().max(2000).optional(),
      })
      .parse({
        userId: formData.get("userId"),
        notes: emptyToNull(formData.get("notes")) ?? undefined,
      });
    await recordStaffOnboardingWeek4Review({
      actor: principal,
      userId: parsed.userId,
      notes: parsed.notes,
    });
    refreshOnboarding(parsed.userId);
    return { message: "Week 4 review recorded. Access was not changed." };
  } catch (error) {
    return fail(error);
  }
}

export async function setStaffOnboardingCadenceAction(
  _prev: StaffOnboardingActionState,
  formData: FormData,
): Promise<StaffOnboardingActionState> {
  try {
    const principal = await requireAppPermission("admin.users");
    const parsed = z
      .object({
        userId: z.string().uuid(),
        cadence: z.string().refine(isStaffOnboardingCadence, "Unknown onboarding cadence."),
      })
      .parse({
        userId: formData.get("userId"),
        cadence: formData.get("cadence"),
      });
    await setStaffOnboardingCadence({
      actor: principal,
      userId: parsed.userId,
      cadence: parsed.cadence,
    });
    refreshOnboarding(parsed.userId);
    return { message: "Tracked cadence updated. This does not grant permissions." };
  } catch (error) {
    return fail(error);
  }
}

export async function setUserManagerAction(
  _prev: StaffOnboardingActionState,
  formData: FormData,
): Promise<StaffOnboardingActionState> {
  try {
    const principal = await requireAppPermission("admin.users");
    const parsed = z
      .object({
        userId: z.string().uuid(),
        managerId: z.string().uuid().nullable(),
      })
      .parse({
        userId: formData.get("userId"),
        managerId: emptyToNull(formData.get("managerId")),
      });
    await setUserManager({
      actor: principal,
      userId: parsed.userId,
      managerId: parsed.managerId,
    });
    refreshOnboarding(parsed.userId);
    return { message: "Manager saved." };
  } catch (error) {
    return fail(error);
  }
}
