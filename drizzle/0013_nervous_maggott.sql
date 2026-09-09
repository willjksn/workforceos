CREATE TYPE "public"."permission_override_effect" AS ENUM('grant', 'deny');--> statement-breakpoint
CREATE TABLE "user_permission_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"effect" "permission_override_effect" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "user_permission_overrides_user_permission_uq" UNIQUE("user_id","permission_id")
);
--> statement-breakpoint
ALTER TABLE "public_intake_settings" ALTER COLUMN "military_talent_owner_role_slug" SET DEFAULT 'military-talent-partner';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "organizational_title" text;--> statement-breakpoint
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_permission_overrides_user_id_idx" ON "user_permission_overrides" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_permission_overrides_permission_id_idx" ON "user_permission_overrides" USING btree ("permission_id");--> statement-breakpoint
UPDATE "roles" SET "slug" = 'military-talent-partner', "name" = 'Military Talent Partner', "description" = 'Military occupation translation and Transition Talent Profile work', "updated_at" = now() WHERE "slug" = 'military-talent-specialist';--> statement-breakpoint
UPDATE "public_intake_settings" SET "military_talent_owner_role_slug" = 'military-talent-partner', "updated_at" = now() WHERE "military_talent_owner_role_slug" = 'military-talent-specialist';--> statement-breakpoint
UPDATE "roles" SET "name" = 'Administrator / Executive', "description" = 'Full operational access. Access bundle slug remains managing-partner.', "updated_at" = now() WHERE "slug" = 'managing-partner';--> statement-breakpoint
UPDATE "roles" SET "name" = 'Operations', "updated_at" = now() WHERE "slug" = 'operations-administrator';--> statement-breakpoint
UPDATE "roles" SET "name" = 'Strategy & Technology', "updated_at" = now() WHERE "slug" = 'strategy-technology-administrator';--> statement-breakpoint
UPDATE "roles" SET "name" = 'Senior Talent Partner', "updated_at" = now() WHERE "slug" = 'talent-partner';--> statement-breakpoint
UPDATE "roles" SET "name" = 'Recruiter Standard', "description" = 'Recruiting and candidate operations. No commercial opportunity ownership.', "updated_at" = now() WHERE "slug" = 'recruiter';--> statement-breakpoint
UPDATE "roles" SET "name" = 'Read only', "updated_at" = now() WHERE "slug" = 'read-only';