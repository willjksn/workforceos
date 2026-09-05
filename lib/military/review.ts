import { originatingAgentCannotApprove } from "./mtoa";

export type MappingReviewStatus = "pending" | "approved" | "rejected" | "needs_review";

export function initialReviewStatus(input: {
  origin: "reference_data" | "human" | "agent" | "import" | "system";
  trustedReference?: boolean;
}): MappingReviewStatus {
  if (input.origin === "agent") return "pending";
  if (input.origin === "system" && !input.trustedReference) return "pending";
  if (input.origin === "import" && !input.trustedReference) return "needs_review";
  return "approved";
}

export function canDecideMappingReview(input: {
  actorType: "human" | "agent" | "system";
  originatingAgentId?: string | null;
  reviewerUserId?: string | null;
}) {
  if (originatingAgentCannotApprove(input.actorType)) return false;
  if (!input.reviewerUserId) return false;
  return true;
}

export function assertHumanMappingReview(input: {
  actorType: "human" | "agent" | "system";
  originatingAgentId?: string | null;
  reviewerUserId?: string | null;
  nextStatus: MappingReviewStatus;
}) {
  if (input.nextStatus === "pending" || input.nextStatus === "needs_review") return;
  if (!canDecideMappingReview(input)) {
    throw new Error("AI or system actors cannot approve their own military mappings");
  }
}
