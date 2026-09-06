"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import {
  convertInquiryToOpportunity,
  updateWebsiteInquiryStatus,
} from "@/lib/inquiries/service";
import { AuthorizationError } from "@/lib/rbac/permissions";

export type ActionState = { error?: string };

const statusSchema = z.enum([
  "new",
  "reviewing",
  "qualified",
  "discovery_requested",
  "converted_to_opportunity",
  "nurture",
  "closed",
]);

export async function updateInquiryStatusAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("opportunities.write");
    const parsed = z
      .object({
        inquiryId: z.string().uuid(),
        status: statusSchema,
      })
      .safeParse({
        inquiryId: formData.get("inquiryId"),
        status: formData.get("status"),
      });
    if (!parsed.success) return { error: "Invalid inquiry update." };
    await updateWebsiteInquiryStatus({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      inquiryId: parsed.data.inquiryId,
      status: parsed.data.status,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "Unable to update inquiry." };
  }
  redirect(`/app/crm/inquiries/${formData.get("inquiryId")}`);
}

export async function convertInquiryAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("opportunities.write");
    const inquiryId = String(formData.get("inquiryId") ?? "");
    if (!z.string().uuid().safeParse(inquiryId).success) return { error: "Invalid inquiry." };
    await convertInquiryToOpportunity({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      inquiryId,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "Unable to convert inquiry." };
  }
  redirect(`/app/crm/inquiries/${formData.get("inquiryId")}`);
}
