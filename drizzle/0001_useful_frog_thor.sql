CREATE TYPE "public"."activity_type" AS ENUM('note', 'email', 'phone', 'meeting', 'task', 'research', 'outreach', 'status_change', 'system', 'other');--> statement-breakpoint
CREATE TYPE "public"."designation_type" AS ENUM('silver_medalist');--> statement-breakpoint
CREATE TYPE "public"."engagement_direction" AS ENUM('inbound', 'outbound', 'internal');--> statement-breakpoint
CREATE TYPE "public"."engagement_type" AS ENUM('email', 'phone', 'linkedin', 'interview_prep', 'nurture', 'note', 'check_in', 'other');--> statement-breakpoint
CREATE TYPE "public"."candidate_military_status" AS ENUM('unknown', 'none', 'veteran', 'active_duty', 'reserve', 'national_guard');--> statement-breakpoint
CREATE TYPE "public"."opportunity_score_band" AS ENUM('priority', 'active_qualified', 'nurture', 'monitor');--> statement-breakpoint
CREATE TYPE "public"."signal_review_status" AS ENUM('draft', 'pending_review', 'approved', 'dismissed', 'converted');--> statement-breakpoint
ALTER TYPE "public"."opportunity_stage" ADD VALUE 'target' BEFORE 'qualified';--> statement-breakpoint
ALTER TYPE "public"."opportunity_stage" ADD VALUE 'discovery_scheduled' BEFORE 'proposal';--> statement-breakpoint
ALTER TYPE "public"."opportunity_stage" ADD VALUE 'discovery_complete' BEFORE 'proposal';--> statement-breakpoint
ALTER TYPE "public"."opportunity_stage" ADD VALUE 'nurture' BEFORE 'won';--> statement-breakpoint
ALTER TYPE "public"."talent_pool_scope" ADD VALUE 'user';--> statement-breakpoint
CREATE TABLE "opportunity_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"icp_fit" integer DEFAULT 0 NOT NULL,
	"trigger_score" integer DEFAULT 0 NOT NULL,
	"demonstrated_pain" integer DEFAULT 0 NOT NULL,
	"service_fit" integer DEFAULT 0 NOT NULL,
	"buyer_access" integer DEFAULT 0 NOT NULL,
	"timing_budget" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"override_score" integer,
	"override_reason" text,
	"override_user_id" uuid,
	"override_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "opportunity_scores_opportunity_uq" UNIQUE("opportunity_id")
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"activity_type" "activity_type" NOT NULL,
	"subject" text NOT NULL,
	"details" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"company_id" uuid,
	"contact_id" uuid,
	"candidate_id" uuid,
	"opportunity_id" uuid,
	"next_action" text,
	"follow_up_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "candidate_designations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"designation_type" "designation_type" NOT NULL,
	"related_job_id" uuid,
	"related_company_id" uuid,
	"reason" text,
	"created_by_user_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "candidate_engagements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"engagement_type" "engagement_type" NOT NULL,
	"channel" text,
	"subject" text,
	"summary" text,
	"direction" "engagement_direction" DEFAULT 'outbound' NOT NULL,
	"user_id" uuid,
	"agent_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"response_status" text,
	"related_company_id" uuid,
	"related_job_id" uuid,
	"next_follow_up_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"module" text NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb NOT NULL,
	"sort" text,
	"visible_columns" jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "saved_views_user_module_name_uq" UNIQUE("user_id","module","name")
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "industry" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "sub_industry" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "employee_count" integer;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "annual_revenue" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "account_owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "military_fit_score" integer;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "workforce_opportunity_score" integer;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "last_activity_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "next_action" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "next_action_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "department" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "buyer_persona" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "seniority" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "influence_level" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "relationship_strength" "relationship_strength" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "last_contacted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "do_not_contact" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "communication_preferences" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "service_code" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "value_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "probability" integer;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "opportunity_score" integer;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "score_band" "opportunity_score_band";--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "urgency" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "target_close_date" date;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "primary_contact_id" uuid;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "problem_statement" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "business_impact" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "lost_reason" text;--> statement-breakpoint
ALTER TABLE "opportunity_signals" ADD COLUMN "evidence" text;--> statement-breakpoint
ALTER TABLE "opportunity_signals" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "opportunity_signals" ADD COLUMN "confidence" integer;--> statement-breakpoint
ALTER TABLE "opportunity_signals" ADD COLUMN "business_impact" text;--> statement-breakpoint
ALTER TABLE "opportunity_signals" ADD COLUMN "review_status" "signal_review_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunity_signals" ADD COLUMN "resulting_opportunity_id" uuid;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD COLUMN "years_experience" integer;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD COLUMN "proficiency" text;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD COLUMN "confidence" integer;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD COLUMN "human_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_talent_pools" ADD COLUMN "match_score" integer;--> statement-breakpoint
ALTER TABLE "candidate_talent_pools" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "current_company" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "years_experience" integer;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "military_status" "candidate_military_status" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "compensation_expectations" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "career_interests" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "remote_preference" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "relocation_willingness" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "current_resume_file_id" uuid;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "last_contacted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "last_profile_review_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "do_not_contact" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "talent_pools" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "talent_pools" ADD COLUMN "last_evaluated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "opportunity_scores" ADD CONSTRAINT "opportunity_scores_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_scores" ADD CONSTRAINT "opportunity_scores_override_user_id_users_id_fk" FOREIGN KEY ("override_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_designations" ADD CONSTRAINT "candidate_designations_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_designations" ADD CONSTRAINT "candidate_designations_related_job_id_jobs_id_fk" FOREIGN KEY ("related_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_designations" ADD CONSTRAINT "candidate_designations_related_company_id_companies_id_fk" FOREIGN KEY ("related_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_designations" ADD CONSTRAINT "candidate_designations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_engagements" ADD CONSTRAINT "candidate_engagements_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_engagements" ADD CONSTRAINT "candidate_engagements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_engagements" ADD CONSTRAINT "candidate_engagements_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_engagements" ADD CONSTRAINT "candidate_engagements_related_company_id_companies_id_fk" FOREIGN KEY ("related_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_engagements" ADD CONSTRAINT "candidate_engagements_related_job_id_jobs_id_fk" FOREIGN KEY ("related_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opportunity_scores_opportunity_id_idx" ON "opportunity_scores" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "opportunity_scores_override_user_id_idx" ON "opportunity_scores" USING btree ("override_user_id");--> statement-breakpoint
CREATE INDEX "activities_organization_id_idx" ON "activities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "activities_created_by_user_id_idx" ON "activities" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "activities_company_id_idx" ON "activities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "activities_contact_id_idx" ON "activities" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "activities_candidate_id_idx" ON "activities" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "activities_opportunity_id_idx" ON "activities" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "activities_occurred_at_idx" ON "activities" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "candidate_designations_candidate_id_idx" ON "candidate_designations" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "candidate_designations_related_job_id_idx" ON "candidate_designations" USING btree ("related_job_id");--> statement-breakpoint
CREATE INDEX "candidate_designations_related_company_id_idx" ON "candidate_designations" USING btree ("related_company_id");--> statement-breakpoint
CREATE INDEX "candidate_designations_created_by_user_id_idx" ON "candidate_designations" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "candidate_engagements_candidate_id_idx" ON "candidate_engagements" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "candidate_engagements_user_id_idx" ON "candidate_engagements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "candidate_engagements_agent_id_idx" ON "candidate_engagements" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "candidate_engagements_related_company_id_idx" ON "candidate_engagements" USING btree ("related_company_id");--> statement-breakpoint
CREATE INDEX "candidate_engagements_related_job_id_idx" ON "candidate_engagements" USING btree ("related_job_id");--> statement-breakpoint
CREATE INDEX "saved_views_organization_id_idx" ON "saved_views" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "saved_views_user_id_idx" ON "saved_views" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_account_owner_user_id_users_id_fk" FOREIGN KEY ("account_owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_primary_contact_id_contacts_id_fk" FOREIGN KEY ("primary_contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_signals" ADD CONSTRAINT "opportunity_signals_resulting_opportunity_id_opportunities_id_fk" FOREIGN KEY ("resulting_opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_current_resume_file_id_files_id_fk" FOREIGN KEY ("current_resume_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_pools" ADD CONSTRAINT "talent_pools_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_account_owner_user_id_idx" ON "companies" USING btree ("account_owner_user_id");--> statement-breakpoint
CREATE INDEX "contacts_owner_user_id_idx" ON "contacts" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "opportunities_owner_user_id_idx" ON "opportunities" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "opportunities_primary_contact_id_idx" ON "opportunities" USING btree ("primary_contact_id");--> statement-breakpoint
CREATE INDEX "opportunity_signals_resulting_opportunity_id_idx" ON "opportunity_signals" USING btree ("resulting_opportunity_id");--> statement-breakpoint
CREATE INDEX "candidates_owner_user_id_idx" ON "candidates" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "candidates_current_resume_file_id_idx" ON "candidates" USING btree ("current_resume_file_id");--> statement-breakpoint
CREATE INDEX "talent_pools_owner_user_id_idx" ON "talent_pools" USING btree ("owner_user_id");