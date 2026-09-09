"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import {
  advanceApplication,
  completeOnboardingTask,
  createRequisition,
  nurtureApplication,
  rejectApplication,
  requestBackgroundCheck,
  requestDrugScreen,
  startOnboarding,
  submitRequisitionForApproval,
} from "@/lib/hiring/service";
import { AuthorizationError } from "@/lib/rbac/permissions";

export type ActionState = { error?: string; url?: string };

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
    redirect(`/app/jobs?view=headcount&created=${row.id}`);
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

export async function startOnboardingAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("onboarding.manage");
    const applicationId = String(formData.get("applicationId") ?? "");
    const started = await startOnboarding({ principal, applicationId });
    redirect(`/app/onboarding?issued=${encodeURIComponent(started.accessPath)}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return fail(error);
  }
}

export async function issueSelfScheduleLinkAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("interviews.schedule");
    const applicationId = String(formData.get("applicationId") ?? "");
    const { issuePublicAccessToken } = await import("@/lib/public-access/tokens");
    const issued = await issuePublicAccessToken({
      organizationId: principal.organizationId,
      purpose: "interview_self_schedule",
      applicationId,
      createdByUserId: principal.id,
      ttlHours: 14 * 24,
    });
    return { url: issued.path };
  } catch (error) {
    return fail(error);
  }
}

export async function issueApplicationStatusLinkAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("applications.read");
    const applicationId = String(formData.get("applicationId") ?? "");
    const { issuePublicAccessToken } = await import("@/lib/public-access/tokens");
    const issued = await issuePublicAccessToken({
      organizationId: principal.organizationId,
      purpose: "application_status",
      applicationId,
      createdByUserId: principal.id,
      ttlHours: 30 * 24,
    });
    return { url: issued.path };
  } catch (error) {
    return fail(error);
  }
}

export async function completeOnboardingTaskAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("onboarding.complete");
    const taskId = String(formData.get("taskId") ?? "");
    await completeOnboardingTask({ principal, taskId });
    redirect("/app/onboarding");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return fail(error);
  }
}

export async function requestBackgroundCheckAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("background_checks.request");
    const applicationId = String(formData.get("applicationId") ?? "");
    await requestBackgroundCheck({ principal, applicationId });
    redirect(`/app/recruiting/applications/${applicationId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return fail(error);
  }
}

export async function requestDrugScreenAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("drug_screens.request");
    const applicationId = String(formData.get("applicationId") ?? "");
    await requestDrugScreen({ principal, applicationId });
    redirect(`/app/recruiting/applications/${applicationId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return fail(error);
  }
}
