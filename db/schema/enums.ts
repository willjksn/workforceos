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
  "pending_approval",
  "approved",
  "sent",
  "rescinded",
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

export const skillFamilyEnum = pgEnum("skill_family", [
  "technical",
  "leadership",
  "business",
  "digital",
  "safety_compliance",
  "other",
]);

export const workforceAssessmentStatusEnum = pgEnum("workforce_assessment_status", [
  "draft",
  "data_collection",
  "analysis",
  "human_review",
  "client_ready",
  "delivered",
  "completed",
  "superseded",
]);

export const workforceCriticalityEnum = pgEnum("workforce_criticality", [
  "critical",
  "high",
  "moderate",
  "low",
]);

export const workforceDataQualityEnum = pgEnum("workforce_data_quality", [
  "unknown",
  "estimated",
  "internal_only",
  "sourced",
  "reviewed",
]);

export const workforceImportSourceEnum = pgEnum("workforce_import_source", [
  "csv",
  "excel",
  "manual",
  "integration",
]);

export const workforceSupplySourceTypeEnum = pgEnum("workforce_supply_source_type", [
  "internal_mobility",
  "labor_market",
  "military",
  "apprenticeship",
  "community_college",
  "university",
  "technical_school",
  "training_program",
  "talent_network",
  "workforce_board",
  "external_recruiting",
  "other",
]);

export const workforcePipelineStatusEnum = pgEnum("workforce_pipeline_status", [
  "planned",
  "active",
  "at_risk",
  "paused",
  "completed",
  "cancelled",
]);

export const educationPartnerTypeEnum = pgEnum("education_partner_type", [
  "community_college",
  "university",
  "technical_school",
  "training_provider",
  "workforce_board",
  "other",
]);

export const partnershipStatusEnum = pgEnum("partnership_status", [
  "exploratory",
  "active",
  "paused",
  "ended",
]);

export const apprenticeshipStatusEnum = pgEnum("apprenticeship_status", [
  "planned",
  "active",
  "paused",
  "completed",
  "cancelled",
]);

export const careerPathEdgeTypeEnum = pgEnum("career_path_edge_type", [
  "sequential",
  "lateral",
]);

export const skillsGapScopeEnum = pgEnum("skills_gap_scope", [
  "individual",
  "aggregate",
  "military_transition",
]);

export const workforceRecommendationStatusEnum = pgEnum("workforce_recommendation_status", [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "changes_requested",
]);

export const workforceRoadmapPeriodEnum = pgEnum("workforce_roadmap_period", [
  "0_90_days",
  "3_6_months",
  "6_12_months",
  "12_24_months",
]);

export const workforceRiskCategoryEnum = pgEnum("workforce_risk_category", [
  "skills_shortage",
  "retirement",
  "attrition",
  "capacity",
  "geographic_scarcity",
  "credential_shortage",
  "education_capacity",
  "training_capacity",
  "military_availability",
  "pipeline_conversion",
  "compensation",
  "competition",
]);

export const laborMarketProviderEnum = pgEnum("labor_market_provider", [
  "bls",
  "census",
  "onet",
]);

export const talentScarcityClassEnum = pgEnum("talent_scarcity_class", [
  "unknown",
  "estimated",
  "internal_only",
  "scarce",
  "moderate",
  "abundant",
]);

export const billingTypeEnum = pgEnum("billing_type", [
  "placement_fee",
  "monthly_recurring",
  "milestone",
  "fixed_project",
  "retainer",
  "custom",
]);

export const billingScheduleStatusEnum = pgEnum("billing_schedule_status", [
  "active",
  "paused",
  "terminated",
  "completed",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "ready",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
  "disputed",
]);

export const paymentReconciliationStatusEnum = pgEnum("payment_reconciliation_status", [
  "unmatched",
  "matched",
  "disputed",
  "written_off",
]);

export const revenueEventStatusEnum = pgEnum("revenue_event_status", [
  "expected",
  "recognized",
  "invoiced",
  "cancelled",
]);

