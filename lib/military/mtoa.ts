export const MTOA_SERVICE_CODE = "military-talent-opportunity-assessment";

export function mappingIsClientFacingDraft(status: string) {
  return status === "draft" || status === "in_review";
}

export function canCreateDeliveryProject(planStatus: string) {
  return planStatus === "approved";
}

export function originatingAgentCannotApprove(actorType: "human" | "agent" | "system") {
  return actorType !== "human";
}
