import type { AgentContext } from "./context";
import type { ReviewCategory } from "./registry";

export type TaskResult = {
  summary: string;
  payload: Record<string, unknown>;
  confidence: string | null;
  missingData: string[];
  assumptions: string;
  reviewCategory: ReviewCategory | null;
  humanReviewRequired: boolean;
  facts?: string[];
  inferences?: string[];
};

function factInferenceSplit(context: AgentContext, inference: string): { facts: string[]; inferences: string[] } {
  const facts: string[] = [];
  if (context.record) facts.push("Current record loaded from PostgreSQL.");
  if (context.workflow) facts.push(`Approved workflow ${context.workflow.code} ${context.workflow.version} loaded.`);
  for (const item of context.knowledge) {
    facts.push(`Knowledge: ${item.title}${item.source ? ` (source: ${item.source})` : ""}.`);
  }
  return { facts, inferences: [inference] };
}

export function executeHeuristicTask(context: AgentContext): TaskResult {
  const recordLabel = context.record
    ? String(context.record.name ?? context.record.title ?? context.recordType)
    : "no current record";
  const missingData = context.record ? [] : ["No current record was supplied."];
  if (!context.workflow) missingData.push("No approved service workflow was attached to this record.");
  const { facts, inferences } = factInferenceSplit(
    context,
    `${context.agentSlug} produced a ${context.taskKey} draft. Treat inferences as unverified.`,
  );

  const summary = `${context.agentSlug} / ${context.taskKey}: draft from stored records (${recordLabel}).`;
  const assumptions =
    "Output uses only WorkforceOS database context, approved workflows, and approved knowledge. Labor-market or client facts were not invented.";

  const material = materialReview(context.agentSlug, context.taskKey);
  return {
    summary,
    payload: {
      task: context.taskKey,
      agent: context.agentSlug,
      facts,
      inferences,
      recordType: context.recordType,
      recordId: context.recordId,
      workflow: context.workflow,
      knowledgeSources: context.knowledge.map((item) => ({
        id: item.id,
        title: item.title,
        source: item.source,
      })),
    },
    confidence: missingData.length === 0 ? "0.6200" : null,
    missingData,
    assumptions,
    reviewCategory: material.category,
    humanReviewRequired: material.humanReviewRequired,
    facts,
    inferences,
  };
}

function materialReview(agentSlug: string, taskKey: string): {
  category: ReviewCategory | null;
  humanReviewRequired: boolean;
} {
  if (agentSlug === "military-talent-agent" || taskKey === "mapping_draft") {
    return { category: "military_mapping", humanReviewRequired: true };
  }
  if (agentSlug === "proposal-agent" || taskKey === "draft_proposal") {
    return { category: "proposal", humanReviewRequired: true };
  }
  if (agentSlug === "workforce-analyst" || agentSlug === "workforce-architect") {
    return { category: "workforce_recommendation", humanReviewRequired: true };
  }
  if (taskKey === "submit_candidate" || taskKey === "candidate_summary") {
    return { category: "candidate_submission", humanReviewRequired: true };
  }
  if (taskKey === "ai_candidate_rejection") {
    return { category: "ai_candidate_rejection", humanReviewRequired: true };
  }
  if (taskKey.includes("pricing")) return { category: "pricing", humanReviewRequired: true };
  if (agentSlug === "compliance-assistant") {
    return { category: "contract_legal_language", humanReviewRequired: true };
  }
  if (taskKey === "client_update") return { category: "client_deliverable", humanReviewRequired: true };
  if (agentSlug === "finance-assistant") {
    return { category: "invoice_adjustment", humanReviewRequired: true };
  }
  if (taskKey === "recommend_opportunity" || taskKey === "solution_recommendation") {
    return { category: "solution_plan", humanReviewRequired: true };
  }
  return { category: null, humanReviewRequired: true };
}
