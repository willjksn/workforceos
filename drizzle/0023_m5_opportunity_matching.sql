CREATE TABLE "candidate_job_match_factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"factor_group" text NOT NULL,
	"dimension" text NOT NULL,
	"label" text NOT NULL,
	"detail" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "candidate_job_match_factors_group_chk" CHECK ("candidate_job_match_factors"."factor_group" in ('aligned', 'documented_gap', 'unknown', 'preferred_gap', 'evidence')),
	CONSTRAINT "candidate_job_match_factors_dimension_chk" CHECK ("candidate_job_match_factors"."dimension" in ('capability', 'credential', 'education', 'clearance', 'experience', 'location', 'timing', 'job_family', 'compensation', 'workplace'))
);
--> statement-breakpoint
CREATE TABLE "job_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"requirement_type" "skill_requirement_type" DEFAULT 'required' NOT NULL,
	"label" text NOT NULL,
	"value_text" text,
	"requirement_source" text NOT NULL,
	"source_text" text,
	"review_status" "mapping_review_status" DEFAULT 'pending' NOT NULL,
	"confidence" integer,
	"originating_agent_id" uuid,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "job_requirements_id_organization_uq" UNIQUE("id","organization_id"),
	CONSTRAINT "job_requirements_job_kind_label_uq" UNIQUE("job_id","kind","label"),
	CONSTRAINT "job_requirements_kind_chk" CHECK ("job_requirements"."kind" in ('credential', 'education', 'clearance', 'experience', 'location', 'workplace', 'travel', 'license', 'job_family', 'occupation')),
	CONSTRAINT "job_requirements_source_chk" CHECK ("job_requirements"."requirement_source" in ('public_job_description', 'structured_employer_feed', 'recruiter_entry', 'employer_provided', 'ai_extraction', 'reviewed_ai_extraction')),
	CONSTRAINT "job_requirements_confidence_chk" CHECK ("job_requirements"."confidence" is null or ("job_requirements"."confidence" >= 0 and "job_requirements"."confidence" <= 100))
);
--> statement-breakpoint
ALTER TABLE "candidate_job_matches" DROP CONSTRAINT "candidate_job_matches_candidate_id_candidates_id_fk";
--> statement-breakpoint
ALTER TABLE "candidate_job_matches" DROP CONSTRAINT "candidate_job_matches_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_id_organization_uq" UNIQUE("id","organization_id");
--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "organization_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "candidate_job_matches" AS m
    INNER JOIN "candidates" AS c ON c."id" = m."candidate_id"
    INNER JOIN "jobs" AS j ON j."id" = m."job_id"
    WHERE c."organization_id" <> j."organization_id"
  ) THEN
    RAISE EXCEPTION 'candidate_job_matches has cross-organization rows and cannot be backfilled';
  END IF;
