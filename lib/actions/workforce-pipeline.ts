"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import { AuthorizationError } from "@/lib/rbac/permissions";
import {
  addWorkforceCapabilityText,
  addWorkforceRoleSkill,
  addWorkforceStrategyNote,
  linkWorkforceCapabilityText,
  linkWorkforceRoleJob,
  unlinkWorkforceRoleJob,
  updateWorkforceRoleDemand,
} from "@/lib/workforce/pipeline-commands";
import { WorkforceError } from "@/lib/workforce/errors";

export type ActionState = { error?: string };

const horizon = z.enum(["0_90_days", "3_6_months", "6_12_months", "12_24_months"]);
const demandHorizon = z.enum(["current", "evergreen", "future"]);
const demandSource = z.enum(["current_jobs", "workforce_plan", "manual_employer_need", "aggregated_role"]);
const clearance = z.enum(["unknown", "none", "confidential", "secret", "top_secret", "ts_sci"]);
const channel = z.enum([
  "military_talent_network",
  "talent_network",
  "targeted_campaign",
  "skillbridge_pathway",
  "education_partner",
  "training_pathway",
  "evergreen_pool",
  "increase_sourcing",
  "review_requirements",
]);

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError || error instanceof z.ZodError) {
    return { error: error instanceof z.ZodError ? error.issues[0]?.message : error.message };
  }
  if (error instanceof WorkforceError) return { error: error.message };
  if (error instanceof Error) return { error: error.message };
  return { error: "Unable to save" };
}

function isNextControlFlow(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error;
}

function actorFrom(principal: { id: string; organizationId: string; roleSlugs: string[] }) {
  return { organizationId: principal.organizationId, userId: principal.id, roleSlugs: principal.roleSlugs };
}

function optionalUuid(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export async function updateRoleDemandAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("workforce.write");
    const parsed = z.object({
      roleId: z.string().uuid(),
      demandQuantity: z.coerce.number().int().min(0).max(100000),
      demandHorizon,
      planningHorizon: horizon.nullable(),
      demandSource,
      jobFamilyId: z.string().uuid().nullable(),
      minimumCredentials: z.string().trim().max(300).nullable(),
      requiredClearanceLevel: clearance.nullable(),
      companyLocationId: z.string().uuid().nullable(),
    }).parse({
      roleId: formData.get("roleId"),
      demandQuantity: formData.get("demandQuantity"),
      demandHorizon: formData.get("demandHorizon"),
      planningHorizon: optionalUuid(formData.get("planningHorizon")) ? formData.get("planningHorizon") : null,
      demandSource: formData.get("demandSource"),
      jobFamilyId: optionalUuid(formData.get("jobFamilyId")),
      minimumCredentials: String(formData.get("minimumCredentials") ?? "").trim() || null,
      requiredClearanceLevel: optionalUuid(formData.get("requiredClearanceLevel"))
        ? formData.get("requiredClearanceLevel")
        : null,
      companyLocationId: optionalUuid(formData.get("companyLocationId")),
    });
    await updateWorkforceRoleDemand({ actor: actorFrom(principal), ...parsed });
    redirect(`/app/workforce/roles/${parsed.roleId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function addRoleSkillAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("workforce.write");
    const parsed = z.object({
      roleId: z.string().uuid(),
      skillId: z.string().uuid(),
      requirementType: z.enum(["required", "preferred", "nice_to_have"]),
    }).parse({
      roleId: formData.get("roleId"),
      skillId: formData.get("skillId"),
      requirementType: formData.get("requirementType") || "required",
    });
    await addWorkforceRoleSkill({ actor: actorFrom(principal), ...parsed });
    redirect(`/app/workforce/roles/${parsed.roleId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function addCapabilityTextAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("workforce.write");
    const parsed = z.object({
      roleId: z.string().uuid(),
      sourceText: z.string().trim().min(1).max(300),
    }).parse({ roleId: formData.get("roleId"), sourceText: formData.get("sourceText") });
    await addWorkforceCapabilityText({ actor: actorFrom(principal), ...parsed });
    redirect(`/app/workforce/roles/${parsed.roleId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function linkCapabilityTextAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("workforce.write");
    const parsed = z.object({
      roleId: z.string().uuid(),
      textId: z.string().uuid(),
      skillId: z.string().uuid(),
    }).parse({
      roleId: formData.get("roleId"),
      textId: formData.get("textId"),
      skillId: formData.get("skillId"),
    });
    await linkWorkforceCapabilityText({ actor: actorFrom(principal), textId: parsed.textId, skillId: parsed.skillId });
    redirect(`/app/workforce/roles/${parsed.roleId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function linkRoleJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("workforce.write");
    const parsed = z.object({
      roleId: z.string().uuid(),
      jobId: z.string().uuid(),
    }).parse({ roleId: formData.get("roleId"), jobId: formData.get("jobId") });
    await linkWorkforceRoleJob({ actor: actorFrom(principal), ...parsed });
    redirect(`/app/workforce/roles/${parsed.roleId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function unlinkRoleJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("workforce.write");
    const parsed = z.object({
      roleId: z.string().uuid(),
      jobId: z.string().uuid(),
    }).parse({ roleId: formData.get("roleId"), jobId: formData.get("jobId") });
    await unlinkWorkforceRoleJob({ actor: actorFrom(principal), ...parsed });
    redirect(`/app/workforce/roles/${parsed.roleId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}

export async function addStrategyNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("workforce.write");
    const parsed = z.object({
      roleId: z.string().uuid(),
      channel,
      note: z.string().trim().min(1).max(2000),
    }).parse({
      roleId: formData.get("roleId"),
      channel: formData.get("channel"),
      note: formData.get("note"),
    });
    await addWorkforceStrategyNote({ actor: actorFrom(principal), ...parsed });
    redirect(`/app/workforce/roles/${parsed.roleId}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return fail(error);
  }
}
