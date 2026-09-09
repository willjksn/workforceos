CREATE TYPE "public"."staff_onboarding_cadence" AS ENUM('day_1', 'week_1', 'week_2', 'week_3', 'week_4', 'complete');--> statement-breakpoint
CREATE TABLE "staff_onboarding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"cadence" "staff_onboarding_cadence" DEFAULT 'day_1' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"week2_shadow_completed_at" timestamp with time zone,
	"week3_supervised_completed_at" timestamp with time zone,
	"week4_reviewed_at" timestamp with time zone,
	"week4_reviewed_by_user_id" uuid,
	"week4_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "staff_onboarding_user_uq" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "staff_onboarding_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"onboarding_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "staff_onboarding_equipment_item_uq" UNIQUE("onboarding_id","item_key")
);
--> statement-breakpoint
CREATE TABLE "staff_policy_acknowledgements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"policy_key" text NOT NULL,
	"acknowledged_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "staff_policy_acknowledgements_user_policy_uq" UNIQUE("user_id","policy_key")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "manager_id" uuid;--> statement-breakpoint
ALTER TABLE "staff_onboarding" ADD CONSTRAINT "staff_onboarding_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_onboarding" ADD CONSTRAINT "staff_onboarding_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_onboarding" ADD CONSTRAINT "staff_onboarding_week4_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("week4_reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_onboarding_equipment" ADD CONSTRAINT "staff_onboarding_equipment_onboarding_id_staff_onboarding_id_fk" FOREIGN KEY ("onboarding_id") REFERENCES "public"."staff_onboarding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_onboarding_equipment" ADD CONSTRAINT "staff_onboarding_equipment_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_policy_acknowledgements" ADD CONSTRAINT "staff_policy_acknowledgements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_onboarding_organization_id_idx" ON "staff_onboarding" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "staff_onboarding_user_id_idx" ON "staff_onboarding" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "staff_onboarding_week4_reviewed_by_user_id_idx" ON "staff_onboarding" USING btree ("week4_reviewed_by_user_id");--> statement-breakpoint
CREATE INDEX "staff_onboarding_equipment_onboarding_id_idx" ON "staff_onboarding_equipment" USING btree ("onboarding_id");--> statement-breakpoint
CREATE INDEX "staff_onboarding_equipment_completed_by_user_id_idx" ON "staff_onboarding_equipment" USING btree ("completed_by_user_id");--> statement-breakpoint
CREATE INDEX "staff_policy_acknowledgements_user_id_idx" ON "staff_policy_acknowledgements" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_manager_id_idx" ON "users" USING btree ("manager_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_manager_not_self" CHECK ("users"."manager_id" is null or "users"."manager_id" <> "users"."id");