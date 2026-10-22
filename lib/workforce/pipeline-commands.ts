import { and, eq } from "drizzle-orm";

import { getDb } from "../../db";
import {
  jobs,
  skills,
  workforceRoleCapabilityTexts,
  workforceRoleJobs,
  workforceRoleSkills,
  workforceRoles,
  workforceStrategyNotes,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { roleSlugsHavePermission, type Permission } from "../rbac/permissions";
import { WorkforceError } from "./errors";

type Actor = {
  organizationId: string;
  userId: string;
  roleSlugs?: string[];
};

function requirePerm(actor: Actor, permission: Permission) {
  if (!roleSlugsHavePermission(actor.roleSlugs, permission)) {
    throw new WorkforceError(`Missing permission: ${permission}`);
  }
}

async function audit(actor: Actor, action: string, recordType: string, recordId: string, after: unknown, before?: unknown) {
  await recordAuditEvent({
    organizationId: actor.organizationId,
    actor: { type: "human", userId: actor.userId },
    action,
    recordType,
    recordId,
    after,
    before,
  });
}

async function loadRole(actor: Actor, roleId: string) {
  const db = getDb();
  const [role] = await db.select().from(workforceRoles).where(and(
    eq(workforceRoles.id, roleId),
    eq(workforceRoles.organizationId, actor.organizationId),
  )).limit(1);
  if (!role) throw new WorkforceError("Workforce role not found");
  return role;
}

export async function updateWorkforceRoleDemand(input: {
  actor: Actor;
  roleId: string;
  demandQuantity: number;
  demandHorizon: "current" | "evergreen" | "future";
  planningHorizon?: "0_90_days" | "3_6_months" | "6_12_months" | "12_24_months" | null;
  demandSource: "current_jobs" | "workforce_plan" | "manual_employer_need" | "aggregated_role";
  jobFamilyId?: string | null;
  minimumCredentials?: string | null;
  requiredClearanceLevel?: "unknown" | "none" | "confidential" | "secret" | "top_secret" | "ts_sci" | null;
  companyLocationId?: string | null;
}) {
  requirePerm(input.actor, "workforce.write");
  const before = await loadRole(input.actor, input.roleId);
  const db = getDb();
  const [after] = await db.update(workforceRoles).set({
    demandQuantity: input.demandQuantity,
    demandHorizon: input.demandHorizon,
    planningHorizon: input.planningHorizon ?? null,
    demandSource: input.demandSource,
    jobFamilyId: input.jobFamilyId === undefined ? before.jobFamilyId : input.jobFamilyId,
    minimumCredentials: input.minimumCredentials === undefined ? before.minimumCredentials : input.minimumCredentials,
    requiredClearanceLevel: input.requiredClearanceLevel === undefined
      ? before.requiredClearanceLevel
      : input.requiredClearanceLevel,
    companyLocationId: input.companyLocationId === undefined ? before.companyLocationId : input.companyLocationId,
    updatedAt: new Date(),
  }).where(eq(workforceRoles.id, before.id)).returning();
  await audit(input.actor, "workforce.role.demand_updated", "workforce_role", before.id, {
    demandQuantity: after.demandQuantity,
    demandHorizon: after.demandHorizon,
    planningHorizon: after.planningHorizon,
    demandSource: after.demandSource,
    jobFamilyId: after.jobFamilyId,
    minimumCredentials: after.minimumCredentials,
    requiredClearanceLevel: after.requiredClearanceLevel,
  }, {
    demandQuantity: before.demandQuantity,
    demandHorizon: before.demandHorizon,
    planningHorizon: before.planningHorizon,
    demandSource: before.demandSource,
    jobFamilyId: before.jobFamilyId,
    minimumCredentials: before.minimumCredentials,
    requiredClearanceLevel: before.requiredClearanceLevel,
  });
  return after;
}

export async function addWorkforceRoleSkill(input: {
  actor: Actor;
  roleId: string;
  skillId: string;
  requirementType?: "required" | "preferred" | "nice_to_have";
  targetProficiency?: string | null;
  quantityAffected?: number | null;
}) {
  requirePerm(input.actor, "workforce.write");
  const role = await loadRole(input.actor, input.roleId);
  const db = getDb();
  const [skill] = await db.select({ id: skills.id }).from(skills).where(eq(skills.id, input.skillId)).limit(1);
  if (!skill) throw new WorkforceError("Skill not found");
  const [created] = await db.insert(workforceRoleSkills).values({
    roleId: role.id,
    skillId: skill.id,
    requirementType: input.requirementType ?? "required",
    targetProficiency: input.targetProficiency ?? null,
    quantityAffected: input.quantityAffected ?? null,
  }).onConflictDoNothing().returning();
  await audit(input.actor, "workforce.role.capability_changed", "workforce_role", role.id, {
    skillId: skill.id,
    requirementType: input.requirementType ?? "required",
    linked: Boolean(created),
  });
  return created ?? null;
}

export async function addWorkforceCapabilityText(input: {
  actor: Actor;
  roleId: string;
  sourceText: string;
}) {
  requirePerm(input.actor, "workforce.write");
  const role = await loadRole(input.actor, input.roleId);
  const db = getDb();
  const [created] = await db.insert(workforceRoleCapabilityTexts).values({
    roleId: role.id,
    sourceText: input.sourceText.trim(),
    reviewStatus: "pending",
  }).returning();
  await audit(input.actor, "workforce.role.capability_changed", "workforce_role_capability_text", created.id, {
    roleId: role.id,
    reviewStatus: "pending",
  });
  return created;
}

export async function linkWorkforceCapabilityText(input: {
  actor: Actor;
  textId: string;
  skillId: string;
}) {
  requirePerm(input.actor, "workforce.write");
  const db = getDb();
  const [text] = await db.select().from(workforceRoleCapabilityTexts).where(eq(workforceRoleCapabilityTexts.id, input.textId)).limit(1);
  if (!text) throw new WorkforceError("Capability text not found");
  const role = await loadRole(input.actor, text.roleId);
  const [skill] = await db.select({ id: skills.id }).from(skills).where(eq(skills.id, input.skillId)).limit(1);
  if (!skill) throw new WorkforceError("Skill not found");
  await db.insert(workforceRoleSkills).values({
    roleId: role.id,
    skillId: skill.id,
    requirementType: "required",
  }).onConflictDoNothing();
  const [updated] = await db.update(workforceRoleCapabilityTexts).set({
    skillId: skill.id,
    reviewStatus: "approved",
    reviewedByUserId: input.actor.userId,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(workforceRoleCapabilityTexts.id, text.id)).returning();
  await audit(input.actor, "workforce.role.capability_changed", "workforce_role_capability_text", text.id, {
    skillId: skill.id,
    reviewStatus: "approved",
  }, { reviewStatus: text.reviewStatus, skillId: text.skillId });
  return updated;
}

export async function linkWorkforceRoleJob(input: { actor: Actor; roleId: string; jobId: string }) {
  requirePerm(input.actor, "workforce.write");
  const role = await loadRole(input.actor, input.roleId);
  const db = getDb();
  const [job] = await db.select().from(jobs).where(and(
    eq(jobs.id, input.jobId),
    eq(jobs.organizationId, input.actor.organizationId),
  )).limit(1);
  if (!job) throw new WorkforceError("Job not found");
  if (job.companyId && job.companyId !== role.companyId) {
    throw new WorkforceError("Job belongs to a different company");
  }
  const [created] = await db.insert(workforceRoleJobs).values({
    organizationId: input.actor.organizationId,
    roleId: role.id,
    jobId: job.id,
    createdByUserId: input.actor.userId,
  }).onConflictDoNothing().returning();
  await audit(input.actor, "workforce.role.job_linked", "workforce_role", role.id, {
    jobId: job.id,
    jobStatus: job.status,
    linked: Boolean(created),
  });
  return created ?? null;
}

export async function unlinkWorkforceRoleJob(input: { actor: Actor; roleId: string; jobId: string }) {
  requirePerm(input.actor, "workforce.write");
  const role = await loadRole(input.actor, input.roleId);
  const db = getDb();
  const [removed] = await db.delete(workforceRoleJobs).where(and(
    eq(workforceRoleJobs.organizationId, input.actor.organizationId),
    eq(workforceRoleJobs.roleId, role.id),
    eq(workforceRoleJobs.jobId, input.jobId),
  )).returning();
  if (!removed) throw new WorkforceError("Job link not found");
  await audit(input.actor, "workforce.role.job_unlinked", "workforce_role", role.id, { jobId: input.jobId });
  return removed;
}

export async function addWorkforceStrategyNote(input: {
  actor: Actor;
  roleId: string;
  channel:
    | "military_talent_network"
    | "talent_network"
    | "targeted_campaign"
    | "skillbridge_pathway"
    | "education_partner"
    | "training_pathway"
    | "evergreen_pool"
    | "increase_sourcing"
    | "review_requirements";
  note: string;
  educationPartnerId?: string | null;
}) {
  requirePerm(input.actor, "workforce.write");
  const role = await loadRole(input.actor, input.roleId);
  const db = getDb();
  const [created] = await db.insert(workforceStrategyNotes).values({
    organizationId: input.actor.organizationId,
    roleId: role.id,
    assessmentId: role.assessmentId,
    channel: input.channel,
    note: input.note.trim(),
    educationPartnerId: input.educationPartnerId ?? null,
    createdByUserId: input.actor.userId,
  }).returning();
  await audit(input.actor, "workforce.strategy_note.saved", "workforce_strategy_note", created.id, {
    roleId: role.id,
    channel: created.channel,
  });
  return created;
}
