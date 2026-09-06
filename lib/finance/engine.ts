import { and, count, desc, eq, inArray, lte, notInArray, or, sql } from "drizzle-orm";

import { getDb } from "../../db";
import {
  billingEvents,
  billingSchedules,
  companies,
  contractBillingTerms,
  contracts,
  financeAdjustments,
  financeCostEntries,
  integrationEvents,
  invoices,
  payments,
  placements,
  projects,
  revenueEvents,
  searchProjects,
  services,
} from "../../db/schema";
import { requestApproval } from "../approvals/service";
import { recordAuditEvent } from "../audit/record-audit-event";
import { roleSlugsHavePermission } from "../rbac/permissions";
import { agingBucket, daysPastDue, isInvoiceOverdue, type AgingBucket } from "./aging";
import { assertFeeOverrideAllowed, assertScheduleChangeAfterExecutionAllowed } from "./gates";
import { addMoney, FinanceError, moneyString, parseMoney, requireMoney, subtractMoney } from "./money";
import { calculatePlacementFee } from "./placement-fees";

export { FinanceError };
export { calculatePlacementFee } from "./placement-fees";
export { agingBucket, daysPastDue } from "./aging";

export type FinanceActor = {
  organizationId: string;
  userId: string;
  roleSlugs?: string[];
};

type BillingType = "placement_fee" | "monthly_recurring" | "milestone" | "fixed_project" | "retainer" | "custom";

async function audit(
  actor: FinanceActor,
  action: string,
  recordType: string,
  recordId: string,
  after: unknown,
  before?: unknown,
  reason?: string,
) {
  await recordAuditEvent({
    organizationId: actor.organizationId,
    actor: { type: "human", userId: actor.userId },
    action,
    recordType,
    recordId,
    after,
    before,
    reason,
  });
}

function nextMonthDate(from: Date, billingDay: number) {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + 1;
  const day = Math.min(billingDay, 28);
  return new Date(Date.UTC(year, month, day));
}

function dueDateFromIssued(issued: Date) {
  return new Date(Date.UTC(issued.getUTCFullYear(), issued.getUTCMonth(), issued.getUTCDate() + 30));
}

export async function storeContractBillingTerms(input: {
  actor: FinanceActor;
  contractId: string;
  terms: Array<{
    name: string;
    billingType: string;
    amount?: string | number | null;
    percentage?: string | number | null;
    dueTrigger: string;
    sequence?: number;
    notes?: string | null;
  }>;
}) {
  const db = getDb();
  const [contract] = await db
    .select()
    .from(contracts)
    .where(and(eq(contracts.id, input.contractId), eq(contracts.organizationId, input.actor.organizationId)))
    .limit(1);
  if (!contract) throw new FinanceError("Contract not found");
  const inserted = [];
  for (const [index, term] of input.terms.entries()) {
    if (term.amount == null && term.percentage == null) {
      throw new FinanceError("Contract billing terms require a stored amount or percentage");
    }
    const [row] = await db
      .insert(contractBillingTerms)
      .values({
        contractId: contract.id,
        name: term.name,
        billingType: term.billingType,
        amount: term.amount != null ? moneyString(requireMoney(term.amount, term.name)) : null,
        percentage: term.percentage != null ? String(term.percentage) : null,
        dueTrigger: term.dueTrigger,
        sequence: term.sequence ?? index + 1,
        notes: term.notes ?? null,
      })
      .returning();
    inserted.push(row);
  }
  await audit(input.actor, "contract_billing_terms.stored", "contract", contract.id, inserted);
  return inserted;
}

