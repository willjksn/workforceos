"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { inviteOrganizationUser } from "@/lib/admin/invite-user";
import { requireAppPermission } from "@/lib/auth/guard";
import { assignableRoleSlugs } from "@/lib/rbac/assign-role";
import {
  AuthorizationError,
  PERMISSIONS,
  ROLE_SLUGS,
  isRoleSlug,
  requirePermission,
} from "@/lib/rbac/permissions";
import {
  archiveUser,
  assignUserRole,
  copyUserAccess,
  resetUserPermissionOverrides,
  setUserAccessBundles,
  setUserAccessStatus,
  setUserOrganizationalTitle,
  setUserPermissionOverride,
} from "@/lib/repositories/platform";
import { emptyToNull } from "@/lib/validation/forms";

export type ActionState = { error?: string; ok?: boolean; roleSlug?: string; message?: string };

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError || error instanceof z.ZodError) {
    return { error: error instanceof z.ZodError ? error.issues[0]?.message : error.message };
  }
  if (error instanceof Error) return { error: error.message };
  return { error: "Unable to save" };
}

function refreshPeople(userId?: string) {
  revalidatePath("/app/admin/users");
  revalidatePath("/app/admin/roles");
  revalidatePath("/app/admin/access-review");
  if (userId) revalidatePath(`/app/admin/users/${userId}`);
}

const roleSlugSchema = z.string().refine((value): value is (typeof ROLE_SLUGS)[number] => isRoleSlug(value));

export async function assignUserRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("admin.roles");
    const parsed = z
      .object({
        userId: z.string().uuid(),
        roleSlug: roleSlugSchema,
      })
      .parse({
        userId: formData.get("userId"),
        roleSlug: formData.get("roleSlug"),
      });
    if (!assignableRoleSlugs(principal).includes(parsed.roleSlug)) {
      throw new AuthorizationError("Only a Managing Partner can assign the Managing Partner role.");
    }
    const result = await assignUserRole({
      actor: principal,
      userId: parsed.userId,
      roleSlug: parsed.roleSlug,
    });
    refreshPeople(parsed.userId);
    return { ok: true, roleSlug: result.roleSlug };
  } catch (error) {
    return fail(error);
  }
}

export async function setUserAccessBundlesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("admin.roles");
    const userId = z.string().uuid().parse(formData.get("userId"));
    const roleSlugs = formData
      .getAll("roleSlug")
      .map((value) => String(value))
      .filter(isRoleSlug);
    for (const slug of roleSlugs) {
      if (!assignableRoleSlugs(principal).includes(slug)) {
        throw new AuthorizationError("Only a Managing Partner can assign the Managing Partner role.");
      }
    }
    await setUserAccessBundles({
      actor: principal,
      userId,
      roleSlugs,
    });
    refreshPeople(userId);
    return { ok: true, message: "Access bundles saved." };
  } catch (error) {
    return fail(error);
  }
}

export async function setUserOrganizationalTitleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("admin.users");
    const parsed = z
      .object({
        userId: z.string().uuid(),
        organizationalTitle: z.string().trim().max(200).optional(),
      })
      .parse({
        userId: formData.get("userId"),
        organizationalTitle: emptyToNull(formData.get("organizationalTitle")) ?? undefined,
      });
    await setUserOrganizationalTitle({
      actor: principal,
      userId: parsed.userId,
      organizationalTitle: parsed.organizationalTitle ?? null,
    });
    refreshPeople(parsed.userId);
    return { ok: true, message: "Organizational title saved. Title is display-only and is not a permission." };
  } catch (error) {
    return fail(error);
  }
}

