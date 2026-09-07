"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import { downloadStoredFile } from "@/lib/hiring/service";
import { AuthorizationError, requirePermission } from "@/lib/rbac/permissions";
import {
  addCandidateExperience,
  addCandidateToPool,
  createCandidate,
  createTalentPool,
  getCandidateWithRelationships,
  getTalentPool,
} from "@/lib/repositories/talent";
import { applyResumeToCandidate } from "@/lib/talent/apply-resume";
import { emptyToNull } from "@/lib/validation/forms";

export type ActionState = { error?: string; message?: string };

const availabilitySchema = z.enum([
  "unknown",
  "available_now",
  "passive",
  "not_looking",
  "do_not_contact",
]);
const consentSchema = z.enum(["unknown", "granted", "withdrawn", "expired"]);

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

export async function createCandidateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("candidates.write");
    const parsed = z
      .object({
        fullName: z.string().trim().min(1).max(200),
        email: z.string().trim().email().optional(),
        currentTitle: z.string().trim().max(200).optional(),
        availability: availabilitySchema,
        consentStatus: consentSchema,
      })
      .parse({
        fullName: formData.get("fullName"),
        email: emptyToNull(formData.get("email")) ?? undefined,
        currentTitle: emptyToNull(formData.get("currentTitle")) ?? undefined,
        availability: formData.get("availability") || "unknown",
        consentStatus: formData.get("consentStatus") || "unknown",
      });
    const candidate = await createCandidate({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      ...parsed,
      email: parsed.email ?? null,
      currentTitle: parsed.currentTitle ?? null,
    });
    redirect(`/app/talent/${candidate.id}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function addExperienceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("candidates.write");
    const parsed = z
      .object({
        candidateId: z.string().uuid(),
        employer: z.string().trim().min(1).max(200),
        title: z.string().trim().min(1).max(200),
        summary: z.string().trim().max(2000).optional(),
      })
      .parse({
        candidateId: formData.get("candidateId"),
        employer: formData.get("employer"),
        title: formData.get("title"),
        summary: emptyToNull(formData.get("summary")) ?? undefined,
      });
    const existing = await getCandidateWithRelationships(parsed.candidateId, principal.organizationId);
    if (!existing) return { error: "Candidate not found" };
    await addCandidateExperience({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      candidateId: parsed.candidateId,
      employer: parsed.employer,
      title: parsed.title,
      summary: parsed.summary ?? null,
    });
    redirect(`/app/talent/${parsed.candidateId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function addCandidateToPoolAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("candidates.write");
    const parsed = z
      .object({
        candidateId: z.string().uuid(),
        talentPoolId: z.string().uuid(),
      })
      .parse({
        candidateId: formData.get("candidateId"),
        talentPoolId: formData.get("talentPoolId"),
      });
    const existing = await getCandidateWithRelationships(parsed.candidateId, principal.organizationId);
    const pool = await getTalentPool(parsed.talentPoolId, principal.organizationId);
    if (!existing || !pool) return { error: "Candidate or pool not found" };
    await addCandidateToPool({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      candidateId: parsed.candidateId,
      talentPoolId: parsed.talentPoolId,
    });
    redirect(`/app/talent/${parsed.candidateId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function createTalentPoolAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("candidates.write");
    const parsed = z
      .object({
        name: z.string().trim().min(1).max(200),
        slug: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase slug like military-talent"),
        description: z.string().trim().max(2000).optional(),
      })
      .parse({
        name: formData.get("name"),
        slug: formData.get("slug"),
        description: emptyToNull(formData.get("description")) ?? undefined,
      });
    const pool = await createTalentPool({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      name: parsed.name,
      slug: parsed.slug,
      description: parsed.description ?? null,
    });
    redirect(`/app/talent/pools/${pool.id}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

const candidateResumeReturnPath = z
  .string()
  .regex(
    /^\/app\/(?:talent|military\/skillbridge|recruiting\/applications)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid return path",
  );

export async function applyResumeToCandidateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("candidates.write");
    requirePermission(principal, "candidate_pii.read");
    const parsed = z
      .object({
        candidateId: z.string().uuid(),
        redirectTo: candidateResumeReturnPath,
      })
      .parse({
        candidateId: formData.get("candidateId"),
        redirectTo: formData.get("redirectTo"),
      });
    const existing = await getCandidateWithRelationships(parsed.candidateId, principal.organizationId);
    if (!existing) return { error: "Candidate not found" };
    const fileId = existing.candidate.currentResumeFileId;
    if (!fileId || !existing.resumeFile) return { error: "No resume on file" };
    const { file, body } = await downloadStoredFile(principal, fileId);
    const result = await applyResumeToCandidate({
      organizationId: principal.organizationId,
      candidateId: parsed.candidateId,
      fileId: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
      body,
      actor: { type: "human", userId: principal.id },
    });
    if (!result.filled.length) {
      return {
        message: "No empty fields to fill. Existing recruiter-entered values were left unchanged.",
      };
    }
    redirect(parsed.redirectTo);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}