export async function createDeliveryBillingFoundation(input: {
  actor: FinanceActor;
  project: typeof projects.$inferSelect;
  serviceCode: string;
  serviceId?: string | null;
  contract?: typeof contracts.$inferSelect | null;
  storedAmount?: string | number | null;
}) {
  const db = getDb();
  const billingType: BillingType =
    input.serviceCode === "fractional-talent-partner"
      ? "monthly_recurring"
      : input.serviceCode === "professional-search"
        ? "placement_fee"
        : "milestone";
  const cadence =
    billingType === "monthly_recurring" ? "monthly" : billingType === "placement_fee" ? "placement" : "milestone";
  const monthlyFee =
    parseMoney(input.contract?.monthlyFee) ?? parseMoney(input.contract?.contractValue) ?? parseMoney(input.storedAmount);
  const amount =
    billingType === "placement_fee"
      ? null
      : billingType === "monthly_recurring"
        ? monthlyFee
        : parseMoney(input.contract?.contractValue) ?? parseMoney(input.storedAmount);

  const [schedule] = await db
    .insert(billingSchedules)
    .values({
      organizationId: input.actor.organizationId,
      companyId: input.project.companyId,
      projectId: input.project.id,
      contractId: input.contract?.id ?? null,
      serviceId: input.serviceId ?? null,
      name: `${input.serviceCode} billing`,
      cadence,
      billingType,
      amount: amount != null ? moneyString(amount) : null,
      dueTrigger:
        billingType === "monthly_recurring"
          ? "monthly_fractional"
          : billingType === "placement_fee"
            ? "candidate_start"
            : "milestone_completed",
      recurrence: billingType === "monthly_recurring" ? "monthly" : "none",
      billingDay: input.contract?.billingDay ?? null,
      startDate: input.contract?.effectiveDate ?? input.contract?.executionDate ?? null,
      endDate: input.contract?.expirationDate ?? null,
      minimumTermMonths: input.contract?.minimumTermMonths ?? null,
      nextInvoiceDate:
        billingType === "monthly_recurring"
          ? nextMonthDate(new Date(), input.contract?.billingDay ?? 1)
          : null,
      nextExpectedAt:
        billingType === "monthly_recurring"
          ? nextMonthDate(new Date(), input.contract?.billingDay ?? 1)
          : null,
      renewalStatus: billingType === "monthly_recurring" ? "active" : null,
      sourceRule: "Stored contract / approved service workflow billing rules",
    })
    .returning();

  await audit(input.actor, "billing_schedule.created", "billing_schedule", schedule.id, schedule);

  if (billingType === "placement_fee") {
    return { schedule, events: [] as Array<typeof billingEvents.$inferSelect> };
  }

  if (billingType === "monthly_recurring") {
    if (amount == null) {
      throw new FinanceError("Fractional monthly fee must come from the stored contract");
    }
    const event = await insertRevenuePair(input.actor, {
      companyId: input.project.companyId,
      projectId: input.project.id,
      contractId: input.contract?.id ?? null,
      serviceId: input.serviceId ?? null,
      scheduleId: schedule.id,
      source: "fractional_monthly",
      sourceMilestone: "monthly_retainer",
      triggerType: "monthly_fractional",
      amount,
      expectedDate: schedule.nextInvoiceDate ?? new Date(),
    });
    return { schedule, events: [event.billingEvent] };
  }

  const terms = input.contract
    ? await db.select().from(contractBillingTerms).where(eq(contractBillingTerms.contractId, input.contract.id))
    : [];
  if (terms.length > 0) {
    const events = [];
    for (const term of terms) {
      const termAmount = requireMoney(term.amount, `Milestone ${term.name}`);
      const triggerType =
        term.dueTrigger === "assessment_kickoff" || term.dueTrigger === "kickoff"
          ? "assessment_kickoff"
          : term.dueTrigger === "final_deliverable" || term.dueTrigger === "final"
            ? "final_deliverable"
            : term.dueTrigger === "contract_deposit"
              ? "contract_deposit"
              : "milestone_completed";
      const pair = await insertRevenuePair(input.actor, {
        companyId: input.project.companyId,
        projectId: input.project.id,
        contractId: input.contract?.id ?? null,
        serviceId: input.serviceId ?? null,
        scheduleId: schedule.id,
        source: "contract_milestone",
        sourceMilestone: term.name,
        triggerType,
        amount: termAmount,
        expectedDate: new Date(),
      });
      events.push(pair.billingEvent);
    }
    return { schedule, events };
  }

  if (amount == null) {
    return { schedule, events: [] as Array<typeof billingEvents.$inferSelect> };
  }
  const fallback = await insertRevenuePair(input.actor, {
    companyId: input.project.companyId,
    projectId: input.project.id,
    contractId: input.contract?.id ?? null,
    serviceId: input.serviceId ?? null,
    scheduleId: schedule.id,
    source: "project_start",
    sourceMilestone: "project_start",
    triggerType: "custom",
    amount,
    expectedDate: new Date(),
  });
  return { schedule, events: [fallback.billingEvent] };
}

async function insertRevenuePair(
  actor: FinanceActor,
  input: {
    companyId?: string | null;
    projectId?: string | null;
    contractId?: string | null;
    serviceId?: string | null;
    scheduleId?: string | null;
    placementId?: string | null;
    source: string;
    sourceMilestone: string;
    triggerType:
      | "candidate_start"
      | "milestone_completed"
      | "monthly_fractional"
      | "assessment_kickoff"
      | "final_deliverable"
      | "contract_deposit"
      | "custom";
    amount: number;
    expectedDate: Date;
    actualDate?: Date | null;
    status?: "scheduled" | "triggered";
  },
) {
  const db = getDb();
  const [billingEvent] = await db
    .insert(billingEvents)
    .values({
      organizationId: actor.organizationId,
      companyId: input.companyId ?? null,
      projectId: input.projectId ?? null,
      contractId: input.contractId ?? null,
      scheduleId: input.scheduleId ?? null,
      placementId: input.placementId ?? null,
      sourceMilestone: input.sourceMilestone,
      triggerType: input.triggerType,
      amount: moneyString(input.amount),
      expectedDate: input.expectedDate,
      actualDate: input.actualDate ?? null,
      status: input.status ?? "scheduled",
      sourceType: input.source,
      sourceId: input.placementId ?? input.projectId ?? null,
      notes: "Operational billing trigger. QuickBooks invoice is created only when that integration is configured.",
      triggeredAt: input.status === "triggered" ? new Date() : null,
    })
    .returning();
  const [revenueEvent] = await db
    .insert(revenueEvents)
    .values({
      organizationId: actor.organizationId,
      companyId: input.companyId ?? null,
      projectId: input.projectId ?? null,
      contractId: input.contractId ?? null,
      serviceId: input.serviceId ?? null,
      placementId: input.placementId ?? null,
      billingEventId: billingEvent.id,
      scheduleId: input.scheduleId ?? null,
      source: input.source,
      triggerType: input.triggerType,
      amount: moneyString(input.amount),
      expectedDate: input.expectedDate,
      actualDate: input.actualDate ?? null,
      status: "expected",
    })
    .returning();
  await audit(actor, "billing_event.created", "billing_event", billingEvent.id, billingEvent);
  await audit(actor, "revenue_event.created", "revenue_event", revenueEvent.id, revenueEvent);
  return { billingEvent, revenueEvent };
}