export const revenueTriggerTypeEnum = pgEnum("revenue_trigger_type", [
  "candidate_start",
  "milestone_completed",
  "monthly_fractional",
  "assessment_kickoff",
  "final_deliverable",
  "contract_deposit",
  "custom",
]);

export const arAgingBucketEnum = pgEnum("ar_aging_bucket", [
  "current",
  "1_30",
  "31_60",
  "61_90",
  "90_plus",
]);

export const financeAdjustmentTypeEnum = pgEnum("finance_adjustment_type", [
  "write_off",
  "invoice_adjustment",
  "revenue_correction",
  "fee_override",
  "billing_schedule_change",
]);

export const enrichmentReviewStatusEnum = pgEnum("enrichment_review_status", [
  "pending_review",
  "accepted",
  "rejected",
]);

export const integrationJobStatusEnum = pgEnum("integration_job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "dead_letter",
]);

export const workspaceReferenceTypeEnum = pgEnum("workspace_reference_type", [
  "calendar",
  "meeting",
  "interview",
  "email_thread",
]);

export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "partial",
]);

export const promptVersionStatusEnum = pgEnum("prompt_version_status", [
  "draft",
  "approved",
  "retired",
]);

export const knowledgeRecordTypeEnum = pgEnum("knowledge_record_type", [
  "service_playbook",
  "military_methodology",
  "workforce_methodology",
  "legal_template_reference",
  "recruiting_playbook",
  "client_approved_insight",
  "lessons_learned",
  "case_study",
  "internal_process",
]);

export const knowledgeRecordStatusEnum = pgEnum("knowledge_record_status", [
  "draft",
  "in_review",
  "approved",
  "retired",
]);

export const automationRuleStatusEnum = pgEnum("automation_rule_status", [
  "enabled",
  "disabled",
]);

export const agentHandoffStatusEnum = pgEnum("agent_handoff_status", [
  "pending",
  "accepted",
  "completed",
  "rejected",
  "failed",
]);

export const reviewCategoryEnum = pgEnum("review_category", [
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
]);

export const circuitBreakerStateEnum = pgEnum("circuit_breaker_state", [
  "closed",
  "open",
  "half_open",
]);

export const privacyDeletionStatusEnum = pgEnum("privacy_deletion_status", [
  "requested",
  "approved",
  "completed",
  "rejected",
]);

export const scoutCommandFamilyEnum = pgEnum("scout_command_family", [
  "SEARCH",
  "SUMMARIZE",
  "DRAFT",
  "CREATE",
  "UPDATE",
  "ASSIGN",
  "ADD_TO_POOL",
  "ADD_TO_JOB",
  "CREATE_TASK",
  "CREATE_FOLLOW_UP",
  "SHOW_RECORD",
  "SHOW_DASHBOARD",
  "FIND_MATCHES",
]);

export const scoutMessageRoleEnum = pgEnum("scout_message_role", [
  "user",
  "scout",
  "system",
]);

export const scoutActionStatusEnum = pgEnum("scout_action_status", [
  "proposed",
  "confirmed",
  "executed",
  "cancelled",
  "rejected",
  "pending_approval",
]);

export const skillbridgeApprovalStatusEnum = pgEnum("skillbridge_approval_status", [
  "unknown",
  "not_started",
  "candidate_interested",
  "command_discussion",
  "pending",
  "approved",
  "denied",
  "not_required",
  "completed",
]);

export const skillbridgeCandidateStatusEnum = pgEnum("skillbridge_candidate_status", [
  "new",
  "initial_contact",
  "profile_incomplete",
  "ready_for_matching",
  "matching",
  "opportunity_identified",
  "submitted",
  "interviewing",
  "skillbridge_pending",
  "skillbridge_approved",
  "skillbridge_active",
  "conversion_pending",
  "hired",
  "nurture",
  "closed",
]);

export const skillbridgeOpportunityStageEnum = pgEnum("skillbridge_opportunity_stage", [
  "candidate_identified",
  "initial_contact",
  "profile_complete",
  "opportunity_matching",
  "candidate_interested",
  "employer_submitted",
  "hiring_manager_review",
  "interview",
  "skillbridge_approval",
  "skillbridge_placement",
  "skillbridge_active",
  "conversion_review",
  "hired",
  "no_match_yet",
  "candidate_withdrew",
  "employer_declined",
  "skillbridge_denied",
  "position_closed",
  "nurture",
  "closed",
]);

