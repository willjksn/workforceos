import type { Permission } from "../rbac/permissions";
import type { AutonomyLevel } from "./autonomy";

export type ReviewCategory =
  | "candidate_submission"
  | "ai_candidate_rejection"
  | "military_mapping"
  | "workforce_recommendation"
  | "solution_plan"
  | "proposal"
  | "pricing"
  | "contract_legal_language"
  | "client_deliverable"
  | "invoice_adjustment";

export type AgentDefinition = {
  slug: string;
  name: string;
  description: string;
  optional?: boolean;
  autonomyLevel: AutonomyLevel;
  permissions: Permission[];
  tasks: string[];
  forbidden: string[];
};

export const APPROVED_AGENTS: AgentDefinition[] = [
  {
    slug: "opportunity-scout",
    name: "Opportunity Scout",
    description: "Evaluate company signals and recommend opportunities. Cannot mark won, send outbound, or create contracts.",
    autonomyLevel: 2,
    permissions: ["companies.read", "opportunities.read", "opportunities.write", "contacts.read", "services.read"],
    tasks: ["evaluate_signals", "draft_signal", "recommend_opportunity", "recommend_service"],
    forbidden: ["mark_opportunity_won", "send_outbound", "create_contract", "execute_contract"],
  },
  {
    slug: "account-intelligence-agent",
    name: "Account Intelligence Agent",
    description: "Summarize companies, synthesize signals, and draft account briefs. Distinguishes sourced facts from inference.",
    autonomyLevel: 1,
    permissions: ["companies.read", "contacts.read", "opportunities.read", "services.read"],
    tasks: [
      "summarize_company",
      "synthesize_signals",
      "identify_workforce_themes",
      "draft_account_brief",
      "identify_buyer_roles",
      "recommend_research",
    ],
    forbidden: ["send_outbound", "execute_contract"],
  },
  {
    slug: "sales-agent",
    name: "Sales Agent",
    description: "Draft outreach, discovery/meeting prep, and solution recommendations. Does not send external email in V1 without workflow + human approval.",
    autonomyLevel: 1,
    permissions: ["companies.read", "contacts.read", "opportunities.read", "opportunities.write", "discovery.read", "services.read"],
    tasks: [
      "draft_outreach",
      "discovery_prep",
      "meeting_prep",
      "opportunity_summary",
      "follow_up_draft",
      "solution_recommendation",
    ],
    forbidden: ["send_outbound", "execute_contract", "approve_proposal"],
  },
  {
    slug: "recruiting-agent",
    name: "Recruiting Agent",
    description: "Internal talent search, match scoring, summaries, and outreach drafts. Cannot permanently reject, submit, or offer.",
    autonomyLevel: 3,
    permissions: [
      "candidates.read",
      "jobs.read",
      "jobs.write",
      "search_projects.read",
      "submissions.read",
      "services.read",
    ],
    tasks: [
      "internal_talent_search",
      "match_scoring",
      "rediscovery",
      "pool_recommendations",
      "screening_questions",
      "candidate_summary",
      "outreach_draft",
      "stalled_alert",
    ],
    forbidden: ["reject_candidate_permanently", "submit_candidate", "issue_offer", "approve_submission"],
  },
  {
    slug: "military-talent-agent",
    name: "Military Talent Agent",
    description: "Draft military-civilian mappings and hiring-manager briefs. Material mappings require human review.",
    autonomyLevel: 2,
    permissions: ["military.read", "military.write", "candidates.read", "jobs.read", "services.read"],
    tasks: [
      "mapping_draft",
      "installation_recommendation",
      "skills_translation",
      "gap_analysis",
      "bridge_training",
      "hiring_manager_brief",
    ],
    forbidden: ["approve_mapping", "execute_contract"],
  },
  {
    slug: "workforce-analyst",
    name: "Workforce Analyst",
    description: "Summarize stored workforce data and interpret gaps. Must not fabricate labor-market data.",
    autonomyLevel: 2,
    permissions: ["workforce.read", "workforce.analyze", "forecasts.read", "scenario_models.read", "services.read"],
    tasks: [
      "summarize_workforce",
      "forecast_commentary",
      "gap_interpretation",
      "scenario_analysis",
      "supply_commentary",
      "risk_identification",
    ],
    forbidden: ["invent_labor_data", "approve_workforce_recommendation"],
  },
  {
    slug: "workforce-architect",
    name: "Workforce Architect",
    description: "Draft pipeline, pathway, and roadmap recommendations. Client-facing output requires human approval.",
    autonomyLevel: 2,
    permissions: [
      "workforce.read",
      "workforce.write",
      "workforce.analyze",
      "pipelines.read",
      "career_paths.read",
      "training_programs.read",
      "services.read",
    ],
    tasks: ["pipeline_design", "career_pathways", "training_strategy", "skills_architecture", "workforce_roadmap"],
    forbidden: ["approve_workforce_recommendation", "invent_labor_data"],
  },
  {
    slug: "proposal-agent",
    name: "Proposal Agent",
    description: "Draft proposals from approved solution plans. Cannot approve or send.",
    autonomyLevel: 2,
    permissions: ["proposals.read", "proposals.write", "solutions.read", "discovery.read", "services.read"],
    tasks: ["draft_proposal", "executive_summary", "structure_scope", "assumptions_exclusions", "next_steps"],
    forbidden: ["approve_proposal", "send_proposal", "execute_contract"],
  },
  {
    slug: "project-agent",
    name: "Project Agent",
    description: "Project status, overdue work, and proposed tasks. Cannot close projects or mark client-approved deliverables.",
    autonomyLevel: 3,
    permissions: ["projects.read", "projects.write", "deliverables.read", "billing.read", "services.read"],
    tasks: [
      "status_summary",
      "overdue_tasks",
      "risk_issue_summary",
      "next_actions",
      "client_update",
      "meeting_actions_to_tasks",
    ],
    forbidden: ["close_project", "approve_deliverable", "execute_contract"],
  },
  {
    slug: "knowledge-agent",
    name: "Knowledge Agent",
    description: "Index approved lessons and retrieve institutional knowledge with sources preserved.",
    autonomyLevel: 2,
    permissions: ["knowledge.read", "knowledge.write", "projects.read", "services.read"],
    tasks: ["index_lessons", "summarize_outcomes", "identify_methodology", "suggest_knowledge", "retrieve_knowledge"],
    forbidden: ["approve_knowledge"],
  },
  {
    slug: "finance-assistant",
    name: "Finance Assistant",
    description: "Optional commentary on stored invoices and AR. Cannot invent amounts or post to QuickBooks.",
    optional: true,
    autonomyLevel: 1,
    permissions: ["finance.read", "invoices.read", "billing.read", "services.read"],
    tasks: ["invoice_commentary", "ar_summary"],
    forbidden: ["execute_contract", "approve_invoice_adjustment", "invent_fee"],
  },
  {
    slug: "compliance-assistant",
    name: "Compliance Assistant",
    description: "Optional legal/compliance reminders from stored templates. Cannot execute contracts or approve language.",
    optional: true,
    autonomyLevel: 1,
    permissions: ["legal.read", "contracts.read", "services.read"],
    tasks: ["compliance_check", "template_reminder"],
    forbidden: ["execute_contract", "approve_legal_language"],
  },
  {
    slug: "candidate-engagement-assistant",
    name: "Candidate Engagement Assistant",
    description: "Optional nurture and follow-up drafts. Cannot send mail or change pipeline status.",
    optional: true,
    autonomyLevel: 1,
    permissions: ["candidates.read", "services.read"],
    tasks: ["nurture_draft", "follow_up_draft"],
    forbidden: ["send_outbound", "submit_candidate", "reject_candidate_permanently"],
  },
  {
    slug: "scout",
    name: "Scout",
    description:
      "Persistent WorkforceOS intelligence assistant. Parses natural language into a closed command registry. Cannot generate SQL, send mail, execute contracts, or self-approve.",
    autonomyLevel: 2,
    permissions: [
      "scout.use",
      "scout.search",
      "scout.draft",
      "candidates.read",
      "jobs.read",
      "military.read",
      "skillbridge.read",
      "companies.read",
      "opportunities.read",
      "knowledge.read",
      "services.read",
      "projects.read",
      "reports.read",
    ],
    tasks: ["scout_search", "scout_summarize", "scout_draft", "scout_daily_brief"],
    forbidden: [
      "send_outbound",
      "execute_contract",
      "submit_candidate",
      "issue_offer",
      "reject_candidate_permanently",
      "approve_proposal",
    ],
  },
];

