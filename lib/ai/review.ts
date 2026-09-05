import { desc, eq } from "drizzle-orm";

import { getDb } from "../../db";
import { agentOutputs, agents, approvals } from "../../db/schema";
import {
  ApprovalError,
  approveRequest,
  assertAgentCannotSelfApprove,
  rejectRequest,
  requestChanges,
} from "../approvals/service";
import { recordAuditEvent } from "../audit/record-audit-event";

export { assertAgentCannotSelfApprove, ApprovalError };

export const REVIEW_CATEGORIES = [
  "candidate_submission",
  "ai_candidate_rejection",
  "military_mapping",
  "workforce_recommendation",
  "solution_plan",
  "proposal",
  "pricing",
  "contract_legal_language",
  "client_deliverable",
  "invoice_adjustment",
] as const;

export async function listReviewQueue(organizationId: string, category?: string) {
  const db = getDb();
  const rows = await db
    .select({
      output: agentOutputs,
      approval: approvals,
      agent: agents,
    })
    .from(agentOutputs)
    .innerJoin(agents, eq(agentOutputs.agentId, agents.id))
    .leftJoin(approvals, eq(agentOutputs.approvalId, approvals.id))
    .where(eq(agentOutputs.organizationId, organizationId))
    .orderBy(desc(agentOutputs.createdAt));
  return rows.filter((row) => {
    if (row.output.status !== "pending_review" && row.approval?.status !== "pending") return false;
    if (category && row.output.reviewCategory !== category) return false;
    return true;
  });
}

export async function decideReviewItem(input: {
  organizationId: string;
  reviewerUserId: string;
  outputId: string;
  decision: "approved" | "rejected" | "changes_requested";
  notes?: string;
  actorType?: "human" | "agent" | "system";
  decidingAgentId?: string | null;
}) {
  const db = getDb();
  const [output] = await db.select().from(agentOutputs).where(eq(agentOutputs.id, input.outputId)).limit(1);
  if (!output) throw new ApprovalError("Agent output not found");
  if (input.actorType && input.actorType !== "human") {
    throw new ApprovalError("Only a human can approve material agent output");
  }
  if (output.agentId) {
    assertAgentCannotSelfApprove({
      requestingAgentId: output.agentId,
      decidingActorType: input.actorType ?? "human",
      decidingAgentId: input.decidingAgentId,
    });
  }
  if (!output.approvalId) throw new ApprovalError("This output is not in the review queue");
  const [approval] = await db.select().from(approvals).where(eq(approvals.id, output.approvalId)).limit(1);
  if (approval?.requestingAgentId) {
    assertAgentCannotSelfApprove({
      requestingAgentId: approval.requestingAgentId,
      decidingActorType: input.actorType ?? "human",
      decidingAgentId: input.decidingAgentId,
    });
  }
  const updated =
    input.decision === "approved"
      ? await approveRequest(output.approvalId, input.reviewerUserId, input.notes)
      : input.decision === "rejected"
        ? await rejectRequest(output.approvalId, input.reviewerUserId, input.notes)
        : await requestChanges(output.approvalId, input.reviewerUserId, input.notes);
  const [after] = await db
    .update(agentOutputs)
    .set({
      status:
        input.decision === "approved"
          ? "approved"
          : input.decision === "rejected"
            ? "rejected"
            : "changes_requested",
    })
    .where(eq(agentOutputs.id, output.id))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.reviewerUserId },
    action: `agent_output.${input.decision}`,
    recordType: "agent_output",
    recordId: output.id,
    reason: input.notes,
    after: { status: after.status },
  });
  return { output: after, approval: updated };
}
