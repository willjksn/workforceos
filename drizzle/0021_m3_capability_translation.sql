CREATE TYPE "public"."capability_basis" AS ENUM('explicit', 'reference_supported', 'inferred');--> statement-breakpoint
CREATE TYPE "public"."capability_evidence_type" AS ENUM('resume_skill', 'military_duty', 'military_equipment', 'military_training', 'credential', 'occupation_mapping', 'recruiter_entered', 'clearance', 'leadership');--> statement-breakpoint
CREATE TABLE "civilian_occupation_job_families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occupation_id" uuid NOT NULL,
	"job_family_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "civilian_occupation_job_families_uq" UNIQUE("occupation_id","job_family_id")
);
--> statement-breakpoint
CREATE TABLE "competency_clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "competency_clusters_slug_uq" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "job_families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "job_families_slug_uq" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "skill_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "skill_aliases_skill_alias_uq" UNIQUE("skill_id","alias")
);
--> statement-breakpoint
CREATE TABLE "candidate_skill_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"candidate_skill_id" uuid NOT NULL,
	"evidence_type" "capability_evidence_type" NOT NULL,
	"citation" text NOT NULL,
	"source" "profile_evidence_source" DEFAULT 'recruiter' NOT NULL,
	"confidence" integer,
	"duty_id" uuid,
	"equipment_id" uuid,
	"training_id" uuid,
	"credential_id" uuid,
	"clearance_id" uuid,
	"experience_id" uuid,
	"military_occupation_skill_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "candidate_skill_evidence_id_organization_uq" UNIQUE("id","organization_id"),
	CONSTRAINT "candidate_skill_evidence_citation_chk" CHECK (length(trim("candidate_skill_evidence"."citation")) > 0),
	CONSTRAINT "candidate_skill_evidence_pointer_chk" CHECK ((
      ("candidate_skill_evidence"."evidence_type" <> 'military_duty' or "candidate_skill_evidence"."duty_id" is not null)
      and ("candidate_skill_evidence"."evidence_type" <> 'military_equipment' or "candidate_skill_evidence"."equipment_id" is not null)
      and ("candidate_skill_evidence"."evidence_type" <> 'military_training' or "candidate_skill_evidence"."training_id" is not null)
      and ("candidate_skill_evidence"."evidence_type" <> 'credential' or "candidate_skill_evidence"."credential_id" is not null)
      and ("candidate_skill_evidence"."evidence_type" <> 'clearance' or "candidate_skill_evidence"."clearance_id" is not null)
      and ("candidate_skill_evidence"."evidence_type" <> 'leadership' or "candidate_skill_evidence"."experience_id" is not null)
      and ("candidate_skill_evidence"."evidence_type" <> 'occupation_mapping' or "candidate_skill_evidence"."military_occupation_skill_id" is not null)
    ))
);
--> statement-breakpoint
ALTER TABLE "candidate_skills" DROP CONSTRAINT "candidate_skills_candidate_id_candidates_id_fk";
--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "competency_cluster_id" uuid;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "source_version" text;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
UPDATE "candidate_skills" AS cs
SET "organization_id" = c."organization_id"
FROM "candidates" AS c
WHERE c."id" = cs."candidate_id";--> statement-breakpoint
ALTER TABLE "candidate_skills" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD COLUMN "capability_basis" "capability_basis" DEFAULT 'explicit' NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD COLUMN "review_status" "mapping_review_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
UPDATE "candidate_skills"
SET "review_status" = 'approved'
WHERE "human_verified" = true;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD COLUMN "reviewed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD COLUMN "originating_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD COLUMN "evidence_summary" text;--> statement-breakpoint
ALTER TABLE "military_occupation_skills" ADD COLUMN "evidence_reference" text;--> statement-breakpoint
ALTER TABLE "military_occupation_skills" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "military_occupation_skills" ADD COLUMN "source_version" text;--> statement-breakpoint
ALTER TABLE "military_occupation_skills" ADD COLUMN "confidence" integer;--> statement-breakpoint
ALTER TABLE "military_occupation_skills" ADD COLUMN "review_status" "mapping_review_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "military_occupation_skills" ADD COLUMN "reviewed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "military_occupation_skills" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "military_occupation_skills" ADD COLUMN "origin" "mapping_origin" DEFAULT 'reference_data' NOT NULL;--> statement-breakpoint
ALTER TABLE "military_occupation_skills" ADD COLUMN "originating_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "military_occupation_skills" ADD COLUMN "mapping_quality" text DEFAULT 'development_fixture' NOT NULL;--> statement-breakpoint
ALTER TABLE "civilian_occupation_job_families" ADD CONSTRAINT "civilian_occupation_job_families_occupation_id_civilian_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."civilian_occupations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civilian_occupation_job_families" ADD CONSTRAINT "civilian_occupation_job_families_job_family_id_job_families_id_fk" FOREIGN KEY ("job_family_id") REFERENCES "public"."job_families"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_aliases" ADD CONSTRAINT "skill_aliases_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skill_evidence" ADD CONSTRAINT "candidate_skill_evidence_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skill_evidence" ADD CONSTRAINT "candidate_skill_evidence_military_occupation_skill_id_military_occupation_skills_id_fk" FOREIGN KEY ("military_occupation_skill_id") REFERENCES "public"."military_occupation_skills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_id_organization_uq" UNIQUE("id","organization_id");--> statement-breakpoint
ALTER TABLE "candidate_skill_evidence" ADD CONSTRAINT "candidate_skill_evidence_skill_org_fk" FOREIGN KEY ("candidate_skill_id","organization_id") REFERENCES "public"."candidate_skills"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skill_evidence" ADD CONSTRAINT "candidate_skill_evidence_duty_org_fk" FOREIGN KEY ("duty_id","organization_id") REFERENCES "public"."candidate_military_duties"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skill_evidence" ADD CONSTRAINT "candidate_skill_evidence_equipment_org_fk" FOREIGN KEY ("equipment_id","organization_id") REFERENCES "public"."candidate_military_equipment"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skill_evidence" ADD CONSTRAINT "candidate_skill_evidence_training_org_fk" FOREIGN KEY ("training_id","organization_id") REFERENCES "public"."candidate_military_training"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skill_evidence" ADD CONSTRAINT "candidate_skill_evidence_credential_org_fk" FOREIGN KEY ("credential_id","organization_id") REFERENCES "public"."candidate_credentials"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skill_evidence" ADD CONSTRAINT "candidate_skill_evidence_clearance_org_fk" FOREIGN KEY ("clearance_id","organization_id") REFERENCES "public"."candidate_clearances"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skill_evidence" ADD CONSTRAINT "candidate_skill_evidence_experience_org_fk" FOREIGN KEY ("experience_id","organization_id") REFERENCES "public"."candidate_military_experiences"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "civilian_occupation_job_families_occupation_id_idx" ON "civilian_occupation_job_families" USING btree ("occupation_id");--> statement-breakpoint
CREATE INDEX "civilian_occupation_job_families_job_family_id_idx" ON "civilian_occupation_job_families" USING btree ("job_family_id");--> statement-breakpoint
CREATE INDEX "skill_aliases_skill_id_idx" ON "skill_aliases" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "candidate_skill_evidence_organization_id_idx" ON "candidate_skill_evidence" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "candidate_skill_evidence_candidate_skill_id_idx" ON "candidate_skill_evidence" USING btree ("candidate_skill_id");--> statement-breakpoint
CREATE INDEX "candidate_skill_evidence_duty_id_idx" ON "candidate_skill_evidence" USING btree ("duty_id");--> statement-breakpoint
CREATE INDEX "candidate_skill_evidence_equipment_id_idx" ON "candidate_skill_evidence" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "candidate_skill_evidence_training_id_idx" ON "candidate_skill_evidence" USING btree ("training_id");--> statement-breakpoint
CREATE INDEX "candidate_skill_evidence_credential_id_idx" ON "candidate_skill_evidence" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "candidate_skill_evidence_clearance_id_idx" ON "candidate_skill_evidence" USING btree ("clearance_id");--> statement-breakpoint
CREATE INDEX "candidate_skill_evidence_experience_id_idx" ON "candidate_skill_evidence" USING btree ("experience_id");--> statement-breakpoint
CREATE INDEX "candidate_skill_evidence_occupation_skill_id_idx" ON "candidate_skill_evidence" USING btree ("military_occupation_skill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_skill_evidence_duty_uq" ON "candidate_skill_evidence" USING btree ("candidate_skill_id","duty_id") WHERE "candidate_skill_evidence"."duty_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_skill_evidence_equipment_uq" ON "candidate_skill_evidence" USING btree ("candidate_skill_id","equipment_id") WHERE "candidate_skill_evidence"."equipment_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_skill_evidence_training_uq" ON "candidate_skill_evidence" USING btree ("candidate_skill_id","training_id") WHERE "candidate_skill_evidence"."training_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_skill_evidence_credential_uq" ON "candidate_skill_evidence" USING btree ("candidate_skill_id","credential_id") WHERE "candidate_skill_evidence"."credential_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_skill_evidence_clearance_uq" ON "candidate_skill_evidence" USING btree ("candidate_skill_id","clearance_id") WHERE "candidate_skill_evidence"."clearance_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_skill_evidence_experience_uq" ON "candidate_skill_evidence" USING btree ("candidate_skill_id","experience_id") WHERE "candidate_skill_evidence"."experience_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_skill_evidence_occupation_skill_uq" ON "candidate_skill_evidence" USING btree ("candidate_skill_id","military_occupation_skill_id") WHERE "candidate_skill_evidence"."military_occupation_skill_id" is not null;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_competency_cluster_id_competency_clusters_id_fk" FOREIGN KEY ("competency_cluster_id") REFERENCES "public"."competency_clusters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_originating_agent_id_agents_id_fk" FOREIGN KEY ("originating_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_candidate_org_fk" FOREIGN KEY ("candidate_id","organization_id") REFERENCES "public"."candidates"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "military_occupation_skills" ADD CONSTRAINT "military_occupation_skills_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "military_occupation_skills" ADD CONSTRAINT "military_occupation_skills_originating_agent_id_agents_id_fk" FOREIGN KEY ("originating_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "skills_competency_cluster_id_idx" ON "skills" USING btree ("competency_cluster_id");--> statement-breakpoint
CREATE INDEX "candidate_skills_organization_id_idx" ON "candidate_skills" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "candidate_skills_reviewed_by_user_id_idx" ON "candidate_skills" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE INDEX "candidate_skills_originating_agent_id_idx" ON "candidate_skills" USING btree ("originating_agent_id");--> statement-breakpoint
CREATE INDEX "military_occupation_skills_reviewed_by_user_id_idx" ON "military_occupation_skills" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE INDEX "military_occupation_skills_originating_agent_id_idx" ON "military_occupation_skills" USING btree ("originating_agent_id");--> statement-breakpoint
INSERT INTO "competency_clusters" ("slug", "name", "description") VALUES
  ('electrical-electronics', 'Electrical/Electronics', 'Lightweight competency cluster. Not a second skill taxonomy.'),
  ('maintenance-reliability', 'Maintenance & Reliability', 'Lightweight competency cluster. Not a second skill taxonomy.'),
  ('operations', 'Operations', 'Lightweight competency cluster. Not a second skill taxonomy.'),
  ('supply-chain-logistics', 'Supply Chain & Logistics', 'Lightweight competency cluster. Not a second skill taxonomy.'),
  ('cyber-it', 'Cyber/IT', 'Lightweight competency cluster. Not a second skill taxonomy.'),
  ('leadership-supervision', 'Leadership & Supervision', 'Lightweight competency cluster. Not a second skill taxonomy.'),
  ('program-project-management', 'Program/Project Management', 'Lightweight competency cluster. Not a second skill taxonomy.'),
  ('safety-compliance', 'Safety/Compliance', 'Lightweight competency cluster. Not a second skill taxonomy.')
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "job_families" ("slug", "name", "description") VALUES
  ('electrical-maintenance', 'Electrical Maintenance', 'Employer-neutral job family. Not an employer-specific mapping.'),
  ('instrumentation-controls', 'Instrumentation & Controls', 'Employer-neutral job family. Not an employer-specific mapping.'),
  ('cybersecurity', 'Cybersecurity', 'Employer-neutral job family. Not an employer-specific mapping.'),
  ('supply-chain', 'Supply Chain', 'Employer-neutral job family. Not an employer-specific mapping.'),
  ('operations', 'Operations', 'Employer-neutral job family. Not an employer-specific mapping.'),
  ('project-management', 'Project Management', 'Employer-neutral job family. Not an employer-specific mapping.'),
  ('engineering', 'Engineering', 'Employer-neutral job family. Not an employer-specific mapping.'),
  ('logistics', 'Logistics', 'Employer-neutral job family. Not an employer-specific mapping.'),
  ('skilled-trades', 'Skilled Trades', 'Employer-neutral job family. Not an employer-specific mapping.')
ON CONFLICT ("slug") DO NOTHING;