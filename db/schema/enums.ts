import { pgEnum } from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "invited",
  "disabled",
]);

export const actorTypeEnum = pgEnum("actor_type", ["human", "agent", "system"]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
  "changes_requested",
]);

export const companyTypeEnum = pgEnum("company_type", [
  "prospect",
  "client",
  "partner",
  "other",
]);

export const clientStatusEnum = pgEnum("client_status", [
  "prospect",
  "active",
  "inactive",
  "former",
]);

export const relationshipStrengthEnum = pgEnum("relationship_strength", [
  "unknown",
  "weak",
  "moderate",
  "strong",
  "strategic",
]);

export const opportunityStageEnum = pgEnum("opportunity_stage", [
  "identified",
  "target",
  "qualified",
  "discovery_scheduled",
  "discovery_complete",
  "proposal",
  "negotiation",
  "nurture",
  "won",
  "lost",
  "abandoned",
]);

export const signalTypeEnum = pgEnum("signal_type", [
  "hiring",
  "expansion",
  "layoff",
  "funding",
  "leadership_change",
  "workforce_need",
  "other",
]);

export const candidateAvailabilityEnum = pgEnum("candidate_availability", [
  "unknown",
  "available_now",
  "passive",
  "not_looking",
  "do_not_contact",
]);

export const consentStatusEnum = pgEnum("consent_status", [
  "unknown",
  "granted",
  "withdrawn",
  "expired",
]);

export const talentPoolTypeEnum = pgEnum("talent_pool_type", [
  "static",
  "dynamic",
]);

export const talentPoolScopeEnum = pgEnum("talent_pool_scope", [
  "organization",
  "global_template",
  "user",
]);

export const poolMembershipSourceEnum = pgEnum("pool_membership_source", [
  "manual",
  "rule",
  "import",
  "agent",
  "system",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "draft",
  "open",
  "search_active",
  "on_hold",
  "filled",
  "cancelled",
  "closed",
]);

export const skillRequirementTypeEnum = pgEnum("skill_requirement_type", [
  "required",
  "preferred",
  "nice_to_have",
]);

export const candidatePipelineStatusEnum = pgEnum("candidate_pipeline_status", [
  "sourced",
  "identified",
  "rediscovered",
  "contacted",
  "interested",
  "screened",
  "screening",
  "qualified",
  "submitted",
  "interviewing",
  "interview",
  "finalist",
  "offered",
  "offer",
  "placed",
  "declined",
  "rejected",
  "withdrawn",
  "nurture",
]);

export const interviewStatusEnum = pgEnum("interview_status", [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
]);

export const offerStatusEnum = pgEnum("offer_status", [
  "draft",
  "extended",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
]);

export const militaryBranchEnum = pgEnum("military_branch", [
  "army",
  "navy",
  "air_force",
  "marine_corps",
  "coast_guard",
  "space_force",
]);

export const militaryClassificationTypeEnum = pgEnum(
  "military_classification_type",
  ["mos", "rating", "afsc", "specialty"],
);

export const militaryPresenceLevelEnum = pgEnum("military_presence_level", [
  "primary",
  "significant",
  "limited",
  "unknown",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "draft",
  "in_review",
  "approved",
  "rejected",
]);

export const serviceStatusEnum = pgEnum("service_status", [
  "active",
  "inactive",
  "archived",
]);

export const solutionPlanStatusEnum = pgEnum("solution_plan_status", [
  "draft",
  "in_review",
  "approved",
  "rejected",
  "superseded",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "planned",
  "active",
  "on_hold",
  "completed",
  "cancelled",
  "at_risk",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
  "not_started",
  "waiting_client",
  "review",
]);

export const privacyClassEnum = pgEnum("privacy_class", [
  "public",
  "internal",
  "confidential",
  "restricted_pii",
]);

export const activityTypeEnum = pgEnum("activity_type", [
  "note",
  "email",
  "phone",
  "meeting",
  "task",
  "research",
  "outreach",
  "status_change",
  "system",
  "other",
]);

export const signalReviewStatusEnum = pgEnum("signal_review_status", [
  "draft",
  "pending_review",
  "approved",
  "dismissed",
  "converted",
]);

export const opportunityScoreBandEnum = pgEnum("opportunity_score_band", [
  "priority",
  "active_qualified",
  "nurture",
  "monitor",
]);

