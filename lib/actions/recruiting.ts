"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import { AuthorizationError, can } from "@/lib/rbac/permissions";
import { getCompanyInOrganization } from "@/lib/repositories/crm";
import {
  completeInternalSearch,
  createJobWithInternalSearch,
  getJobWorkspace,
  runInternalTalentSearch,
  updateMatchPipelineStatus,
} from "@/lib/repositories/recruiting";
import { addCandidateToPool, getTalentPool, listTalentPools } from "@/lib/repositories/talent";
import { emptyToNull } from "@/lib/validation/forms";

export type ActionState = { error?: string };

const jobStatusSchema = z.enum(["draft", "open", "on_hold", "filled", "cancelled", "closed"]);
const pipelineStatusSchema = z.enum([
  "sourced",
  "screened",
  "submitted",
  "interviewing",
  "offered",
  "placed",
  "declined",
  "withdrawn",
]);

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

export async function createJobAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("jobs.write");
    const parsed = z
      .object({
        title: z.string().trim().min(1).max(200),
        companyId: z.string().uuid().optional(),
        description: z.string().trim().max(8000).optional(),
        status: jobStatusSchema,
      })
      .parse({
        title: formData.get("title"),
        companyId: emptyToNull(formData.get("companyId")) ?? undefined,
        description: emptyToNull(formData.get("description")) ?? undefined,
        status: formData.get("status") || "open",
      });
    if (parsed.companyId) {
      const company = await getCompanyInOrganization(parsed.companyId, principal.organizationId);
      if (!company) return { error: "Company not found" };
    }
    const created = await createJobWithInternalSearch({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      title: parsed.title,
      companyId: parsed.companyId ?? null,
      description: parsed.description ?? null,
      status: parsed.status,
    });
    redirect(`/app/jobs/${created.job.id}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function runInternalSearchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("jobs.write");
    if (!can(principal, "candidates.read")) {
      throw new AuthorizationError("Missing permission: candidates.read");
    }
    const parsed = z.object({ jobId: z.string().uuid() }).parse({
      jobId: formData.get("jobId"),
    });
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

export async function completeInternalSearchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("jobs.write");
    const parsed = z
      .object({
        jobId: z.string().uuid(),
        searchProjectId: z.string().uuid(),
      })
      .parse({
        jobId: formData.get("jobId"),
        searchProjectId: formData.get("searchProjectId"),
      });
    const job = await getJobWorkspace(parsed.jobId, principal.organizationId);
    if (!job) return { error: "Job not found" };
    await completeInternalSearch({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      jobId: parsed.jobId,
      searchProjectId: parsed.searchProjectId,
    });
    redirect(`/app/jobs/${parsed.jobId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function updatePipelineAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("jobs.write");
    const parsed = z
      .object({
        jobId: z.string().uuid(),
        matchId: z.string().uuid(),
        pipelineStatus: pipelineStatusSchema,
      })
      .parse({
        jobId: formData.get("jobId"),
        matchId: formData.get("matchId"),
        pipelineStatus: formData.get("pipelineStatus"),
      });
    const job = await getJobWorkspace(parsed.jobId, principal.organizationId);
    if (!job) return { error: "Job not found" };
    await updateMatchPipelineStatus({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      jobId: parsed.jobId,
      matchId: parsed.matchId,
      pipelineStatus: parsed.pipelineStatus,
    });
    redirect(`/app/jobs/${parsed.jobId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function preserveSilverMedalistAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("candidates.write");
    const parsed = z
      .object({
        jobId: z.string().uuid(),
        candidateId: z.string().uuid(),
      })
      .parse({
        jobId: formData.get("jobId"),
        candidateId: formData.get("candidateId"),
      });
    const job = await getJobWorkspace(parsed.jobId, principal.organizationId);
    if (!job) return { error: "Job not found" };
    const pools = await listTalentPools(principal.organizationId);
    const silver = pools.find((pool) => pool.slug === "silver-medalists");
    if (!silver) {
      const fallback = pools[0];
      if (!fallback) return { error: "No talent pool available" };
      await addCandidateToPool({
        organizationId: principal.organizationId,
        actorUserId: principal.id,
        candidateId: parsed.candidateId,
        talentPoolId: fallback.id,
      });
    } else {
      const pool = await getTalentPool(silver.id, principal.organizationId);
      if (!pool) return { error: "Silver medalist pool not found" };
      await addCandidateToPool({
        organizationId: principal.organizationId,
        actorUserId: principal.id,
        candidateId: parsed.candidateId,
        talentPoolId: silver.id,
      });
    }
    redirect(`/app/jobs/${parsed.jobId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}
