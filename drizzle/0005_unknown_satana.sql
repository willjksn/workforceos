CREATE TYPE "public"."ar_aging_bucket" AS ENUM('current', '1_30', '31_60', '61_90', '90_plus');--> statement-breakpoint
CREATE TYPE "public"."billing_schedule_status" AS ENUM('active', 'paused', 'terminated', 'completed');--> statement-breakpoint
CREATE TYPE "public"."billing_type" AS ENUM('placement_fee', 'monthly_recurring', 'milestone', 'fixed_project', 'retainer', 'custom');--> statement-breakpoint
CREATE TYPE "public"."enrichment_review_status" AS ENUM('pending_review', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."finance_adjustment_type" AS ENUM('write_off', 'invoice_adjustment', 'revenue_correction', 'fee_override', 'billing_schedule_change');--> statement-breakpoint
CREATE TYPE "public"."integration_job_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'dead_letter');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'ready', 'sent', 'partially_paid', 'paid', 'overdue', 'void', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."payment_reconciliation_status" AS ENUM('unmatched', 'matched', 'disputed', 'written_off');--> statement-breakpoint
CREATE TYPE "public"."revenue_event_status" AS ENUM('expected', 'recognized', 'invoiced', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."revenue_trigger_type" AS ENUM('candidate_start', 'milestone_completed', 'monthly_fractional', 'assessment_kickoff', 'final_deliverable', 'contract_deposit', 'custom');--> statement-breakpoint
CREATE TYPE "public"."workspace_reference_type" AS ENUM('calendar', 'meeting', 'interview', 'email_thread');--> statement-breakpoint
CREATE TABLE "occupation_alternate_titles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occupation_id" uuid NOT NULL,
	"title" text NOT NULL,
	"onet_source" text,
	"onet_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "occupation_alternate_titles_uq" UNIQUE("occupation_id","title")
);
--> statement-breakpoint
CREATE TABLE "contract_billing_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"name" text NOT NULL,
	"billing_type" text NOT NULL,
	"amount" numeric(14, 2),
	"percentage" numeric(8, 4),
	"due_trigger" text NOT NULL,
	"sequence" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "finance_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid,
	"project_id" uuid,
	"contract_id" uuid,
	"invoice_id" uuid,
	"schedule_id" uuid,
	"placement_id" uuid,
	"adjustment_type" "finance_adjustment_type" NOT NULL,
	"original_amount" numeric(14, 2),
	"adjusted_amount" numeric(14, 2) NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by_user_id" uuid,
	"approved_by_user_id" uuid,
	"approval_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "finance_cost_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid,
	"project_id" uuid,
	"contract_id" uuid,
	"category" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"incurred_date" date,
	"notes" text,
	"entered_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"contract_id" uuid,
	"project_id" uuid,
	"service_id" uuid,
	"schedule_id" uuid,
	"billing_event_id" uuid,
	"revenue_event_id" uuid,
	"invoice_number" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"balance_due" numeric(14, 2) NOT NULL,
	"issued_date" date,
	"due_date" date,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"owner_user_id" uuid,
	"next_action" text,
	"dispute_status" text,
	"aging_bucket" "ar_aging_bucket",
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "invoices_organization_number_uq" UNIQUE("organization_id","invoice_number")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"external_transaction_reference" text,
	"method_summary" text,
	"source_system" text DEFAULT 'workforceos' NOT NULL,
	"reconciliation_status" "payment_reconciliation_status" DEFAULT 'unmatched' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "revenue_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid,
	"project_id" uuid,
	"contract_id" uuid,
	"service_id" uuid,
	"placement_id" uuid,
	"billing_event_id" uuid,
	"schedule_id" uuid,
	"source" text NOT NULL,
	"trigger_type" "revenue_trigger_type" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"expected_date" date,
	"actual_date" date,
	"status" "revenue_event_status" DEFAULT 'expected' NOT NULL,
	"invoice_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "enrichment_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"company_id" uuid,
	"contact_id" uuid,
	"external_id" text,
	"proposed_payload" jsonb,
	"confidence" integer,
	"status" "enrichment_review_status" DEFAULT 'pending_review' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "integration_webhook_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"provider" text NOT NULL,
	"external_event_id" text NOT NULL,
	"signature_valid" boolean DEFAULT false NOT NULL,
	"status" "integration_job_status" DEFAULT 'queued' NOT NULL,
	"processed_at" timestamp with time zone,
	"last_error" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_webhook_receipts_provider_event_uq" UNIQUE("provider","external_event_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_event_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"reference_type" "workspace_reference_type" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"external_id" text,
	"title" text,
	"occurred_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "minimum_fee" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "retained_search_structure" text;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "linkedin_recruiter_project_id" text;--> statement-breakpoint
ALTER TABLE "search_projects" ADD COLUMN "linkedin_recruiter_reference_id" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "monthly_fee" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "billing_day" integer;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "minimum_term_months" integer;--> statement-breakpoint
ALTER TABLE "esign_envelopes" ADD COLUMN "completed_document_key" text;--> statement-breakpoint
ALTER TABLE "esign_envelopes" ADD COLUMN "signer_status" text;--> statement-breakpoint
ALTER TABLE "billing_events" ADD COLUMN "placement_id" uuid;--> statement-breakpoint
ALTER TABLE "billing_events" ADD COLUMN "trigger_type" "revenue_trigger_type";--> statement-breakpoint
ALTER TABLE "billing_events" ADD COLUMN "actual_date" date;--> statement-breakpoint
ALTER TABLE "billing_events" ADD COLUMN "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "billing_events" ADD COLUMN "source_type" text;--> statement-breakpoint
ALTER TABLE "billing_events" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD COLUMN "service_id" uuid;--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD COLUMN "billing_type" "billing_type" DEFAULT 'custom' NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD COLUMN "percentage" numeric(8, 4);--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD COLUMN "due_trigger" text;--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD COLUMN "scheduled_date" date;--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD COLUMN "recurrence" text;--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD COLUMN "invoice_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD COLUMN "status" "billing_schedule_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD COLUMN "billing_day" integer;--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD COLUMN "minimum_term_months" integer;--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD COLUMN "next_invoice_date" date;--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD COLUMN "renewal_status" text;--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD COLUMN "pause_reason" text;--> statement-breakpoint
ALTER TABLE "external_records" ADD COLUMN "last_sync_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD COLUMN "environment" text DEFAULT 'unconfigured' NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD COLUMN "account_label" text;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD COLUMN "scopes" text;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD COLUMN "last_success_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD COLUMN "last_health_check_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD COLUMN "disabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integration_events" ADD COLUMN "connection_id" uuid;--> statement-breakpoint
ALTER TABLE "integration_events" ADD COLUMN "external_event_id" text;--> statement-breakpoint
ALTER TABLE "integration_events" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "integration_events" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_events" ADD COLUMN "next_retry_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integration_events" ADD COLUMN "dead_letter" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_events" ADD COLUMN "payload" jsonb;--> statement-breakpoint
ALTER TABLE "occupation_alternate_titles" ADD CONSTRAINT "occupation_alternate_titles_occupation_id_civilian_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."civilian_occupations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_billing_terms" ADD CONSTRAINT "contract_billing_terms_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustments" ADD CONSTRAINT "finance_adjustments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustments" ADD CONSTRAINT "finance_adjustments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustments" ADD CONSTRAINT "finance_adjustments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustments" ADD CONSTRAINT "finance_adjustments_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustments" ADD CONSTRAINT "finance_adjustments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustments" ADD CONSTRAINT "finance_adjustments_schedule_id_billing_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."billing_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustments" ADD CONSTRAINT "finance_adjustments_placement_id_placements_id_fk" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustments" ADD CONSTRAINT "finance_adjustments_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_adjustments" ADD CONSTRAINT "finance_adjustments_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_cost_entries" ADD CONSTRAINT "finance_cost_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_cost_entries" ADD CONSTRAINT "finance_cost_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_cost_entries" ADD CONSTRAINT "finance_cost_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_cost_entries" ADD CONSTRAINT "finance_cost_entries_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_cost_entries" ADD CONSTRAINT "finance_cost_entries_entered_by_user_id_users_id_fk" FOREIGN KEY ("entered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_schedule_id_billing_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."billing_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billing_event_id_billing_events_id_fk" FOREIGN KEY ("billing_event_id") REFERENCES "public"."billing_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_placement_id_placements_id_fk" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_billing_event_id_billing_events_id_fk" FOREIGN KEY ("billing_event_id") REFERENCES "public"."billing_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_schedule_id_billing_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."billing_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_reviews" ADD CONSTRAINT "enrichment_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_reviews" ADD CONSTRAINT "enrichment_reviews_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_reviews" ADD CONSTRAINT "enrichment_reviews_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_reviews" ADD CONSTRAINT "enrichment_reviews_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_webhook_receipts" ADD CONSTRAINT "integration_webhook_receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_event_references" ADD CONSTRAINT "workspace_event_references_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "occupation_alternate_titles_occupation_id_idx" ON "occupation_alternate_titles" USING btree ("occupation_id");--> statement-breakpoint
CREATE INDEX "contract_billing_terms_contract_id_idx" ON "contract_billing_terms" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "finance_adjustments_organization_id_idx" ON "finance_adjustments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "finance_adjustments_company_id_idx" ON "finance_adjustments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "finance_adjustments_project_id_idx" ON "finance_adjustments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "finance_adjustments_contract_id_idx" ON "finance_adjustments" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "finance_adjustments_invoice_id_idx" ON "finance_adjustments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "finance_adjustments_schedule_id_idx" ON "finance_adjustments" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "finance_adjustments_placement_id_idx" ON "finance_adjustments" USING btree ("placement_id");--> statement-breakpoint
CREATE INDEX "finance_adjustments_requested_by_user_id_idx" ON "finance_adjustments" USING btree ("requested_by_user_id");--> statement-breakpoint
CREATE INDEX "finance_adjustments_approved_by_user_id_idx" ON "finance_adjustments" USING btree ("approved_by_user_id");--> statement-breakpoint
CREATE INDEX "finance_cost_entries_organization_id_idx" ON "finance_cost_entries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "finance_cost_entries_company_id_idx" ON "finance_cost_entries" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "finance_cost_entries_project_id_idx" ON "finance_cost_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "finance_cost_entries_contract_id_idx" ON "finance_cost_entries" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "finance_cost_entries_entered_by_user_id_idx" ON "finance_cost_entries" USING btree ("entered_by_user_id");--> statement-breakpoint
CREATE INDEX "invoices_organization_id_idx" ON "invoices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invoices_company_id_idx" ON "invoices" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "invoices_contract_id_idx" ON "invoices" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "invoices_project_id_idx" ON "invoices" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "invoices_service_id_idx" ON "invoices" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "invoices_schedule_id_idx" ON "invoices" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "invoices_billing_event_id_idx" ON "invoices" USING btree ("billing_event_id");--> statement-breakpoint
CREATE INDEX "invoices_owner_user_id_idx" ON "invoices" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "payments_organization_id_idx" ON "payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payments_invoice_id_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "revenue_events_organization_id_idx" ON "revenue_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "revenue_events_company_id_idx" ON "revenue_events" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "revenue_events_project_id_idx" ON "revenue_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "revenue_events_contract_id_idx" ON "revenue_events" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "revenue_events_service_id_idx" ON "revenue_events" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "revenue_events_placement_id_idx" ON "revenue_events" USING btree ("placement_id");--> statement-breakpoint
CREATE INDEX "revenue_events_billing_event_id_idx" ON "revenue_events" USING btree ("billing_event_id");--> statement-breakpoint
CREATE INDEX "revenue_events_schedule_id_idx" ON "revenue_events" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "revenue_events_invoice_id_idx" ON "revenue_events" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "enrichment_reviews_organization_id_idx" ON "enrichment_reviews" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "enrichment_reviews_company_id_idx" ON "enrichment_reviews" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "enrichment_reviews_contact_id_idx" ON "enrichment_reviews" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "enrichment_reviews_reviewed_by_user_id_idx" ON "enrichment_reviews" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE INDEX "integration_webhook_receipts_organization_id_idx" ON "integration_webhook_receipts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workspace_event_references_organization_id_idx" ON "workspace_event_references" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workspace_event_references_entity_idx" ON "workspace_event_references" USING btree ("entity_type","entity_id");--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_placement_id_placements_id_fk" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_schedules" ADD CONSTRAINT "billing_schedules_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_events_placement_id_idx" ON "billing_events" USING btree ("placement_id");--> statement-breakpoint
CREATE INDEX "billing_events_invoice_id_idx" ON "billing_events" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "billing_schedules_service_id_idx" ON "billing_schedules" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "integration_events_connection_id_idx" ON "integration_events" USING btree ("connection_id");--> statement-breakpoint
ALTER TABLE "external_records" ADD CONSTRAINT "external_records_org_provider_entity_uq" UNIQUE("organization_id","provider","entity_type","entity_id");--> statement-breakpoint
ALTER TABLE "external_records" ADD CONSTRAINT "external_records_org_provider_external_uq" UNIQUE("organization_id","provider","external_id","entity_type");--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_org_provider_uq" UNIQUE("organization_id","provider");--> statement-breakpoint
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_idempotency_uq" UNIQUE("organization_id","provider","idempotency_key");