CREATE TYPE "public"."public_content_placement" AS ENUM('home', 'careers', 'skillbridge', 'site_wide');--> statement-breakpoint
CREATE TYPE "public"."public_content_style_variant" AS ENUM('navy', 'teal', 'light');--> statement-breakpoint
CREATE TYPE "public"."public_content_type" AS ENUM('featured_job', 'featured_skillbridge', 'homepage_banner', 'urgent_hiring_notice', 'temporary_announcement', 'featured_industry_campaign');--> statement-breakpoint
CREATE TABLE "public_content_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"content_type" "public_content_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"cta_label" text,
	"cta_url" text,
	"linked_job_id" uuid,
	"industry_code" text,
	"placement" "public_content_placement" DEFAULT 'home' NOT NULL,
	"style_variant" "public_content_style_variant",
	"feature_image_key" text,
	"priority" integer DEFAULT 100 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "public_content_items" ADD CONSTRAINT "public_content_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_content_items" ADD CONSTRAINT "public_content_items_linked_job_id_jobs_id_fk" FOREIGN KEY ("linked_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_content_items" ADD CONSTRAINT "public_content_items_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_content_items" ADD CONSTRAINT "public_content_items_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "public_content_items_organization_id_idx" ON "public_content_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "public_content_items_linked_job_id_idx" ON "public_content_items" USING btree ("linked_job_id");--> statement-breakpoint
CREATE INDEX "public_content_items_created_by_user_id_idx" ON "public_content_items" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "public_content_items_updated_by_user_id_idx" ON "public_content_items" USING btree ("updated_by_user_id");--> statement-breakpoint
CREATE INDEX "public_content_items_org_type_idx" ON "public_content_items" USING btree ("organization_id","content_type");--> statement-breakpoint
CREATE INDEX "public_content_items_org_active_idx" ON "public_content_items" USING btree ("organization_id","is_active");