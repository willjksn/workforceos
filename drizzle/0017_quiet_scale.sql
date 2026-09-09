ALTER TYPE "public"."skillbridge_alert_rule_code" ADD VALUE 'window_starting_soon';--> statement-breakpoint
ALTER TYPE "public"."skillbridge_alert_rule_code" ADD VALUE 'window_ending_soon';--> statement-breakpoint
CREATE TYPE "public"."public_access_token_purpose" AS ENUM('interview_self_schedule', 'hire_onboarding', 'application_status');--> statement-breakpoint
CREATE TYPE "public"."report_export_cadence" AS ENUM('daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."report_export_job_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "skillbridge_profiles" ADD COLUMN "ets_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "skillbridge_profiles" ADD COLUMN "eaos_date" timestamp with time zone;--> statement-breakpoint
CREATE TABLE "public_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"purpose" "public_access_token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"application_id" uuid,
	"onboarding_instance_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "report_export_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"category" text NOT NULL,
	"cadence" "report_export_cadence" DEFAULT 'weekly' NOT NULL,
	"include_pii" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"filters" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "report_export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"schedule_id" uuid,
	"requested_by_user_id" uuid,
	"category" text NOT NULL,
	"status" "report_export_job_status" DEFAULT 'queued' NOT NULL,
	"include_pii" boolean DEFAULT false NOT NULL,
	"row_count" integer,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);--> statement-breakpoint
ALTER TABLE "public_access_tokens" ADD CONSTRAINT "public_access_tokens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_access_tokens" ADD CONSTRAINT "public_access_tokens_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_access_tokens" ADD CONSTRAINT "public_access_tokens_onboarding_instance_id_onboarding_instances_id_fk" FOREIGN KEY ("onboarding_instance_id") REFERENCES "public"."onboarding_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_access_tokens" ADD CONSTRAINT "public_access_tokens_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_export_schedules" ADD CONSTRAINT "report_export_schedules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_export_schedules" ADD CONSTRAINT "report_export_schedules_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_export_jobs" ADD CONSTRAINT "report_export_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_export_jobs" ADD CONSTRAINT "report_export_jobs_schedule_id_report_export_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."report_export_schedules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_export_jobs" ADD CONSTRAINT "report_export_jobs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "public_access_tokens_token_hash_uq" ON "public_access_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "public_access_tokens_organization_id_idx" ON "public_access_tokens" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "public_access_tokens_application_id_idx" ON "public_access_tokens" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "public_access_tokens_onboarding_instance_id_idx" ON "public_access_tokens" USING btree ("onboarding_instance_id");--> statement-breakpoint
CREATE INDEX "public_access_tokens_created_by_user_id_idx" ON "public_access_tokens" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "public_access_tokens_purpose_expires_idx" ON "public_access_tokens" USING btree ("purpose","expires_at");--> statement-breakpoint
CREATE INDEX "report_export_schedules_organization_id_idx" ON "report_export_schedules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "report_export_schedules_created_by_user_id_idx" ON "report_export_schedules" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "report_export_schedules_next_run_idx" ON "report_export_schedules" USING btree ("enabled","next_run_at");--> statement-breakpoint
CREATE INDEX "report_export_jobs_organization_id_idx" ON "report_export_jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "report_export_jobs_schedule_id_idx" ON "report_export_jobs" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "report_export_jobs_requested_by_user_id_idx" ON "report_export_jobs" USING btree ("requested_by_user_id");
