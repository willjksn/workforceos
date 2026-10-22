CREATE TYPE "public"."clearance_level" AS ENUM('unknown', 'none', 'confidential', 'secret', 'top_secret', 'ts_sci');--> statement-breakpoint
CREATE TYPE "public"."clearance_status" AS ENUM('unknown', 'reported_active', 'reported_inactive', 'expired');--> statement-breakpoint
CREATE TYPE "public"."credential_status" AS ENUM('unknown', 'active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."education_completion_status" AS ENUM('unknown', 'in_progress', 'completed', 'incomplete');--> statement-breakpoint
CREATE TYPE "public"."military_equipment_kind" AS ENUM('platform', 'system', 'equipment', 'tool');--> statement-breakpoint
CREATE TYPE "public"."military_training_category" AS ENUM('technical', 'nuclear', 'leadership', 'cyber', 'maintenance', 'logistics', 'aviation', 'instructor', 'other');--> statement-breakpoint
CREATE TYPE "public"."profile_evidence_source" AS ENUM('resume', 'candidate', 'recruiter', 'ai_extraction', 'military_occupation_mapping');--> statement-breakpoint
CREATE TABLE "candidate_clearances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"clearance_level" "clearance_level" DEFAULT 'unknown' NOT NULL,
	"clearance_status" "clearance_status" DEFAULT 'unknown' NOT NULL,
	"last_known_active_date" timestamp with time zone,
	"source" "profile_evidence_source" DEFAULT 'candidate' NOT NULL,
	"source_reference" text,
	"human_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "candidate_clearances_candidate_id_uq" UNIQUE("candidate_id"),
	CONSTRAINT "candidate_clearances_id_organization_uq" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "candidate_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"name" text NOT NULL,
	"issuer" text,
	"credential_id" text,
	"issued_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"status" "credential_status" DEFAULT 'unknown' NOT NULL,
	"source" "profile_evidence_source" DEFAULT 'recruiter' NOT NULL,
	"source_reference" text,
	"human_verified" boolean DEFAULT false NOT NULL,
	"confidence" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "candidate_credentials_id_organization_uq" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "candidate_education" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"institution" text NOT NULL,
	"degree_or_credential" text NOT NULL,
	"field_of_study" text,
	"completion_status" "education_completion_status" DEFAULT 'unknown' NOT NULL,
	"completion_date" timestamp with time zone,
	"completion_year" integer,
	"source" "profile_evidence_source" DEFAULT 'recruiter' NOT NULL,
	"source_reference" text,
	"human_verified" boolean DEFAULT false NOT NULL,
	"confidence" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "candidate_education_id_organization_uq" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "candidate_military_duties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"candidate_military_experience_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"source" "profile_evidence_source" DEFAULT 'recruiter' NOT NULL,
	"source_reference" text,
	"human_verified" boolean DEFAULT false NOT NULL,
	"confidence" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "candidate_military_duties_id_organization_uq" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "candidate_military_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"candidate_military_experience_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "military_equipment_kind" DEFAULT 'equipment' NOT NULL,
	"description" text,
	"source" "profile_evidence_source" DEFAULT 'recruiter' NOT NULL,
	"source_reference" text,
	"human_verified" boolean DEFAULT false NOT NULL,
	"confidence" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "candidate_military_equipment_id_organization_uq" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "candidate_military_training" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"candidate_military_experience_id" uuid NOT NULL,
	"school_name" text NOT NULL,
	"category" "military_training_category" DEFAULT 'other' NOT NULL,
	"description" text,
	"completion_year" integer,
	"source" "profile_evidence_source" DEFAULT 'recruiter' NOT NULL,
	"source_reference" text,
	"human_verified" boolean DEFAULT false NOT NULL,
	"confidence" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "candidate_military_training_id_organization_uq" UNIQUE("id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
UPDATE "candidate_military_experiences" AS experience
SET "organization_id" = candidate."organization_id"
FROM "candidates" AS candidate
WHERE experience."candidate_id" = candidate."id"
  AND experience."organization_id" IS NULL;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "direct_reports_count" integer;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "indirect_reports_count" integer;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "team_size" integer;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "resource_scope" text;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "shift_watch_leadership" text;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "program_responsibility" text;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "leadership_source" "profile_evidence_source";--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "leadership_human_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "skillbridge_profiles" ADD COLUMN "career_priorities" text;--> statement-breakpoint
ALTER TABLE "skillbridge_target_roles" ADD COLUMN "job_family" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_id_organization_uq" UNIQUE("id","organization_id");--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD CONSTRAINT "candidate_military_experiences_id_organization_uq" UNIQUE("id","organization_id");--> statement-breakpoint
ALTER TABLE "candidate_clearances" ADD CONSTRAINT "candidate_clearances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_clearances" ADD CONSTRAINT "candidate_clearances_candidate_org_fk" FOREIGN KEY ("candidate_id","organization_id") REFERENCES "public"."candidates"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_credentials" ADD CONSTRAINT "candidate_credentials_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_credentials" ADD CONSTRAINT "candidate_credentials_candidate_org_fk" FOREIGN KEY ("candidate_id","organization_id") REFERENCES "public"."candidates"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_education" ADD CONSTRAINT "candidate_education_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_education" ADD CONSTRAINT "candidate_education_candidate_org_fk" FOREIGN KEY ("candidate_id","organization_id") REFERENCES "public"."candidates"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_military_duties" ADD CONSTRAINT "candidate_military_duties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_military_duties" ADD CONSTRAINT "candidate_military_duties_experience_org_fk" FOREIGN KEY ("candidate_military_experience_id","organization_id") REFERENCES "public"."candidate_military_experiences"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_military_equipment" ADD CONSTRAINT "candidate_military_equipment_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_military_equipment" ADD CONSTRAINT "candidate_military_equipment_experience_org_fk" FOREIGN KEY ("candidate_military_experience_id","organization_id") REFERENCES "public"."candidate_military_experiences"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_military_training" ADD CONSTRAINT "candidate_military_training_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_military_training" ADD CONSTRAINT "candidate_military_training_experience_org_fk" FOREIGN KEY ("candidate_military_experience_id","organization_id") REFERENCES "public"."candidate_military_experiences"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_clearances_organization_id_idx" ON "candidate_clearances" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "candidate_clearances_candidate_id_idx" ON "candidate_clearances" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "candidate_credentials_organization_id_idx" ON "candidate_credentials" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "candidate_credentials_candidate_id_idx" ON "candidate_credentials" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "candidate_education_organization_id_idx" ON "candidate_education" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "candidate_education_candidate_id_idx" ON "candidate_education" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "candidate_military_duties_organization_id_idx" ON "candidate_military_duties" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "candidate_military_duties_experience_id_idx" ON "candidate_military_duties" USING btree ("candidate_military_experience_id");--> statement-breakpoint
CREATE INDEX "candidate_military_equipment_organization_id_idx" ON "candidate_military_equipment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "candidate_military_equipment_experience_id_idx" ON "candidate_military_equipment" USING btree ("candidate_military_experience_id");--> statement-breakpoint
CREATE INDEX "candidate_military_training_organization_id_idx" ON "candidate_military_training" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "candidate_military_training_experience_id_idx" ON "candidate_military_training" USING btree ("candidate_military_experience_id");--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD CONSTRAINT "candidate_military_experiences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_military_experiences" ADD CONSTRAINT "candidate_military_experiences_candidate_org_fk" FOREIGN KEY ("candidate_id","organization_id") REFERENCES "public"."candidates"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbridge_profiles" ADD CONSTRAINT "skillbridge_profiles_candidate_org_fk" FOREIGN KEY ("candidate_id","organization_id") REFERENCES "public"."candidates"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_military_experiences_organization_id_idx" ON "candidate_military_experiences" USING btree ("organization_id");