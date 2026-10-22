"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAnyAppPermission } from "@/lib/auth/guard";
import {
  EngagementError,
  addManualEmployerContact,
  closeEngagement,
  confirmExternalSend,
  markEngagementPlaced,
  markSentManually,
  recordCandidateResponse,
  recordEmployerResponse,
  recordFormalSubmission,
  referToAnotherContact,
  requestEngagementInterview,
  routeToAuthorizedReviewer,
  scheduleEngagementInterview,
  setAuthorizedEmployerRoute,
  setEngagementFollowUp,
  setEngagementState,
  startEmployerOutreach,
  startEngagement,
} from "@/lib/recruiting/opportunity-engagement";

type ActionState = { error?: string; message?: string };

const actorPermissions = ["candidates.write", "jobs.write"] as const;

function failure(error: unknown): ActionState {
  if (error instanceof EngagementError) return { error: error.message };
  return { error: "The engagement action could not be saved." };
}

function refresh(paths: string[]) {
  for (const path of paths) revalidatePath(path);
}

export async function startEngagementAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAnyAppPermission([...actorPermissions]);
  const parsed = z.object({
    matchId: z.string().uuid(),
    returnPath: z.string().min(1),
  }).safeParse({ matchId: formData.get("matchId"), returnPath: formData.get("returnPath") });
  if (!parsed.success) return { error: "Match is required." };
  try {
    const engagement = await startEngagement({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      matchId: parsed.data.matchId,
      explicitStart: true,
    });
    refresh([parsed.data.returnPath, `/app/jobs/engagements/${engagement.id}`]);
    return { message: "Engagement started. Nothing has been sent." };
  } catch (error) {
    return failure(error);
  }
}

export async function setAuthorizedRouteAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAnyAppPermission(["jobs.write"]);
  const parsed = z.object({
    jobId: z.string().uuid(),
    authorized: z.enum(["yes", "no"]),
  }).safeParse({
    jobId: formData.get("jobId"),
    authorized: formData.get("authorized"),
  });
  if (!parsed.success) return { error: "Job is required." };
  try {
    await setAuthorizedEmployerRoute({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      jobId: parsed.data.jobId,
      authorized: parsed.data.authorized === "yes",
    });
    refresh([`/app/jobs/${parsed.data.jobId}`]);
    return {
      message: parsed.data.authorized === "yes"
        ? "Authorized employer route recorded. A company record alone did not create it."
        : "Authorized employer route removed. Public outreach remains available.",
    };
  } catch (error) {
    return failure(error);
  }
}

