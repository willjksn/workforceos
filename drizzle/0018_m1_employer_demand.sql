-- M1 employer demand only. Statements that 0017 already applied were removed from the
-- generated file so this migration stays additive on databases that have 0017.
CREATE TYPE "public"."career_source_type" AS ENUM('public_careers_page', 'feed', 'employer_api', 'manual_url', 'csv');--> statement-breakpoint
CREATE TYPE "public"."job_demand_horizon" AS ENUM('current', 'evergreen', 'future');--> statement-breakpoint
ALTER TYPE "public"."job_context_type" ADD VALUE 'monitored_public';--> statement-breakpoint
ALTER TYPE "public"."job_context_type" ADD VALUE 'exploratory';--> statement-breakpoint
CREATE TABLE "career_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"source_type" "career_source_type" NOT NULL,
	"name" text NOT NULL,
	"base_url" text,
	"careers_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"last_successful_sync_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "career_sources_id_organization_uq" UNIQUE("id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "demand_horizon" "job_demand_horizon" DEFAULT 'current' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "career_source_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "external_key" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "career_sources" ADD CONSTRAINT "career_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_sources" ADD CONSTRAINT "career_sources_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "career_sources_organization_id_idx" ON "career_sources" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "career_sources_company_id_idx" ON "career_sources" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "career_sources_org_active_idx" ON "career_sources" USING btree ("organization_id","active");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_career_source_organization_fk" FOREIGN KEY ("career_source_id","organization_id") REFERENCES "public"."career_sources"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_career_source_id_idx" ON "jobs" USING btree ("career_source_id");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_career_source_external_key_uq" UNIQUE("career_source_id","external_key");
