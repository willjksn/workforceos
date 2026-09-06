CREATE TYPE "public"."application_source" AS ENUM('career_site', 'referral', 'recruiter', 'linkedin', 'indeed', 'military_event', 'skillbridge', 'client_referral', 'internal', 'agency', 'other');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('submitted', 'in_process', 'hired', 'rejected', 'withdrawn', 'nurture', 'position_closed');--> statement-breakpoint
CREATE TYPE "public"."background_check_status" AS ENUM('not_required', 'not_started', 'invited', 'consent_pending', 'in_progress', 'completed', 'review_required', 'cleared', 'adverse_review', 'cancelled', 'error');--> statement-breakpoint
CREATE TYPE "public"."client_visibility" AS ENUM('public', 'confidential', 'internal_only');--> statement-breakpoint
CREATE TYPE "public"."drug_screen_status" AS ENUM('not_required', 'not_started', 'ordered', 'scheduled', 'completed', 'review_required', 'cleared', 'cancelled', 'error');--> statement-breakpoint
CREATE TYPE "public"."employee_status" AS ENUM('prehire', 'active', 'leave', 'inactive', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."job_context_type" AS ENUM('internal', 'client', 'skillbridge');--> statement-breakpoint
CREATE TYPE "public"."posting_visibility" AS ENUM('public', 'unlisted', 'internal_only', 'closed');--> statement-breakpoint
CREATE TYPE "public"."application_question_type" AS ENUM('short_text', 'long_text', 'yes_no', 'single_select', 'multi_select', 'date', 'number', 'file', 'acknowledgement');--> statement-breakpoint
CREATE TYPE "public"."requisition_status" AS ENUM('draft', 'pending_approval', 'approved', 'rejected', 'open', 'on_hold', 'filled', 'cancelled', 'closed');--> statement-breakpoint
CREATE TYPE "public"."scorecard_recommendation" AS ENUM('strong_yes', 'yes', 'mixed', 'no', 'strong_no');--> statement-breakpoint
CREATE TYPE "public"."transactional_email_status" AS ENUM('queued', 'sent', 'delivered', 'failed', 'bounced');--> statement-breakpoint
ALTER TYPE "public"."in_app_notification_kind" ADD VALUE 'application_received';--> statement-breakpoint
ALTER TYPE "public"."in_app_notification_kind" ADD VALUE 'application_awaiting_review';--> statement-breakpoint
ALTER TYPE "public"."in_app_notification_kind" ADD VALUE 'scorecard_overdue';--> statement-breakpoint
ALTER TYPE "public"."in_app_notification_kind" ADD VALUE 'background_check_status';--> statement-breakpoint
ALTER TYPE "public"."in_app_notification_kind" ADD VALUE 'drug_screen_status';--> statement-breakpoint
ALTER TYPE "public"."in_app_notification_kind" ADD VALUE 'offer_approval';--> statement-breakpoint
ALTER TYPE "public"."in_app_notification_kind" ADD VALUE 'offer_accepted';--> statement-breakpoint
ALTER TYPE "public"."in_app_notification_kind" ADD VALUE 'offer_expiring';--> statement-breakpoint
ALTER TYPE "public"."in_app_notification_kind" ADD VALUE 'onboarding_overdue';--> statement-breakpoint
ALTER TYPE "public"."in_app_notification_kind" ADD VALUE 'new_hire_starting';--> statement-breakpoint
ALTER TYPE "public"."offer_status" ADD VALUE 'pending_approval';--> statement-breakpoint
ALTER TYPE "public"."offer_status" ADD VALUE 'approved';--> statement-breakpoint
ALTER TYPE "public"."offer_status" ADD VALUE 'sent';--> statement-breakpoint
ALTER TYPE "public"."offer_status" ADD VALUE 'rescinded';--> statement-breakpoint
CREATE TABLE "external_research_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"research_session_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"source_type" text NOT NULL,
	"title" text NOT NULL,
	"snippet" text,
	"url" text,
	"publisher" text,
	"published_at" timestamp with time zone,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_version" text,
	"confidence" numeric(5, 4),
	"structured_provider_id" text,
	"human_review_status" text DEFAULT 'unreviewed' NOT NULL,
	"proposed_action" text,
	"applied_to_record_type" text,
	"applied_to_record_id" uuid,
	"provenance" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "research_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cache_key" text NOT NULL,
	"provider" text NOT NULL,
	"research_type" text NOT NULL,
	"query" text NOT NULL,
	"filters" jsonb,
	"result_summary" jsonb NOT NULL,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "research_cache_key_uq" UNIQUE("cache_key")
);
--> statement-breakpoint
CREATE TABLE "research_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"scout_session_id" uuid,
	"query" text NOT NULL,
	"research_type" text NOT NULL,
	"providers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"estimated_cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"web_search_calls" integer DEFAULT 0 NOT NULL,
	"tavily_requests" integer DEFAULT 0 NOT NULL,
	"failure_state" text,
	"error_detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "application_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"question_id" uuid,
	"question_key" text NOT NULL,
	"answer" text,
	"file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "application_form_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "application_form_versions_form_version_uq" UNIQUE("form_id","version")
);
--> statement-breakpoint
CREATE TABLE "application_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"job_context_type" text DEFAULT 'client' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "application_pre_employment_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"check_type" text NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "application_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_version_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"question_type" "application_question_type" NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"options" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "application_questions_version_key_uq" UNIQUE("form_version_id","key")
);
--> statement-breakpoint
CREATE TABLE "application_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"from_stage" text,
	"to_stage" text NOT NULL,
	"changed_by_user_id" uuid,
	"reason" text,
	"source" text DEFAULT 'human' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"job_posting_id" uuid,
	"source" "application_source" DEFAULT 'career_site' NOT NULL,
	"source_detail" text,
	"status" "application_status" DEFAULT 'submitted' NOT NULL,
	"current_stage" text DEFAULT 'applied' NOT NULL,
	"pipeline" text DEFAULT 'client' NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone,
	"owner_user_id" uuid,
	"recruiter_user_id" uuid,
	"disposition" text,
	"disposition_reason" text,
	"withdrawn_at" timestamp with time zone,
	"duplicate_review_required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "background_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"application_id" uuid,
	"job_id" uuid,
	"provider" text DEFAULT 'manual' NOT NULL,
	"provider_candidate_id" text,
	"provider_report_id" text,
	"status" "background_check_status" DEFAULT 'not_started' NOT NULL,
	"requested_at" timestamp with time zone,
	"consent_status" text DEFAULT 'unknown' NOT NULL,
	"invitation_sent_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"result_summary" text,
	"review_status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "candidate_dedupe_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"application_id" uuid,
	"candidate_ids" jsonb NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "drug_screens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"application_id" uuid,
	"job_id" uuid,
	"provider" text DEFAULT 'manual' NOT NULL,
	"status" "drug_screen_status" DEFAULT 'not_started' NOT NULL,
	"ordered_at" timestamp with time zone,
	"scheduled_at" timestamp with time zone,
	"collection_site" text,
	"completed_at" timestamp with time zone,
	"result_status" text,
	"review_required" boolean DEFAULT true NOT NULL,
	"reviewed_by_user_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"employee_number" text,
	"status" "employee_status" DEFAULT 'prehire' NOT NULL,
	"hire_date" date,
	"start_date" date,
	"job_title" text,
	"department" text,
	"manager_employee_id" uuid,
	"work_location" text,
	"employment_type" text,
	"work_email" text,
	"terminated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "employees_org_candidate_uq" UNIQUE("organization_id","candidate_id")
);
--> statement-breakpoint
CREATE TABLE "interview_calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_event_id" text,
	"calendar_owner" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"meeting_url" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "interview_calendar_events_interview_uq" UNIQUE("interview_id")
);
--> statement-breakpoint
CREATE TABLE "interview_plan_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"interview_type" text DEFAULT 'video' NOT NULL,
	"instructions" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "interview_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "interview_scorecards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"interview_id" uuid NOT NULL,
	"application_id" uuid,
	"interviewer_user_id" uuid NOT NULL,
	"template_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"recommendation" "scorecard_recommendation",
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_application_form_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"form_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "job_application_form_links_job_uq" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "job_description_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"created_by_user_id" uuid,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"ai_model" text,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "job_description_versions_job_version_uq" UNIQUE("job_id","version")
);
--> statement-breakpoint
CREATE TABLE "job_postings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"requisition_id" uuid,
	"slug" text NOT NULL,
	"public_title" text NOT NULL,
	"public_description" text NOT NULL,
	"location" text,
	"workplace_type" text,
	"employment_type" text,
	"salary_display" text,
	"company_display" text,
	"visibility" "posting_visibility" DEFAULT 'internal_only' NOT NULL,
	"client_visibility" "client_visibility" DEFAULT 'confidential' NOT NULL,
	"public_status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"application_open" boolean DEFAULT false NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"skillbridge_eligible" boolean DEFAULT false NOT NULL,
	"skillbridge_disclaimer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "job_postings_org_slug_uq" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "job_requisitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid,
	"department" text,
	"business_unit" text,
	"hiring_manager_user_id" uuid,
	"recruiter_user_id" uuid,
	"title" text NOT NULL,
	"job_family" text,
	"employment_type" text,
	"headcount" integer DEFAULT 1 NOT NULL,
	"replacement_or_growth" text,
	"replacement_for" text,
	"reason" text,
	"location" text,
	"workplace_type" text,
	"compensation_min" numeric(12, 2),
	"compensation_max" numeric(12, 2),
	"compensation_currency" text DEFAULT 'USD' NOT NULL,
	"budget_status" text,
	"target_start_date" date,
	"requested_open_date" date,
	"approval_status" text DEFAULT 'draft' NOT NULL,
	"status" "requisition_status" DEFAULT 'draft' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "onboarding_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"employee_id" uuid,
	"template_id" uuid,
	"start_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "onboarding_instances_application_uq" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "onboarding_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"title" text NOT NULL,
	"owner_role" text NOT NULL,
	"due_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"phase" text DEFAULT 'before_start' NOT NULL,
	"blocking" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "onboarding_template_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"title" text NOT NULL,
	"owner_role" text DEFAULT 'new_hire' NOT NULL,
	"due_offset_days" integer DEFAULT 0 NOT NULL,
	"phase" text DEFAULT 'before_start' NOT NULL,
	"blocking" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "onboarding_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "onboarding_templates_org_slug_uq" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "pre_employment_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"check_type" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "pre_employment_requirements_job_type_uq" UNIQUE("job_id","check_type")
);
--> statement-breakpoint
CREATE TABLE "prehire_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"start_date" date,
	"manager_user_id" uuid,
	"location" text,
	"blockers" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "prehire_records_application_uq" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "reference_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"name" text NOT NULL,
	"relationship" text,
	"contact" text,
	"requested_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"notes" text,
	"review" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scorecard_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"section" text DEFAULT 'general' NOT NULL,
	"prompt" text NOT NULL,
	"question_type" text DEFAULT 'rating' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scorecard_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scorecard_id" uuid NOT NULL,
	"question_id" uuid,
	"rating" integer,
	"answer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scorecard_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transactional_email_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"template" text NOT NULL,
	"recipient" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"status" "transactional_email_status" DEFAULT 'queued' NOT NULL,
	"provider_message_id" text,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD COLUMN "model_tier" text;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD COLUMN "web_search_calls" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD COLUMN "tavily_requests" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "application_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "job_context_type" "job_context_type" DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "department" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "posting_visibility" "posting_visibility" DEFAULT 'internal_only' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "client_visibility" "client_visibility" DEFAULT 'internal_only' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "public_slug" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "skillbridge_eligible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "application_id" uuid;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD COLUMN "last_request_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "external_research_results" ADD CONSTRAINT "external_research_results_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_research_results" ADD CONSTRAINT "external_research_results_research_session_id_research_sessions_id_fk" FOREIGN KEY ("research_session_id") REFERENCES "public"."research_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_sessions" ADD CONSTRAINT "research_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_sessions" ADD CONSTRAINT "research_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_sessions" ADD CONSTRAINT "research_sessions_scout_session_id_scout_sessions_id_fk" FOREIGN KEY ("scout_session_id") REFERENCES "public"."scout_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_answers" ADD CONSTRAINT "application_answers_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_answers" ADD CONSTRAINT "application_answers_question_id_application_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."application_questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_answers" ADD CONSTRAINT "application_answers_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_form_versions" ADD CONSTRAINT "application_form_versions_form_id_application_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."application_forms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_forms" ADD CONSTRAINT "application_forms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_pre_employment_checks" ADD CONSTRAINT "application_pre_employment_checks_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_questions" ADD CONSTRAINT "application_questions_form_version_id_application_form_versions_id_fk" FOREIGN KEY ("form_version_id") REFERENCES "public"."application_form_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_stage_history" ADD CONSTRAINT "application_stage_history_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_stage_history" ADD CONSTRAINT "application_stage_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_posting_id_job_postings_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_postings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_recruiter_user_id_users_id_fk" FOREIGN KEY ("recruiter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "background_checks" ADD CONSTRAINT "background_checks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "background_checks" ADD CONSTRAINT "background_checks_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "background_checks" ADD CONSTRAINT "background_checks_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "background_checks" ADD CONSTRAINT "background_checks_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "background_checks" ADD CONSTRAINT "background_checks_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_dedupe_flags" ADD CONSTRAINT "candidate_dedupe_flags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_dedupe_flags" ADD CONSTRAINT "candidate_dedupe_flags_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drug_screens" ADD CONSTRAINT "drug_screens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drug_screens" ADD CONSTRAINT "drug_screens_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drug_screens" ADD CONSTRAINT "drug_screens_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drug_screens" ADD CONSTRAINT "drug_screens_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drug_screens" ADD CONSTRAINT "drug_screens_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_plan_stages" ADD CONSTRAINT "interview_plan_stages_plan_id_interview_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."interview_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_plans" ADD CONSTRAINT "interview_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_plans" ADD CONSTRAINT "interview_plans_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_scorecards" ADD CONSTRAINT "interview_scorecards_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_scorecards" ADD CONSTRAINT "interview_scorecards_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_scorecards" ADD CONSTRAINT "interview_scorecards_interviewer_user_id_users_id_fk" FOREIGN KEY ("interviewer_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_scorecards" ADD CONSTRAINT "interview_scorecards_template_id_scorecard_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."scorecard_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_application_form_links" ADD CONSTRAINT "job_application_form_links_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_application_form_links" ADD CONSTRAINT "job_application_form_links_form_id_application_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."application_forms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_application_form_links" ADD CONSTRAINT "job_application_form_links_form_version_id_application_form_versions_id_fk" FOREIGN KEY ("form_version_id") REFERENCES "public"."application_form_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_description_versions" ADD CONSTRAINT "job_description_versions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_description_versions" ADD CONSTRAINT "job_description_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_description_versions" ADD CONSTRAINT "job_description_versions_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_requisition_id_job_requisitions_id_fk" FOREIGN KEY ("requisition_id") REFERENCES "public"."job_requisitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_hiring_manager_user_id_users_id_fk" FOREIGN KEY ("hiring_manager_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_recruiter_user_id_users_id_fk" FOREIGN KEY ("recruiter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_instances" ADD CONSTRAINT "onboarding_instances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_instances" ADD CONSTRAINT "onboarding_instances_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_instances" ADD CONSTRAINT "onboarding_instances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_instances" ADD CONSTRAINT "onboarding_instances_template_id_onboarding_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."onboarding_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_instance_id_onboarding_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."onboarding_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_template_tasks" ADD CONSTRAINT "onboarding_template_tasks_template_id_onboarding_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."onboarding_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_templates" ADD CONSTRAINT "onboarding_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_employment_requirements" ADD CONSTRAINT "pre_employment_requirements_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prehire_records" ADD CONSTRAINT "prehire_records_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prehire_records" ADD CONSTRAINT "prehire_records_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prehire_records" ADD CONSTRAINT "prehire_records_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_checks" ADD CONSTRAINT "reference_checks_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_questions" ADD CONSTRAINT "scorecard_questions_template_id_scorecard_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."scorecard_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_responses" ADD CONSTRAINT "scorecard_responses_scorecard_id_interview_scorecards_id_fk" FOREIGN KEY ("scorecard_id") REFERENCES "public"."interview_scorecards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_responses" ADD CONSTRAINT "scorecard_responses_question_id_scorecard_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."scorecard_questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_templates" ADD CONSTRAINT "scorecard_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactional_email_events" ADD CONSTRAINT "transactional_email_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "external_research_results_organization_id_idx" ON "external_research_results" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "external_research_results_session_id_idx" ON "external_research_results" USING btree ("research_session_id");--> statement-breakpoint
