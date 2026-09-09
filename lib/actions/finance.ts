"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAppPermission } from "@/lib/auth/guard";
import {
  createInvoiceFromBillingEvent,
  recordPayment,
  requestFeeOverride,
  requestInvoiceAdjustment,
} from "@/lib/finance/engine";
import { getQuickBooksAdapter } from "@/lib/integrations/providers";
import { retryFailedEvent } from "@/lib/integrations/retry";
import { AuthorizationError } from "@/lib/rbac/permissions";

export type ActionState = { error?: string };

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError || error instanceof z.ZodError) {
    return { error: error instanceof z.ZodError ? error.issues[0]?.message : error.message };
  }
  if (error instanceof Error) return { error: error.message };
  return { error: "Unable to save" };
}

function revalidateFinance() {
  revalidatePath("/app");
  revalidatePath("/app/finance");
  revalidatePath("/app/finance/schedules");
  revalidatePath("/app/finance/revenue");
  revalidatePath("/app/finance/invoices");
  revalidatePath("/app/finance/payments");
  revalidatePath("/app/finance/ar");
  revalidatePath("/app/finance/economics");
  revalidatePath("/app/integrations");
}

export async function createInvoiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("invoices.write");
    const billingEventId = z.string().uuid().parse(formData.get("billingEventId"));
    const invoice = await createInvoiceFromBillingEvent({
      actor: { organizationId: principal.organizationId, userId: principal.id, roleSlugs: principal.roleSlugs },
      billingEventId,
    });
    await getQuickBooksAdapter().postInvoice({
      organizationId: principal.organizationId,
      actorUserId: principal.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
    });
    revalidateFinance();
    return {};
  } catch (error) {
    return fail(error);
  }
}

export async function recordPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("payments.write");
    const parsed = z
      .object({
        invoiceId: z.string().uuid(),
        amount: z.string().min(1),
        methodSummary: z.string().optional(),
        externalTransactionReference: z.string().optional(),
      })
      .parse({
        invoiceId: formData.get("invoiceId"),
        amount: formData.get("amount"),
        methodSummary: formData.get("methodSummary") || undefined,
        externalTransactionReference: formData.get("externalTransactionReference") || undefined,
      });
    await recordPayment({
      actor: { organizationId: principal.organizationId, userId: principal.id, roleSlugs: principal.roleSlugs },
      ...parsed,
    });
    revalidateFinance();
    return {};
  } catch (error) {
    return fail(error);
  }
}

export async function requestFeeOverrideAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("finance.write");
    const parsed = z
      .object({
        placementId: z.string().uuid(),
        amount: z.string().min(1),
        reason: z.string().trim().min(1),
      })
      .parse({
        placementId: formData.get("placementId"),
        amount: formData.get("amount"),
        reason: formData.get("reason"),
      });
    await requestFeeOverride({
      actor: { organizationId: principal.organizationId, userId: principal.id, roleSlugs: principal.roleSlugs },
      ...parsed,
    });
    revalidateFinance();
    return {};
  } catch (error) {
    return fail(error);
  }
}

export async function requestWriteOffAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("invoices.write");
    const parsed = z
      .object({
        invoiceId: z.string().uuid(),
        amount: z.string().min(1),
        reason: z.string().trim().min(1),
      })
      .parse({
        invoiceId: formData.get("invoiceId"),
        amount: formData.get("amount"),
        reason: formData.get("reason"),
      });
    await requestInvoiceAdjustment({
      actor: { organizationId: principal.organizationId, userId: principal.id, roleSlugs: principal.roleSlugs },
      ...parsed,
      adjustmentType: "write_off",
    });
    revalidateFinance();
    return {};
  } catch (error) {
    return fail(error);
  }
}

export async function retryIntegrationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const principal = await requireAppPermission("integrations.manage");
    const eventId = z.string().uuid().parse(formData.get("eventId"));
    await retryFailedEvent({
      organizationId: principal.organizationId,
      eventId,
      actorUserId: principal.id,
    });
    revalidatePath("/app");
    revalidatePath("/app/integrations");
    return {};
  } catch (error) {
    return fail(error);
  }
}