export const GLOBAL_FORBIDDEN_TASKS = [
  "execute_contract",
  "mark_opportunity_won",
  "submit_candidate",
  "issue_offer",
  "approve_proposal",
  "send_proposal",
  "close_project",
  "approve_deliverable",
  "reject_candidate_permanently",
  "approve_mapping",
] as const;

export function agentDefinition(slug: string) {
  return APPROVED_AGENTS.find((agent) => agent.slug === slug);
}

export function isForbiddenTask(slug: string, taskKey: string) {
  if ((GLOBAL_FORBIDDEN_TASKS as readonly string[]).includes(taskKey)) return true;
  const definition = agentDefinition(slug);
  return Boolean(definition?.forbidden.includes(taskKey));
}

export function agentAllowsTask(slug: string, taskKey: string) {
  if (isForbiddenTask(slug, taskKey)) return false;
  const definition = agentDefinition(slug);
  return Boolean(definition?.tasks.includes(taskKey));
}

export const AUTOMATION_RULE_SPECS = [
  {
    code: "high-score-signal-draft-opportunity",
    name: "High-score signal drafts an opportunity",
    eventName: "signal.high_score",
    agentSlug: "opportunity-scout",
    taskKey: "recommend_opportunity",
    actionKey: "draft_opportunity",
  },
  {
    code: "job-search-active-internal-search",
    name: "Job search_active triggers internal Talent Network search",
    eventName: "job.search_active",
    agentSlug: "recruiting-agent",
    taskKey: "internal_talent_search",
    actionKey: "internal_talent_search",
  },
  {
    code: "new-candidate-matching",
    name: "New candidate triggers matching",
    eventName: "candidate.created",
    agentSlug: "recruiting-agent",
    taskKey: "match_scoring",
    actionKey: "candidate_matching",
  },
  {
    code: "interview-feedback-overdue-alert",
    name: "Overdue interview feedback creates an alert",
    eventName: "interview.feedback_overdue",
    agentSlug: "recruiting-agent",
    taskKey: "stalled_alert",
    actionKey: "create_alert",
  },
  {
    code: "contract-executed-create-project",
    name: "Executed contract creates a delivery project",
    eventName: "contract.executed",
    agentSlug: "project-agent",
    taskKey: "next_actions",
    actionKey: "create_delivery_project",
  },
  {
    code: "milestone-complete-billing-event",
    name: "Project milestone complete creates a billing event",
    eventName: "project.milestone_complete",
    agentSlug: "project-agent",
    taskKey: "next_actions",
    actionKey: "create_billing_event",
  },
  {
    code: "workforce-recommendation-review-queue",
    name: "Pending workforce recommendation enters Review Queue",
    eventName: "workforce.recommendation_pending",
    agentSlug: "workforce-analyst",
    taskKey: "gap_interpretation",
    actionKey: "enqueue_review",
  },
] as const;