CREATE INDEX "research_cache_expires_at_idx" ON "research_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "research_sessions_organization_id_idx" ON "research_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "research_sessions_user_id_idx" ON "research_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "research_sessions_scout_session_id_idx" ON "research_sessions" USING btree ("scout_session_id");--> statement-breakpoint
CREATE INDEX "application_answers_application_id_idx" ON "application_answers" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_answers_question_id_idx" ON "application_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "application_answers_file_id_idx" ON "application_answers" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "application_form_versions_form_id_idx" ON "application_form_versions" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "application_forms_organization_id_idx" ON "application_forms" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "application_pre_employment_checks_application_id_idx" ON "application_pre_employment_checks" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_questions_form_version_id_idx" ON "application_questions" USING btree ("form_version_id");--> statement-breakpoint
CREATE INDEX "application_stage_history_application_id_idx" ON "application_stage_history" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_stage_history_changed_by_user_id_idx" ON "application_stage_history" USING btree ("changed_by_user_id");--> statement-breakpoint
CREATE INDEX "applications_organization_id_idx" ON "applications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "applications_candidate_id_idx" ON "applications" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "applications_job_id_idx" ON "applications" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "applications" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "applications_stage_idx" ON "applications" USING btree ("organization_id","current_stage");--> statement-breakpoint
CREATE INDEX "applications_applied_at_idx" ON "applications" USING btree ("applied_at");--> statement-breakpoint
CREATE INDEX "applications_owner_user_id_idx" ON "applications" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "applications_job_posting_id_idx" ON "applications" USING btree ("job_posting_id");--> statement-breakpoint
CREATE INDEX "background_checks_organization_id_idx" ON "background_checks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "background_checks_candidate_id_idx" ON "background_checks" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "background_checks_application_id_idx" ON "background_checks" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "candidate_dedupe_flags_organization_id_idx" ON "candidate_dedupe_flags" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "drug_screens_organization_id_idx" ON "drug_screens" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "drug_screens_candidate_id_idx" ON "drug_screens" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "drug_screens_application_id_idx" ON "drug_screens" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "employees_organization_id_idx" ON "employees" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "employees_candidate_id_idx" ON "employees" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "interview_plan_stages_plan_id_idx" ON "interview_plan_stages" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "interview_plans_organization_id_idx" ON "interview_plans" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "interview_plans_job_id_idx" ON "interview_plans" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "interview_scorecards_organization_id_idx" ON "interview_scorecards" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "interview_scorecards_interview_id_idx" ON "interview_scorecards" USING btree ("interview_id");--> statement-breakpoint
CREATE INDEX "interview_scorecards_application_id_idx" ON "interview_scorecards" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "interview_scorecards_interviewer_user_id_idx" ON "interview_scorecards" USING btree ("interviewer_user_id");--> statement-breakpoint
CREATE INDEX "job_application_form_links_form_id_idx" ON "job_application_form_links" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "job_description_versions_job_id_idx" ON "job_description_versions" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_description_versions_created_by_user_id_idx" ON "job_description_versions" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "job_description_versions_approved_by_user_id_idx" ON "job_description_versions" USING btree ("approved_by_user_id");--> statement-breakpoint
CREATE INDEX "job_postings_organization_id_idx" ON "job_postings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "job_postings_job_id_idx" ON "job_postings" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_postings_requisition_id_idx" ON "job_postings" USING btree ("requisition_id");--> statement-breakpoint
CREATE INDEX "job_requisitions_organization_id_idx" ON "job_requisitions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "job_requisitions_company_id_idx" ON "job_requisitions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "job_requisitions_hiring_manager_user_id_idx" ON "job_requisitions" USING btree ("hiring_manager_user_id");--> statement-breakpoint
CREATE INDEX "job_requisitions_recruiter_user_id_idx" ON "job_requisitions" USING btree ("recruiter_user_id");--> statement-breakpoint
CREATE INDEX "job_requisitions_created_by_user_id_idx" ON "job_requisitions" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "onboarding_instances_employee_id_idx" ON "onboarding_instances" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "onboarding_tasks_instance_id_idx" ON "onboarding_tasks" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "onboarding_template_tasks_template_id_idx" ON "onboarding_template_tasks" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "pre_employment_requirements_job_id_idx" ON "pre_employment_requirements" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "prehire_records_candidate_id_idx" ON "prehire_records" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "reference_checks_application_id_idx" ON "reference_checks" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "scorecard_questions_template_id_idx" ON "scorecard_questions" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "scorecard_responses_scorecard_id_idx" ON "scorecard_responses" USING btree ("scorecard_id");--> statement-breakpoint
CREATE INDEX "scorecard_templates_organization_id_idx" ON "scorecard_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "transactional_email_events_organization_id_idx" ON "transactional_email_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "transactional_email_events_entity_idx" ON "transactional_email_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "interviews_application_id_idx" ON "interviews" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "offers_application_id_idx" ON "offers" USING btree ("application_id");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_org_public_slug_uq" UNIQUE("organization_id","public_slug");