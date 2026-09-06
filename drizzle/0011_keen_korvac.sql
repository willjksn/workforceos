CREATE TYPE "public"."website_inquiry_service_interest" AS ENUM('professional-search', 'military-talent-opportunity-assessment', 'ta-performance-assessment', 'fractional-talent-partner', 'workforce-pipeline-assessment', 'other');--> statement-breakpoint
CREATE TYPE "public"."website_inquiry_status" AS ENUM('new', 'reviewing', 'qualified', 'discovery_requested', 'converted_to_opportunity', 'nurture', 'closed');--> statement-breakpoint
ALTER TYPE "public"."in_app_notification_kind" ADD VALUE 'website_inquiry_received';--> statement-breakpoint
ALTER TYPE "public"."in_app_notification_kind" ADD VALUE 'military_talent_received';--> statement-breakpoint
CREATE TABLE "public_intake_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"inquiry_owner_user_id" uuid,
	"inquiry_owner_role_slug" text DEFAULT 'managing-partner' NOT NULL,
	"military_talent_owner_user_id" uuid,
	"military_talent_owner_role_slug" text DEFAULT 'military-talent-specialist' NOT NULL,
	"application_notify_user_id" uuid,
	"application_notify_role_slug" text DEFAULT 'recruiter' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "public_intake_settings_organization_uq" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "website_inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid,
	"contact_id" uuid,
	"opportunity_id" uuid,
	"owner_user_id" uuid,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"company_name" text NOT NULL,
	"company_website" text,
	"title" text,
	"service_interest" "website_inquiry_service_interest" NOT NULL,
	"challenge" text NOT NULL,
	"timeline" text,
	"role_count" text,
	"location" text,
	"referral_source" text,
	"source" text DEFAULT 'pierone_public_website' NOT NULL,
	"subsource" text,
	"landing_url" text,
	"referrer" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"company_match_status" text DEFAULT 'unresolved' NOT NULL,
	"contact_match_status" text DEFAULT 'new' NOT NULL,
	"status" "website_inquiry_status" DEFAULT 'new' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "public_intake_settings" ADD CONSTRAINT "public_intake_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_intake_settings" ADD CONSTRAINT "public_intake_settings_inquiry_owner_user_id_users_id_fk" FOREIGN KEY ("inquiry_owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_intake_settings" ADD CONSTRAINT "public_intake_settings_military_talent_owner_user_id_users_id_fk" FOREIGN KEY ("military_talent_owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_intake_settings" ADD CONSTRAINT "public_intake_settings_application_notify_user_id_users_id_fk" FOREIGN KEY ("application_notify_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_inquiries" ADD CONSTRAINT "website_inquiries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_inquiries" ADD CONSTRAINT "website_inquiries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_inquiries" ADD CONSTRAINT "website_inquiries_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_inquiries" ADD CONSTRAINT "website_inquiries_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_inquiries" ADD CONSTRAINT "website_inquiries_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "public_intake_settings_inquiry_owner_user_id_idx" ON "public_intake_settings" USING btree ("inquiry_owner_user_id");--> statement-breakpoint
CREATE INDEX "public_intake_settings_military_talent_owner_user_id_idx" ON "public_intake_settings" USING btree ("military_talent_owner_user_id");--> statement-breakpoint
CREATE INDEX "public_intake_settings_application_notify_user_id_idx" ON "public_intake_settings" USING btree ("application_notify_user_id");--> statement-breakpoint
CREATE INDEX "website_inquiries_organization_id_idx" ON "website_inquiries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "website_inquiries_company_id_idx" ON "website_inquiries" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "website_inquiries_contact_id_idx" ON "website_inquiries" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "website_inquiries_opportunity_id_idx" ON "website_inquiries" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "website_inquiries_owner_user_id_idx" ON "website_inquiries" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "website_inquiries_status_idx" ON "website_inquiries" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "website_inquiries_submitted_at_idx" ON "website_inquiries" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "website_inquiries_email_idx" ON "website_inquiries" USING btree ("organization_id","email");