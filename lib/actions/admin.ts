"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import { assignableRoleSlugs } from "@/lib/rbac/assign-role";
import { AuthorizationError, ROLE_SLUGS } from "@/lib/rbac/permissions";
import { archiveUser, assignUserRole, setUserAccessStatus } from "@/lib/repositories/platform";

export type ActionState = { error?: string; ok?: boolean; roleSlug?: string };

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError || error instanceof z.ZodError) {
    return { error: error instanceof z.ZodError ? error.issues[0]?.message : error.message };
  }
  if (error instanceof Error) return { error: error.message };
  return { error: "Unable to save" };
}

function refreshPeople() {
  revalidatePath("/app/admin/users");
  revalidatePath("/app/admin/roles");
}

export async function assignUserRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("admin.roles");
    const parsed = z
      .object({
        userId: z.string().uuid(),
        roleSlug: z.string().refine((value): value is (typeof ROLE_SLUGS)[number] =>
          (ROLE_SLUGS as readonly string[]).includes(value),
        ),
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
    refreshPeople();
    return { ok: true, roleSlug: result.roleSlug };
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
    refreshPeople();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
