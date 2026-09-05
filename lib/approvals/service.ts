import { eq } from "drizzle-orm";

import { getDb } from "../../db";
import { agentOutputs, approvals } from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";

export class ApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalError";
  }
}

type RequestApprovalInput = {
  organizationId: string;
  recordType: string;
  recordId: string;
  approvalType: string;
  requestingUserId?: string | null;
  requestingAgentId?: string | null;
  assignedReviewerUserId?: string | null;
};

export async function requestApproval(input: RequestApprovalInput) {
  const db = getDb();
  const [approval] = await db
    .insert(approvals)
    .values({
      organizationId: input.organizationId,
      recordType: input.recordType,
      recordId: input.recordId,
      approvalType: input.approvalType,
      requestingUserId: input.requestingUserId ?? null,
      requestingAgentId: input.requestingAgentId ?? null,
      assignedReviewerUserId: input.assignedReviewerUserId ?? null,
      status: "pending",
    })
    .returning();

  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: {
      type: input.requestingAgentId ? "agent" : "human",
      userId: input.requestingUserId,
      agentId: input.requestingAgentId,
    },
    action: "approval.requested",
    recordType: "approval",
    recordId: approval.id,
    after: approval,
  });

  return approval;
}

async function decide(options: {
  approvalId: string;
  reviewerUserId: string;
  status: "approved" | "rejected" | "changes_requested";
  notes?: string;
}) {
  if (!options.reviewerUserId) {
    throw new ApprovalError("A human reviewer is required");
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, options.approvalId))
    .limit(1);
  if (!existing) throw new ApprovalError("Approval not found");
  if (existing.status !== "pending") {
    throw new ApprovalError("Approval is not pending");
  }

  if (existing.requestingAgentId && existing.requestingUserId === options.reviewerUserId) {
    const [linkedOutput] = await db
      .select()
      .from(agentOutputs)
      .where(eq(agentOutputs.approvalId, existing.id))
      .limit(1);
    if (linkedOutput) {
      throw new ApprovalError("Agents cannot approve their own material output");
    }
  }

  const [updated] = await db
    .update(approvals)
    .set({
      status: options.status,
      assignedReviewerUserId: options.reviewerUserId,
      decisionNotes: options.notes,
      decidedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(approvals.id, options.approvalId))
    .returning();

  await recordAuditEvent({
    organizationId: existing.organizationId,
    actor: { type: "human", userId: options.reviewerUserId },
    action: `approval.${options.status}`,
    recordType: "approval",
    recordId: existing.id,
    before: existing,
    after: updated,
    reason: options.notes,
  });

  return updated;
}

export async function approveRequest(approvalId: string, reviewerUserId: string, notes?: string) {
  return decide({ approvalId, reviewerUserId, status: "approved", notes });
}

export async function rejectRequest(approvalId: string, reviewerUserId: string, notes?: string) {
  return decide({ approvalId, reviewerUserId, status: "rejected", notes });
}

export async function requestChanges(approvalId: string, reviewerUserId: string, notes?: string) {
  return decide({
    approvalId,
    reviewerUserId,
    status: "changes_requested",
    notes,
  });
}

export function assertAgentCannotSelfApprove(params: {
  requestingAgentId?: string | null;
  decidingActorType: "human" | "agent" | "system";
  decidingAgentId?: string | null;
}) {
  if (
    params.requestingAgentId &&
    params.decidingActorType === "agent" &&
    params.decidingAgentId === params.requestingAgentId
  ) {
    throw new ApprovalError("Agents cannot approve their own material output");
  }
}
