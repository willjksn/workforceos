export class DeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeliveryError";
  }
}

export function assertApprovedVersionImmutable(reviewStatus: string) {
  if (reviewStatus === "approved") {
    throw new DeliveryError(
      "Approved service versions cannot be overwritten. Create a new version.",
    );
  }
}

export function canCreateProjectFromPlan(planStatus: string) {
  return planStatus === "approved";
}

export function contractAllowsProjectCreation(contractStatus: string | null | undefined) {
  return contractStatus === "executed";
}

export function canOverrideContractGate(roleSlugs: readonly string[]) {
  return roleSlugs.includes("managing-partner");
}

export function assertProjectCreationAllowed(input: {
  planStatus: string;
  contractStatus?: string | null;
  overrideReason?: string | null;
  roleSlugs?: readonly string[];
}) {
  if (!canCreateProjectFromPlan(input.planStatus)) {
    throw new DeliveryError("Project creation requires an approved solution plan");
  }
  if (contractAllowsProjectCreation(input.contractStatus)) return;
  if (input.overrideReason?.trim() && input.roleSlugs && canOverrideContractGate(input.roleSlugs)) {
    return;
  }
  throw new DeliveryError(
    "Project creation requires an executed contract unless a Managing Partner override is recorded",
  );
}

export function canSubmitProposalForReview(status: string) {
  return status === "draft";
}

export function assertCanSubmitProposalForReview(status: string) {
  if (!canSubmitProposalForReview(status)) {
    throw new DeliveryError("Only a draft proposal can be submitted for internal review");
  }
}

export function canApproveProposal(status: string) {
  return status === "internal_review";
}

export function assertCanApproveProposal(status: string) {
  if (!canApproveProposal(status)) {
    throw new DeliveryError("Proposal must be in internal review before it can be approved");
  }
}

export function canSendProposal(status: string) {
  return status === "approved";
}

export function assertCanSendProposal(status: string) {
  if (!canSendProposal(status)) {
    throw new DeliveryError("Proposal must be human-approved before it can be sent");
  }
}

export function sentProposalIsImmutable(status: string) {
  return ["sent", "viewed", "accepted", "declined", "expired", "superseded"].includes(status);
}

export function assertProposalVersionMutable(status: string) {
  if (sentProposalIsImmutable(status)) {
    throw new DeliveryError("Sent proposals cannot be overwritten. Create a new version.");
  }
}

export function canDeliverClientFacing(input: {
  clientFacing: boolean;
  status: string;
  approvedAt?: Date | null;
}) {
  if (!input.clientFacing) return true;
  return input.status === "approved" || Boolean(input.approvedAt);
}

export function assertCanDeliverClientFacing(input: {
  clientFacing: boolean;
  status: string;
  approvedAt?: Date | null;
}) {
  if (!canDeliverClientFacing(input)) {
    throw new DeliveryError("Client-facing deliverables require human approval before delivery");
  }
}

export function closeoutBlocked(input: {
  requiredDeliverablesIncomplete: boolean;
  approvalsIncomplete: boolean;
  overrideReason?: string | null;
  roleSlugs?: readonly string[];
}) {
  if (!input.requiredDeliverablesIncomplete && !input.approvalsIncomplete) return false;
  if (input.overrideReason?.trim() && input.roleSlugs && canOverrideContractGate(input.roleSlugs)) {
    return false;
  }
  return true;
}

export function assertCloseoutAllowed(input: {
  requiredDeliverablesIncomplete: boolean;
  approvalsIncomplete: boolean;
  overrideReason?: string | null;
  roleSlugs?: readonly string[];
}) {
  if (closeoutBlocked(input)) {
    throw new DeliveryError(
      "Project closeout requires required deliverables and approvals to be complete unless a Managing Partner override is recorded",
    );
  }
}

export function projectHealthFromRisks(
  openMaterialRisks: Array<{ severity: string; status: string }>,
) {
  const blocking = openMaterialRisks.filter(
    (risk) =>
      risk.status === "open" &&
      (risk.severity === "high" || risk.severity === "critical"),
  );
  return blocking.length > 0 ? "at_risk" : "healthy";
}

export function shouldMarkProjectAtRisk(health: string, currentStatus: string) {
  return health === "at_risk" && currentStatus === "active";
}
