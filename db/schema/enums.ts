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
  "on_hold",
  "filled",
  "cancelled",
  "closed",
]);

export const skillRequirementTypeEnum = pgEnum("skill_requirement_type", [
  "required",
  "preferred",
]);

export const candidatePipelineStatusEnum = pgEnum("candidate_pipeline_status", [
  "sourced",
  "screened",
  "submitted",
  "interviewing",
  "offered",
  "placed",
  "declined",
  "withdrawn",
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
]);

export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
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