export async function routeEngagementAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAnyAppPermission([...actorPermissions]);
  const parsed = z.object({
    engagementId: z.string().uuid(),
    contactId: z.string().uuid(),
    note: z.string().optional(),
  }).safeParse({
    engagementId: formData.get("engagementId"),
    contactId: formData.get("contactId"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "Reviewer is required." };
  try {
    await routeToAuthorizedReviewer({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      engagementId: parsed.data.engagementId,
      contactId: parsed.data.contactId,
      note: parsed.data.note,
    });
    refresh([`/app/jobs/engagements/${parsed.data.engagementId}`]);
    return { message: "Talent review draft is ready. It has not been sent." };
  } catch (error) {
    return failure(error);
  }
}

export async function outreachEngagementAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAnyAppPermission([...actorPermissions]);
  const parsed = z.object({
    engagementId: z.string().uuid(),
    contactId: z.string().uuid(),
    note: z.string().optional(),
  }).safeParse({
    engagementId: formData.get("engagementId"),
    contactId: formData.get("contactId"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "Contact is required." };
  try {
    await startEmployerOutreach({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      engagementId: parsed.data.engagementId,
      contactId: parsed.data.contactId,
      note: parsed.data.note,
    });
    refresh([`/app/jobs/engagements/${parsed.data.engagementId}`]);
    return { message: "Employer outreach draft is ready. It has not been sent." };
  } catch (error) {
    return failure(error);
  }
}

export async function addEmployerContactAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAnyAppPermission([...actorPermissions]);
  const parsed = z.object({
    engagementId: z.string().uuid(),
    companyId: z.string().uuid(),
    fullName: z.string().min(2),
    title: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
  }).safeParse({
    engagementId: formData.get("engagementId"),
    companyId: formData.get("companyId"),
    fullName: formData.get("fullName"),
    title: formData.get("title") || undefined,
    email: formData.get("email") || "",
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) return { error: "Contact name is required." };
  try {
    await addManualEmployerContact({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      companyId: parsed.data.companyId,
      fullName: parsed.data.fullName,
      title: parsed.data.title,
      email: parsed.data.email || null,
      phone: parsed.data.phone,
    });
    refresh([`/app/jobs/engagements/${parsed.data.engagementId}`]);
    return { message: "Contact saved on the company record. Nothing has been sent." };
  } catch (error) {
    return failure(error);
  }
}

export async function confirmSendAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAnyAppPermission([...actorPermissions]);
  const parsed = z.object({ engagementId: z.string().uuid() }).safeParse({ engagementId: formData.get("engagementId") });
  if (!parsed.success || formData.get("confirmSend") !== "yes") {
    return { error: "External delivery requires explicit confirmation." };
  }
  try {
    const result = await confirmExternalSend({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      engagementId: parsed.data.engagementId,
      confirmed: true,
    });
    refresh([`/app/jobs/engagements/${parsed.data.engagementId}`]);
    if (result.deliveryState === "not_configured") {
      return { message: "Email is not configured. Copy the draft or mark it sent manually. Nothing was delivered." };
    }
    return { message: "Send confirmed and handed to the email provider." };
  } catch (error) {
    return failure(error);
  }
}

export async function markSentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAnyAppPermission([...actorPermissions]);
  const parsed = z.object({ engagementId: z.string().uuid() }).safeParse({ engagementId: formData.get("engagementId") });
  if (!parsed.success || formData.get("confirmManual") !== "yes") {
    return { error: "External delivery requires explicit confirmation." };
  }
  try {
    await markSentManually({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      engagementId: parsed.data.engagementId,
      confirmed: true,
    });
    refresh([`/app/jobs/engagements/${parsed.data.engagementId}`]);
    return { message: "Marked sent manually. The email provider was not called." };
  } catch (error) {
    return failure(error);
  }
}

export async function recordResponseAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAnyAppPermission([...actorPermissions]);
  const parsed = z.object({
    engagementId: z.string().uuid(),
    response: z.enum(["interested", "possible_future_fit", "not_a_fit", "refer_to_another_manager", "needs_more_information", "no_response"]),
    note: z.string().optional(),
    respondedBy: z.string().optional(),
  }).safeParse({
    engagementId: formData.get("engagementId"),
    response: formData.get("response"),
    note: formData.get("note") || undefined,
    respondedBy: formData.get("respondedBy") || undefined,
  });
  if (!parsed.success) return { error: "Response is required." };
  try {
    await recordEmployerResponse({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      ...parsed.data,
    });
    refresh([`/app/jobs/engagements/${parsed.data.engagementId}`]);
    return { message: "Employer response saved. The match category was not changed." };
  } catch (error) {
    return failure(error);
  }
}

