CREATE TYPE "public"."privacy_deletion_status" AS ENUM('requested', 'approved', 'completed', 'rejected');--> statement-breakpoint
CREATE TABLE "privacy_deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"requested_by_user_id" uuid,
	"status" "privacy_deletion_status" DEFAULT 'requested' NOT NULL,
	"reason" text NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket_key" text NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limit_buckets_key_window_uq" UNIQUE("bucket_key","window_started_at")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "privacy_deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "privacy_deletion_requests" ADD CONSTRAINT "privacy_deletion_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_deletion_requests" ADD CONSTRAINT "privacy_deletion_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "privacy_deletion_requests_organization_id_idx" ON "privacy_deletion_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "privacy_deletion_requests_candidate_id_idx" ON "privacy_deletion_requests" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "privacy_deletion_requests_requested_by_user_id_idx" ON "privacy_deletion_requests" USING btree ("requested_by_user_id");--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_bucket_key_idx" ON "rate_limit_buckets" USING btree ("bucket_key");--> statement-breakpoint
CREATE INDEX "approvals_org_status_idx" ON "approvals" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "agent_runs_org_status_idx" ON "agent_runs" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "contacts_org_last_contacted_idx" ON "contacts" USING btree ("organization_id","last_contacted_at");--> statement-breakpoint
CREATE INDEX "opportunities_org_stage_idx" ON "opportunities" USING btree ("organization_id","stage");--> statement-breakpoint
CREATE INDEX "opportunities_org_updated_at_idx" ON "opportunities" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE INDEX "candidates_org_availability_idx" ON "candidates" USING btree ("organization_id","availability");--> statement-breakpoint
CREATE INDEX "candidates_org_military_status_idx" ON "candidates" USING btree ("organization_id","military_status");--> statement-breakpoint
CREATE INDEX "jobs_org_status_idx" ON "jobs" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "invoices_org_status_due_idx" ON "invoices" USING btree ("organization_id","status","due_date");--> statement-breakpoint
CREATE INDEX "integration_events_org_status_idx" ON "integration_events" USING btree ("organization_id","status");