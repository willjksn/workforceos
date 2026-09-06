import { getAiStackConfig, modelForTier, type AiStackConfig } from "./config";
import type { AiModelRoute, AiModelTier, AiRiskLevel, AiTaskKind } from "./types";

const SOL_TASKS = new Set([
  "scout_search",
  "scout_complex",
  "hybrid_research_synthesis",
  "mapping_draft",
  "skills_translation",
  "gap_analysis",
  "scenario_analysis",
  "pipeline_design",
  "career_pathways",
  "workforce_roadmap",
  "skills_architecture",
  "draft_proposal",
  "structure_scope",
  "solution_recommendation",
  "match_scoring",
  "internal_talent_search",
]);

const TERRA_TASKS = new Set([
  "summarize_company",
  "draft_account_brief",
  "candidate_summary",
  "opportunity_summary",
  "status_summary",
  "scout_summarize",
  "scout_draft",
  "draft_outreach",
  "follow_up_draft",
  "nurture_draft",
  "executive_summary",
  "hiring_manager_brief",
  "forecast_commentary",
  "client_update",
  "synthesize_signals",
  "evaluate_signals",
]);

const LUNA_TASKS = new Set([
  "classify",
  "tag",
  "intent",
  "intent_detection",
  "entity_extraction",
  "extract",
  "lightweight_classification",
  "document_classification",
  "scout_intent",
  "index_lessons",
]);

const HIGH_RISK_AGENTS = new Set([
  "military-talent-agent",
  "workforce-analyst",
  "workforce-architect",
  "proposal-agent",
]);

export type RouteAiModelInput = {
  taskType?: string;
  agentSlug?: string;
  taskKind?: AiTaskKind;
  complexity?: "low" | "medium" | "high";
  risk?: AiRiskLevel;
  config?: AiStackConfig;
};

export function inferTaskKind(input: RouteAiModelInput): AiTaskKind {
  if (input.taskKind) return input.taskKind;
  const task = (input.taskType ?? "").toLowerCase();
  if (LUNA_TASKS.has(task) || /classif|tag|intent|extract/.test(task)) {
    return task.includes("extract") ? "extract" : task.includes("tag") ? "tag" : task.includes("intent") ? "intent" : "classify";
  }
  if (TERRA_TASKS.has(task) || /summar|draft|brief|comment/.test(task)) {
    return /draft|outreach|message/.test(task) ? "draft" : "summarize";
  }
  if (SOL_TASKS.has(task) || /reason|synthes|analy|mapping|scenario|proposal|hybrid/.test(task)) {
    return /synthes|hybrid/.test(task) ? "synthesize" : "reason";
  }
  return "summarize";
}

export function inferRisk(input: RouteAiModelInput): AiRiskLevel {
  if (input.risk) return input.risk;
  if (input.agentSlug && HIGH_RISK_AGENTS.has(input.agentSlug)) return "high";
  const task = (input.taskType ?? "").toLowerCase();
  if (/mapping|workforce|proposal|scenario|solution|military/.test(task)) return "high";
  if (/classif|tag|intent|extract/.test(task)) return "low";
  return "medium";
}