export async function referEngagementAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAnyAppPermission([...actorPermissions]);
  const parsed = z.object({
    engagementId: z.string().uuid(),
    contactId: z.string().uuid(),
    note: z.string().optional(),
  }).safeParse({
    engagementId: formData.get("engagementId"),
    contactId: formData.get("contactId"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "The next contact is required." };
  try {
    await referToAnotherContact({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      ...parsed.data,
    });
    refresh([`/app/jobs/engagements/${parsed.data.engagementId}`]);
    return { message: "Referral kept the earlier route and opened the next contact. Nothing has been sent." };
  } catch (error) {
    return failure(error);
  }
}

export async function candidateResponseAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAnyAppPermission([...actorPermissions]);
  const parsed = z.object({
    engagementId: z.string().uuid(),
    response: z.enum(["informed", "interested", "declined", "needs_information"]),
    note: z.string().optional(),
  }).safeParse({
    engagementId: formData.get("engagementId"),
    response: formData.get("response"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "Candidate response is required." };
  try {
    await recordCandidateResponse({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      ...parsed.data,
    });
    refresh([`/app/jobs/engagements/${parsed.data.engagementId}`]);
    return { message: "Candidate response saved separately from the employer response." };
  } catch (error) {
    return failure(error);
  }
}

export async function followUpAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAnyAppPermission([...actorPermissions]);
  const parsed = z.object({
    engagementId: z.string().uuid(),
    nextFollowUpAt: z.string().min(8),
    nextAction: z.string().optional(),
  }).safeParse({
    engagementId: formData.get("engagementId"),
    nextFollowUpAt: formData.get("nextFollowUpAt"),
    nextAction: formData.get("nextAction") || undefined,
  });
  if (!parsed.success) return { error: "Follow-up date is required." };
  try {
    await setEngagementFollowUp({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      engagementId: parsed.data.engagementId,
      nextFollowUpAt: new Date(parsed.data.nextFollowUpAt),
      nextAction: parsed.data.nextAction,
    });
    refresh([`/app/jobs/engagements/${parsed.data.engagementId}`, "/app/jobs/engagements"]);
    return { message: "Follow-up date saved." };
  } catch (error) {
    return failure(error);
  }
}

export async function stateAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAnyAppPermission([...actorPermissions]);
  const parsed = z.object({
    engagementId: z.string().uuid(),
    status: z.enum(["acknowledged", "reviewing", "needs_follow_up", "needs_information", "ready_for_outreach", "no_fit"]),
    note: z.string().optional(),
  }).safeParse({
    engagementId: formData.get("engagementId"),
    status: formData.get("status"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "State is required." };
  try {
    await setEngagementState({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      ...parsed.data,
    });
    refresh([`/app/jobs/engagements/${parsed.data.engagementId}`]);
    return { message: "Workflow state saved. The match category was not changed." };
  } catch (error) {
    return failure(error);
  }
}

export async function interviewAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAnyAppPermission([...actorPermissions]);
  const parsed = z.object({
    engagementId: z.string().uuid(),
    scheduledFor: z.string().optional(),
  }).safeParse({
    engagementId: formData.get("engagementId"),
    scheduledFor: formData.get("scheduledFor") || undefined,
  });
  if (!parsed.success) return { error: "Interview request is incomplete." };
  try {
    if (parsed.data.scheduledFor) {
      await scheduleEngagementInterview({
        organizationId: principal.organizationId,
        actorUserId: principal.id,
        engagementId: parsed.data.engagementId,
        scheduledFor: new Date(parsed.data.scheduledFor),
      });
      refresh([`/app/jobs/engagements/${parsed.data.engagementId}`]);
      return { message: "Interview recorded on the existing interview workflow. No invitation was emailed." };
    }
    await requestEngagementInterview({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      engagementId: parsed.data.engagementId,
    });
    refresh([`/app/jobs/engagements/${parsed.data.engagementId}`]);
    return { message: "Interview requested. Nothing was emailed." };
  } catch (error) {
    return failure(error);
  }
}

export async function formalSubmissionAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAnyAppPermission([...actorPermissions]);
  const parsed = z.object({ engagementId: z.string().uuid() }).safeParse({ engagementId: formData.get("engagementId") });
  if (!parsed.success || formData.get("confirmSubmission") !== "yes") {
    return { error: "A formal submission requires explicit confirmation." };
  }
  try {
    await recordFormalSubmission({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      engagementId: parsed.data.engagementId,
      confirmed: true,
    });
    refresh([`/app/jobs/engagements/${parsed.data.engagementId}`]);
    return { message: "Formal submission recorded for this authorized route." };
  } catch (error) {
    return failure(error);
  }
}

export async function closeEngagementAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAnyAppPermission([...actorPermissions]);
  const parsed = z.object({
    engagementId: z.string().uuid(),
    reason: z.string().min(2),
  }).safeParse({
    engagementId: formData.get("engagementId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: "A close reason is required." };
  try {
    await closeEngagement({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      ...parsed.data,
    });
    refresh([`/app/jobs/engagements/${parsed.data.engagementId}`, "/app/jobs/engagements"]);
    return { message: "Engagement closed." };
  } catch (error) {
    return failure(error);
  }
}

export async function placeEngagementAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requireAnyAppPermission([...actorPermissions]);
  const parsed = z.object({
    engagementId: z.string().uuid(),
    placementId: z.string().uuid().optional(),
  }).safeParse({
    engagementId: formData.get("engagementId"),
    placementId: formData.get("placementId") || undefined,
  });
  if (!parsed.success) return { error: "Engagement is required." };
  try {
    await markEngagementPlaced({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      engagementId: parsed.data.engagementId,
      placementId: parsed.data.placementId,
    });
    refresh([`/app/jobs/engagements/${parsed.data.engagementId}`]);
    return { message: "Engagement marked placed. Match scoring was not changed." };
  } catch (error) {
    return failure(error);
  }
}
