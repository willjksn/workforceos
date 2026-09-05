export class WorkforceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkforceError";
  }
}

export const DELIVERED_ASSESSMENT_STATUSES = ["delivered", "completed", "superseded"] as const;

export function assertAssessmentMutable(status: string) {
  if (status === "delivered" || status === "completed") {
    throw new WorkforceError("Delivered assessments cannot be overwritten. Create a new version.");
  }
  if (status === "superseded") {
    throw new WorkforceError("Superseded assessments cannot be edited.");
  }
}

export function assertHumanApprovalActor(actorType: "human" | "agent" | "system") {
  if (actorType !== "human") {
    throw new WorkforceError("Human approval is required for client-facing workforce recommendations");
  }
}
