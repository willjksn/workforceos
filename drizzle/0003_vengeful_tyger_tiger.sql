CREATE TYPE "public"."billing_event_status" AS ENUM('scheduled', 'triggered', 'queued', 'invoiced', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('draft', 'internal_review', 'client_review', 'sent_for_signature', 'partially_signed', 'executed', 'expired', 'terminated', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."deliverable_status" AS ENUM('not_started', 'in_progress', 'review', 'approved', 'client_ready', 'delivered', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."discovery_status" AS ENUM('draft', 'in_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."esign_status" AS ENUM('not_sent', 'created', 'sent', 'delivered', 'partially_signed', 'completed', 'declined', 'voided', 'manual');--> statement-breakpoint
CREATE TYPE "public"."expansion_status" AS ENUM('suggested', 'reviewed', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('open', 'in_progress', 'resolved', 'wont_fix');--> statement-breakpoint
CREATE TYPE "public"."legal_template_status" AS ENUM('draft', 'attorney_review', 'approved', 'retired');--> statement-breakpoint
CREATE TYPE "public"."legal_template_type" AS ENUM('msa', 'direct_hire_search_agreement', 'retained_search_agreement', 'fractional_ta_sow', 'consulting_sow', 'military_talent_assessment_sow', 'ta_performance_assessment_sow', 'workforce_assessment_sow', 'nda', 'dpa', 'subcontractor_agreement', 'employee_agreement', 'confidentiality_ip_agreement', 'independent_contractor_agreement');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('scheduled', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('percentage_fee', 'fixed_project', 'monthly_recurring');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('draft', 'internal_review', 'approved', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."risk_status" AS ENUM('open', 'mitigating', 'accepted', 'closed');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."workflow_step_type" AS ENUM('qualification', 'discovery', 'data_collection', 'analysis', 'recommendation', 'approval', 'legal', 'project', 'deliverable', 'billing', 'closeout', 'expansion', 'human_review', 'exception');--> statement-breakpoint
ALTER TYPE "public"."project_status" ADD VALUE 'at_risk';--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE 'not_started';--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE 'waiting_client';--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE 'review';--> statement-breakpoint
CREATE TABLE "discoveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"service_version_id" uuid,
	"title" text NOT NULL,
	"status" "discovery_status" DEFAULT 'draft' NOT NULL,
	"answers" jsonb,
	"problem_statement" text,
	"business_impact" text,
	"root_causes" text,
	"requirements" text,
	"timeline" text,
	"budget" text,
	"decision_makers" text,
	"missing_data" text,
	"recommended_service_code" text,
	"recommended_next_service_code" text,
	"output_summary" text,
	"generated_by_actor_type" text,
	"generated_by_model" text,
	"generated_by_model_version" text,
	"generated_confidence" numeric(5, 4),
	"human_approved_at" timestamp with time zone,
	"human_approved_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "proposal_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"executive_summary" text,
	"client_problem" text,
	"recommended_solution" text,
	"scope" text,
	"deliverables" text,
	"timeline" text,
	"client_responsibilities" text,
	"firm_responsibilities" text,
	"kpis" text,
	"pricing" text,
	"pricing_amount" numeric(14, 2),
	"payment_terms" text,
	"assumptions" text,
	"exclusions" text,
	"next_steps" text,
	"html_body" text,
	"generated_by_model" text,
	"generated_by_model_version" text,
	"generated_confidence" numeric(5, 4),
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "proposal_versions_proposal_version_uq" UNIQUE("proposal_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"solution_plan_id" uuid NOT NULL,
	"service_version_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "proposal_status" DEFAULT 'draft' NOT NULL,
	"current_version_number" integer DEFAULT 1 NOT NULL,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"superseded_by_proposal_id" uuid,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "service_workflow_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_version_id" uuid NOT NULL,
	"qualification_triggers" text,
	"required_discovery_inputs" jsonb,
	"data_collection" text,
	"ai_responsibilities" text,
	"human_responsibilities" text,
	"approval_gates" text,
	"deliverables" text,
	"legal_package" jsonb,
	"project_template_code" text,
	"billing_rules" text,
	"kpis" text,
	"completion_rules" text,
	"expansion_rules" text,
	"exception_handling" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "service_workflow_definitions_version_uq" UNIQUE("service_version_id")
);
--> statement-breakpoint
CREATE TABLE "expansion_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid,
	"source_service_code" text NOT NULL,
	"recommended_service_code" text NOT NULL,
	"rationale" text,
	"status" "expansion_status" DEFAULT 'suggested' NOT NULL,
	"resulting_opportunity_id" uuid,
	"reviewed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_closeouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"lessons_learned" text,
	"client_feedback" text,
	"knowledge_capture" text,
	"kpi_snapshot" text,
	"completed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "project_closeouts_project_uq" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "project_deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"deliverable_type" text NOT NULL,
	"description" text,
	"due_date" date,
	"owner_user_id" uuid,
	"file_id" uuid,
	"version_number" integer DEFAULT 1 NOT NULL,
	"status" "deliverable_status" DEFAULT 'not_started' NOT NULL,
	"client_facing" boolean DEFAULT true NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"client_delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"description" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"owner_user_id" uuid,
	"action" text,
	"status" "issue_status" DEFAULT 'open' NOT NULL,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_kpis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"definition" text,
	"value" text,
	"unit" text,
	"source" text,
	"captured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"scheduled_at" timestamp with time zone,
	"notes" text,
	"actions" text,
	"status" "meeting_status" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"description" text NOT NULL,
	"probability" text DEFAULT 'medium' NOT NULL,
	"impact" text DEFAULT 'medium' NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"mitigation" text,
	"owner_user_id" uuid,
	"status" "risk_status" DEFAULT 'open' NOT NULL,
	"material" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_template_deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"name" text NOT NULL,
	"deliverable_type" text NOT NULL,
	"description" text,
	"required" boolean DEFAULT true NOT NULL,
	"client_facing" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_template_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sequence" integer NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "project_template_phases_template_sequence_uq" UNIQUE("template_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "project_template_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sequence" integer DEFAULT 1 NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"completion_criteria" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"service_version_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "project_templates_code_uq" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"service_id" uuid,
	"opportunity_id" uuid,
	"proposal_id" uuid,
	"solution_plan_id" uuid,
	"project_id" uuid,
	"contract_type" "legal_template_type" NOT NULL,
	"template_id" uuid,
	"title" text NOT NULL,
	"sow" text,
	"contract_value" numeric(14, 2),
	"signer_name" text,
	"signer_email" text,
	"signature_status" "esign_status" DEFAULT 'not_sent' NOT NULL,
	"status" "contract_status" DEFAULT 'draft' NOT NULL,
	"execution_date" date,
	"effective_date" date,
	"expiration_date" date,
	"renewal_date" date,
	"termination_date" date,
	"payment_terms" text,
	"guarantee_terms" text,
	"insurance_requirements" text,
	"data_requirements" text,
	"special_clauses" text,
	"amendments" text,
	"file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "esign_envelopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"provider" text DEFAULT 'manual' NOT NULL,
	"provider_envelope_id" text,
	"status" "esign_status" DEFAULT 'not_sent' NOT NULL,
	"sent_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"audit_certificate_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "legal_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"template_type" "legal_template_type" NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"jurisdiction" text,
	"effective_date" date,
	"last_legal_review_at" timestamp with time zone,
	"owner_user_id" uuid,
	"attorney_approved" boolean DEFAULT false NOT NULL,
	"status" "legal_template_status" DEFAULT 'draft' NOT NULL,
	"body" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "legal_templates_type_version_uq" UNIQUE("template_type","version")
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid,
	"project_id" uuid,
	"contract_id" uuid,
	"schedule_id" uuid,
	"source_milestone" text,
	"amount" numeric(14, 2) NOT NULL,
	"expected_date" date,
	"status" "billing_event_status" DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid,
	"project_id" uuid,
	"contract_id" uuid,
	"name" text NOT NULL,
	"cadence" text NOT NULL,
	"amount" numeric(14, 2),
	"next_expected_at" date,
	"source_rule" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "service_versions" ADD COLUMN "effective_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "service_versions" ADD COLUMN "scope_definition" text;--> statement-breakpoint
ALTER TABLE "service_versions" ADD COLUMN "required_inputs" jsonb;--> statement-breakpoint
ALTER TABLE "service_versions" ADD COLUMN "deliverables" jsonb;--> statement-breakpoint
ALTER TABLE "service_versions" ADD COLUMN "kpis" jsonb;--> statement-breakpoint
ALTER TABLE "service_versions" ADD COLUMN "client_responsibilities" text;--> statement-breakpoint
ALTER TABLE "service_versions" ADD COLUMN "firm_responsibilities" text;--> statement-breakpoint
ALTER TABLE "service_versions" ADD COLUMN "legal_requirements" text;--> statement-breakpoint
ALTER TABLE "service_versions" ADD COLUMN "pricing_guidance" text;--> statement-breakpoint
ALTER TABLE "service_versions" ADD COLUMN "expansion_services" jsonb;--> statement-breakpoint
ALTER TABLE "service_versions" ADD COLUMN "pricing_model" "pricing_model";--> statement-breakpoint
ALTER TABLE "service_versions" ADD COLUMN "min_price" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "service_versions" ADD COLUMN "max_price" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "service_versions" ADD COLUMN "percentage_fee" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "service_versions" ADD COLUMN "minimum_fee" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "service_versions" ADD COLUMN "default_duration_days" integer;--> statement-breakpoint
ALTER TABLE "service_versions" ADD COLUMN "practice_area" text;--> statement-breakpoint
ALTER TABLE "service_workflows" ADD COLUMN "step_type" "workflow_step_type";--> statement-breakpoint
ALTER TABLE "service_workflows" ADD COLUMN "responsible_role" text;--> statement-breakpoint
ALTER TABLE "service_workflows" ADD COLUMN "required_inputs" text;--> statement-breakpoint
ALTER TABLE "service_workflows" ADD COLUMN "output_type" text;--> statement-breakpoint
ALTER TABLE "service_workflows" ADD COLUMN "blocking" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "service_workflows" ADD COLUMN "completion_criteria" text;--> statement-breakpoint
ALTER TABLE "service_workflows" ADD COLUMN "next_step_number" integer;--> statement-breakpoint
ALTER TABLE "service_workflows" ADD COLUMN "exception_path" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "practice_area" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "pricing_model" "pricing_model";--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "default_min_price" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "default_max_price" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "default_duration_days" integer;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "discovery_id" uuid;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "plan_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "problem_statement" text;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "business_impact" text;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "findings" text;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "recommended_scope" text;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "required_inputs" text;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "deliverables" text;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "phases" text;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "timeline" text;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "client_responsibilities" text;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "firm_responsibilities" text;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "kpis" text;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "risks" text;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "pricing_model" "pricing_model";--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "estimated_price" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "recommended_price" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "approved_price" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "pricing_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "pricing_override_reason" text;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "pricing_approved_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "pricing_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "expansion_opportunities" text;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "generated_by_agent_run_id" uuid;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "generated_by_model" text;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "generated_by_model_version" text;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "generated_confidence" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "source_references" jsonb;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "approved_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_phases" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "project_phases" ADD COLUMN "status" text DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD COLUMN "agent_id" uuid;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD COLUMN "priority" "task_priority" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD COLUMN "depends_on_task_id" uuid;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD COLUMN "requires_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD COLUMN "completion_criteria" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "service_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "opportunity_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "contract_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "health" text DEFAULT 'healthy' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "contract_value" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "next_milestone" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "contract_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "contract_override_reason" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "contract_override_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "contract_override_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "closeout_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "closeout_override_reason" text;--> statement-breakpoint
ALTER TABLE "legal_packages" ADD COLUMN "contract_id" uuid;--> statement-breakpoint
ALTER TABLE "discoveries" ADD CONSTRAINT "discoveries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discoveries" ADD CONSTRAINT "discoveries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discoveries" ADD CONSTRAINT "discoveries_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discoveries" ADD CONSTRAINT "discoveries_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discoveries" ADD CONSTRAINT "discoveries_service_version_id_service_versions_id_fk" FOREIGN KEY ("service_version_id") REFERENCES "public"."service_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discoveries" ADD CONSTRAINT "discoveries_human_approved_by_user_id_users_id_fk" FOREIGN KEY ("human_approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_solution_plan_id_solution_plans_id_fk" FOREIGN KEY ("solution_plan_id") REFERENCES "public"."solution_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_service_version_id_service_versions_id_fk" FOREIGN KEY ("service_version_id") REFERENCES "public"."service_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_workflow_definitions" ADD CONSTRAINT "service_workflow_definitions_service_version_id_service_versions_id_fk" FOREIGN KEY ("service_version_id") REFERENCES "public"."service_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expansion_recommendations" ADD CONSTRAINT "expansion_recommendations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expansion_recommendations" ADD CONSTRAINT "expansion_recommendations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expansion_recommendations" ADD CONSTRAINT "expansion_recommendations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expansion_recommendations" ADD CONSTRAINT "expansion_recommendations_resulting_opportunity_id_opportunities_id_fk" FOREIGN KEY ("resulting_opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expansion_recommendations" ADD CONSTRAINT "expansion_recommendations_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_closeouts" ADD CONSTRAINT "project_closeouts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_closeouts" ADD CONSTRAINT "project_closeouts_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_deliverables" ADD CONSTRAINT "project_deliverables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_deliverables" ADD CONSTRAINT "project_deliverables_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_deliverables" ADD CONSTRAINT "project_deliverables_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_deliverables" ADD CONSTRAINT "project_deliverables_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_kpis" ADD CONSTRAINT "project_kpis_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_meetings" ADD CONSTRAINT "project_meetings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_risks" ADD CONSTRAINT "project_risks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_risks" ADD CONSTRAINT "project_risks_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_template_deliverables" ADD CONSTRAINT "project_template_deliverables_template_id_project_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."project_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_template_phases" ADD CONSTRAINT "project_template_phases_template_id_project_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."project_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_template_tasks" ADD CONSTRAINT "project_template_tasks_phase_id_project_template_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."project_template_phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_service_version_id_service_versions_id_fk" FOREIGN KEY ("service_version_id") REFERENCES "public"."service_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_solution_plan_id_solution_plans_id_fk" FOREIGN KEY ("solution_plan_id") REFERENCES "public"."solution_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_template_id_legal_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."legal_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esign_envelopes" ADD CONSTRAINT "esign_envelopes_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_templates" ADD CONSTRAINT "legal_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_templates" ADD CONSTRAINT "legal_templates_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_schedule_id_billing_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."billing_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD CONSTRAINT "billing_schedules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD CONSTRAINT "billing_schedules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD CONSTRAINT "billing_schedules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD CONSTRAINT "billing_schedules_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discoveries_organization_id_idx" ON "discoveries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "discoveries_company_id_idx" ON "discoveries" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "discoveries_opportunity_id_idx" ON "discoveries" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "discoveries_service_id_idx" ON "discoveries" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "discoveries_service_version_id_idx" ON "discoveries" USING btree ("service_version_id");--> statement-breakpoint
CREATE INDEX "discoveries_human_approved_by_user_id_idx" ON "discoveries" USING btree ("human_approved_by_user_id");--> statement-breakpoint
CREATE INDEX "proposal_versions_proposal_id_idx" ON "proposal_versions" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "proposal_versions_created_by_user_id_idx" ON "proposal_versions" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "proposals_organization_id_idx" ON "proposals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "proposals_company_id_idx" ON "proposals" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "proposals_opportunity_id_idx" ON "proposals" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "proposals_solution_plan_id_idx" ON "proposals" USING btree ("solution_plan_id");--> statement-breakpoint
CREATE INDEX "proposals_service_version_id_idx" ON "proposals" USING btree ("service_version_id");--> statement-breakpoint
CREATE INDEX "proposals_approved_by_user_id_idx" ON "proposals" USING btree ("approved_by_user_id");--> statement-breakpoint
CREATE INDEX "service_workflow_definitions_service_version_id_idx" ON "service_workflow_definitions" USING btree ("service_version_id");--> statement-breakpoint
CREATE INDEX "expansion_recommendations_organization_id_idx" ON "expansion_recommendations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "expansion_recommendations_company_id_idx" ON "expansion_recommendations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "expansion_recommendations_project_id_idx" ON "expansion_recommendations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "expansion_recommendations_resulting_opportunity_id_idx" ON "expansion_recommendations" USING btree ("resulting_opportunity_id");--> statement-breakpoint
CREATE INDEX "expansion_recommendations_reviewed_by_user_id_idx" ON "expansion_recommendations" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE INDEX "project_closeouts_completed_by_user_id_idx" ON "project_closeouts" USING btree ("completed_by_user_id");--> statement-breakpoint
CREATE INDEX "project_deliverables_project_id_idx" ON "project_deliverables" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_deliverables_owner_user_id_idx" ON "project_deliverables" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "project_deliverables_file_id_idx" ON "project_deliverables" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "project_deliverables_approved_by_user_id_idx" ON "project_deliverables" USING btree ("approved_by_user_id");--> statement-breakpoint
CREATE INDEX "project_issues_project_id_idx" ON "project_issues" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_issues_owner_user_id_idx" ON "project_issues" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "project_kpis_project_id_idx" ON "project_kpis" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_meetings_project_id_idx" ON "project_meetings" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_risks_project_id_idx" ON "project_risks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_risks_owner_user_id_idx" ON "project_risks" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "project_template_deliverables_template_id_idx" ON "project_template_deliverables" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "project_template_phases_template_id_idx" ON "project_template_phases" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "project_template_tasks_phase_id_idx" ON "project_template_tasks" USING btree ("phase_id");--> statement-breakpoint
CREATE INDEX "project_templates_service_id_idx" ON "project_templates" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "project_templates_service_version_id_idx" ON "project_templates" USING btree ("service_version_id");--> statement-breakpoint
CREATE INDEX "contracts_organization_id_idx" ON "contracts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contracts_company_id_idx" ON "contracts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "contracts_service_id_idx" ON "contracts" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "contracts_opportunity_id_idx" ON "contracts" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "contracts_proposal_id_idx" ON "contracts" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "contracts_solution_plan_id_idx" ON "contracts" USING btree ("solution_plan_id");--> statement-breakpoint
CREATE INDEX "contracts_project_id_idx" ON "contracts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "contracts_template_id_idx" ON "contracts" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "contracts_file_id_idx" ON "contracts" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "esign_envelopes_contract_id_idx" ON "esign_envelopes" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "legal_templates_organization_id_idx" ON "legal_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_templates_owner_user_id_idx" ON "legal_templates" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "billing_events_organization_id_idx" ON "billing_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "billing_events_company_id_idx" ON "billing_events" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "billing_events_project_id_idx" ON "billing_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "billing_events_contract_id_idx" ON "billing_events" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "billing_events_schedule_id_idx" ON "billing_events" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "billing_schedules_organization_id_idx" ON "billing_schedules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "billing_schedules_company_id_idx" ON "billing_schedules" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "billing_schedules_project_id_idx" ON "billing_schedules" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "billing_schedules_contract_id_idx" ON "billing_schedules" USING btree ("contract_id");--> statement-breakpoint
ALTER TABLE "solution_plans" ADD CONSTRAINT "solution_plans_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD CONSTRAINT "solution_plans_discovery_id_discoveries_id_fk" FOREIGN KEY ("discovery_id") REFERENCES "public"."discoveries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD CONSTRAINT "solution_plans_pricing_approved_by_user_id_users_id_fk" FOREIGN KEY ("pricing_approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD CONSTRAINT "solution_plans_generated_by_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("generated_by_agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_plans" ADD CONSTRAINT "solution_plans_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_contract_override_by_user_id_users_id_fk" FOREIGN KEY ("contract_override_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_packages" ADD CONSTRAINT "legal_packages_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "solution_plans_company_id_idx" ON "solution_plans" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "solution_plans_discovery_id_idx" ON "solution_plans" USING btree ("discovery_id");--> statement-breakpoint
CREATE INDEX "solution_plans_pricing_approved_by_user_id_idx" ON "solution_plans" USING btree ("pricing_approved_by_user_id");--> statement-breakpoint
CREATE INDEX "solution_plans_generated_by_agent_run_id_idx" ON "solution_plans" USING btree ("generated_by_agent_run_id");--> statement-breakpoint
CREATE INDEX "solution_plans_approved_by_user_id_idx" ON "solution_plans" USING btree ("approved_by_user_id");--> statement-breakpoint
CREATE INDEX "project_tasks_owner_user_id_idx" ON "project_tasks" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "project_tasks_agent_id_idx" ON "project_tasks" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "project_tasks_depends_on_task_id_idx" ON "project_tasks" USING btree ("depends_on_task_id");--> statement-breakpoint
CREATE INDEX "projects_company_id_idx" ON "projects" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "projects_service_id_idx" ON "projects" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "projects_opportunity_id_idx" ON "projects" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "projects_contract_id_idx" ON "projects" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "projects_owner_user_id_idx" ON "projects" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "projects_contract_override_by_user_id_idx" ON "projects" USING btree ("contract_override_by_user_id");--> statement-breakpoint
CREATE INDEX "legal_packages_contract_id_idx" ON "legal_packages" USING btree ("contract_id");