export async function setUserPermissionOverrideAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("admin.roles");
    const parsed = z
      .object({
        userId: z.string().uuid(),
        permission: z.string().refine((value): value is (typeof PERMISSIONS)[number] =>
          (PERMISSIONS as readonly string[]).includes(value),
        ),
        effect: z.enum(["grant", "deny"]),
      })
      .parse({
        userId: formData.get("userId"),
        permission: formData.get("permission"),
        effect: formData.get("effect"),
      });
    await setUserPermissionOverride({
      actor: principal,
      userId: parsed.userId,
      permission: parsed.permission,
      effect: parsed.effect,
    });
    refreshPeople(parsed.userId);
    return { ok: true, message: "Override saved. Deny wins over a bundle grant." };
  } catch (error) {
    return fail(error);
  }
}

export async function resetUserPermissionOverridesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("admin.roles");
    const userId = z.string().uuid().parse(formData.get("userId"));
    await resetUserPermissionOverrides({ actor: principal, userId });
    refreshPeople(userId);
    return { ok: true, message: "Permission overrides cleared." };
  } catch (error) {
    return fail(error);
  }
}

export async function copyUserAccessAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("admin.roles");
    const parsed = z
      .object({
        targetUserId: z.string().uuid(),
        sourceUserId: z.string().uuid(),
        includeOverrides: z.enum(["yes", "no"]).default("yes"),
      })
      .parse({
        targetUserId: formData.get("targetUserId"),
        sourceUserId: formData.get("sourceUserId"),
        includeOverrides: formData.get("includeOverrides") === "no" ? "no" : "yes",
      });
    const result = await copyUserAccess({
      actor: principal,
      sourceUserId: parsed.sourceUserId,
      targetUserId: parsed.targetUserId,
      includeOverrides: parsed.includeOverrides === "yes",
    });
    refreshPeople(parsed.targetUserId);
    return {
      ok: true,
      message: `Copied ${result.roleSlugs.length} access bundle(s)${parsed.includeOverrides === "yes" ? " and overrides" : ""}.`,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function setUserAccessStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("admin.users");
    const { assertRateLimit, RATE_LIMITS } = await import("@/lib/security/rate-limit");
    await assertRateLimit({ key: `auth:${principal.id}`, ...RATE_LIMITS.authSensitive });
    const parsed = z
      .object({
        userId: z.string().uuid(),
        status: z.enum(["active", "disabled", "archived"]),
      })
      .parse({
        userId: formData.get("userId"),
        status: formData.get("status"),
      });
    if (parsed.status === "archived") {
      await archiveUser({ actor: principal, userId: parsed.userId });
    } else {
      await setUserAccessStatus({
        actor: principal,
        userId: parsed.userId,
        status: parsed.status,
      });
    }
    refreshPeople(parsed.userId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function inviteUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("admin.users");
    requirePermission(principal, "admin.roles");
    const { assertRateLimit, RATE_LIMITS } = await import("@/lib/security/rate-limit");
    await assertRateLimit({ key: `auth:${principal.id}`, ...RATE_LIMITS.authSensitive });
    const parsed = z
      .object({
        email: z.string().trim().email("Enter a valid work email.").transform((value) => value.toLowerCase()),
        fullName: z.string().trim().max(200).optional(),
        organizationalTitle: z.string().trim().max(200).optional(),
        roleSlug: roleSlugSchema,
      })
      .parse({
        email: formData.get("email"),
        fullName: emptyToNull(formData.get("fullName")) ?? undefined,
        organizationalTitle: emptyToNull(formData.get("organizationalTitle")) ?? undefined,
        roleSlug: formData.get("roleSlug"),
      });
    if (!assignableRoleSlugs(principal).includes(parsed.roleSlug)) {
      throw new AuthorizationError("Only a Managing Partner can assign the Managing Partner role.");
    }
    const result = await inviteOrganizationUser({
      actor: principal,
      email: parsed.email,
      fullName: parsed.fullName,
      organizationalTitle: parsed.organizationalTitle,
      roleSlug: parsed.roleSlug,
    });
    refreshPeople(result.userId);
    return { ok: true, roleSlug: result.roleSlug, message: result.message };
  } catch (error) {
    return fail(error);
  }
}