export function routeAiModel(input: RouteAiModelInput = {}): AiModelRoute {
  const config = input.config ?? getAiStackConfig();
  const kind = inferTaskKind(input);
  const risk = inferRisk(input);
  const complexity = input.complexity ?? (kind === "reason" || kind === "synthesize" ? "high" : kind === "classify" || kind === "extract" || kind === "tag" || kind === "intent" ? "low" : "medium");
  const task = (input.taskType ?? "").toLowerCase();
  const agent = input.agentSlug ?? "";

  let tier: AiModelTier = "terra";
  let reason = "Default balanced Terra assignment.";

  if (LUNA_TASKS.has(task) || kind === "classify" || kind === "extract" || kind === "tag" || kind === "intent") {
    tier = "luna";
    reason = "High-volume low-risk classification or extraction.";
  } else if (SOL_TASKS.has(task) || kind === "reason" || kind === "synthesize" || complexity === "high" || risk === "high") {
    tier = "sol";
    reason = "Complex reasoning, hybrid synthesis, or high-value analysis.";
  } else if (TERRA_TASKS.has(task) || kind === "summarize" || kind === "draft" || kind === "tool_use") {
    tier = "terra";
    reason = "Balanced summary, draft, or medium-complexity work.";
  }

  if (agent === "scout" && (kind === "classify" || kind === "intent" || task === "scout_intent")) {
    tier = "luna";
    reason = "Scout simple intent/classification uses Luna.";
  } else if (agent === "scout" && (kind === "draft" || task === "scout_draft")) {
    tier = "terra";
    reason = "Scout routine drafts use Terra.";
  } else if (agent === "scout" && (complexity === "high" || kind === "reason" || kind === "synthesize")) {
    tier = "sol";
    reason = "Scout complex reasoning uses Sol.";
  } else if (agent === "knowledge-agent" && (kind === "classify" || kind === "extract" || kind === "summarize")) {
    tier = kind === "summarize" ? "terra" : "luna";
    reason = "Knowledge Agent uses Luna/Terra for indexing and retrieval support.";
  } else if (agent === "project-agent") {
    tier = "terra";
    reason = "Project Agent default is Terra.";
  } else if (agent === "recruiting-agent" && (kind === "classify" || kind === "extract" || kind === "tag")) {
    tier = "luna";
    reason = "Recruiting tagging/extraction uses Luna.";
  } else if (agent === "recruiting-agent" && (kind === "reason" || complexity === "high")) {
    tier = "sol";
    reason = "Complex candidate/job analysis uses Sol.";
  } else if (agent === "recruiting-agent") {
    tier = "terra";
    reason = "Recruiting Agent default is Terra.";
  } else if (agent === "account-intelligence-agent" && (kind === "reason" || kind === "synthesize" || complexity === "high")) {
    tier = "sol";
    reason = "Complex account synthesis uses Sol.";
  } else if (agent === "account-intelligence-agent") {
    tier = "terra";
    reason = "Account Intelligence default is Terra.";
  } else if (agent === "proposal-agent" && (kind === "reason" || kind === "synthesize" || task === "draft_proposal" || task === "structure_scope")) {
    tier = "sol";
    reason = "Complex proposal/solution structure uses Sol.";
  } else if (agent === "proposal-agent") {
    tier = "terra";
    reason = "Proposal Agent default is Terra.";
  } else if (agent === "opportunity-scout" && (kind === "reason" || kind === "synthesize" || complexity === "high")) {
    tier = "sol";
    reason = "Complex opportunity research synthesis uses Sol.";
  } else if (agent === "opportunity-scout") {
    tier = "terra";
    reason = "Opportunity Scout research synthesis default is Terra.";
  } else if (agent === "military-talent-agent" && (kind === "summarize" || kind === "draft") && complexity !== "high") {
    tier = "terra";
    reason = "Military Talent routine summaries use Terra.";
  } else if (agent === "military-talent-agent") {
    tier = "sol";
    reason = "Military translation and mapping drafts use Sol.";
  } else if (agent === "workforce-analyst" && (kind === "summarize") && complexity !== "high") {
    tier = "terra";
    reason = "Workforce Analyst summaries use Terra.";
  } else if (agent === "workforce-analyst" || agent === "workforce-architect") {
    tier = "sol";
    reason = "Workforce scenario and architecture analysis uses Sol.";
  }

  const highRiskComplex = risk === "high" && (tier === "sol" || complexity === "high" || kind === "reason" || kind === "synthesize");
  return {
    tier,
    model: modelForTier(tier, config),
    allowTerraFallback: true,
    allowLunaFallback: !highRiskComplex && tier !== "sol",
    reason,
  };
}

export function canFallbackToTier(route: AiModelRoute, candidate: AiModelTier) {
  if (candidate === route.tier) return true;
  if (candidate === "terra") return route.allowTerraFallback;
  if (candidate === "luna") return route.allowLunaFallback;
  return false;
}
