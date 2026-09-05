"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import { executePrivacyDeletion } from "@/lib/privacy/deletion";
import { AuthorizationError } from "@/lib/rbac/permissions";

export type ActionState = { error?: string; ok?: boolean };

export async function requestPrivacyDeletionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("privacy.delete");
    const parsed = z
      .object({
        candidateId: z.string().uuid(),
        reason: z.string().min(8).max(500),
      })
      .parse({
        candidateId: formData.get("candidateId"),
        reason: formData.get("reason"),
      });
    await executePrivacyDeletion({
      actor: principal,
      candidateId: parsed.candidateId,
      reason: parsed.reason,
    });
    revalidatePath("/app/talent");
    revalidatePath(`/app/talent/${parsed.candidateId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof z.ZodError) {
      return { error: error instanceof z.ZodError ? error.issues[0]?.message : error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to complete privacy deletion" };
  }
}
