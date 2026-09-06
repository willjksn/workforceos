"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import {
  advanceApplication,
  createRequisition,
  nurtureApplication,
  rejectApplication,
  submitRequisitionForApproval,
} from "@/lib/hiring/service";
import { AuthorizationError } from "@/lib/rbac/permissions";

export type ActionState = { error?: string };

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError || error instanceof z.ZodError) {
    return { error: error instanceof z.ZodError ? error.issues[0]?.message : error.message };
  }
  return { error: error instanceof Error ? error.message : "Unable to complete this action." };
}

export async function createRequisitionAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("jobs.create");
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { error: "Title is required." };
    const row = await createRequisition({
      principal,
      title,
      department: String(formData.get("department") ?? "") || null,
      location: String(formData.get("location") ?? "") || null,
      employmentType: String(formData.get("employmentType") ?? "") || null,
    });
    await submitRequisitionForApproval({ principal, requisitionId: row.id });
    redirect(`/app/recruiting/requisitions?created=${row.id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return fail(error);
  }
}

export async function advanceApplicationAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("applications.advance");
    const applicationId = String(formData.get("applicationId") ?? "");
    const toStage = String(formData.get("toStage") ?? "");
    await advanceApplication({ principal, applicationId, toStage });
    redirect(`/app/recruiting/applications/${applicationId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return fail(error);
  }
}

export async function rejectApplicationAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("applications.reject");
    const applicationId = String(formData.get("applicationId") ?? "");
    const reason = String(formData.get("reason") ?? "other");
    await rejectApplication({ principal, applicationId, reason, source: "human" });
    redirect(`/app/recruiting/applications/${applicationId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return fail(error);
  }
}

export async function nurtureApplicationAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("applications.review");
    const applicationId = String(formData.get("applicationId") ?? "");
    await nurtureApplication({ principal, applicationId });
    redirect(`/app/recruiting/applications/${applicationId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return fail(error);
  }
}