END $$;--> statement-breakpoint
UPDATE "candidate_job_matches" AS m
SET "organization_id" = c."organization_id"
FROM "candidates" AS c
WHERE c."id" = m."candidate_id";
--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD CONSTRAINT "candidate_job_matches_id_organization_uq" UNIQUE("id","organization_id");
--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "match_category" text;--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "freshness" text DEFAULT 'stale' NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "input_hash" text;--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "recruiter_disposition" text;--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "disposition_note" text;--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "disposition_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD COLUMN "disposition_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_skills" ADD COLUMN "requirement_source" text DEFAULT 'recruiter_entry' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_skills" ADD COLUMN "source_text" text;--> statement-breakpoint
ALTER TABLE "job_skills" ADD COLUMN "review_status" "mapping_review_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_skills" ADD COLUMN "confidence" integer;--> statement-breakpoint
ALTER TABLE "job_skills" ADD COLUMN "originating_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "job_skills" ADD COLUMN "reviewed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "job_skills" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidate_job_match_factors" ADD CONSTRAINT "candidate_job_match_factors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_job_match_factors" ADD CONSTRAINT "candidate_job_match_factors_match_org_fk" FOREIGN KEY ("match_id","organization_id") REFERENCES "public"."candidate_job_matches"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requirements" ADD CONSTRAINT "job_requirements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requirements" ADD CONSTRAINT "job_requirements_originating_agent_id_agents_id_fk" FOREIGN KEY ("originating_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requirements" ADD CONSTRAINT "job_requirements_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requirements" ADD CONSTRAINT "job_requirements_job_org_fk" FOREIGN KEY ("job_id","organization_id") REFERENCES "public"."jobs"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_job_match_factors_organization_id_idx" ON "candidate_job_match_factors" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "candidate_job_match_factors_match_id_idx" ON "candidate_job_match_factors" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "job_requirements_organization_id_idx" ON "job_requirements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "job_requirements_job_id_idx" ON "job_requirements" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_requirements_job_review_idx" ON "job_requirements" USING btree ("job_id","review_status");--> statement-breakpoint
CREATE INDEX "job_requirements_originating_agent_id_idx" ON "job_requirements" USING btree ("originating_agent_id");--> statement-breakpoint
CREATE INDEX "job_requirements_reviewed_by_user_id_idx" ON "job_requirements" USING btree ("reviewed_by_user_id");--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD CONSTRAINT "candidate_job_matches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD CONSTRAINT "candidate_job_matches_disposition_by_user_id_users_id_fk" FOREIGN KEY ("disposition_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD CONSTRAINT "candidate_job_matches_candidate_org_fk" FOREIGN KEY ("candidate_id","organization_id") REFERENCES "public"."candidates"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD CONSTRAINT "candidate_job_matches_job_org_fk" FOREIGN KEY ("job_id","organization_id") REFERENCES "public"."jobs"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_originating_agent_id_agents_id_fk" FOREIGN KEY ("originating_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_skills_org_skill_idx" ON "candidate_skills" USING btree ("organization_id","skill_id");--> statement-breakpoint
CREATE INDEX "candidate_job_matches_organization_id_idx" ON "candidate_job_matches" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "candidate_job_matches_disposition_by_user_id_idx" ON "candidate_job_matches" USING btree ("disposition_by_user_id");--> statement-breakpoint
CREATE INDEX "candidate_job_matches_org_candidate_freshness_idx" ON "candidate_job_matches" USING btree ("organization_id","candidate_id","freshness");--> statement-breakpoint
CREATE INDEX "candidate_job_matches_org_job_category_idx" ON "candidate_job_matches" USING btree ("organization_id","job_id","match_category");--> statement-breakpoint
CREATE INDEX "job_skills_originating_agent_id_idx" ON "job_skills" USING btree ("originating_agent_id");--> statement-breakpoint
CREATE INDEX "job_skills_reviewed_by_user_id_idx" ON "job_skills" USING btree ("reviewed_by_user_id");--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD CONSTRAINT "candidate_job_matches_category_chk" CHECK ("candidate_job_matches"."match_category" is null or "candidate_job_matches"."match_category" in ('strong_match', 'possible_match', 'developmental_match', 'no_current_match'));--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD CONSTRAINT "candidate_job_matches_freshness_chk" CHECK ("candidate_job_matches"."freshness" in ('current', 'stale', 'queued', 'error'));--> statement-breakpoint
ALTER TABLE "candidate_job_matches" ADD CONSTRAINT "candidate_job_matches_disposition_chk" CHECK ("candidate_job_matches"."recruiter_disposition" is null or "candidate_job_matches"."recruiter_disposition" in ('viable', 'not_viable', 'needs_information'));--> statement-breakpoint
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_requirement_source_chk" CHECK ("job_skills"."requirement_source" in ('public_job_description', 'structured_employer_feed', 'recruiter_entry', 'employer_provided', 'ai_extraction', 'reviewed_ai_extraction'));--> statement-breakpoint
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_confidence_chk" CHECK ("job_skills"."confidence" is null or ("job_skills"."confidence" >= 0 and "job_skills"."confidence" <= 100));