export async function recordPlacementFeeEvent(input: {
  actor: FinanceActor;
  placementId: string;
}) {
  const db = getDb();
  const [placement] = await db.select().from(placements).where(eq(placements.id, input.placementId)).limit(1);
  if (!placement) throw new FinanceError("Placement not found");
  const [search] = placement.searchProjectId
    ? await db.select().from(searchProjects).where(eq(searchProjects.id, placement.searchProjectId)).limit(1)
    : [];
  const result = calculatePlacementFee({
    startingSalary: placement.startingSalary,
    feePercent: placement.feePercent ?? search?.feePercent,
    feeAmount: search?.feeAmount,
    minimumFee: search?.minimumFee,
  });
  await db
    .update(placements)
    .set({ placementFee: moneyString(result.fee), updatedAt: new Date() })
    .where(eq(placements.id, placement.id));

  const [existing] = await db
    .select()
    .from(billingEvents)
    .where(eq(billingEvents.placementId, placement.id))
    .limit(1);
  if (existing) return { placement, ...result, billingEvent: existing };

  const pair = await insertRevenuePair(input.actor, {
    companyId: placement.companyId,
    placementId: placement.id,
    source: "placement",
    sourceMilestone: "candidate_start",
    triggerType: "candidate_start",
    amount: result.fee,
    expectedDate: placement.startDate ?? new Date(),
    actualDate: placement.startDate ?? new Date(),
    status: "triggered",
  });
  await db
    .update(placements)
    .set({ billingEventQueuedAt: new Date(), updatedAt: new Date() })
    .where(eq(placements.id, placement.id));
  return { placement, ...result, billingEvent: pair.billingEvent, revenueEvent: pair.revenueEvent };
}

export async function requestFeeOverride(input: {
  actor: FinanceActor;
  placementId: string;
  amount: string | number;
  reason: string;
}) {
  if (!roleSlugsHavePermission(input.actor.roleSlugs, "finance.write")) {
    throw new FinanceError("Missing permission: finance.write");
  }
  if (!input.reason.trim()) {
    throw new FinanceError("Fee override requires a reason, user, date, and approval");
  }
  const db = getDb();
  const [placement] = await db.select().from(placements).where(eq(placements.id, input.placementId)).limit(1);
  if (!placement) throw new FinanceError("Placement not found");
  const original = requireMoney(placement.placementFee ?? "0", "Current placement fee");
  const adjusted = requireMoney(input.amount, "Override amount");
  const [row] = await db
    .insert(financeAdjustments)
    .values({
      organizationId: input.actor.organizationId,
      companyId: placement.companyId,
      placementId: placement.id,
      adjustmentType: "fee_override",
      originalAmount: moneyString(original),
      adjustedAmount: moneyString(adjusted),
      reason: input.reason.trim(),
      status: "pending",
      requestedByUserId: input.actor.userId,
    })
    .returning();
  const approval = await requestApproval({
    organizationId: input.actor.organizationId,
    recordType: "finance_adjustment",
    recordId: row.id,
    approvalType: "fee_override",
    requestingUserId: input.actor.userId,
  });
  await db.update(financeAdjustments).set({ approvalId: approval.id, updatedAt: new Date() }).where(eq(financeAdjustments.id, row.id));
  await audit(input.actor, "fee_override.requested", "finance_adjustment", row.id, row, placement, input.reason);
  return { adjustment: row, approval };
}

export async function approveFinanceAdjustment(input: {
  actor: FinanceActor;
  adjustmentId: string;
}) {
  if (!roleSlugsHavePermission(input.actor.roleSlugs, "finance.approve")) {
    throw new FinanceError("Missing permission: finance.approve");
  }
  const db = getDb();
  const [row] = await db.select().from(financeAdjustments).where(eq(financeAdjustments.id, input.adjustmentId)).limit(1);
  if (!row) throw new FinanceError("Adjustment not found");
  if (row.status !== "pending") throw new FinanceError("Adjustment is not pending");
  if (row.adjustmentType === "fee_override") {
    assertFeeOverrideAllowed({ reason: row.reason, approved: true });
  }
  const [updated] = await db
    .update(financeAdjustments)
    .set({
      status: "approved",
      approvedByUserId: input.actor.userId,
      decidedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(financeAdjustments.id, row.id))
    .returning();
  if (updated.adjustmentType === "fee_override" && updated.placementId) {
    await db
      .update(placements)
      .set({ placementFee: updated.adjustedAmount, updatedAt: new Date() })
      .where(eq(placements.id, updated.placementId));
    await db
      .update(billingEvents)
      .set({ amount: updated.adjustedAmount, updatedAt: new Date() })
      .where(eq(billingEvents.placementId, updated.placementId));
    await db
      .update(revenueEvents)
      .set({ amount: updated.adjustedAmount, updatedAt: new Date() })
      .where(eq(revenueEvents.placementId, updated.placementId));
  }
  if (updated.adjustmentType === "write_off" && updated.invoiceId) {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, updated.invoiceId)).limit(1);
    if (invoice) {
      await db
        .update(invoices)
        .set({
          balanceDue: "0.00",
          status: "void",
          paymentStatus: "written_off",
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoice.id));
    }
  }
  await audit(input.actor, "finance_adjustment.approved", "finance_adjustment", updated.id, updated, row, row.reason);
  return updated;
}