export const skillbridgeResumeStatusEnum = pgEnum("skillbridge_resume_status", [
  "missing",
  "outdated",
  "current",
  "needs_review",
]);

export const skillbridgeNoteKindEnum = pgEnum("skillbridge_note_kind", [
  "candidate_preference",
  "employer_feedback",
  "timing",
  "approval",
  "resume",
  "career_goal",
  "follow_up",
  "risk",
  "other",
]);

export const skillbridgeNoteVisibilityEnum = pgEnum("skillbridge_note_visibility", [
  "internal",
  "client_visible",
]);

export const skillbridgeIdealEmployerKindEnum = pgEnum("skillbridge_ideal_employer_kind", [
  "named_company",
  "employer_category",
  "industry",
  "no_preference",
]);

export const skillbridgeDocumentTypeEnum = pgEnum("skillbridge_document_type", [
  "resume",
  "certification",
  "training",
  "transition",
  "other",
]);

export const skillbridgeAlertRuleCodeEnum = pgEnum("skillbridge_alert_rule_code", [
  "candidate_no_contact",
  "employer_feedback_overdue",
  "window_approaching",
  "no_opportunity",
  "resume_missing",
  "conversion_approaching",
]);

export const inAppNotificationKindEnum = pgEnum("in_app_notification_kind", [
  "skillbridge_window_approaching",
  "follow_up_overdue",
  "employer_response_overdue",
  "resume_missing",
  "interview_upcoming",
  "approval_pending",
  "conversion_decision_approaching",
  "scout_action",
  "application_received",
  "application_awaiting_review",
  "scorecard_overdue",
  "background_check_status",
  "drug_screen_status",
  "offer_approval",
  "offer_accepted",
  "offer_expiring",
  "onboarding_overdue",
  "new_hire_starting",
]);

export const jobContextTypeEnum = pgEnum("job_context_type", ["internal", "client", "skillbridge"]);

export const postingVisibilityEnum = pgEnum("posting_visibility", [
  "public",
  "unlisted",
  "internal_only",
  "closed",
]);

export const clientVisibilityEnum = pgEnum("client_visibility", ["public", "confidential", "internal_only"]);

export const requisitionStatusEnum = pgEnum("requisition_status", [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "open",
  "on_hold",
  "filled",
  "cancelled",
  "closed",
]);

export const applicationSourceEnum = pgEnum("application_source", [
  "career_site",
  "referral",
  "recruiter",
  "linkedin",
  "indeed",
  "military_event",
  "skillbridge",
  "client_referral",
  "internal",
  "agency",
  "other",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "submitted",
  "in_process",
  "hired",
  "rejected",
  "withdrawn",
  "nurture",
  "position_closed",
]);

export const questionTypeEnum = pgEnum("application_question_type", [
  "short_text",
  "long_text",
  "yes_no",
  "single_select",
  "multi_select",
  "date",
  "number",
  "file",
  "acknowledgement",
]);

export const backgroundCheckStatusEnum = pgEnum("background_check_status", [
  "not_required",
  "not_started",
  "invited",
  "consent_pending",
  "in_progress",
  "completed",
  "review_required",
  "cleared",
  "adverse_review",
  "cancelled",
  "error",
]);

export const drugScreenStatusEnum = pgEnum("drug_screen_status", [
  "not_required",
  "not_started",
  "ordered",
  "scheduled",
  "completed",
  "review_required",
  "cleared",
  "cancelled",
  "error",
]);

export const employeeStatusEnum = pgEnum("employee_status", [
  "prehire",
  "active",
  "leave",
  "inactive",
  "terminated",
]);

export const scorecardRecommendationEnum = pgEnum("scorecard_recommendation", [
  "strong_yes",
  "yes",
  "mixed",
  "no",
  "strong_no",
]);

export const transactionalEmailStatusEnum = pgEnum("transactional_email_status", [
  "queued",
  "sent",
  "delivered",
  "failed",
  "bounced",
]);
