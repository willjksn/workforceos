"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import { AuthorizationError, can } from "@/lib/rbac/permissions";
import { getCompanyInOrganization } from "@/lib/repositories/crm";
import {
  createInterview,
  createOffer,
  createPlacementFromOffer,
  createSubmission,
  setOfferStatus,
  submitCandidateToClient,
  updateInterview,
} from "@/lib/repositories/recruiting-delivery";
import {
  approveSearchStrategy,
  completeInternalSearch,
  createJobWithInternalSearch,
  getJobWorkspace,
  replaceJobSkills,
  runInternalTalentSearch,
  saveCandidateScreening,
  setJobStatus,
  updateJobRecord,
  updateMatchPipelineStatus,
  updateSearchProject,
} from "@/lib/repositories/recruiting";
import { addCandidateToPool, getTalentPool, listTalentPools } from "@/lib/repositories/talent";
import { PIPELINE_STAGES } from "@/lib/recruiting/pipeline";
import { emptyToNull } from "@/lib/validation/forms";

export type ActionState = { error?: string };

const jobStatusSchema = z.enum([
  "draft",
  "open",
  "search_active",
  "on_hold",
  "filled",
  "cancelled",
  "closed",
]);
const pipelineStatusSchema = z.enum(PIPELINE_STAGES);
const skillTypeSchema = z.enum(["required", "preferred", "nice_to_have"]);

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

function parseSkillPayload(formData: FormData) {
  const skillIds = formData.getAll("skillId").filter((value): value is string => typeof value === "string" && value.length > 0);
  const types = formData.getAll("requirementType");
  return skillIds.flatMap((skillId, index) => {
    const parsed = skillTypeSchema.safeParse(types[index]);
    if (!parsed.success) return [];
    return [{ skillId, requirementType: parsed.data }];
  });
}