export async function requestInvoiceAdjustment(input: {
  actor: FinanceActor;
  invoiceId: string;
  amount: string | number;
  reason: string;
  adjustmentType?: "write_off" | "invoice_adjustment" | "revenue_correction";
}) {
  if (!roleSlugsHavePermission(input.actor.roleSlugs, "invoices.write") && !roleSlugsHavePermission(input.actor.roleSlugs, "finance.write")) {
    throw new FinanceError("Missing permission: invoices.write");
  }
  if (!input.reason.trim()) throw new FinanceError("Invoice adjustment requires a reason and approval");
  const db = getDb();
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, input.invoiceId), eq(invoices.organizationId, input.actor.organizationId)))
    .limit(1);
  if (!invoice) throw new FinanceError("Invoice not found");
  const [row] = await db
    .insert(financeAdjustments)
    .values({
      organizationId: input.actor.organizationId,
      companyId: invoice.companyId,
      projectId: invoice.projectId,
      contractId: invoice.contractId,
      invoiceId: invoice.id,
      adjustmentType: input.adjustmentType ?? "invoice_adjustment",
      originalAmount: invoice.amount,
      adjustedAmount: moneyString(requireMoney(input.amount, "Adjusted amount")),
      reason: input.reason.trim(),
      status: "pending",
      requestedByUserId: input.actor.userId,
    })
    .returning();
  const approval = await requestApproval({
    organizationId: input.actor.organizationId,
    recordType: "finance_adjustment",
    recordId: row.id,
    approvalType: row.adjustmentType,
    requestingUserId: input.actor.userId,
  });
  await audit(input.actor, "invoice_adjustment.requested", "finance_adjustment", row.id, row, invoice, input.reason);
  return { adjustment: row, approval };
}

export async function changeBillingScheduleAfterExecution(input: {
  actor: FinanceActor;
  scheduleId: string;
  amount?: string | number | null;
  reason: string;
}) {
  const db = getDb();
  const [schedule] = await db
    .select()
    .from(billingSchedules)
    .where(and(eq(billingSchedules.id, input.scheduleId), eq(billingSchedules.organizationId, input.actor.organizationId)))
    .limit(1);
  if (!schedule) throw new FinanceError("Billing schedule not found");
  const [contract] = schedule.contractId
    ? await db.select().from(contracts).where(eq(contracts.id, schedule.contractId)).limit(1)
    : [];
  const approved = roleSlugsHavePermission(input.actor.roleSlugs, "finance.approve");
  assertScheduleChangeAfterExecutionAllowed({
    contractStatus: contract?.status,
    approved,
    reason: input.reason,
  });
  if (!roleSlugsHavePermission(input.actor.roleSlugs, "billing.write")) {
    throw new FinanceError("Missing permission: billing.write");
  }
  const nextAmount = input.amount != null ? moneyString(requireMoney(input.amount, "Schedule amount")) : schedule.amount;
  const [updated] = await db
    .update(billingSchedules)
    .set({ amount: nextAmount, updatedAt: new Date() })
    .where(eq(billingSchedules.id, schedule.id))
    .returning();
  await db.insert(financeAdjustments).values({
    organizationId: input.actor.organizationId,
    companyId: schedule.companyId,
    projectId: schedule.projectId,
    contractId: schedule.contractId,
    scheduleId: schedule.id,
    adjustmentType: "billing_schedule_change",
    originalAmount: schedule.amount,
    adjustedAmount: nextAmount ?? "0.00",
    reason: input.reason,
    status: "approved",
    requestedByUserId: input.actor.userId,
    approvedByUserId: input.actor.userId,
    decidedAt: new Date(),
  });
  await audit(input.actor, "billing_schedule.changed", "billing_schedule", updated.id, updated, schedule, input.reason);
  return updated;
}

