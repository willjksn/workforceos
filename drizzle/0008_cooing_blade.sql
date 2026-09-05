CREATE TYPE "public"."in_app_notification_kind" AS ENUM('skillbridge_window_approaching', 'follow_up_overdue', 'employer_response_overdue', 'resume_missing', 'interview_upcoming', 'approval_pending', 'conversion_decision_approaching', 'scout_action');--> statement-breakpoint
CREATE TYPE "public"."scout_action_status" AS ENUM('proposed', 'confirmed', 'executed', 'cancelled', 'rejected', 'pending_approval');--> statement-breakpoint
CREATE TYPE "public"."scout_command_family" AS ENUM('SEARCH', 'SUMMARIZE', 'DRAFT', 'CREATE', 'UPDATE', 'ASSIGN', 'ADD_TO_POOL', 'ADD_TO_JOB', 'CREATE_TASK', 'CREATE_FOLLOW_UP', 'SHOW_RECORD', 'SHOW_DASHBOARD', 'FIND_MATCHES');--> statement-breakpoint
CREATE TYPE "public"."scout_message_role" AS ENUM('user', 'scout', 'system');--> statement-breakpoint
CREATE TYPE "public"."skillbridge_alert_rule_code" AS ENUM('candidate_no_contact', 'employer_feedback_overdue', 'window_approaching', 'no_opportunity', 'resume_missing', 'conversion_approaching');--> statement-breakpoint
CREATE TYPE "public"."skillbridge_approval_status" AS ENUM('unknown', 'not_started', 'candidate_interested', 'command_discussion', 'pending', 'approved', 'denied', 'not_required', 'completed');--> statement-breakpoint
CREATE TYPE "public"."skillbridge_candidate_status" AS ENUM('new', 'initial_contact', 'profile_incomplete', 'ready_for_matching', 'matching', 'opportunity_identified', 'submitted', 'interviewing', 'skillbridge_pending', 'skillbridge_approved', 'skillbridge_active', 'conversion_pending', 'hired', 'nurture', 'closed');--> statement-breakpoint
CREATE TYPE "public"."skillbridge_document_type" AS ENUM('resume', 'certification', 'training', 'transition', 'other');--> statement-breakpoint
CREATE TYPE "public"."skillbridge_ideal_employer_kind" AS ENUM('named_company', 'employer_category', 'industry', 'no_preference');--> statement-breakpoint
CREATE TYPE "public"."skillbridge_note_kind" AS ENUM('candidate_preference', 'employer_feedback', 'timing', 'approval', 'resume', 'career_goal', 'follow_up', 'risk', 'other');--> statement-breakpoint
CREATE TYPE "public"."skillbridge_note_visibility" AS ENUM('internal', 'client_visible');--> statement-breakpoint
CREATE TYPE "public"."skillbridge_opportunity_stage" AS ENUM('candidate_identified', 'initial_contact', 'profile_complete', 'opportunity_matching', 'candidate_interested', 'employer_submitted', 'hiring_manager_review', 'interview', 'skillbridge_approval', 'skillbridge_placement', 'skillbridge_active', 'conversion_review', 'hired', 'no_match_yet', 'candidate_withdrew', 'employer_declined', 'skillbridge_denied', 'position_closed', 'nurture', 'closed');--> statement-breakpoint
CREATE TYPE "public"."skillbridge_resume_status" AS ENUM('missing', 'outdated', 'current', 'needs_review');--> statement-breakpoint
CREATE TABLE "in_app_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "in_app_notification_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"record_type" text,
	"record_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scout_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"session_id" uuid,
	"message_id" uuid,
	"user_id" uuid NOT NULL,
	"command_family" "scout_command_family" NOT NULL,
	"action_key" text NOT NULL,
	"status" "scout_action_status" DEFAULT 'proposed' NOT NULL,
	"confirmation_required" text DEFAULT 'true' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"target_record_type" text,
	"target_record_id" uuid,
	"input_dto" jsonb,
	"result" jsonb,
	"error_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scout_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "scout_message_role" NOT NULL,
	"content" text NOT NULL,
	"command_family" "scout_command_family",
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scout_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"page_pathname" text,
	"page_module" text,
	"entity_type" text,
	"entity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "skillbridge_alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" "skillbridge_alert_rule_code" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"threshold_days" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "skillbridge_alert_rules_org_code_uq" UNIQUE("organization_id","code")
);
--> statement-breakpoint
CREATE TABLE "skillbridge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"skillbridge_profile_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"document_type" "skillbridge_document_type" DEFAULT 'other' NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "skillbridge_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"skillbridge_profile_id" uuid NOT NULL,
	"skillbridge_opportunity_id" uuid,
	"kind" "skillbridge_note_kind" DEFAULT 'other' NOT NULL,
	"visibility" "skillbridge_note_visibility" DEFAULT 'internal' NOT NULL,
	"body" text NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "skillbridge_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"skillbridge_profile_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"job_id" uuid,
	"opportunity_id" uuid,
	"search_project_id" uuid,
	"stage" "skillbridge_opportunity_stage" DEFAULT 'candidate_identified' NOT NULL,
	"source" text,
	"match_score" numeric(5, 2),
	"match_explanation" text,
	"candidate_interest" text,
	"employer_interest" text,
	"submitted_at" timestamp with time zone,
	"last_employer_contact_at" timestamp with time zone,
	"last_candidate_contact_at" timestamp with time zone,
	"next_action" text,
	"next_action_due_at" timestamp with time zone,
	"owner_user_id" uuid,
	"outcome" text,
	"outcome_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "skillbridge_opportunity_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skillbridge_opportunity_id" uuid NOT NULL,
	"from_stage" "skillbridge_opportunity_stage",
	"to_stage" "skillbridge_opportunity_stage" NOT NULL,
	"changed_by_user_id" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "skillbridge_preferred_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skillbridge_profile_id" uuid NOT NULL,
	"location_label" text NOT NULL,
	"city" text,
	"region" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "skillbridge_preferred_locations_profile_label_uq" UNIQUE("skillbridge_profile_id","location_label")
);
--> statement-breakpoint
CREATE TABLE "skillbridge_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"branch" "military_branch",
	"military_occupation_id" uuid,
	"mos_rate_afsc_display" text,
	"rank_code" text,
	"rank_title" text,
	"pay_grade" text,
	"current_installation_id" uuid,
	"current_duty_location" text,
	"years_of_service" integer,
	"end_of_service_date" timestamp with time zone,
	"separation_date" timestamp with time zone,
	"retirement_date" timestamp with time zone,
	"skillbridge_eligibility_date" timestamp with time zone,
	"skillbridge_window_start" timestamp with time zone,
	"skillbridge_window_end" timestamp with time zone,
	"terminal_leave_start" timestamp with time zone,
	"candidate_available_date" timestamp with time zone,
	"skillbridge_approval_status" "skillbridge_approval_status" DEFAULT 'unknown' NOT NULL,
	"preferred_location_primary" text,
	"relocation_willingness" text,
	"remote_preference" text,
	"ideal_industry" text,
	"ideal_employer_kind" "skillbridge_ideal_employer_kind" DEFAULT 'no_preference' NOT NULL,
	"ideal_employer" text,
	"ideal_employer_notes" text,
	"candidate_status" "skillbridge_candidate_status" DEFAULT 'new' NOT NULL,
	"resume_status" "skillbridge_resume_status" DEFAULT 'missing' NOT NULL,
	"owner_user_id" uuid,
	"last_contacted_at" timestamp with time zone,
	"next_follow_up_at" timestamp with time zone,
	"next_action" text,
	"next_action_due_at" timestamp with time zone,
	"next_action_priority" "task_priority" DEFAULT 'normal' NOT NULL,
	"development_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "skillbridge_profiles_candidate_id_uq" UNIQUE("candidate_id")
);
--> statement-breakpoint
CREATE TABLE "skillbridge_target_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skillbridge_profile_id" uuid NOT NULL,
	"role_title" text NOT NULL,
	"civilian_occupation_id" uuid,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "skillbridge_target_roles_profile_title_uq" UNIQUE("skillbridge_profile_id","role_title")
);
--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_actions" ADD CONSTRAINT "scout_actions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_actions" ADD CONSTRAINT "scout_actions_session_id_scout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."scout_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_actions" ADD CONSTRAINT "scout_actions_message_id_scout_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."scout_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_actions" ADD CONSTRAINT "scout_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_messages" ADD CONSTRAINT "scout_messages_session_id_scout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."scout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_sessions" ADD CONSTRAINT "scout_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout_sessions" ADD CONSTRAINT "scout_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_alert_rules" ADD CONSTRAINT "skillbridge_alert_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_documents" ADD CONSTRAINT "skillbridge_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_documents" ADD CONSTRAINT "skillbridge_documents_skillbridge_profile_id_skillbridge_profiles_id_fk" FOREIGN KEY ("skillbridge_profile_id") REFERENCES "public"."skillbridge_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_documents" ADD CONSTRAINT "skillbridge_documents_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_documents" ADD CONSTRAINT "skillbridge_documents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_notes" ADD CONSTRAINT "skillbridge_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_notes" ADD CONSTRAINT "skillbridge_notes_skillbridge_profile_id_skillbridge_profiles_id_fk" FOREIGN KEY ("skillbridge_profile_id") REFERENCES "public"."skillbridge_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_notes" ADD CONSTRAINT "skillbridge_notes_skillbridge_opportunity_id_skillbridge_opportunities_id_fk" FOREIGN KEY ("skillbridge_opportunity_id") REFERENCES "public"."skillbridge_opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_notes" ADD CONSTRAINT "skillbridge_notes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_opportunities" ADD CONSTRAINT "skillbridge_opportunities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_opportunities" ADD CONSTRAINT "skillbridge_opportunities_skillbridge_profile_id_skillbridge_profiles_id_fk" FOREIGN KEY ("skillbridge_profile_id") REFERENCES "public"."skillbridge_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_opportunities" ADD CONSTRAINT "skillbridge_opportunities_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_opportunities" ADD CONSTRAINT "skillbridge_opportunities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_opportunities" ADD CONSTRAINT "skillbridge_opportunities_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_opportunities" ADD CONSTRAINT "skillbridge_opportunities_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_opportunities" ADD CONSTRAINT "skillbridge_opportunities_search_project_id_search_projects_id_fk" FOREIGN KEY ("search_project_id") REFERENCES "public"."search_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_opportunities" ADD CONSTRAINT "skillbridge_opportunities_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_opportunity_stage_history" ADD CONSTRAINT "skillbridge_opportunity_stage_history_skillbridge_opportunity_id_skillbridge_opportunities_id_fk" FOREIGN KEY ("skillbridge_opportunity_id") REFERENCES "public"."skillbridge_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_opportunity_stage_history" ADD CONSTRAINT "skillbridge_opportunity_stage_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_preferred_locations" ADD CONSTRAINT "skillbridge_preferred_locations_skillbridge_profile_id_skillbridge_profiles_id_fk" FOREIGN KEY ("skillbridge_profile_id") REFERENCES "public"."skillbridge_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_profiles" ADD CONSTRAINT "skillbridge_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_profiles" ADD CONSTRAINT "skillbridge_profiles_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_profiles" ADD CONSTRAINT "skillbridge_profiles_military_occupation_id_military_occupations_id_fk" FOREIGN KEY ("military_occupation_id") REFERENCES "public"."military_occupations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_profiles" ADD CONSTRAINT "skillbridge_profiles_current_installation_id_military_installations_id_fk" FOREIGN KEY ("current_installation_id") REFERENCES "public"."military_installations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_profiles" ADD CONSTRAINT "skillbridge_profiles_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_target_roles" ADD CONSTRAINT "skillbridge_target_roles_skillbridge_profile_id_skillbridge_profiles_id_fk" FOREIGN KEY ("skillbridge_profile_id") REFERENCES "public"."skillbridge_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_target_roles" ADD CONSTRAINT "skillbridge_target_roles_civilian_occupation_id_civilian_occupations_id_fk" FOREIGN KEY ("civilian_occupation_id") REFERENCES "public"."civilian_occupations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "in_app_notifications_organization_id_idx" ON "in_app_notifications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "in_app_notifications_user_id_idx" ON "in_app_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "in_app_notifications_user_read_idx" ON "in_app_notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "scout_actions_organization_id_idx" ON "scout_actions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "scout_actions_session_id_idx" ON "scout_actions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "scout_actions_message_id_idx" ON "scout_actions" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "scout_actions_user_id_idx" ON "scout_actions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scout_actions_target_idx" ON "scout_actions" USING btree ("target_record_type","target_record_id");--> statement-breakpoint
CREATE INDEX "scout_messages_session_id_idx" ON "scout_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "scout_sessions_organization_id_idx" ON "scout_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "scout_sessions_user_id_idx" ON "scout_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scout_sessions_entity_idx" ON "scout_sessions" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "skillbridge_alert_rules_organization_id_idx" ON "skillbridge_alert_rules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "skillbridge_documents_organization_id_idx" ON "skillbridge_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "skillbridge_documents_profile_id_idx" ON "skillbridge_documents" USING btree ("skillbridge_profile_id");--> statement-breakpoint
CREATE INDEX "skillbridge_documents_candidate_id_idx" ON "skillbridge_documents" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "skillbridge_documents_file_id_idx" ON "skillbridge_documents" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "skillbridge_notes_organization_id_idx" ON "skillbridge_notes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "skillbridge_notes_profile_id_idx" ON "skillbridge_notes" USING btree ("skillbridge_profile_id");--> statement-breakpoint
CREATE INDEX "skillbridge_notes_opportunity_id_idx" ON "skillbridge_notes" USING btree ("skillbridge_opportunity_id");--> statement-breakpoint
CREATE INDEX "skillbridge_notes_created_by_user_id_idx" ON "skillbridge_notes" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "skillbridge_opportunities_organization_id_idx" ON "skillbridge_opportunities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "skillbridge_opportunities_profile_id_idx" ON "skillbridge_opportunities" USING btree ("skillbridge_profile_id");--> statement-breakpoint
CREATE INDEX "skillbridge_opportunities_candidate_id_idx" ON "skillbridge_opportunities" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "skillbridge_opportunities_company_id_idx" ON "skillbridge_opportunities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "skillbridge_opportunities_job_id_idx" ON "skillbridge_opportunities" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "skillbridge_opportunities_opportunity_id_idx" ON "skillbridge_opportunities" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "skillbridge_opportunities_search_project_id_idx" ON "skillbridge_opportunities" USING btree ("search_project_id");--> statement-breakpoint
CREATE INDEX "skillbridge_opportunities_owner_user_id_idx" ON "skillbridge_opportunities" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "skillbridge_opportunities_org_stage_idx" ON "skillbridge_opportunities" USING btree ("organization_id","stage");--> statement-breakpoint
CREATE INDEX "skillbridge_opportunity_stage_history_opp_id_idx" ON "skillbridge_opportunity_stage_history" USING btree ("skillbridge_opportunity_id");--> statement-breakpoint
CREATE INDEX "skillbridge_opportunity_stage_history_changed_by_idx" ON "skillbridge_opportunity_stage_history" USING btree ("changed_by_user_id");--> statement-breakpoint
CREATE INDEX "skillbridge_preferred_locations_profile_id_idx" ON "skillbridge_preferred_locations" USING btree ("skillbridge_profile_id");--> statement-breakpoint
CREATE INDEX "skillbridge_profiles_organization_id_idx" ON "skillbridge_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "skillbridge_profiles_candidate_id_idx" ON "skillbridge_profiles" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "skillbridge_profiles_military_occupation_id_idx" ON "skillbridge_profiles" USING btree ("military_occupation_id");--> statement-breakpoint
CREATE INDEX "skillbridge_profiles_current_installation_id_idx" ON "skillbridge_profiles" USING btree ("current_installation_id");--> statement-breakpoint
CREATE INDEX "skillbridge_profiles_owner_user_id_idx" ON "skillbridge_profiles" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "skillbridge_profiles_org_status_idx" ON "skillbridge_profiles" USING btree ("organization_id","candidate_status");--> statement-breakpoint
CREATE INDEX "skillbridge_profiles_window_start_idx" ON "skillbridge_profiles" USING btree ("skillbridge_window_start");--> statement-breakpoint
CREATE INDEX "skillbridge_profiles_next_follow_up_idx" ON "skillbridge_profiles" USING btree ("next_follow_up_at");--> statement-breakpoint
CREATE INDEX "skillbridge_profiles_next_action_due_idx" ON "skillbridge_profiles" USING btree ("next_action_due_at");--> statement-breakpoint
CREATE INDEX "skillbridge_target_roles_profile_id_idx" ON "skillbridge_target_roles" USING btree ("skillbridge_profile_id");--> statement-breakpoint
CREATE INDEX "skillbridge_target_roles_occupation_id_idx" ON "skillbridge_target_roles" USING btree ("civilian_occupation_id");