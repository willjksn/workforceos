"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import { AuthorizationError } from "@/lib/rbac/permissions";
import { isReportCategory, parseReportFilters } from "@/lib/reporting/filters";
import { saveReportView } from "@/lib/reporting/saved";
import { RateLimitError } from "@/lib/security/rate-limit";

export type ActionState = { error?: string; ok?: boolean };

export async function saveReportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("reports.read");
    const parsed = z
      .object({
        category: z.string(),
        name: z.string().min(1).max(80),
        from: z.string().optional(),
        to: z.string().optional(),
        companyId: z.string().optional(),
        serviceCode: z.string().optional(),
        ownerUserId: z.string().optional(),
      })
      .parse({
        category: formData.get("category"),
        name: formData.get("name"),
        from: formData.get("from") || undefined,
        to: formData.get("to") || undefined,
        companyId: formData.get("companyId") || undefined,
        serviceCode: formData.get("serviceCode") || undefined,
        ownerUserId: formData.get("ownerUserId") || undefined,
      });
    if (!isReportCategory(parsed.category)) {
      throw new AuthorizationError("Unknown report category");
    }
    await saveReportView({
      organizationId: principal.organizationId,
      userId: principal.id,
      category: parsed.category,
      name: parsed.name,
      filters: parseReportFilters(parsed),
    });
    revalidatePath(`/app/reports/${parsed.category}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof RateLimitError || error instanceof AuthorizationError || error instanceof z.ZodError) {
      return { error: error instanceof z.ZodError ? error.issues[0]?.message : error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to save report" };
  }
}