export async function pauseRecurringSchedule(input: {
  actor: FinanceActor;
  scheduleId: string;
  reason: string;
  terminate?: boolean;
}) {
  const db = getDb();
  const [schedule] = await db
    .select()
    .from(billingSchedules)
    .where(and(eq(billingSchedules.id, input.scheduleId), eq(billingSchedules.organizationId, input.actor.organizationId)))
    .limit(1);
  if (!schedule) throw new FinanceError("Billing schedule not found");
  const [updated] = await db
    .update(billingSchedules)
    .set({
      status: input.terminate ? "terminated" : "paused",
      pauseReason: input.reason,
      renewalStatus: input.terminate ? "terminated" : "paused",
      updatedAt: new Date(),
    })
    .where(eq(billingSchedules.id, schedule.id))
    .returning();
  await audit(input.actor, input.terminate ? "billing_schedule.terminated" : "billing_schedule.paused", "billing_schedule", updated.id, updated, schedule, input.reason);
  return updated;
}

async function nextInvoiceNumber(organizationId: string) {
  const db = getDb();
  const year = new Date().getUTCFullYear();
  const rows = await db.select({ invoiceNumber: invoices.invoiceNumber }).from(invoices).where(eq(invoices.organizationId, organizationId));
  const prefix = `INV-${year}-`;
  const max = rows.reduce((current, row) => {
    if (!row.invoiceNumber.startsWith(prefix)) return current;
    const parsed = Number(row.invoiceNumber.slice(prefix.length));
    return Number.isFinite(parsed) ? Math.max(current, parsed) : current;
  }, 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

export async function createInvoiceFromBillingEvent(input: {
  actor: FinanceActor;
  billingEventId: string;
  issuedDate?: Date;
  dueDate?: Date;
}) {
  if (!roleSlugsHavePermission(input.actor.roleSlugs, "invoices.write") && !roleSlugsHavePermission(input.actor.roleSlugs, "finance.write")) {
    throw new FinanceError("Missing permission: invoices.write");
  }
  const db = getDb();
  const [event] = await db
    .select()
    .from(billingEvents)
    .where(and(eq(billingEvents.id, input.billingEventId), eq(billingEvents.organizationId, input.actor.organizationId)))
    .limit(1);
  if (!event) throw new FinanceError("Billing event not found");
  if (!event.companyId) throw new FinanceError("Billing event is missing a client");
  const amount = requireMoney(event.amount, "Billing event amount");
  const issued = input.issuedDate ?? new Date();
  const due = input.dueDate ?? dueDateFromIssued(issued);
  const [invoice] = await db
    .insert(invoices)
    .values({
      organizationId: input.actor.organizationId,
      companyId: event.companyId,
      contractId: event.contractId,
      projectId: event.projectId,
      scheduleId: event.scheduleId,
      billingEventId: event.id,
      invoiceNumber: await nextInvoiceNumber(input.actor.organizationId),
      amount: moneyString(amount),
      balanceDue: moneyString(amount),
      issuedDate: issued,
      dueDate: due,
      status: "ready",
      paymentStatus: "unpaid",
      ownerUserId: input.actor.userId,
      agingBucket: agingBucket(due),
    })
    .returning();
  await db
    .update(billingEvents)
    .set({ invoiceId: invoice.id, status: "invoiced", updatedAt: new Date() })
    .where(eq(billingEvents.id, event.id));
  await db
    .update(revenueEvents)
    .set({ invoiceId: invoice.id, status: "invoiced", updatedAt: new Date() })
    .where(eq(revenueEvents.billingEventId, event.id));
  if (event.scheduleId) {
    await db
      .update(billingSchedules)
      .set({ invoiceStatus: "invoiced", updatedAt: new Date() })
      .where(eq(billingSchedules.id, event.scheduleId));
  }
  await audit(input.actor, "invoice.created", "invoice", invoice.id, invoice);
  return invoice;
}

export async function setInvoiceStatus(input: {
  actor: FinanceActor;
  invoiceId: string;
  status: typeof invoices.$inferSelect.status;
  reason?: string;
}) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, input.invoiceId), eq(invoices.organizationId, input.actor.organizationId)))
    .limit(1);
  if (!before) throw new FinanceError("Invoice not found");
  const [after] = await db
    .update(invoices)
    .set({
      status: input.status,
      disputeStatus: input.status === "disputed" ? "disputed" : before.disputeStatus,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, before.id))
    .returning();
  await audit(input.actor, "invoice.status_changed", "invoice", after.id, after, before, input.reason);
  return after;
}