export async function createJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("jobs.write");
    const parsed = z
      .object({
        title: z.string().trim().min(1).max(200),
        normalizedTitle: z.string().trim().max(200).optional(),
        companyId: z.string().uuid().optional(),
        hiringManagerContactId: z.string().uuid().optional(),
        locationLabel: z.string().trim().max(200).optional(),
        description: z.string().trim().max(8000).optional(),
        status: jobStatusSchema,
        employmentType: z.string().trim().max(80).optional(),
        workplaceType: z.string().trim().max(80).optional(),
        compensationMin: z.string().trim().max(20).optional(),
        compensationMax: z.string().trim().max(20).optional(),
        bonus: z.string().trim().max(200).optional(),
        requiredExperienceYears: z.coerce.number().int().min(0).max(50).optional(),
        education: z.string().trim().max(200).optional(),
        certifications: z.string().trim().max(500).optional(),
        travel: z.string().trim().max(200).optional(),
        relocation: z.string().trim().max(200).optional(),
        scheduleShift: z.string().trim().max(200).optional(),
        reasonOpen: z.string().trim().max(500).optional(),
        targetStartDate: z.string().trim().max(20).optional(),
        interviewProcess: z.string().trim().max(2000).optional(),
        businessContext: z.string().trim().max(4000).optional(),
        candidateValueProposition: z.string().trim().max(4000).optional(),
        priorSearchFailureNotes: z.string().trim().max(4000).optional(),
        successMeasures: z.string().trim().max(2000).optional(),
        priority: z.string().trim().max(40).optional(),
        urgency: z.string().trim().max(40).optional(),
        reportingRelationship: z.string().trim().max(200).optional(),
        militaryCompatibility: z.string().trim().max(200).optional(),
      })
      .parse({
        title: formData.get("title"),
        normalizedTitle: emptyToNull(formData.get("normalizedTitle")) ?? undefined,
        companyId: emptyToNull(formData.get("companyId")) ?? undefined,
        hiringManagerContactId: emptyToNull(formData.get("hiringManagerContactId")) ?? undefined,
        locationLabel: emptyToNull(formData.get("locationLabel")) ?? undefined,
        description: emptyToNull(formData.get("description")) ?? undefined,
        status: formData.get("status") || "open",
        employmentType: emptyToNull(formData.get("employmentType")) ?? undefined,
        workplaceType: emptyToNull(formData.get("workplaceType")) ?? undefined,
        compensationMin: emptyToNull(formData.get("compensationMin")) ?? undefined,
        compensationMax: emptyToNull(formData.get("compensationMax")) ?? undefined,
        bonus: emptyToNull(formData.get("bonus")) ?? undefined,
        requiredExperienceYears: emptyToNull(formData.get("requiredExperienceYears")) ?? undefined,
        education: emptyToNull(formData.get("education")) ?? undefined,
        certifications: emptyToNull(formData.get("certifications")) ?? undefined,
        travel: emptyToNull(formData.get("travel")) ?? undefined,
        relocation: emptyToNull(formData.get("relocation")) ?? undefined,
        scheduleShift: emptyToNull(formData.get("scheduleShift")) ?? undefined,
        reasonOpen: emptyToNull(formData.get("reasonOpen")) ?? undefined,
        targetStartDate: emptyToNull(formData.get("targetStartDate")) ?? undefined,
        interviewProcess: emptyToNull(formData.get("interviewProcess")) ?? undefined,
        businessContext: emptyToNull(formData.get("businessContext")) ?? undefined,
        candidateValueProposition: emptyToNull(formData.get("candidateValueProposition")) ?? undefined,
        priorSearchFailureNotes: emptyToNull(formData.get("priorSearchFailureNotes")) ?? undefined,
        successMeasures: emptyToNull(formData.get("successMeasures")) ?? undefined,
        priority: emptyToNull(formData.get("priority")) ?? undefined,
        urgency: emptyToNull(formData.get("urgency")) ?? undefined,
        reportingRelationship: emptyToNull(formData.get("reportingRelationship")) ?? undefined,
        militaryCompatibility: emptyToNull(formData.get("militaryCompatibility")) ?? undefined,
      });
    if (parsed.companyId) {
      const company = await getCompanyInOrganization(parsed.companyId, principal.organizationId);
      if (!company) return { error: "Company not found" };
    }
    const created = await createJobWithInternalSearch({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      ...parsed,
      companyId: parsed.companyId ?? null,
      skills: parseSkillPayload(formData),
    });
    redirect(`/app/jobs/${created.job.id}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function updateJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("jobs.write");
    const jobId = z.string().uuid().parse(formData.get("jobId"));
    const status = jobStatusSchema.parse(formData.get("status") || "open");
    await updateJobRecord({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      jobId,
      values: {
        title: String(formData.get("title") ?? ""),
        status,
        locationLabel: emptyToNull(formData.get("locationLabel")),
        description: emptyToNull(formData.get("description")),
        compensationMin: emptyToNull(formData.get("compensationMin")),
        compensationMax: emptyToNull(formData.get("compensationMax")),
        hiringManagerContactId: emptyToNull(formData.get("hiringManagerContactId")),
        priority: emptyToNull(formData.get("priority")) ?? "normal",
        urgency: emptyToNull(formData.get("urgency")) ?? "normal",
        militaryCompatibility: emptyToNull(formData.get("militaryCompatibility")),
        targetStartDate: emptyToNull(formData.get("targetStartDate")),
      },
    });
    await replaceJobSkills({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      jobId,
      skills: parseSkillPayload(formData),
    });
    redirect(`/app/jobs/${jobId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function setJobStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("jobs.write");
    const parsed = z.object({ jobId: z.string().uuid(), status: jobStatusSchema }).parse({
      jobId: formData.get("jobId"),
      status: formData.get("status"),
    });
    await setJobStatus({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      ...parsed,
    });
    redirect(`/app/jobs/${parsed.jobId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function runInternalSearchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("jobs.write");
    if (!can(principal, "candidates.read")) {
      throw new AuthorizationError("Missing permission: candidates.read");
    }
    const parsed = z.object({ jobId: z.string().uuid() }).parse({ jobId: formData.get("jobId") });
    const job = await getJobWorkspace(parsed.jobId, principal.organizationId);
    if (!job) return { error: "Job not found" };
    await runInternalTalentSearch({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      jobId: parsed.jobId,
    });
    redirect(`/app/jobs/${parsed.jobId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function completeInternalSearchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("jobs.write");
    const parsed = z.object({ jobId: z.string().uuid(), searchProjectId: z.string().uuid() }).parse({
      jobId: formData.get("jobId"),
      searchProjectId: formData.get("searchProjectId"),
    });
    await completeInternalSearch({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      ...parsed,
    });
    redirect(`/app/jobs/${parsed.jobId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function updatePipelineAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("jobs.write");
    const parsed = z.object({
      jobId: z.string().uuid(),
      matchId: z.string().uuid(),
      pipelineStatus: pipelineStatusSchema,
    }).parse({
      jobId: formData.get("jobId"),
      matchId: formData.get("matchId"),
      pipelineStatus: formData.get("pipelineStatus"),
    });
    await updateMatchPipelineStatus({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      ...parsed,
      actorType: "human",
    });
    redirect(`/app/jobs/${parsed.jobId}/pipeline`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function saveScreeningAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("jobs.write");
    const parsed = z.object({
      jobId: z.string().uuid(),
      matchId: z.string().uuid(),
      motivation: z.string().optional(),
      compensation: z.string().optional(),
      availability: z.string().optional(),
      locationRelocation: z.string().optional(),
      workAuthorization: z.string().optional(),
      recruiterAssessment: z.string().optional(),
    }).parse({
      jobId: formData.get("jobId"),
      matchId: formData.get("matchId"),
      motivation: emptyToNull(formData.get("motivation")) ?? undefined,
      compensation: emptyToNull(formData.get("compensation")) ?? undefined,
      availability: emptyToNull(formData.get("availability")) ?? undefined,
      locationRelocation: emptyToNull(formData.get("locationRelocation")) ?? undefined,
      workAuthorization: emptyToNull(formData.get("workAuthorization")) ?? undefined,
      recruiterAssessment: emptyToNull(formData.get("recruiterAssessment")) ?? undefined,
    });
    await saveCandidateScreening({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      matchId: parsed.matchId,
      values: {
        motivation: parsed.motivation,
        compensation: parsed.compensation,
        availability: parsed.availability,
        locationRelocation: parsed.locationRelocation,
        workAuthorization: parsed.workAuthorization,
        recruiterAssessment: parsed.recruiterAssessment,
      },
    });
    redirect(`/app/jobs/${parsed.jobId}/pipeline`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function createSubmissionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("submissions.write");
    const parsed = z.object({
      jobId: z.string().uuid(),
      candidateId: z.string().uuid(),
      matchId: z.string().uuid().optional(),
      candidateSummary: z.string().optional(),
      recruiterCommentary: z.string().optional(),
    }).parse({
      jobId: formData.get("jobId"),
      candidateId: formData.get("candidateId"),
      matchId: emptyToNull(formData.get("matchId")) ?? undefined,
      candidateSummary: emptyToNull(formData.get("candidateSummary")) ?? undefined,
      recruiterCommentary: emptyToNull(formData.get("recruiterCommentary")) ?? undefined,
    });
    const created = await createSubmission({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      jobId: parsed.jobId,
      candidateId: parsed.candidateId,
      matchId: parsed.matchId,
      packet: parsed,
    });
    redirect(`/app/submissions?focus=${created.id}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function submitToClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("submissions.approve");
    const parsed = z.object({ submissionId: z.string().uuid() }).parse({
      submissionId: formData.get("submissionId"),
    });
    await submitCandidateToClient({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      submissionId: parsed.submissionId,
    });
    redirect("/app/submissions");
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function createInterviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("interviews.write");
    const parsed = z.object({
      candidateId: z.string().uuid(),
      jobId: z.string().uuid(),
      submissionId: z.string().uuid().optional(),
      stage: z.string().optional(),
      format: z.string().optional(),
      scheduledFor: z.string().optional(),
      locationOrLink: z.string().optional(),
      participants: z.string().optional(),
    }).parse({
      candidateId: formData.get("candidateId"),
      jobId: formData.get("jobId"),
      submissionId: emptyToNull(formData.get("submissionId")) ?? undefined,
      stage: emptyToNull(formData.get("stage")) ?? undefined,
      format: emptyToNull(formData.get("format")) ?? undefined,
      scheduledFor: emptyToNull(formData.get("scheduledFor")) ?? undefined,
      locationOrLink: emptyToNull(formData.get("locationOrLink")) ?? undefined,
      participants: emptyToNull(formData.get("participants")) ?? undefined,
    });
    await createInterview({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      values: {
        ...parsed,
        scheduledFor: parsed.scheduledFor ? new Date(parsed.scheduledFor) : null,
        clientFeedbackDueAt: parsed.scheduledFor
          ? new Date(new Date(parsed.scheduledFor).getTime() + 3 * 24 * 60 * 60 * 1000)
          : null,
      },
    });
    redirect("/app/interviews");
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function updateInterviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("interviews.write");
    const parsed = z.object({
      interviewId: z.string().uuid(),
      status: z.enum(["scheduled", "completed", "cancelled", "no_show"]),
      clientFeedback: z.string().optional(),
      candidateFeedback: z.string().optional(),
      outcome: z.string().optional(),
      nextStep: z.string().optional(),
    }).parse({
      interviewId: formData.get("interviewId"),
      status: formData.get("status"),
      clientFeedback: emptyToNull(formData.get("clientFeedback")) ?? undefined,
      candidateFeedback: emptyToNull(formData.get("candidateFeedback")) ?? undefined,
      outcome: emptyToNull(formData.get("outcome")) ?? undefined,
      nextStep: emptyToNull(formData.get("nextStep")) ?? undefined,
    });
    await updateInterview({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      interviewId: parsed.interviewId,
      values: {
        status: parsed.status,
        clientFeedback: parsed.clientFeedback,
        candidateFeedback: parsed.candidateFeedback,
        outcome: parsed.outcome,
        nextStep: parsed.nextStep,
        completedAt: parsed.status === "completed" ? new Date() : undefined,
      },
    });
    redirect("/app/interviews");
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function createOfferAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("offers.write");
    const parsed = z.object({
      candidateId: z.string().uuid(),
      jobId: z.string().uuid(),
      searchProjectId: z.string().uuid().optional(),
      baseSalary: z.string().optional(),
      bonus: z.string().optional(),
      offerDate: z.string().optional(),
      expirationDate: z.string().optional(),
    }).parse({
      candidateId: formData.get("candidateId"),
      jobId: formData.get("jobId"),
      searchProjectId: emptyToNull(formData.get("searchProjectId")) ?? undefined,
      baseSalary: emptyToNull(formData.get("baseSalary")) ?? undefined,
      bonus: emptyToNull(formData.get("bonus")) ?? undefined,
      offerDate: emptyToNull(formData.get("offerDate")) ?? undefined,
      expirationDate: emptyToNull(formData.get("expirationDate")) ?? undefined,
    });
    await createOffer({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      values: { ...parsed, status: "extended" },
    });
    redirect("/app/offers");
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function setOfferStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("offers.write");
    const parsed = z.object({
      offerId: z.string().uuid(),
      status: z.enum(["draft", "extended", "accepted", "declined", "withdrawn", "expired"]),
      declineReason: z.string().optional(),
    }).parse({
      offerId: formData.get("offerId"),
      status: formData.get("status"),
      declineReason: emptyToNull(formData.get("declineReason")) ?? undefined,
    });
    await setOfferStatus({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      ...parsed,
    });
    redirect("/app/offers");
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function createPlacementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("placements.write");
    const parsed = z.object({
      offerId: z.string().uuid(),
      startDate: z.string().min(1),
    }).parse({
      offerId: formData.get("offerId"),
      startDate: formData.get("startDate"),
    });
    await createPlacementFromOffer({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      offerId: parsed.offerId,
      startDate: new Date(parsed.startDate),
    });
    redirect("/app/placements");
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function updateSearchProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("search_projects.write");
    const parsed = z.object({
      searchProjectId: z.string().uuid(),
      candidateProfile: z.string().optional(),
      targetIndustries: z.string().optional(),
      targetGeography: z.string().optional(),
      booleanStrategy: z.string().optional(),
      guaranteeDays: z.coerce.number().int().positive().optional(),
      feePercent: z.string().optional(),
      contractReference: z.string().optional(),
    }).parse({
      searchProjectId: formData.get("searchProjectId"),
      candidateProfile: emptyToNull(formData.get("candidateProfile")) ?? undefined,
      targetIndustries: emptyToNull(formData.get("targetIndustries")) ?? undefined,
      targetGeography: emptyToNull(formData.get("targetGeography")) ?? undefined,
      booleanStrategy: emptyToNull(formData.get("booleanStrategy")) ?? undefined,
      guaranteeDays: emptyToNull(formData.get("guaranteeDays")) ?? undefined,
      feePercent: emptyToNull(formData.get("feePercent")) ?? undefined,
      contractReference: emptyToNull(formData.get("contractReference")) ?? undefined,
    });
    const { searchProjectId, ...values } = parsed;
    await updateSearchProject({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      searchProjectId,
      values,
    });
    redirect(`/app/search-projects/${parsed.searchProjectId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function approveSearchStrategyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("search_projects.write");
    const parsed = z.object({ searchProjectId: z.string().uuid() }).parse({
      searchProjectId: formData.get("searchProjectId"),
    });
    await approveSearchStrategy({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      searchProjectId: parsed.searchProjectId,
    });
    redirect(`/app/search-projects/${parsed.searchProjectId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function preserveSilverMedalistAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("candidates.write");
    const parsed = z.object({ jobId: z.string().uuid(), candidateId: z.string().uuid() }).parse({
      jobId: formData.get("jobId"),
      candidateId: formData.get("candidateId"),
    });
    const job = await getJobWorkspace(parsed.jobId, principal.organizationId);
    if (!job) return { error: "Job not found" };
    const pools = await listTalentPools(principal.organizationId);
    const silver = pools.find((pool) => pool.slug === "silver-medalists") ?? pools[0];
    if (!silver) return { error: "No talent pool available" };
    const pool = await getTalentPool(silver.id, principal.organizationId);
    if (!pool) return { error: "Talent pool not found" };
    await addCandidateToPool({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      candidateId: parsed.candidateId,
      talentPoolId: silver.id,
    });
    redirect(`/app/jobs/${parsed.jobId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}
