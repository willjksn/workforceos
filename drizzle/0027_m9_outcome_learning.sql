CREATE TABLE "outcome_learning_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"recommendation_type" text NOT NULL,
	"subject_key" text NOT NULL,
	"time_window" text NOT NULL,
	"window_start" timestamp with time zone,
	"window_end" timestamp with time zone NOT NULL,
	"sample_count" integer NOT NULL,
	"evidence_band" text NOT NULL,
	"observed_pattern" text NOT NULL,
	"why_it_matters" text NOT NULL,
	"human_review_prompt" text NOT NULL,
	"source_records" text NOT NULL,
	"source_filter" text NOT NULL,
	"supporting_summary" text NOT NULL,
	"review_state" text DEFAULT 'new' NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "outcome_learning_recommendations_identity_uq" UNIQUE("organization_id","recommendation_type","subject_key","time_window"),
	CONSTRAINT "outcome_learning_recommendations_type_chk" CHECK ("recommendation_type" in ('REVIEW_MATCH_ASSUMPTION', 'REVIEW_MILITARY_MAPPING', 'REVIEW_JOB_REQUIREMENT', 'REVIEW_PIPELINE_STRATEGY', 'REVIEW_EMPLOYER_WORKFLOW', 'REVIEW_FOLLOW_UP_PROCESS', 'INSUFFICIENT_DATA')),
	CONSTRAINT "outcome_learning_recommendations_window_chk" CHECK ("time_window" in ('30d', '90d', '180d', '365d', 'all')),
	CONSTRAINT "outcome_learning_recommendations_band_chk" CHECK ("evidence_band" in ('insufficient', 'early_signal', 'operational_pattern')),
	CONSTRAINT "outcome_learning_recommendations_state_chk" CHECK ("review_state" in ('new', 'reviewing', 'accepted_as_note', 'dismissed', 'needs_more_data')),
	CONSTRAINT "outcome_learning_recommendations_sample_chk" CHECK ("sample_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "outcome_learning_recommendations" ADD CONSTRAINT "outcome_learning_recommendations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_learning_recommendations" ADD CONSTRAINT "outcome_learning_recommendations_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outcome_learning_recommendations_organization_id_idx" ON "outcome_learning_recommendations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "outcome_learning_recommendations_reviewed_by_user_id_idx" ON "outcome_learning_recommendations" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE INDEX "outcome_learning_recommendations_org_window_state_idx" ON "outcome_learning_recommendations" USING btree ("organization_id","time_window","review_state");