export async function recordPayment(input: {
  actor: FinanceActor;
  invoiceId: string;
  amount: string | number;
  paymentDate?: Date;
  externalTransactionReference?: string | null;
  methodSummary?: string | null;
  sourceSystem?: string;
}) {
  if (!roleSlugsHavePermission(input.actor.roleSlugs, "payments.write") && !roleSlugsHavePermission(input.actor.roleSlugs, "finance.write")) {
    throw new FinanceError("Missing permission: payments.write");
  }
  const db = getDb();
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, input.invoiceId), eq(invoices.organizationId, input.actor.organizationId)))
    .limit(1);
  if (!invoice) throw new FinanceError("Invoice not found");
  const paid = requireMoney(input.amount, "Payment amount");
  const currentBalance = requireMoney(invoice.balanceDue, "Invoice balance");
  const nextBalance = Math.max(0, subtractMoney(currentBalance, paid));
  const [payment] = await db
    .insert(payments)
    .values({
      organizationId: input.actor.organizationId,
      invoiceId: invoice.id,
      amount: moneyString(paid),
      paymentDate: input.paymentDate ?? new Date(),
      externalTransactionReference: input.externalTransactionReference ?? null,
      methodSummary: input.methodSummary ?? null,
      sourceSystem: input.sourceSystem ?? "workforceos",
      reconciliationStatus: "matched",
    })
    .returning();
  const status =
    nextBalance <= 0 ? "paid" : paid > 0 && nextBalance < requireMoney(invoice.amount, "Invoice amount") ? "partially_paid" : invoice.status;
  const overdue = isInvoiceOverdue({ status, dueDate: invoice.dueDate, balanceDue: nextBalance });
  const [updated] = await db
    .update(invoices)
    .set({
      balanceDue: moneyString(nextBalance),
      status: overdue && status !== "paid" ? "overdue" : status,
      paymentStatus: nextBalance <= 0 ? "paid" : "partial",
      agingBucket: agingBucket(invoice.dueDate),
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoice.id))
    .returning();
  await audit(input.actor, "payment.recorded", "payment", payment.id, payment, invoice);
  await audit(input.actor, "invoice.payment_status_changed", "invoice", updated.id, updated, invoice);
  return { payment, invoice: updated };
}

export async function recordCostEntry(input: {
  actor: FinanceActor;
  projectId?: string | null;
  companyId?: string | null;
  contractId?: string | null;
  category: string;
  amount: string | number;
  incurredDate?: Date;
  notes?: string | null;
}) {
  const db = getDb();
  const [row] = await db
    .insert(financeCostEntries)
    .values({
      organizationId: input.actor.organizationId,
      companyId: input.companyId ?? null,
      projectId: input.projectId ?? null,
      contractId: input.contractId ?? null,
      category: input.category,
      amount: moneyString(requireMoney(input.amount, "Cost amount")),
      incurredDate: input.incurredDate ?? new Date(),
      notes: input.notes ?? null,
      enteredByUserId: input.actor.userId,
    })
    .returning();
  await audit(input.actor, "finance_cost.recorded", "finance_cost_entry", row.id, row);
  return row;
}

export function refreshInvoiceAging<T extends { dueDate: Date | null; status: string; balanceDue: string }>(row: T, asOf = new Date()) {
  const balance = parseMoney(row.balanceDue) ?? 0;
  const overdue = isInvoiceOverdue({ status: row.status, dueDate: row.dueDate, balanceDue: balance, asOf });
  return {
    agingBucket: agingBucket(row.dueDate, asOf) as AgingBucket | null,
    daysOutstanding: row.dueDate ? Math.max(0, daysPastDue(row.dueDate, asOf)) : 0,
    overdue,
  };
}

export async function listInvoices(organizationId: string, companyId?: string) {
  const db = getDb();
  const rows = await db
    .select({ invoice: invoices, companyName: companies.name, projectName: projects.name })
    .from(invoices)
    .leftJoin(companies, eq(invoices.companyId, companies.id))
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .where(
      companyId
        ? and(eq(invoices.organizationId, organizationId), eq(invoices.companyId, companyId))
        : eq(invoices.organizationId, organizationId),
    )
    .orderBy(desc(invoices.createdAt));
  return rows.map((row) => ({ ...row, aging: refreshInvoiceAging(row.invoice) }));
}

export async function listPayments(organizationId: string) {
  const db = getDb();
  return db
    .select({ payment: payments, invoiceNumber: invoices.invoiceNumber, companyName: companies.name })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .leftJoin(companies, eq(invoices.companyId, companies.id))
    .where(eq(payments.organizationId, organizationId))
    .orderBy(desc(payments.createdAt));
}

export async function listBillingSchedules(organizationId: string) {
  const db = getDb();
  return db
    .select({
      schedule: billingSchedules,
      companyName: companies.name,
      projectName: projects.name,
      serviceName: services.name,
    })
    .from(billingSchedules)
    .leftJoin(companies, eq(billingSchedules.companyId, companies.id))
    .leftJoin(projects, eq(billingSchedules.projectId, projects.id))
    .leftJoin(services, eq(billingSchedules.serviceId, services.id))
    .where(eq(billingSchedules.organizationId, organizationId))
    .orderBy(desc(billingSchedules.createdAt));
}

export async function listRevenueEvents(organizationId: string) {
  const db = getDb();
  return db
    .select({
      event: revenueEvents,
      companyName: companies.name,
      projectName: projects.name,
    })
    .from(revenueEvents)
    .leftJoin(companies, eq(revenueEvents.companyId, companies.id))
    .leftJoin(projects, eq(revenueEvents.projectId, projects.id))
    .where(eq(revenueEvents.organizationId, organizationId))
    .orderBy(desc(revenueEvents.createdAt));
}

export async function accountsReceivableView(organizationId: string, companyId?: string) {
  const rows = await listInvoices(organizationId, companyId);
  return rows
    .filter((row) => !["paid", "void"].includes(row.invoice.status) && (parseMoney(row.invoice.balanceDue) ?? 0) > 0)
    .map((row) => ({
      ...row,
      daysOutstanding: row.aging.daysOutstanding,
      agingBucket: row.aging.agingBucket,
      ownerUserId: row.invoice.ownerUserId,
      nextAction: row.invoice.nextAction,
      disputeStatus: row.invoice.disputeStatus,
    }));
}

