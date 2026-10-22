CREATE TYPE "public"."workforce_demand_source" AS ENUM('current_jobs', 'workforce_plan', 'manual_employer_need', 'aggregated_role');--> statement-breakpoint
CREATE TYPE "public"."workforce_strategy_channel" AS ENUM('military_talent_network', 'talent_network', 'targeted_campaign', 'skillbridge_pathway', 'education_partner', 'training_pathway', 'evergreen_pool', 'increase_sourcing', 'review_requirements');--> statement-breakpoint
CREATE TABLE "workforce_role_capability_texts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"source_text" text NOT NULL,
	"skill_id" uuid,
	"review_status" "mapping_review_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workforce_strategy_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assessment_id" uuid,
	"channel" "workforce_strategy_channel" NOT NULL,
	"note" text NOT NULL,
	"education_partner_id" uuid,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workforce_role_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "workforce_role_jobs_role_job_uq" UNIQUE("role_id","job_id")
);
--> statement-breakpoint
ALTER TABLE "workforce_role_skills" ADD COLUMN "quantity_affected" integer;--> statement-breakpoint
ALTER TABLE "workforce_roles" ADD COLUMN "job_family_id" uuid;--> statement-breakpoint
ALTER TABLE "workforce_roles" ADD COLUMN "demand_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "workforce_roles" ADD COLUMN "demand_horizon" "job_demand_horizon" DEFAULT 'future' NOT NULL;--> statement-breakpoint
ALTER TABLE "workforce_roles" ADD COLUMN "planning_horizon" "workforce_roadmap_period";--> statement-breakpoint
ALTER TABLE "workforce_roles" ADD COLUMN "demand_source" "workforce_demand_source" DEFAULT 'workforce_plan' NOT NULL;--> statement-breakpoint
ALTER TABLE "workforce_roles" ADD COLUMN "required_clearance_level" "clearance_level";--> statement-breakpoint
ALTER TABLE "workforce_role_capability_texts" ADD CONSTRAINT "workforce_role_capability_texts_role_id_workforce_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."workforce_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_role_capability_texts" ADD CONSTRAINT "workforce_role_capability_texts_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_role_capability_texts" ADD CONSTRAINT "workforce_role_capability_texts_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_strategy_notes" ADD CONSTRAINT "workforce_strategy_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_strategy_notes" ADD CONSTRAINT "workforce_strategy_notes_role_id_workforce_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."workforce_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_strategy_notes" ADD CONSTRAINT "workforce_strategy_notes_assessment_id_workforce_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."workforce_assessments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_strategy_notes" ADD CONSTRAINT "workforce_strategy_notes_education_partner_id_education_partners_id_fk" FOREIGN KEY ("education_partner_id") REFERENCES "public"."education_partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_strategy_notes" ADD CONSTRAINT "workforce_strategy_notes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_role_jobs" ADD CONSTRAINT "workforce_role_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_role_jobs" ADD CONSTRAINT "workforce_role_jobs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_roles" ADD CONSTRAINT "workforce_roles_id_organization_uq" UNIQUE("id","organization_id");--> statement-breakpoint
ALTER TABLE "workforce_role_jobs" ADD CONSTRAINT "workforce_role_jobs_role_org_fk" FOREIGN KEY ("role_id","organization_id") REFERENCES "public"."workforce_roles"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_role_jobs" ADD CONSTRAINT "workforce_role_jobs_job_org_fk" FOREIGN KEY ("job_id","organization_id") REFERENCES "public"."jobs"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workforce_role_capability_texts_role_id_idx" ON "workforce_role_capability_texts" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "workforce_role_capability_texts_skill_id_idx" ON "workforce_role_capability_texts" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "workforce_role_capability_texts_reviewer_idx" ON "workforce_role_capability_texts" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE INDEX "workforce_strategy_notes_organization_id_idx" ON "workforce_strategy_notes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workforce_strategy_notes_role_id_idx" ON "workforce_strategy_notes" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "workforce_strategy_notes_assessment_id_idx" ON "workforce_strategy_notes" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "workforce_strategy_notes_partner_id_idx" ON "workforce_strategy_notes" USING btree ("education_partner_id");--> statement-breakpoint
CREATE INDEX "workforce_strategy_notes_created_by_idx" ON "workforce_strategy_notes" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "workforce_role_jobs_organization_id_idx" ON "workforce_role_jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workforce_role_jobs_role_id_idx" ON "workforce_role_jobs" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "workforce_role_jobs_job_id_idx" ON "workforce_role_jobs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "workforce_role_jobs_created_by_idx" ON "workforce_role_jobs" USING btree ("created_by_user_id");--> statement-breakpoint
ALTER TABLE "workforce_roles" ADD CONSTRAINT "workforce_roles_job_family_id_job_families_id_fk" FOREIGN KEY ("job_family_id") REFERENCES "public"."job_families"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workforce_roles_job_family_id_idx" ON "workforce_roles" USING btree ("job_family_id");