CREATE TYPE "public"."guarantee_status" AS ENUM('active', 'expiring_soon', 'completed', 'replacement_required', 'waived');--> statement-breakpoint
CREATE TYPE "public"."mapping_origin" AS ENUM('reference_data', 'human', 'agent', 'import', 'system');--> statement-breakpoint
CREATE TYPE "public"."mapping_review_status" AS ENUM('pending', 'approved', 'rejected', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."placement_status" AS ENUM('pending_start', 'active', 'completed', 'fallen_off', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."search_project_status" AS ENUM('draft', 'active', 'on_hold', 'filled', 'cancelled', 'closed');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('draft', 'pending_approval', 'submitted', 'accepted', 'rejected', 'withdrawn');--> statement-breakpoint
ALTER TYPE "public"."candidate_pipeline_status" ADD VALUE 'identified' BEFORE 'screened';--> statement-breakpoint
ALTER TYPE "public"."candidate_pipeline_status" ADD VALUE 'rediscovered' BEFORE 'screened';--> statement-breakpoint
ALTER TYPE "public"."candidate_pipeline_status" ADD VALUE 'contacted' BEFORE 'screened';--> statement-breakpoint
ALTER TYPE "public"."candidate_pipeline_status" ADD VALUE 'interested' BEFORE 'screened';--> statement-breakpoint
ALTER TYPE "public"."candidate_pipeline_status" ADD VALUE 'screening' BEFORE 'submitted';--> statement-breakpoint
ALTER TYPE "public"."candidate_pipeline_status" ADD VALUE 'qualified' BEFORE 'submitted';--> statement-breakpoint
ALTER TYPE "public"."candidate_pipeline_status" ADD VALUE 'interview' BEFORE 'offered';--> statement-breakpoint
ALTER TYPE "public"."candidate_pipeline_status" ADD VALUE 'finalist' BEFORE 'offered';--> statement-breakpoint
ALTER TYPE "public"."candidate_pipeline_status" ADD VALUE 'offer' BEFORE 'placed';--> statement-breakpoint
ALTER TYPE "public"."candidate_pipeline_status" ADD VALUE 'rejected' BEFORE 'withdrawn';--> statement-breakpoint
ALTER TYPE "public"."candidate_pipeline_status" ADD VALUE 'nurture';--> statement-breakpoint
ALTER TYPE "public"."job_status" ADD VALUE 'search_active' BEFORE 'on_hold';--> statement-breakpoint
ALTER TYPE "public"."skill_requirement_type" ADD VALUE 'nice_to_have';--> statement-breakpoint
CREATE TABLE "candidate_screenings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"motivation" text,
	"compensation" text,
	"availability" text,
	"location_relocation" text,
	"work_authorization" text,
	"travel" text,
	"required_certifications" text,
	"required_skills" text,
	"career_alignment" text,
	"candidate_questions" text,
	"recruiter_assessment" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "placement_guarantees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"placement_id" uuid NOT NULL,
	"search_project_id" uuid,
	"guarantee_days" integer NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" "guarantee_status" DEFAULT 'active' NOT NULL,
	"replacement_required" boolean DEFAULT false NOT NULL,
	"refund_or_replacement_notes" text,
	"source_terms" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bridge_training_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"military_occupation_id" uuid NOT NULL,
	"civilian_occupation_id" uuid,
	"mapping_id" uuid,
	"transferable_skills" text,
	"missing_skills" text,
	"recommended_credential" text,
	"training_program" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"expected_bridge_purpose" text,
	"source" text,
	"source_version" text,
	"review_status" "mapping_review_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"origin" "mapping_origin" DEFAULT 'reference_data' NOT NULL,
	"originating_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "candidate_military_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"military_occupation_id" uuid,
	"civilian_occupation_id" uuid,
	"hiring_manager_summary" text,
	"civilian_experience_summary" text,
	"overall_alignment" text,
	"explanation" text,
	"source" text,
	"ai_model" text,
	"model_version" text,
	"confidence" integer,
	"review_status" "mapping_review_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"origin" "mapping_origin" DEFAULT 'system' NOT NULL,
	"originating_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "occupation_data_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_version" text,
	"summary" text,
	"records_upserted" integer DEFAULT 0 NOT NULL,
	"records_skipped" integer DEFAULT 0 NOT NULL,
	"imported_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "interviews" ALTER COLUMN "submission_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "skills_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "experience_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "industry_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "location_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "compensation_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "certification_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "military_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "career_alignment_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "prior_feedback_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "strengths" text;--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "gaps" text;--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "model_name" text;--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "model_version" text;--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "human_review_status" "mapping_review_status";--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "human_rating" integer;--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "human_reviewed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "last_calculated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "candidate_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "job_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "stage" text;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "format" text;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "location_or_link" text;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "participants" text;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "candidate_prep" text;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "candidate_feedback" text;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "client_feedback" text;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "client_feedback_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "next_step" text;--> statement-breakpoint
ALTER TABLE "job_skills" ADD COLUMN "minimum_years" integer;--> statement-breakpoint
ALTER TABLE "job_skills" ADD COLUMN "importance_weight" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_skills" ADD COLUMN "human_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "normalized_title" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "location_label" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "hiring_manager_contact_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "search_owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "reporting_relationship" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "employment_type" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "workplace_type" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "compensation_min" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "compensation_max" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "compensation_currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "bonus" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "required_experience_years" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "education" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "certifications" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "travel" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "relocation" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "schedule_shift" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "reason_open" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "target_start_date" date;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "interview_process" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "business_context" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "candidate_value_proposition" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "prior_search_failure_notes" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "success_measures" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "urgency" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "military_compatibility" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "last_activity_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "internal_talent_search_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "internal_talent_search_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "internal_candidates_reviewed_count" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "internal_candidates_recommended_count" integer;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "search_project_id" uuid;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "base_salary" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "bonus" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "other_compensation" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "offer_date" date;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "expiration_date" date;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "negotiation_notes" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "decline_reason" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "compensation_gap" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "candidate_hesitation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "competing_offer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "delayed_client_process" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "relocation_concern" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "search_project_id" uuid;--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "offer_id" uuid;--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "starting_salary" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "fee_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "placement_fee" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "guarantee_days" integer;--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "invoice_reference" text;--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "billing_event_queued_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "status" "placement_status" DEFAULT 'pending_start' NOT NULL;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "service_id" uuid;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "status" "search_project_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "target_fill_date" date;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "fee_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "fee_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "guarantee_days" integer;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "contract_reference" text;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "candidate_profile" text;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "target_industries" text;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "target_employers" text;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "target_geography" text;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "talent_pools" text;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "military_occupations" text;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "military_installations" text;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "sourcing_channels" text;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "boolean_strategy" text;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "outreach_approach" text;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "expected_search_difficulty" text;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "compensation_risks" text;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "likely_objections" text;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "strategy_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "strategy_approved_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "internal_search_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "match_id" uuid;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "approved_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "status" "submission_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "candidate_summary" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "relevant_experience" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "matched_requirements" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "transferable_skills" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "military_translation" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "compensation" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "availability" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "identified_gaps" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "recruiter_commentary" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "rank" text;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "pay_grade" text;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "years_service" integer;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "years_in_occupation" integer;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "leadership_level" text;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "duty_stations" text;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "platforms" text;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "training" text;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "certifications" text;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "clearance" text;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "transition_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "military_civilian_mappings" ADD COLUMN "compatibility_score" integer;--> statement-breakpoint
ALTER TABLE "military_civilian_mappings" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "military_civilian_mappings" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "military_civilian_mappings" ADD COLUMN "source_version" text;--> statement-breakpoint
ALTER TABLE "military_civilian_mappings" ADD COLUMN "ai_model" text;--> statement-breakpoint
ALTER TABLE "military_civilian_mappings" ADD COLUMN "model_version" text;--> statement-breakpoint
ALTER TABLE "military_civilian_mappings" ADD COLUMN "confidence" integer;--> statement-breakpoint
ALTER TABLE "military_civilian_mappings" ADD COLUMN "review_status" "mapping_review_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "military_civilian_mappings" ADD COLUMN "reviewed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "military_civilian_mappings" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "military_civilian_mappings" ADD COLUMN "last_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "military_civilian_mappings" ADD COLUMN "origin" "mapping_origin" DEFAULT 'reference_data' NOT NULL;--> statement-breakpoint
ALTER TABLE "military_civilian_mappings" ADD COLUMN "originating_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "military_installations" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "military_installations" ADD COLUMN "latitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "military_installations" ADD COLUMN "longitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "military_installations" ADD COLUMN "coordinate_source" text;--> statement-breakpoint
ALTER TABLE "military_installations" ADD COLUMN "transition_relevance" text;--> statement-breakpoint
ALTER TABLE "military_installations" ADD COLUMN "skillbridge_relevance" text;--> statement-breakpoint
ALTER TABLE "military_installations" ADD COLUMN "recruiting_priority" text;--> statement-breakpoint
ALTER TABLE "military_installations" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "military_occupation_installations" ADD COLUMN "confidence" integer;--> statement-breakpoint
ALTER TABLE "military_occupation_installations" ADD COLUMN "why_present" text;--> statement-breakpoint
ALTER TABLE "military_occupation_installations" ADD COLUMN "transition_opportunity" text;--> statement-breakpoint
ALTER TABLE "military_occupation_installations" ADD COLUMN "skillbridge_opportunity" text;--> statement-breakpoint
ALTER TABLE "military_occupation_installations" ADD COLUMN "recruiting_priority" text;--> statement-breakpoint
ALTER TABLE "military_occupation_installations" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "military_occupation_installations" ADD COLUMN "source_version" text;--> statement-breakpoint
ALTER TABLE "military_occupation_installations" ADD COLUMN "review_status" "mapping_review_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "military_occupation_installations" ADD COLUMN "reviewed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "military_occupation_installations" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "military_occupation_installations" ADD COLUMN "origin" "mapping_origin" DEFAULT 'reference_data' NOT NULL;--> statement-breakpoint
ALTER TABLE "military_occupation_installations" ADD COLUMN "originating_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "military_occupations" ADD COLUMN "career_field" text;--> statement-breakpoint
ALTER TABLE "military_occupations" ADD COLUMN "rank_applicability" text;--> statement-breakpoint
ALTER TABLE "military_occupations" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "military_occupations" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "military_occupations" ADD COLUMN "source_version" text;--> statement-breakpoint
ALTER TABLE "military_occupations" ADD COLUMN "last_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidate_screenings" ADD CONSTRAINT "candidate_screenings_match_id_candidate_job_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."candidate_job_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_screenings" ADD CONSTRAINT "candidate_screenings_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_guarantees" ADD CONSTRAINT "placement_guarantees_placement_id_placements_id_fk" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_guarantees" ADD CONSTRAINT "placement_guarantees_search_project_id_search_projects_id_fk" FOREIGN KEY ("search_project_id") REFERENCES "public"."search_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bridge_training_recommendations" ADD CONSTRAINT "bridge_training_recommendations_military_occupation_id_military_occupations_id_fk" FOREIGN KEY ("military_occupation_id") REFERENCES "public"."military_occupations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bridge_training_recommendations" ADD CONSTRAINT "bridge_training_recommendations_civilian_occupation_id_civilian_occupations_id_fk" FOREIGN KEY ("civilian_occupation_id") REFERENCES "public"."civilian_occupations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bridge_training_recommendations" ADD CONSTRAINT "bridge_training_recommendations_mapping_id_military_civilian_mappings_id_fk" FOREIGN KEY ("mapping_id") REFERENCES "public"."military_civilian_mappings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bridge_training_recommendations" ADD CONSTRAINT "bridge_training_recommendations_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bridge_training_recommendations" ADD CONSTRAINT "bridge_training_recommendations_originating_agent_id_agents_id_fk" FOREIGN KEY ("originating_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_military_translations" ADD CONSTRAINT "candidate_military_translations_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_military_translations" ADD CONSTRAINT "candidate_military_translations_military_occupation_id_military_occupations_id_fk" FOREIGN KEY ("military_occupation_id") REFERENCES "public"."military_occupations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_military_translations" ADD CONSTRAINT "candidate_military_translations_civilian_occupation_id_civilian_occupations_id_fk" FOREIGN KEY ("civilian_occupation_id") REFERENCES "public"."civilian_occupations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_military_translations" ADD CONSTRAINT "candidate_military_translations_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_military_translations" ADD CONSTRAINT "candidate_military_translations_originating_agent_id_agents_id_fk" FOREIGN KEY ("originating_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupation_data_imports" ADD CONSTRAINT "occupation_data_imports_imported_by_user_id_users_id_fk" FOREIGN KEY ("imported_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_screenings_match_id_idx" ON "candidate_screenings" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "candidate_screenings_created_by_user_id_idx" ON "candidate_screenings" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "placement_guarantees_placement_id_idx" ON "placement_guarantees" USING btree ("placement_id");--> statement-breakpoint
CREATE INDEX "placement_guarantees_search_project_id_idx" ON "placement_guarantees" USING btree ("search_project_id");--> statement-breakpoint
CREATE INDEX "bridge_training_recommendations_occupation_id_idx" ON "bridge_training_recommendations" USING btree ("military_occupation_id");--> statement-breakpoint
CREATE INDEX "bridge_training_recommendations_civilian_id_idx" ON "bridge_training_recommendations" USING btree ("civilian_occupation_id");--> statement-breakpoint
CREATE INDEX "bridge_training_recommendations_mapping_id_idx" ON "bridge_training_recommendations" USING btree ("mapping_id");--> statement-breakpoint
CREATE INDEX "bridge_training_recommendations_reviewed_by_user_id_idx" ON "bridge_training_recommendations" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE INDEX "bridge_training_recommendations_originating_agent_id_idx" ON "bridge_training_recommendations" USING btree ("originating_agent_id");--> statement-breakpoint
CREATE INDEX "candidate_military_translations_candidate_id_idx" ON "candidate_military_translations" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "candidate_military_translations_occupation_id_idx" ON "candidate_military_translations" USING btree ("military_occupation_id");--> statement-breakpoint
CREATE INDEX "candidate_military_translations_civilian_id_idx" ON "candidate_military_translations" USING btree ("civilian_occupation_id");--> statement-breakpoint
CREATE INDEX "candidate_military_translations_reviewed_by_user_id_idx" ON "candidate_military_translations" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE INDEX "occupation_data_imports_imported_by_user_id_idx" ON "occupation_data_imports" USING btree ("imported_by_user_id");--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD CONSTRAINT "candidate_job_matches_human_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("human_reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_location_id_company_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."company_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_hiring_manager_contact_id_contacts_id_fk" FOREIGN KEY ("hiring_manager_contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_search_owner_user_id_users_id_fk" FOREIGN KEY ("search_owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_search_project_id_search_projects_id_fk" FOREIGN KEY ("search_project_id") REFERENCES "public"."search_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_search_project_id_search_projects_id_fk" FOREIGN KEY ("search_project_id") REFERENCES "public"."search_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_projects" ADD CONSTRAINT "search_projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_projects" ADD CONSTRAINT "search_projects_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_projects" ADD CONSTRAINT "search_projects_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_projects" ADD CONSTRAINT "search_projects_strategy_approved_by_user_id_users_id_fk" FOREIGN KEY ("strategy_approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_match_id_candidate_job_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."candidate_job_matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "military_civilian_mappings" ADD CONSTRAINT "military_civilian_mappings_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "military_civilian_mappings" ADD CONSTRAINT "military_civilian_mappings_originating_agent_id_agents_id_fk" FOREIGN KEY ("originating_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "military_occupation_installations" ADD CONSTRAINT "military_occupation_installations_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "military_occupation_installations" ADD CONSTRAINT "military_occupation_installations_originating_agent_id_agents_id_fk" FOREIGN KEY ("originating_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_job_matches_human_reviewed_by_user_id_idx" ON "candidate_job_matches" USING btree ("human_reviewed_by_user_id");--> statement-breakpoint
CREATE INDEX "interviews_candidate_id_idx" ON "interviews" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "interviews_job_id_idx" ON "interviews" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "jobs_location_id_idx" ON "jobs" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "jobs_hiring_manager_contact_id_idx" ON "jobs" USING btree ("hiring_manager_contact_id");--> statement-breakpoint
CREATE INDEX "jobs_search_owner_user_id_idx" ON "jobs" USING btree ("search_owner_user_id");--> statement-breakpoint
CREATE INDEX "offers_search_project_id_idx" ON "offers" USING btree ("search_project_id");--> statement-breakpoint
CREATE INDEX "placements_company_id_idx" ON "placements" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "placements_search_project_id_idx" ON "placements" USING btree ("search_project_id");--> statement-breakpoint
CREATE INDEX "placements_offer_id_idx" ON "placements" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "search_projects_company_id_idx" ON "search_projects" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "search_projects_service_id_idx" ON "search_projects" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "search_projects_owner_user_id_idx" ON "search_projects" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "search_projects_strategy_approved_by_user_id_idx" ON "search_projects" USING btree ("strategy_approved_by_user_id");--> statement-breakpoint
CREATE INDEX "submissions_match_id_idx" ON "submissions" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "submissions_approved_by_user_id_idx" ON "submissions" USING btree ("approved_by_user_id");--> statement-breakpoint
CREATE INDEX "military_civilian_mappings_reviewed_by_user_id_idx" ON "military_civilian_mappings" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE INDEX "military_civilian_mappings_originating_agent_id_idx" ON "military_civilian_mappings" USING btree ("originating_agent_id");--> statement-breakpoint
CREATE INDEX "military_occupation_installations_reviewed_by_user_id_idx" ON "military_occupation_installations" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE INDEX "military_occupation_installations_originating_agent_id_idx" ON "military_occupation_installations" USING btree ("originating_agent_id");