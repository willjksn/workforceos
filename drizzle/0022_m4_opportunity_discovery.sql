CREATE TYPE "public"."career_source_health" AS ENUM('not_yet_synced', 'live', 'manual', 'error', 'blocked');--> statement-breakpoint
CREATE TABLE "career_source_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"career_source_id" uuid NOT NULL,
	"status" text NOT NULL,
	"trigger" text NOT NULL,
	"listing_complete" boolean DEFAULT false NOT NULL,
	"discovered_count" integer DEFAULT 0 NOT NULL,
	"new_count" integer DEFAULT 0 NOT NULL,
	"changed_count" integer DEFAULT 0 NOT NULL,
	"unchanged_count" integer DEFAULT 0 NOT NULL,
	"closed_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"actor_user_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "career_source_sync_runs_status_chk" CHECK ("career_source_sync_runs"."status" in ('succeeded', 'failed', 'refused')),
	CONSTRAINT "career_source_sync_runs_trigger_chk" CHECK ("career_source_sync_runs"."trigger" in ('manual', 'schedule'))
);
--> statement-breakpoint
ALTER TABLE "career_sources" ADD COLUMN "adapter_key" text;--> statement-breakpoint
ALTER TABLE "career_sources" ADD COLUMN "health_status" "career_source_health" DEFAULT 'not_yet_synced' NOT NULL;--> statement-breakpoint
ALTER TABLE "career_sources" ADD COLUMN "last_discovered_count" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "last_observed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "public_compensation_text" text;--> statement-breakpoint
ALTER TABLE "job_description_versions" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "job_description_versions" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "job_description_versions" ADD COLUMN "external_key" text;--> statement-breakpoint
ALTER TABLE "career_source_sync_runs" ADD CONSTRAINT "career_source_sync_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_source_sync_runs" ADD CONSTRAINT "career_source_sync_runs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_source_sync_runs" ADD CONSTRAINT "career_source_sync_runs_source_org_fk" FOREIGN KEY ("career_source_id","organization_id") REFERENCES "public"."career_sources"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "career_source_sync_runs_organization_id_idx" ON "career_source_sync_runs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "career_source_sync_runs_career_source_id_idx" ON "career_source_sync_runs" USING btree ("career_source_id");--> statement-breakpoint
CREATE INDEX "career_source_sync_runs_actor_user_id_idx" ON "career_source_sync_runs" USING btree ("actor_user_id");