export async function engagementEconomics(organizationId: string, projectId?: string, companyId?: string) {
  const db = getDb();
  const conditions = [eq(projects.organizationId, organizationId)];
  if (projectId) conditions.push(eq(projects.id, projectId));
  if (companyId) conditions.push(eq(projects.companyId, companyId));
  const projectRows = await db
    .select()
    .from(projects)
    .where(and(...conditions));
  const results = [];
  for (const project of projectRows) {
    const [contract] = project.contractId
      ? await db.select().from(contracts).where(eq(contracts.id, project.contractId)).limit(1)
      : [];
    const invoiceRows = await db.select().from(invoices).where(eq(invoices.projectId, project.id));
    const paymentRows = await db
      .select({ payment: payments })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(eq(invoices.projectId, project.id));
    const costRows = await db.select().from(financeCostEntries).where(eq(financeCostEntries.projectId, project.id));
    const revenueRows = await db.select().from(revenueEvents).where(eq(revenueEvents.projectId, project.id));
    const writeOffs = await db
      .select()
      .from(financeAdjustments)
      .where(and(eq(financeAdjustments.projectId, project.id), eq(financeAdjustments.adjustmentType, "write_off"), eq(financeAdjustments.status, "approved")));
    const contractValue = parseMoney(contract?.contractValue) ?? 0;
    const expectedRevenue = revenueRows.reduce((sum, row) => addMoney(sum, parseMoney(row.amount) ?? 0), 0);
    const invoiced = invoiceRows.reduce((sum, row) => addMoney(sum, parseMoney(row.amount) ?? 0), 0);
    const collected = paymentRows.reduce((sum, row) => addMoney(sum, parseMoney(row.payment.amount) ?? 0), 0);
    const costs = costRows.reduce((sum, row) => addMoney(sum, parseMoney(row.amount) ?? 0), 0);
    const writeOffTotal = writeOffs.reduce((sum, row) => addMoney(sum, parseMoney(row.adjustedAmount) ?? 0), 0);
    const grossMargin = subtractMoney(collected, costs);
    results.push({
      project,
      contractValue,
      expectedRevenue,
      invoiced,
      collected,
      directDeliveryCosts: costs,
      writeOffs: writeOffTotal,
      grossMarginEstimate: grossMargin,
      projectMargin: expectedRevenue > 0 ? grossMargin / expectedRevenue : null,
    });
  }
  return results;
}

export async function companyFinanceSnapshot(organizationId: string, companyId: string) {
  const db = getDb();
  const contractRows = await db
    .select()
    .from(contracts)
    .where(and(eq(contracts.organizationId, organizationId), eq(contracts.companyId, companyId)));
  const invoiceRows = await listInvoices(organizationId, companyId);
  const scheduleRows = await db
    .select()
    .from(billingSchedules)
    .where(and(eq(billingSchedules.organizationId, organizationId), eq(billingSchedules.companyId, companyId)));
  const revenueRows = await db
    .select({ event: revenueEvents, serviceName: services.name })
    .from(revenueEvents)
    .leftJoin(services, eq(revenueEvents.serviceId, services.id))
    .where(and(eq(revenueEvents.organizationId, organizationId), eq(revenueEvents.companyId, companyId)));
  const contractValue = contractRows.reduce((sum, row) => addMoney(sum, parseMoney(row.contractValue) ?? 0), 0);
  const invoiced = invoiceRows.reduce((sum, row) => addMoney(sum, parseMoney(row.invoice.amount) ?? 0), 0);
  const collected = invoiceRows.reduce((sum, row) => {
    const amount = parseMoney(row.invoice.amount) ?? 0;
    const balance = parseMoney(row.invoice.balanceDue) ?? 0;
    return addMoney(sum, subtractMoney(amount, balance));
  }, 0);
  const ar = invoiceRows.reduce((sum, row) => {
    if (["paid", "void"].includes(row.invoice.status)) return sum;
    return addMoney(sum, parseMoney(row.invoice.balanceDue) ?? 0);
  }, 0);
  const byService = new Map<string, number>();
  for (const row of revenueRows) {
    const key = row.serviceName ?? "Unassigned";
    byService.set(key, addMoney(byService.get(key) ?? 0, parseMoney(row.event.amount) ?? 0));
  }
  return {
    contractValue,
    invoiced,
    collected,
    ar,
    activeSchedules: scheduleRows.filter((row) => row.status === "active"),
    revenueByService: [...byService.entries()].map(([service, amount]) => ({ service, amount })),
    invoices: invoiceRows,
  };
}

