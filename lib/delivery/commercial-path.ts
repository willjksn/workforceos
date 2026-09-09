export const COMMERCIAL_PATH_STEPS = [
  { id: "company", label: "Company" },
  { id: "opportunity", label: "Opportunity" },
  { id: "discovery", label: "Discovery" },
  { id: "solution", label: "Solution / Service Plan" },
  { id: "build_proposal", label: "Build Proposal" },
  { id: "draft", label: "Draft" },
  { id: "internal_approval", label: "Internal Approval" },
  { id: "send_client", label: "Send Client" },
  { id: "accepted", label: "Accepted" },
  { id: "contract", label: "Contract / SOW" },
  { id: "project", label: "Project" },
  { id: "delivery", label: "Delivery" },
] as const;

export type CommercialPathStepId = (typeof COMMERCIAL_PATH_STEPS)[number]["id"];

export const IN_FLIGHT_PROPOSAL_STATUSES = ["draft", "internal_review", "approved", "sent", "viewed"] as const;

export type CommercialPathRecord = {
  discoveries: Array<{ id: string; title: string; status: string }>;
  plans: Array<{ id: string; title: string; status: string }>;
  proposals: Array<{ id: string; title: string; status: string }>;
  contracts: Array<{ id: string; title: string; status: string; solutionPlanId: string | null }>;
  projects: Array<{ id: string; name: string; status: string }>;
};

export type CommercialPrimaryCta =
  | { kind: "link"; label: string; href: string }
  | { kind: "build_proposal"; label: string; planId: string }
  | { kind: "create_contract"; label: string; planId: string; proposalId: string }
  | { kind: "create_project"; label: string; planId: string; contractId: string }
  | { kind: "none"; hint: string };

const COMMERCIAL_PATH_SUMMARY = COMMERCIAL_PATH_STEPS.map((step) => step.label).join(" → ");

export function commercialPathSummary() {
  return COMMERCIAL_PATH_SUMMARY;
}

export function latestRow<T>(rows: T[]): T | undefined {
  return rows[0];
}

export function approvedPlan(path: Pick<CommercialPathRecord, "plans">) {
  return path.plans.find((plan) => plan.status === "approved");
}

export function inFlightProposal(path: Pick<CommercialPathRecord, "proposals">) {
  return path.proposals.find((proposal) =>
    (IN_FLIGHT_PROPOSAL_STATUSES as readonly string[]).includes(proposal.status),
  );
}

export function acceptedProposal(path: Pick<CommercialPathRecord, "proposals">) {
  return path.proposals.find((proposal) => proposal.status === "accepted");
}

export function currentCommercialStepId(path: CommercialPathRecord): CommercialPathStepId {
  const discovery = latestRow(path.discoveries);
  const plan = approvedPlan(path) ?? latestRow(path.plans);
  const proposal = acceptedProposal(path) ?? inFlightProposal(path) ?? latestRow(path.proposals);
  const contract = latestRow(path.contracts);
  const project = latestRow(path.projects);

  if (project) return project.status === "planned" || project.status === "active" ? "project" : "delivery";
  if (contract) return "contract";
  if (proposal?.status === "accepted") return "accepted";
  if (proposal?.status === "sent" || proposal?.status === "viewed") return "send_client";
  if (proposal?.status === "approved") return "send_client";
  if (proposal?.status === "internal_review") return "internal_approval";
  if (proposal?.status === "draft") return "draft";
  if (plan?.status === "approved") return "build_proposal";
  if (plan) return "solution";
  if (discovery) return "discovery";
  return "opportunity";
}

export function currentCommercialStepIndex(path: CommercialPathRecord) {
  const id = currentCommercialStepId(path);
  return COMMERCIAL_PATH_STEPS.findIndex((step) => step.id === id);
}

export function resolveCommercialPrimaryCta(
  path: CommercialPathRecord,
  opportunityId: string,
): CommercialPrimaryCta {
  const discovery = latestRow(path.discoveries);
  const plan = latestRow(path.plans);
  const approved = approvedPlan(path);
  const inflight = inFlightProposal(path);
  const accepted = acceptedProposal(path);
  const contract = latestRow(path.contracts);
  const project = latestRow(path.projects);

  if (!discovery) {
    return {
      kind: "link",
      label: "Start discovery",
      href: `/app/discovery?opportunityId=${opportunityId}`,
    };
  }
  if (discovery.status !== "approved") {
    return { kind: "link", label: "Continue discovery", href: `/app/discovery/${discovery.id}` };
  }
  if (!plan) {
    return { kind: "link", label: "Create solution plan", href: `/app/discovery/${discovery.id}` };
  }
  if (plan.status !== "approved") {
    return { kind: "link", label: "Open solution plan", href: `/app/solutions/${plan.id}` };
  }
  if (!inflight && !accepted && approved) {
    return { kind: "build_proposal", label: "Build proposal", planId: approved.id };
  }
  if (inflight) {
    const labels: Record<string, string> = {
      draft: "Open draft proposal",
      internal_review: "Open for internal approval",
      approved: "Send to client",
      sent: "Open sent proposal",
      viewed: "Open sent proposal",
    };
    return {
      kind: "link",
      label: labels[inflight.status] ?? "Open proposal",
      href: `/app/proposals/${inflight.id}`,
    };
  }
  if (accepted && !contract && approved) {
    return {
      kind: "create_contract",
      label: "Create contract / SOW",
      planId: approved.id,
      proposalId: accepted.id,
    };
  }
  if (contract && contract.status !== "executed") {
    return { kind: "link", label: "Open contract / SOW", href: `/app/contracts/${contract.id}` };
  }
  if (contract?.status === "executed" && !project && (contract.solutionPlanId || approved)) {
    return {
      kind: "create_project",
      label: "Create delivery project",
      planId: contract.solutionPlanId ?? approved?.id ?? "",
      contractId: contract.id,
    };
  }
  if (project) {
    return { kind: "link", label: "Open delivery project", href: `/app/projects/${project.id}` };
  }
  if (accepted) {
    return { kind: "link", label: "Open accepted proposal", href: `/app/proposals/${accepted.id}` };
  }
  return { kind: "none", hint: "The next commercial step is not available from this record." };
}

export function canBuildProposalFromPlan(path: Pick<CommercialPathRecord, "proposals">, planStatus: string) {
  if (planStatus !== "approved") return false;
  return !inFlightProposal(path) && !acceptedProposal(path);
}
