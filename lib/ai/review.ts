import { desc, eq } from "drizzle-orm";

import { getDb } from "../../db";
import { agentOutputs, agentRuns, agents, approvals } from "../../db/schema";
import {
  ApprovalError,
  approveRequest,
  assertAgentCannotSelfApprove,
  rejectRequest,
  requestChanges,
} from "../approvals/service";
import { recordAuditEvent } from "../audit/record-audit-event";
import { AuthorizationError, can, type Permission, type Principal } from "../rbac/permissions";
import type { ReviewCategory } from "./registry";

export { assertAgentCannotSelfApprove, ApprovalError };

/** Domain approve permission required to decide a Review Queue item (DEC-AI-012). */
export const REVIEW_DECIDE_PERMISSIONS: Record<ReviewCategory, Permission> = {
  candidate_submission: "submissions.approve",
  ai_candidate_rejection: "submissions.approve",
  military_mapping: "military.review",
  workforce_recommendation: "workforce.approve",
  solution_plan: "solutions.approve",
  proposal: "proposals.approve",
  pricing: "pricing.approve",
  contract_legal_language: "contracts.approve",
  client_deliverable: "deliverables.approve",
  invoice_adjustment: "finance.approve",
};

export function reviewDecidePermission(category: string | null | undefined): Permission | null {
  if (!category) return null;
  return REVIEW_DECIDE_PERMISSIONS[category as ReviewCategory] ?? null;
}

export function canDecideReview(
  principal: Pick<Principal, "status" | "permissions">,
  category: string | null | undefined,
): boolean {
  const needed = reviewDecidePermission(category);
  if (!needed) return false;
  return can(principal as Principal, "agents.read") && can(principal as Principal, needed);
}

export function assertCanDecideReview(
  principal: Pick<Principal, "status" | "permissions">,
  category: string | null | undefined,
) {
  if (!can(principal as Principal, "agents.read")) {
    throw new AuthorizationError("Missing permission: agents.read");
  }
  const needed = reviewDecidePermission(category);
  if (!needed) {
    throw new AuthorizationError(
      "This review item has no mapped domain approve permission. A human with the matching domain approve permission must decide.",
    );
  }
  if (!can(principal as Principal, needed)) {
    throw new AuthorizationError(`Missing permission: ${needed}`);
  }
}

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
      run: agentRuns,
    })
    .from(agentOutputs)
    .innerJoin(agents, eq(agentOutputs.agentId, agents.id))
    .leftJoin(approvals, eq(agentOutputs.approvalId, approvals.id))
    .leftJoin(agentRuns, eq(agentOutputs.agentRunId, agentRuns.id))
    .where(eq(agentOutputs.organizationId, organizationId))
    .orderBy(desc(agentOutputs.createdAt));
  return rows
    .filter((row) => {
      if (row.output.status !== "pending_review" && row.approval?.status !== "pending") return false;
      if (category && row.output.reviewCategory !== category) return false;
      return true;
    })
    .map(({ run, ...row }) => ({
      ...row,
      usedFallback: Boolean(run && (run.provider === "gemini" || run.retryCount > 0)),
    }));
}

export async function decideReviewItem(input: {
  organizationId: string;
  reviewerUserId: string;
  outputId: string;
  decision: "approved" | "rejected" | "changes_requested";
  notes?: string;
  actorType?: "human" | "agent" | "system";
  decidingAgentId?: string | null;
  reviewer?: Pick<Principal, "status" | "permissions">;
}) {
  const db = getDb();
  const [output] = await db.select().from(agentOutputs).where(eq(agentOutputs.id, input.outputId)).limit(1);
  if (!output) throw new ApprovalError("Agent output not found");
  if (input.actorType && input.actorType !== "human") {
    throw new ApprovalError("Only a human can approve material agent output");
  }
  if (!input.reviewer) {
    throw new AuthorizationError("Reviewer principal is required to decide a Review Queue item");
  }
  assertCanDecideReview(input.reviewer, output.reviewCategory);
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
