"use server";

import { z } from "zod";

import { requireAnyAppPermission } from "@/lib/auth/guard";
import { ACADEMY_READ_PERMISSIONS } from "@/lib/academy/access";
import { isTrainingModuleSlug } from "@/lib/academy/training";
import { upsertTrainingProgress } from "@/lib/academy/progress";
import { AuthorizationError } from "@/lib/rbac/permissions";

const progressSchema = z.object({
  moduleSlug: z.string().min(1).max(120),
  status: z.enum(["assigned", "in_progress", "completed"]),
});

/**
 * Persist the caller's own training progress only.
 * Does not grant permissions, assign bundles, or edit overrides.
 */
export async function updateAcademyTrainingAction(
  _state: { error?: string; message?: string },
  formData: FormData,
): Promise<{ error?: string; message?: string }> {
  try {
    const principal = await requireAnyAppPermission(ACADEMY_READ_PERMISSIONS);
    const parsed = progressSchema.parse({
      moduleSlug: String(formData.get("moduleSlug") ?? ""),
      status: String(formData.get("status") ?? ""),
    });
    if (!isTrainingModuleSlug(parsed.moduleSlug)) {
      return { error: "Unknown training module." };
    }
    const targetUserId = String(formData.get("userId") ?? principal.id);
    if (targetUserId !== principal.id) {
      throw new AuthorizationError("You can only update your own training progress.");
    }
    await upsertTrainingProgress({
      userId: principal.id,
      moduleSlug: parsed.moduleSlug,
      status: parsed.status,
    });
    return { message: parsed.status === "completed" ? "Marked complete." : "Progress saved." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    if (error instanceof z.ZodError) return { error: error.issues[0]?.message };
    if (error instanceof Error) return { error: error.message };
    return { error: "Could not save training progress." };
  }
}