export const militaryStatusEnum = pgEnum("candidate_military_status", [
  "unknown",
  "none",
  "veteran",
  "active_duty",
  "reserve",
  "national_guard",
]);

export const designationTypeEnum = pgEnum("designation_type", [
  "silver_medalist",
]);

export const engagementTypeEnum = pgEnum("engagement_type", [
  "email",
  "phone",
  "linkedin",
  "interview_prep",
  "nurture",
  "note",
  "check_in",
  "other",
]);

export const engagementDirectionEnum = pgEnum("engagement_direction", [
  "inbound",
  "outbound",
  "internal",
]);

export const searchProjectStatusEnum = pgEnum("search_project_status", [
  "draft",
  "active",
  "on_hold",
  "filled",
  "cancelled",
  "closed",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "draft",
  "pending_approval",
  "submitted",
  "accepted",
  "rejected",
  "withdrawn",
]);

export const placementStatusEnum = pgEnum("placement_status", [
  "pending_start",
  "active",
  "completed",
  "fallen_off",
  "cancelled",
]);

export const guaranteeStatusEnum = pgEnum("guarantee_status", [
  "active",
  "expiring_soon",
  "completed",
  "replacement_required",
  "waived",
]);

export const mappingReviewStatusEnum = pgEnum("mapping_review_status", [
  "pending",
  "approved",
  "rejected",
  "needs_review",
]);

export const mappingOriginEnum = pgEnum("mapping_origin", [
  "reference_data",
  "human",
  "agent",
  "import",
  "system",
]);

export const pricingModelEnum = pgEnum("pricing_model", [
  "percentage_fee",
  "fixed_project",
  "monthly_recurring",
]);

export const workflowStepTypeEnum = pgEnum("workflow_step_type", [
  "qualification",
  "discovery",
  "data_collection",
  "analysis",
  "recommendation",
  "approval",
  "legal",
  "project",
  "deliverable",
  "billing",
  "closeout",
  "expansion",
  "human_review",
  "exception",
]);

export const discoveryStatusEnum = pgEnum("discovery_status", [
  "draft",
  "in_review",
  "approved",
  "rejected",
]);

export const proposalStatusEnum = pgEnum("proposal_status", [
  "draft",
  "internal_review",
  "approved",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
  "superseded",
]);

export const legalTemplateTypeEnum = pgEnum("legal_template_type", [
  "msa",
  "direct_hire_search_agreement",
  "retained_search_agreement",
  "fractional_ta_sow",
  "consulting_sow",
  "military_talent_assessment_sow",
  "ta_performance_assessment_sow",
  "workforce_assessment_sow",
  "nda",
  "dpa",
  "subcontractor_agreement",
  "employee_agreement",
  "confidentiality_ip_agreement",
  "independent_contractor_agreement",
]);

export const legalTemplateStatusEnum = pgEnum("legal_template_status", [
  "draft",
  "attorney_review",
  "approved",
  "retired",
]);

export const contractStatusEnum = pgEnum("contract_status", [
  "draft",
  "internal_review",
  "client_review",
  "sent_for_signature",
  "partially_signed",
  "executed",
  "expired",
  "terminated",
  "superseded",
]);

export const esignStatusEnum = pgEnum("esign_status", [
  "not_sent",
  "created",
  "sent",
  "delivered",
  "partially_signed",
  "completed",
  "declined",
  "voided",
  "manual",
]);

export const deliverableStatusEnum = pgEnum("deliverable_status", [
  "not_started",
  "in_progress",
  "review",
  "approved",
  "client_ready",
  "delivered",
  "rejected",
]);

export const billingEventStatusEnum = pgEnum("billing_event_status", [
  "scheduled",
  "triggered",
  "queued",
  "invoiced",
  "cancelled",
]);

export const riskStatusEnum = pgEnum("risk_status", [
  "open",
  "mitigating",
  "accepted",
  "closed",
]);

export const issueStatusEnum = pgEnum("issue_status", [
  "open",
  "in_progress",
  "resolved",
  "wont_fix",
]);

export const expansionStatusEnum = pgEnum("expansion_status", [
  "suggested",
  "reviewed",
  "accepted",
  "declined",
]);

export const meetingStatusEnum = pgEnum("meeting_status", [
  "scheduled",
  "completed",
  "cancelled",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);
