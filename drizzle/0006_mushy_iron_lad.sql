CREATE TYPE "public"."agent_handoff_status" AS ENUM('pending', 'accepted', 'completed', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."agent_run_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled', 'partial');--> statement-breakpoint
CREATE TYPE "public"."automation_rule_status" AS ENUM('enabled', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."circuit_breaker_state" AS ENUM('closed', 'open', 'half_open');--> statement-breakpoint
CREATE TYPE "public"."knowledge_record_status" AS ENUM('draft', 'in_review', 'approved', 'retired');--> statement-breakpoint
CREATE TYPE "public"."knowledge_record_type" AS ENUM('service_playbook', 'military_methodology', 'workforce_methodology', 'legal_template_reference', 'recruiting_playbook', 'client_approved_insight', 'lessons_learned', 'case_study', 'internal_process');--> statement-breakpoint
CREATE TYPE "public"."prompt_version_status" AS ENUM('draft', 'approved', 'retired');--> statement-breakpoint
CREATE TYPE "public"."review_category" AS ENUM('candidate_submission', 'ai_candidate_rejection', 'military_mapping', 'workforce_recommendation', 'solution_plan', 'proposal', 'pricing', 'contract_legal_language', 'client_deliverable', 'invoice_adjustment');--> statement-breakpoint
CREATE TABLE "agent_handoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"from_agent_id" uuid NOT NULL,
	"to_agent_id" uuid NOT NULL,
	"task_key" text NOT NULL,
	"inputs" jsonb,
	"output_summary" text,
	"confidence" numeric(5, 4),
	"sources" jsonb,
	"from_run_id" uuid,
	"to_run_id" uuid,
	"human_approval_required" boolean DEFAULT true NOT NULL,
	"approval_id" uuid,
	"status" "agent_handoff_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_circuit_breakers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"state" "circuit_breaker_state" DEFAULT 'closed' NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"open_until" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "ai_circuit_breakers_agent_uq" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE "ai_model_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_type" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"model_version" text,
	"temperature" numeric(4, 3),
	"timeout_ms" integer DEFAULT 30000 NOT NULL,
	"max_tokens" integer,
	"daily_cost_limit_usd" numeric(12, 4),
	"monthly_cost_limit_usd" numeric(12, 4),
	"fallback_provider" text,
	"fallback_model" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "ai_model_configs_org_task_uq" UNIQUE("organization_id","task_type")
);
--> statement-breakpoint
CREATE TABLE "ai_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"agent_id" uuid,
	"agent_run_id" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"task_type" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"estimated_cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_rule_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"event_name" text NOT NULL,
	"record_type" text,
	"record_id" uuid,
	"status" text DEFAULT 'completed' NOT NULL,
	"result_summary" text,
	"agent_run_id" uuid,
	"error_detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"event_name" text NOT NULL,
	"agent_slug" text,
	"task_key" text,
	"action_key" text NOT NULL,
	"status" "automation_rule_status" DEFAULT 'enabled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "automation_rules_org_code_uq" UNIQUE("organization_id","code")
);
--> statement-breakpoint
CREATE TABLE "knowledge_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"knowledge_type" "knowledge_record_type" NOT NULL,
	"status" "knowledge_record_status" DEFAULT 'draft' NOT NULL,
	"version" text DEFAULT '1.0' NOT NULL,
	"content" text NOT NULL,
	"source" text,
	"source_url" text,
	"privacy_class" "privacy_class" DEFAULT 'internal' NOT NULL,
	"required_permission" text,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"change_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "knowledge_records_org_slug_version_uq" UNIQUE("organization_id","slug","version")
);
--> statement-breakpoint
CREATE TABLE "meeting_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"meeting_record_type" text NOT NULL,
	"meeting_record_id" uuid NOT NULL,
	"agent_run_id" uuid,
	"decisions" jsonb,
	"action_items" jsonb,
	"commitments" jsonb,
	"dates" jsonb,
	"risks" jsonb,
	"opportunities" jsonb,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"prompt_name" text NOT NULL,
	"version" text NOT NULL,
	"status" "prompt_version_status" DEFAULT 'draft' NOT NULL,
	"content" text NOT NULL,
	"change_reason" text,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "prompt_versions_agent_name_version_uq" UNIQUE("agent_id","prompt_name","version")
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ALTER COLUMN "status" SET DEFAULT 'queued';--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "autonomy_level" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "default_task_type" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "daily_cost_limit_usd" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "monthly_cost_limit_usd" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "semantic_documents" ADD COLUMN "privacy_class" "privacy_class" DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE "semantic_documents" ADD COLUMN "required_permission" text;--> statement-breakpoint
ALTER TABLE "agent_outputs" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_outputs" ADD COLUMN "review_category" "review_category";--> statement-breakpoint
ALTER TABLE "agent_outputs" ADD COLUMN "record_type" text;--> statement-breakpoint
ALTER TABLE "agent_outputs" ADD COLUMN "record_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_outputs" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "agent_outputs" ADD COLUMN "missing_data" jsonb;--> statement-breakpoint
ALTER TABLE "agent_outputs" ADD COLUMN "assumptions" text;--> statement-breakpoint
ALTER TABLE "agent_outputs" ADD COLUMN "human_review_required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_outputs" ADD COLUMN "status" text DEFAULT 'pending_review' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "task_key" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "workflow_code" text;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "workflow_version" text;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "record_type" text;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "record_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "inputs" jsonb;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "sources" jsonb;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "model_version" text;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "output_summary" text;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "confidence" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "estimated_cost_usd" numeric(12, 6);--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "input_tokens" integer;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "output_tokens" integer;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "human_review_required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "approval_state" text DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "error_detail" text;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "error_code" text;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "parent_run_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "triggered_by" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "invoked_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_handoffs" ADD CONSTRAINT "agent_handoffs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_handoffs" ADD CONSTRAINT "agent_handoffs_from_agent_id_agents_id_fk" FOREIGN KEY ("from_agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_handoffs" ADD CONSTRAINT "agent_handoffs_to_agent_id_agents_id_fk" FOREIGN KEY ("to_agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_handoffs" ADD CONSTRAINT "agent_handoffs_from_run_id_agent_runs_id_fk" FOREIGN KEY ("from_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_handoffs" ADD CONSTRAINT "agent_handoffs_to_run_id_agent_runs_id_fk" FOREIGN KEY ("to_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_handoffs" ADD CONSTRAINT "agent_handoffs_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_circuit_breakers" ADD CONSTRAINT "ai_circuit_breakers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_circuit_breakers" ADD CONSTRAINT "ai_circuit_breakers_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_model_configs" ADD CONSTRAINT "ai_model_configs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rule_runs" ADD CONSTRAINT "automation_rule_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rule_runs" ADD CONSTRAINT "automation_rule_runs_rule_id_automation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rule_runs" ADD CONSTRAINT "automation_rule_runs_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_records" ADD CONSTRAINT "knowledge_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_records" ADD CONSTRAINT "knowledge_records_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_extractions" ADD CONSTRAINT "meeting_extractions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_extractions" ADD CONSTRAINT "meeting_extractions_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_handoffs_organization_id_idx" ON "agent_handoffs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agent_handoffs_from_agent_id_idx" ON "agent_handoffs" USING btree ("from_agent_id");--> statement-breakpoint
CREATE INDEX "agent_handoffs_to_agent_id_idx" ON "agent_handoffs" USING btree ("to_agent_id");--> statement-breakpoint
CREATE INDEX "agent_handoffs_from_run_id_idx" ON "agent_handoffs" USING btree ("from_run_id");--> statement-breakpoint
CREATE INDEX "agent_handoffs_to_run_id_idx" ON "agent_handoffs" USING btree ("to_run_id");--> statement-breakpoint
CREATE INDEX "agent_handoffs_approval_id_idx" ON "agent_handoffs" USING btree ("approval_id");--> statement-breakpoint
CREATE INDEX "ai_circuit_breakers_organization_id_idx" ON "ai_circuit_breakers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_model_configs_organization_id_idx" ON "ai_model_configs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_usage_events_organization_id_idx" ON "ai_usage_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_usage_events_agent_id_idx" ON "ai_usage_events" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "ai_usage_events_agent_run_id_idx" ON "ai_usage_events" USING btree ("agent_run_id");--> statement-breakpoint
CREATE INDEX "ai_usage_events_created_at_idx" ON "ai_usage_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "automation_rule_runs_organization_id_idx" ON "automation_rule_runs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "automation_rule_runs_rule_id_idx" ON "automation_rule_runs" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "automation_rule_runs_agent_run_id_idx" ON "automation_rule_runs" USING btree ("agent_run_id");--> statement-breakpoint
CREATE INDEX "automation_rule_runs_record_idx" ON "automation_rule_runs" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE INDEX "automation_rules_organization_id_idx" ON "automation_rules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "knowledge_records_organization_id_idx" ON "knowledge_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "knowledge_records_approved_by_user_id_idx" ON "knowledge_records" USING btree ("approved_by_user_id");--> statement-breakpoint
CREATE INDEX "meeting_extractions_organization_id_idx" ON "meeting_extractions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "meeting_extractions_agent_run_id_idx" ON "meeting_extractions" USING btree ("agent_run_id");--> statement-breakpoint
CREATE INDEX "meeting_extractions_meeting_idx" ON "meeting_extractions" USING btree ("meeting_record_type","meeting_record_id");--> statement-breakpoint
CREATE INDEX "prompt_versions_organization_id_idx" ON "prompt_versions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "prompt_versions_agent_id_idx" ON "prompt_versions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "prompt_versions_approved_by_user_id_idx" ON "prompt_versions" USING btree ("approved_by_user_id");--> statement-breakpoint
ALTER TABLE "agent_outputs" ADD CONSTRAINT "agent_outputs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_invoked_by_user_id_users_id_fk" FOREIGN KEY ("invoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_outputs_organization_id_idx" ON "agent_outputs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agent_outputs_record_idx" ON "agent_outputs" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE INDEX "agent_runs_organization_id_idx" ON "agent_runs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agent_runs_invoked_by_user_id_idx" ON "agent_runs" USING btree ("invoked_by_user_id");--> statement-breakpoint
CREATE INDEX "agent_runs_parent_run_id_idx" ON "agent_runs" USING btree ("parent_run_id");--> statement-breakpoint
CREATE INDEX "agent_runs_record_idx" ON "agent_runs" USING btree ("record_type","record_id");--> statement-breakpoint
ALTER TABLE "agent_permissions" ADD CONSTRAINT "agent_permissions_agent_permission_uq" UNIQUE("agent_id","permission_slug");