export async function financeOverview(organizationId: string) {
  const db = getDb();
  const [contractRows, invoiceRows, scheduleRows, revenueRows, eventRows] = await Promise.all([
    db.select().from(contracts).where(eq(contracts.organizationId, organizationId)),
    listInvoices(organizationId),
    db.select().from(billingSchedules).where(eq(billingSchedules.organizationId, organizationId)),
    db.select().from(revenueEvents).where(eq(revenueEvents.organizationId, organizationId)),
    db.select().from(billingEvents).where(eq(billingEvents.organizationId, organizationId)),
  ]);
  const contracted = contractRows.reduce((sum, row) => addMoney(sum, parseMoney(row.contractValue) ?? 0), 0);
  const invoiced = invoiceRows.reduce((sum, row) => addMoney(sum, parseMoney(row.invoice.amount) ?? 0), 0);
  const collected = invoiceRows.reduce((sum, row) => {
    const amount = parseMoney(row.invoice.amount) ?? 0;
    const balance = parseMoney(row.invoice.balanceDue) ?? 0;
    return addMoney(sum, subtractMoney(amount, balance));
  }, 0);
  const outstanding = invoiceRows.reduce((sum, row) => {
    if (["paid", "void"].includes(row.invoice.status)) return sum;
    return addMoney(sum, parseMoney(row.invoice.balanceDue) ?? 0);
  }, 0);
  const recurring = scheduleRows
    .filter((row) => row.billingType === "monthly_recurring" && row.status === "active")
    .reduce((sum, row) => addMoney(sum, parseMoney(row.amount) ?? 0), 0);
  const placementExpected = revenueRows
    .filter((row) => row.triggerType === "candidate_start" && row.status !== "cancelled")
    .reduce((sum, row) => addMoney(sum, parseMoney(row.amount) ?? 0), 0);
  const upcoming = eventRows.filter((row) => ["scheduled", "triggered"].includes(row.status));
  const overdue = invoiceRows.filter((row) => row.aging.overdue || row.invoice.status === "overdue");
  const byService = new Map<string, number>();
  const byClient = new Map<string, number>();
  for (const row of invoiceRows) {
    byClient.set(row.companyName ?? "Unknown", addMoney(byClient.get(row.companyName ?? "Unknown") ?? 0, parseMoney(row.invoice.amount) ?? 0));
  }
  const revenueWithService = await db
    .select({ amount: revenueEvents.amount, serviceName: services.name })
    .from(revenueEvents)
    .leftJoin(services, eq(revenueEvents.serviceId, services.id))
    .where(eq(revenueEvents.organizationId, organizationId));
  for (const row of revenueWithService) {
    const key = row.serviceName ?? "Unassigned";
    byService.set(key, addMoney(byService.get(key) ?? 0, parseMoney(row.amount) ?? 0));
  }
  const economics = await engagementEconomics(organizationId);
  return {
    contractedRevenue: contracted,
    invoicedRevenue: invoiced,
    collectedRevenue: collected,
    outstandingAr: outstanding,
    recurringMonthlyRevenue: recurring,
    placementFeesExpected: placementExpected,
    upcomingBillingEvents: upcoming,
    overdueInvoices: overdue,
    revenueByService: [...byService.entries()].map(([service, amount]) => ({ service, amount })),
    revenueByClient: [...byClient.entries()].map(([client, amount]) => ({ client, amount })),
    projectEconomics: economics,
  };
}

export async function financeCommandSnapshot(organizationId: string) {
  const db = getDb();
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [overdueRows, upcomingRows, recurringRows, placementRows, failedRows] = await Promise.all([
    db
      .select({ value: count() })
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, organizationId),
          or(eq(invoices.status, "overdue"), and(notInArray(invoices.status, ["paid", "void", "draft"]), lte(invoices.dueDate, now))),
        ),
      ),
    db
      .select({ value: count() })
      .from(billingEvents)
      .where(
        and(
          eq(billingEvents.organizationId, organizationId),
          inArray(billingEvents.status, ["scheduled", "triggered"]),
          lte(billingEvents.expectedDate, soon),
        ),
      ),
    db
      .select({ value: sql<string>`coalesce(sum(${billingSchedules.amount}), 0)` })
      .from(billingSchedules)
      .where(
        and(
          eq(billingSchedules.organizationId, organizationId),
          eq(billingSchedules.billingType, "monthly_recurring"),
          eq(billingSchedules.status, "active"),
        ),
      ),
    db
      .select({ value: sql<string>`coalesce(sum(${revenueEvents.amount}), 0)` })
      .from(revenueEvents)
      .where(
        and(
          eq(revenueEvents.organizationId, organizationId),
          eq(revenueEvents.triggerType, "candidate_start"),
          notInArray(revenueEvents.status, ["cancelled"]),
        ),
      ),
    db
      .select({ value: count() })
      .from(integrationEvents)
      .where(
        and(
          eq(integrationEvents.organizationId, organizationId),
          or(eq(integrationEvents.deadLetter, true), inArray(integrationEvents.status, ["failed", "error"])),
        ),
      ),
  ]);
  return {
    overdueAr: Number(overdueRows[0]?.value ?? 0),
    upcomingInvoices: Number(upcomingRows[0]?.value ?? 0),
    monthlyRecurringRevenue: parseMoney(recurringRows[0]?.value) ?? 0,
    upcomingPlacementFees: parseMoney(placementRows[0]?.value) ?? 0,
    failedIntegrationSyncs: Number(failedRows[0]?.value ?? 0),
  };
}
