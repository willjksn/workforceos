CREATE TABLE "opportunity_engagement_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"engagement_id" uuid NOT NULL,
	"route_id" uuid,
	"event_type" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"note" text,
	"actor_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_engagement_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"engagement_id" uuid NOT NULL,
	"route_id" uuid,
	"channel" text NOT NULL,
	"contact_id" uuid,
	"recipient_label" text NOT NULL,
	"subject" text,
	"template" text,
	"body" text,
	"delivery_state" text NOT NULL,
	"provider" text,
	"provider_message_id" text,
	"actor_user_id" uuid,
	"drafted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "opportunity_engagement_messages_channel_chk" CHECK ("opportunity_engagement_messages"."channel" in ('email', 'phone', 'meeting', 'manual')),
	CONSTRAINT "opportunity_engagement_messages_delivery_chk" CHECK ("opportunity_engagement_messages"."delivery_state" in ('draft', 'copied', 'manual_sent', 'sent', 'failed', 'not_configured'))
);
--> statement-breakpoint
CREATE TABLE "opportunity_engagement_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"engagement_id" uuid NOT NULL,
	"prior_route_id" uuid,
	"sequence" integer NOT NULL,
	"kind" text NOT NULL,
	"contact_id" uuid,
	"response_status" text,
	"response_note" text,
	"responded_at" timestamp with time zone,
	"responded_by_label" text,
	"sent_at" timestamp with time zone,
	"follow_up_at" timestamp with time zone,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "opportunity_engagement_routes_id_organization_uq" UNIQUE("id","organization_id"),
	CONSTRAINT "opportunity_engagement_routes_engagement_sequence_uq" UNIQUE("engagement_id","sequence"),
	CONSTRAINT "opportunity_engagement_routes_kind_chk" CHECK ("opportunity_engagement_routes"."kind" in ('talent_review', 'employer_outreach', 'referral')),
	CONSTRAINT "opportunity_engagement_routes_response_chk" CHECK ("opportunity_engagement_routes"."response_status" is null or "opportunity_engagement_routes"."response_status" in ('interested', 'possible_future_fit', 'not_a_fit', 'refer_to_another_manager', 'needs_more_information', 'no_response'))
);
--> statement-breakpoint
CREATE TABLE "opportunity_engagements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"company_id" uuid,
	"mode" text,
	"status" text DEFAULT 'ready_for_review' NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"current_contact_id" uuid,
	"current_route_id" uuid,
	"employer_response" text,
	"candidate_response" text,
	"waiting_on" text DEFAULT 'recruiter' NOT NULL,
	"next_action" text,
	"next_follow_up_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"interview_status" text,
	"interview_id" uuid,
	"submission_id" uuid,
	"placement_id" uuid,
	"close_reason" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "opportunity_engagements_id_organization_uq" UNIQUE("id","organization_id"),
	CONSTRAINT "opportunity_engagements_match_id_uq" UNIQUE("match_id"),
	CONSTRAINT "opportunity_engagements_mode_chk" CHECK ("opportunity_engagements"."mode" is null or "opportunity_engagements"."mode" in ('authorized_routing', 'public_outreach')),
	CONSTRAINT "opportunity_engagements_status_chk" CHECK ("opportunity_engagements"."status" in ('ready_for_review', 'ready_for_outreach', 'routed', 'contacted', 'acknowledged', 'reviewing', 'interested', 'referred', 'interview', 'needs_follow_up', 'needs_information', 'no_fit', 'withdrawn', 'placed', 'closed')),
	CONSTRAINT "opportunity_engagements_employer_response_chk" CHECK ("opportunity_engagements"."employer_response" is null or "opportunity_engagements"."employer_response" in ('interested', 'possible_future_fit', 'not_a_fit', 'refer_to_another_manager', 'needs_more_information', 'no_response')),
	CONSTRAINT "opportunity_engagements_candidate_response_chk" CHECK ("opportunity_engagements"."candidate_response" is null or "opportunity_engagements"."candidate_response" in ('informed', 'interested', 'declined', 'needs_information')),
	CONSTRAINT "opportunity_engagements_waiting_on_chk" CHECK ("opportunity_engagements"."waiting_on" in ('recruiter', 'employer', 'candidate')),
	CONSTRAINT "opportunity_engagements_interview_status_chk" CHECK ("opportunity_engagements"."interview_status" is null or "opportunity_engagements"."interview_status" in ('requested', 'scheduled', 'completed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "authorized_employer_route" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_id_organization_uq" UNIQUE("id","organization_id");--> statement-breakpoint
ALTER TABLE "opportunity_engagement_events" ADD CONSTRAINT "opportunity_engagement_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagement_events" ADD CONSTRAINT "opportunity_engagement_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagement_events" ADD CONSTRAINT "opportunity_engagement_events_engagement_org_fk" FOREIGN KEY ("engagement_id","organization_id") REFERENCES "public"."opportunity_engagements"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagement_events" ADD CONSTRAINT "opportunity_engagement_events_route_org_fk" FOREIGN KEY ("route_id","organization_id") REFERENCES "public"."opportunity_engagement_routes"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagement_messages" ADD CONSTRAINT "opportunity_engagement_messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagement_messages" ADD CONSTRAINT "opportunity_engagement_messages_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagement_messages" ADD CONSTRAINT "opportunity_engagement_messages_engagement_org_fk" FOREIGN KEY ("engagement_id","organization_id") REFERENCES "public"."opportunity_engagements"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagement_messages" ADD CONSTRAINT "opportunity_engagement_messages_route_org_fk" FOREIGN KEY ("route_id","organization_id") REFERENCES "public"."opportunity_engagement_routes"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagement_messages" ADD CONSTRAINT "opportunity_engagement_messages_contact_org_fk" FOREIGN KEY ("contact_id","organization_id") REFERENCES "public"."contacts"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagement_routes" ADD CONSTRAINT "opportunity_engagement_routes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagement_routes" ADD CONSTRAINT "opportunity_engagement_routes_engagement_org_fk" FOREIGN KEY ("engagement_id","organization_id") REFERENCES "public"."opportunity_engagements"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagement_routes" ADD CONSTRAINT "opportunity_engagement_routes_contact_org_fk" FOREIGN KEY ("contact_id","organization_id") REFERENCES "public"."contacts"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagement_routes" ADD CONSTRAINT "opportunity_engagement_routes_prior_org_fk" FOREIGN KEY ("prior_route_id","organization_id") REFERENCES "public"."opportunity_engagement_routes"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagements" ADD CONSTRAINT "opportunity_engagements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagements" ADD CONSTRAINT "opportunity_engagements_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagements" ADD CONSTRAINT "opportunity_engagements_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagements" ADD CONSTRAINT "opportunity_engagements_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagements" ADD CONSTRAINT "opportunity_engagements_placement_id_placements_id_fk" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagements" ADD CONSTRAINT "opportunity_engagements_match_org_fk" FOREIGN KEY ("match_id","organization_id") REFERENCES "public"."candidate_job_matches"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagements" ADD CONSTRAINT "opportunity_engagements_candidate_org_fk" FOREIGN KEY ("candidate_id","organization_id") REFERENCES "public"."candidates"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagements" ADD CONSTRAINT "opportunity_engagements_job_org_fk" FOREIGN KEY ("job_id","organization_id") REFERENCES "public"."jobs"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagements" ADD CONSTRAINT "opportunity_engagements_company_org_fk" FOREIGN KEY ("company_id","organization_id") REFERENCES "public"."companies"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_engagements" ADD CONSTRAINT "opportunity_engagements_contact_org_fk" FOREIGN KEY ("current_contact_id","organization_id") REFERENCES "public"."contacts"("id","organization_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opportunity_engagement_events_organization_id_idx" ON "opportunity_engagement_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagement_events_engagement_id_idx" ON "opportunity_engagement_events" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagement_events_route_id_idx" ON "opportunity_engagement_events" USING btree ("route_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagement_events_actor_user_id_idx" ON "opportunity_engagement_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagement_events_occurred_at_idx" ON "opportunity_engagement_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "opportunity_engagement_messages_organization_id_idx" ON "opportunity_engagement_messages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagement_messages_engagement_id_idx" ON "opportunity_engagement_messages" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagement_messages_route_id_idx" ON "opportunity_engagement_messages" USING btree ("route_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagement_messages_contact_id_idx" ON "opportunity_engagement_messages" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagement_messages_actor_user_id_idx" ON "opportunity_engagement_messages" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagement_routes_organization_id_idx" ON "opportunity_engagement_routes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagement_routes_engagement_id_idx" ON "opportunity_engagement_routes" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagement_routes_contact_id_idx" ON "opportunity_engagement_routes" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagement_routes_prior_route_id_idx" ON "opportunity_engagement_routes" USING btree ("prior_route_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagements_organization_id_idx" ON "opportunity_engagements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagements_match_id_idx" ON "opportunity_engagements" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagements_candidate_id_idx" ON "opportunity_engagements" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagements_job_id_idx" ON "opportunity_engagements" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagements_company_id_idx" ON "opportunity_engagements" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagements_owner_user_id_idx" ON "opportunity_engagements" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagements_current_contact_id_idx" ON "opportunity_engagements" USING btree ("current_contact_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagements_current_route_id_idx" ON "opportunity_engagements" USING btree ("current_route_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagements_interview_id_idx" ON "opportunity_engagements" USING btree ("interview_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagements_submission_id_idx" ON "opportunity_engagements" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagements_placement_id_idx" ON "opportunity_engagements" USING btree ("placement_id");--> statement-breakpoint
CREATE INDEX "opportunity_engagements_queue_idx" ON "opportunity_engagements" USING btree ("organization_id","status","owner_user_id","next_follow_up_at");