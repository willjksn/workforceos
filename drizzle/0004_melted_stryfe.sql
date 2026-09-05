CREATE TYPE "public"."apprenticeship_status" AS ENUM('planned', 'active', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."career_path_edge_type" AS ENUM('sequential', 'lateral');--> statement-breakpoint
CREATE TYPE "public"."education_partner_type" AS ENUM('community_college', 'university', 'technical_school', 'training_provider', 'workforce_board', 'other');--> statement-breakpoint
CREATE TYPE "public"."labor_market_provider" AS ENUM('bls', 'census', 'onet');--> statement-breakpoint
CREATE TYPE "public"."partnership_status" AS ENUM('exploratory', 'active', 'paused', 'ended');--> statement-breakpoint
CREATE TYPE "public"."skill_family" AS ENUM('technical', 'leadership', 'business', 'digital', 'safety_compliance', 'other');--> statement-breakpoint
CREATE TYPE "public"."skills_gap_scope" AS ENUM('individual', 'aggregate', 'military_transition');--> statement-breakpoint
CREATE TYPE "public"."talent_scarcity_class" AS ENUM('unknown', 'estimated', 'internal_only', 'scarce', 'moderate', 'abundant');--> statement-breakpoint
CREATE TYPE "public"."workforce_assessment_status" AS ENUM('draft', 'data_collection', 'analysis', 'human_review', 'client_ready', 'delivered', 'completed', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."workforce_criticality" AS ENUM('critical', 'high', 'moderate', 'low');--> statement-breakpoint
CREATE TYPE "public"."workforce_data_quality" AS ENUM('unknown', 'estimated', 'internal_only', 'sourced', 'reviewed');--> statement-breakpoint
CREATE TYPE "public"."workforce_import_source" AS ENUM('csv', 'excel', 'manual', 'integration');--> statement-breakpoint
CREATE TYPE "public"."workforce_pipeline_status" AS ENUM('planned', 'active', 'at_risk', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."workforce_recommendation_status" AS ENUM('draft', 'pending_approval', 'approved', 'rejected', 'changes_requested');--> statement-breakpoint
CREATE TYPE "public"."workforce_risk_category" AS ENUM('skills_shortage', 'retirement', 'attrition', 'capacity', 'geographic_scarcity', 'credential_shortage', 'education_capacity', 'training_capacity', 'military_availability', 'pipeline_conversion', 'compensation', 'competition');--> statement-breakpoint
CREATE TYPE "public"."workforce_roadmap_period" AS ENUM('0_90_days', '3_6_months', '6_12_months', '12_24_months');--> statement-breakpoint
CREATE TYPE "public"."workforce_supply_source_type" AS ENUM('internal_mobility', 'labor_market', 'military', 'apprenticeship', 'community_college', 'university', 'technical_school', 'training_program', 'talent_network', 'workforce_board', 'external_recruiting', 'other');--> statement-breakpoint
CREATE TABLE "apprenticeships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid,
	"partner_id" uuid,
	"occupation_id" uuid,
	"sponsor_name" text,
	"duration_months" integer,
	"training_hours" integer,
	"classroom_hours" integer,
	"target_enrollment" integer,
	"annual_capacity" integer,
	"status" "apprenticeship_status" DEFAULT 'planned' NOT NULL,
	"expected_completion_rate_percent" numeric(8, 4),
	"hiring_conversion_percent" numeric(8, 4),
	"retention_rate_percent" numeric(8, 4),
	"notes" text,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "career_path_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path_id" uuid NOT NULL,
	"from_level_id" uuid NOT NULL,
	"to_level_id" uuid NOT NULL,
	"edge_type" "career_path_edge_type" DEFAULT 'sequential' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "career_path_level_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "career_path_level_skills_uq" UNIQUE("level_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "career_path_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"title" text NOT NULL,
	"civilian_occupation_id" uuid,
	"experience" text,
	"training" text,
	"certifications" text,
	"readiness_criteria" text,
	"expected_time_months" integer,
	"leadership_requirements" text,
	"compensation_band" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "career_path_levels_path_sequence_uq" UNIQUE("path_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "career_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "education_partner_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "education_partner_clients_uq" UNIQUE("partner_id","company_id")
);
--> statement-breakpoint
CREATE TABLE "education_partner_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "education_partner_contacts_uq" UNIQUE("partner_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "education_partner_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"region" text,
	"country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "education_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid,
	"name" text NOT NULL,
	"partner_type" "education_partner_type" NOT NULL,
	"partnership_status" "partnership_status" DEFAULT 'exploratory' NOT NULL,
	"programs_summary" text,
	"occupations_supported" text,
	"credentials" text,
	"annual_capacity" integer,
	"notes" text,
	"outcomes" text,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "labor_market_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "labor_market_provider" NOT NULL,
	"geography" text,
	"occupation_code" text,
	"metric" text NOT NULL,
	"value_numeric" numeric(14, 4),
	"as_of_date" date,
	"source_version" text,
	"is_fixture" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "labor_market_source_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "labor_market_provider" NOT NULL,
	"configured" boolean DEFAULT false NOT NULL,
	"last_sync_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "labor_market_source_metadata_org_provider_uq" UNIQUE("organization_id","provider")
);
--> statement-breakpoint
CREATE TABLE "skills_gap_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid,
	"role_id" uuid NOT NULL,
	"scope" "skills_gap_scope" NOT NULL,
	"candidate_id" uuid,
	"existing_skills_summary" text,
	"missing_skills_summary" text,
	"proficiency_gaps" text,
	"certification_gaps" text,
	"recommended_training" text,
	"readiness_estimate" text,
	"source" text,
	"source_date" timestamp with time zone,
	"source_version" text,
	"internal_assumption" text,
	"analyst_override" text,
	"generated_by_model" text,
	"generated_by_model_version" text,
	"confidence" numeric(5, 4),
	"reviewer_user_id" uuid,
	"generated_at" timestamp with time zone,
	"data_quality" "workforce_data_quality" DEFAULT 'internal_only' NOT NULL,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "skills_gap_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"status" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "talent_pipeline_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"gap_id" uuid NOT NULL,
	"source_type" "workforce_supply_source_type" NOT NULL,
	"planned_count" integer DEFAULT 0 NOT NULL,
	"actual_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "talent_pipeline_allocations_gap_source_uq" UNIQUE("gap_id","source_type")
);
--> statement-breakpoint
CREATE TABLE "talent_pipelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"assessment_id" uuid,
	"gap_id" uuid,
	"role_id" uuid NOT NULL,
	"company_location_id" uuid,
	"name" text NOT NULL,
	"source_type" "workforce_supply_source_type" NOT NULL,
	"status" "workforce_pipeline_status" DEFAULT 'planned' NOT NULL,
	"owner_user_id" uuid,
	"partner_id" uuid,
	"target_candidates_per_year" integer DEFAULT 0 NOT NULL,
	"expected_conversion_percent" numeric(8, 4),
	"training_requirements" text,
	"expected_time_to_ready_days" integer,
	"budget_assumption" text,
	"kpis" text,
	"notes" text,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "talent_scarcity_indicators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"company_location_id" uuid,
	"labor_supply_evidence" text,
	"hiring_difficulty" text,
	"historical_time_to_fill_days" integer,
	"compensation_pressure" text,
	"geographic_availability" text,
	"training_capacity" text,
	"credential_barriers" text,
	"competition" text,
	"military_supply" text,
	"internal_pipeline" text,
	"classification" "talent_scarcity_class" DEFAULT 'unknown' NOT NULL,
	"source" text,
	"source_date" timestamp with time zone,
	"source_version" text,
	"internal_assumption" text,
	"analyst_override" text,
	"generated_by_model" text,
	"generated_by_model_version" text,
	"confidence" numeric(5, 4),
	"reviewer_user_id" uuid,
	"generated_at" timestamp with time zone,
	"data_quality" "workforce_data_quality" DEFAULT 'internal_only' NOT NULL,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "training_program_occupations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"occupation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "training_program_occupations_uq" UNIQUE("program_id","occupation_id")
);
--> statement-breakpoint
CREATE TABLE "training_program_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "training_program_skills_uq" UNIQUE("program_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "training_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"partner_id" uuid,
	"name" text NOT NULL,
	"duration_days" integer,
	"cost" numeric(14, 2),
	"capacity" integer,
	"delivery_method" text,
	"location" text,
	"prerequisites" text,
	"completion_rate_percent" numeric(8, 4),
	"placement_rate_percent" numeric(8, 4),
	"credentials" text,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workforce_assessment_assumptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"included" boolean DEFAULT true NOT NULL,
	"rate_percent" numeric(8, 4),
	"quantity" integer,
	"explanation" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "workforce_assessment_assumptions_code_uq" UNIQUE("assessment_id","code")
);
--> statement-breakpoint
CREATE TABLE "workforce_assessment_data_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_name" text NOT NULL,
	"source_date" timestamp with time zone,
	"source_version" text,
	"notes" text,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workforce_assessment_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"company_location_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "workforce_assessment_locations_uq" UNIQUE("assessment_id","company_location_id")
);
--> statement-breakpoint
CREATE TABLE "workforce_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"solution_plan_id" uuid,
	"service_id" uuid,
	"project_id" uuid,
	"title" text NOT NULL,
	"status" "workforce_assessment_status" DEFAULT 'draft' NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"supersedes_assessment_id" uuid,
	"notes" text,
	"created_by_user_id" uuid,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "workforce_assessments_company_version_uq" UNIQUE("company_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "workforce_baselines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"company_location_id" uuid,
	"import_id" uuid,
	"current_headcount" integer DEFAULT 0 NOT NULL,
	"vacancies" integer DEFAULT 0 NOT NULL,
	"attrition_rate_percent" numeric(8, 4),
	"retirement_eligibility_rate_percent" numeric(8, 4),
	"turnover_rate_percent" numeric(8, 4),
	"average_tenure_months" numeric(8, 2),
	"internal_mobility_rate_percent" numeric(8, 4),
	"current_pipeline_count" integer DEFAULT 0 NOT NULL,
	"known_hiring_plan" integer DEFAULT 0 NOT NULL,
	"training_capacity" integer DEFAULT 0 NOT NULL,
	"as_of_date" date,
	"source" text,
	"source_date" timestamp with time zone,
	"source_version" text,
	"internal_assumption" text,
	"analyst_override" text,
	"generated_by_model" text,
	"generated_by_model_version" text,
	"confidence" numeric(5, 4),
	"reviewer_user_id" uuid,
	"generated_at" timestamp with time zone,
	"data_quality" "workforce_data_quality" DEFAULT 'internal_only' NOT NULL,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "workforce_baselines_assessment_role_location_uq" UNIQUE("assessment_id","role_id","company_location_id")
);
--> statement-breakpoint
CREATE TABLE "workforce_forecast_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forecast_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"included" boolean DEFAULT true NOT NULL,
	"rate_percent" numeric(8, 4),
	"quantity" integer,
	"explanation" text,
	"sequence" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "workforce_forecast_components_code_uq" UNIQUE("forecast_id","code")
);
--> statement-breakpoint
CREATE TABLE "workforce_forecast_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forecast_id" uuid NOT NULL,
	"component_code" text NOT NULL,
	"previous_value" text,
	"new_value" text NOT NULL,
	"reason" text NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workforce_forecast_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forecast_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"company_location_id" uuid,
	"horizon_months" integer NOT NULL,
	"current_required" integer DEFAULT 0 NOT NULL,
	"growth_demand" integer DEFAULT 0 NOT NULL,
	"replacement_demand" integer DEFAULT 0 NOT NULL,
	"backlog_demand" integer DEFAULT 0 NOT NULL,
	"expected_internal_supply" integer DEFAULT 0 NOT NULL,
	"future_demand" integer DEFAULT 0 NOT NULL,
	"assumptions_summary" text,
	"source" text,
	"source_date" timestamp with time zone,
	"source_version" text,
	"internal_assumption" text,
	"analyst_override" text,
	"generated_by_model" text,
	"generated_by_model_version" text,
	"confidence" numeric(5, 4),
	"reviewer_user_id" uuid,
	"generated_at" timestamp with time zone,
	"data_quality" "workforce_data_quality" DEFAULT 'internal_only' NOT NULL,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "workforce_forecast_results_forecast_role_loc_horizon_uq" UNIQUE("forecast_id","role_id","company_location_id","horizon_months")
);
--> statement-breakpoint
CREATE TABLE "workforce_forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"horizon_months" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"calculation_method" text NOT NULL,
	"created_by_user_id" uuid,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"source" text,
	"source_date" timestamp with time zone,
	"source_version" text,
	"internal_assumption" text,
	"analyst_override" text,
	"generated_by_model" text,
	"generated_by_model_version" text,
	"confidence" numeric(5, 4),
	"reviewer_user_id" uuid,
	"generated_at" timestamp with time zone,
	"data_quality" "workforce_data_quality" DEFAULT 'internal_only' NOT NULL,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "workforce_forecasts_assessment_version_horizon_uq" UNIQUE("assessment_id","version_number","horizon_months")
);
--> statement-breakpoint
CREATE TABLE "workforce_gap_thresholds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"severity" "workforce_criticality" NOT NULL,
	"min_gap" integer NOT NULL,
	"min_gap_percent" numeric(8, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "workforce_gap_thresholds_org_severity_uq" UNIQUE("organization_id","severity")
);
--> statement-breakpoint
CREATE TABLE "workforce_gaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"forecast_result_id" uuid,
	"role_id" uuid NOT NULL,
	"company_location_id" uuid,
	"horizon_months" integer NOT NULL,
	"demand" integer DEFAULT 0 NOT NULL,
	"supply" integer DEFAULT 0 NOT NULL,
	"gap" integer DEFAULT 0 NOT NULL,
	"severity" "workforce_criticality" DEFAULT 'moderate' NOT NULL,
	"risk" text,
	"time_horizon" text,
	"assumptions_summary" text,
	"override_reason" text,
	"source" text,
	"source_date" timestamp with time zone,
	"source_version" text,
	"internal_assumption" text,
	"analyst_override" text,
	"generated_by_model" text,
	"generated_by_model_version" text,
	"confidence" numeric(5, 4),
	"reviewer_user_id" uuid,
	"generated_at" timestamp with time zone,
	"data_quality" "workforce_data_quality" DEFAULT 'internal_only' NOT NULL,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workforce_geographies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"geography_type" text NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"region" text,
	"country" text,
	"reference_table" text,
	"reference_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workforce_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"source_type" "workforce_import_source" NOT NULL,
	"file_name" text,
	"row_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by_user_id" uuid,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workforce_kpis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"value_numeric" numeric(14, 4),
	"unit" text,
	"as_of_date" date,
	"source" text,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "workforce_kpis_assessment_code_uq" UNIQUE("assessment_id","code")
);
--> statement-breakpoint
CREATE TABLE "workforce_pipeline_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"project_deliverable_id" uuid,
	"version_number" integer DEFAULT 1 NOT NULL,
	"status" "workforce_recommendation_status" DEFAULT 'draft' NOT NULL,
	"html_body" text,
	"executive_summary" text,
	"current_workforce_state" text,
	"critical_occupations" text,
	"demand_forecast" text,
	"talent_supply" text,
	"workforce_gaps" text,
	"military_opportunity" text,
	"education_training_opportunity" text,
	"internal_development" text,
	"recommended_pipeline_mix" text,
	"scenario_analysis" text,
	"implementation_roadmap" text,
	"kpis" text,
	"risks" text,
	"assumptions" text,
	"approval_id" uuid,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"source" text,
	"source_date" timestamp with time zone,
	"source_version" text,
	"internal_assumption" text,
	"analyst_override" text,
	"generated_by_model" text,
	"generated_by_model_version" text,
	"confidence" numeric(5, 4),
	"reviewer_user_id" uuid,
	"generated_at" timestamp with time zone,
	"data_quality" "workforce_data_quality" DEFAULT 'internal_only' NOT NULL,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "workforce_pipeline_plans_assessment_version_uq" UNIQUE("assessment_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "workforce_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" "workforce_recommendation_status" DEFAULT 'draft' NOT NULL,
	"generated_by_actor_type" text DEFAULT 'human' NOT NULL,
	"generated_by_agent_id" uuid,
	"generated_by_user_id" uuid,
	"approval_id" uuid,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"source" text,
	"source_date" timestamp with time zone,
	"source_version" text,
	"internal_assumption" text,
	"analyst_override" text,
	"generated_by_model" text,
	"generated_by_model_version" text,
	"confidence" numeric(5, 4),
	"reviewer_user_id" uuid,
	"generated_at" timestamp with time zone,
	"data_quality" "workforce_data_quality" DEFAULT 'internal_only' NOT NULL,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workforce_risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"role_id" uuid,
	"category" "workforce_risk_category" NOT NULL,
	"severity" "workforce_criticality" DEFAULT 'moderate' NOT NULL,
	"likelihood" text DEFAULT 'medium' NOT NULL,
	"impact" text DEFAULT 'medium' NOT NULL,
	"mitigation" text,
	"owner_user_id" uuid,
	"status" "risk_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workforce_roadmap_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"recommendation_id" uuid,
	"period" "workforce_roadmap_period" NOT NULL,
	"action" text NOT NULL,
	"owner_user_id" uuid,
	"client_responsibility" text,
	"firm_responsibility" text,
	"dependency" text,
	"due_period" text,
	"kpi" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"project_task_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workforce_role_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"requirement_type" "skill_requirement_type" DEFAULT 'required' NOT NULL,
	"target_proficiency" text,
	"years_experience" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "workforce_role_skills_role_skill_uq" UNIQUE("role_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "workforce_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"assessment_id" uuid,
	"title" text NOT NULL,
	"civilian_occupation_id" uuid,
	"job_family" text,
	"company_location_id" uuid,
	"current_headcount" integer DEFAULT 0 NOT NULL,
	"required_skills_summary" text,
	"criticality" "workforce_criticality" DEFAULT 'moderate' NOT NULL,
	"business_function" text,
	"shift_schedule" text,
	"minimum_credentials" text,
	"target_proficiency" text,
	"future_demand_category" text,
	"military_compatibility" text,
	"talent_scarcity" "talent_scarcity_class" DEFAULT 'unknown' NOT NULL,
	"replacement_difficulty" "workforce_criticality" DEFAULT 'moderate' NOT NULL,
	"notes" text,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workforce_scenario_inputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"growth_delta_percent" numeric(8, 4),
	"attrition_delta_percent" numeric(8, 4),
	"retirement_delta_percent" numeric(8, 4),
	"hiring_delta" integer,
	"training_capacity_delta" integer,
	"pipeline_conversion_delta_percent" numeric(8, 4),
	"military_contribution_delta" integer,
	"internal_mobility_delta_percent" numeric(8, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "workforce_scenario_inputs_scenario_uq" UNIQUE("scenario_id")
);
--> statement-breakpoint
CREATE TABLE "workforce_scenario_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"horizon_months" integer NOT NULL,
	"projected_demand" integer DEFAULT 0 NOT NULL,
	"projected_supply" integer DEFAULT 0 NOT NULL,
	"resulting_gap" integer DEFAULT 0 NOT NULL,
	"required_pipeline_capacity" integer DEFAULT 0 NOT NULL,
	"estimated_time_to_readiness_days" integer,
	"major_risks" text,
	"key_assumptions" text,
	"source" text,
	"source_date" timestamp with time zone,
	"source_version" text,
	"internal_assumption" text,
	"analyst_override" text,
	"generated_by_model" text,
	"generated_by_model_version" text,
	"confidence" numeric(5, 4),
	"reviewer_user_id" uuid,
	"generated_at" timestamp with time zone,
	"data_quality" "workforce_data_quality" DEFAULT 'internal_only' NOT NULL,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workforce_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by_user_id" uuid,
	"source" text,
	"source_date" timestamp with time zone,
	"source_version" text,
	"internal_assumption" text,
	"analyst_override" text,
	"generated_by_model" text,
	"generated_by_model_version" text,
	"confidence" numeric(5, 4),
	"reviewer_user_id" uuid,
	"generated_at" timestamp with time zone,
	"data_quality" "workforce_data_quality" DEFAULT 'internal_only' NOT NULL,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workforce_supply_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"company_location_id" uuid,
	"source_type" "workforce_supply_source_type" NOT NULL,
	"estimated_supply" integer DEFAULT 0 NOT NULL,
	"readiness" text,
	"training_required" text,
	"time_to_readiness_days" integer,
	"capacity" integer,
	"last_updated" timestamp with time zone,
	"source" text,
	"source_date" timestamp with time zone,
	"source_version" text,
	"internal_assumption" text,
	"analyst_override" text,
	"generated_by_model" text,
	"generated_by_model_version" text,
	"confidence" numeric(5, 4),
	"reviewer_user_id" uuid,
	"generated_at" timestamp with time zone,
	"data_quality" "workforce_data_quality" DEFAULT 'internal_only' NOT NULL,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "skill_family" "skill_family" DEFAULT 'technical' NOT NULL;--> statement-breakpoint
ALTER TABLE "apprenticeships" ADD CONSTRAINT "apprenticeships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apprenticeships" ADD CONSTRAINT "apprenticeships_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apprenticeships" ADD CONSTRAINT "apprenticeships_partner_id_education_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."education_partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apprenticeships" ADD CONSTRAINT "apprenticeships_occupation_id_civilian_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."civilian_occupations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_path_edges" ADD CONSTRAINT "career_path_edges_path_id_career_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."career_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_path_edges" ADD CONSTRAINT "career_path_edges_from_level_id_career_path_levels_id_fk" FOREIGN KEY ("from_level_id") REFERENCES "public"."career_path_levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_path_edges" ADD CONSTRAINT "career_path_edges_to_level_id_career_path_levels_id_fk" FOREIGN KEY ("to_level_id") REFERENCES "public"."career_path_levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_path_level_skills" ADD CONSTRAINT "career_path_level_skills_level_id_career_path_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."career_path_levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_path_level_skills" ADD CONSTRAINT "career_path_level_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_path_levels" ADD CONSTRAINT "career_path_levels_path_id_career_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."career_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_path_levels" ADD CONSTRAINT "career_path_levels_civilian_occupation_id_civilian_occupations_id_fk" FOREIGN KEY ("civilian_occupation_id") REFERENCES "public"."civilian_occupations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_paths" ADD CONSTRAINT "career_paths_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_paths" ADD CONSTRAINT "career_paths_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education_partner_clients" ADD CONSTRAINT "education_partner_clients_partner_id_education_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."education_partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education_partner_clients" ADD CONSTRAINT "education_partner_clients_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education_partner_contacts" ADD CONSTRAINT "education_partner_contacts_partner_id_education_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."education_partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education_partner_contacts" ADD CONSTRAINT "education_partner_contacts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education_partner_locations" ADD CONSTRAINT "education_partner_locations_partner_id_education_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."education_partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education_partners" ADD CONSTRAINT "education_partners_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education_partners" ADD CONSTRAINT "education_partners_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_market_observations" ADD CONSTRAINT "labor_market_observations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_market_source_metadata" ADD CONSTRAINT "labor_market_source_metadata_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills_gap_analyses" ADD CONSTRAINT "skills_gap_analyses_assessment_id_workforce_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."workforce_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills_gap_analyses" ADD CONSTRAINT "skills_gap_analyses_role_id_workforce_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."workforce_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills_gap_analyses" ADD CONSTRAINT "skills_gap_analyses_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills_gap_items" ADD CONSTRAINT "skills_gap_items_analysis_id_skills_gap_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."skills_gap_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills_gap_items" ADD CONSTRAINT "skills_gap_items_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_pipeline_allocations" ADD CONSTRAINT "talent_pipeline_allocations_pipeline_id_talent_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."talent_pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_pipeline_allocations" ADD CONSTRAINT "talent_pipeline_allocations_gap_id_workforce_gaps_id_fk" FOREIGN KEY ("gap_id") REFERENCES "public"."workforce_gaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_pipelines" ADD CONSTRAINT "talent_pipelines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_pipelines" ADD CONSTRAINT "talent_pipelines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_pipelines" ADD CONSTRAINT "talent_pipelines_assessment_id_workforce_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."workforce_assessments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_pipelines" ADD CONSTRAINT "talent_pipelines_gap_id_workforce_gaps_id_fk" FOREIGN KEY ("gap_id") REFERENCES "public"."workforce_gaps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_pipelines" ADD CONSTRAINT "talent_pipelines_role_id_workforce_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."workforce_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_pipelines" ADD CONSTRAINT "talent_pipelines_company_location_id_company_locations_id_fk" FOREIGN KEY ("company_location_id") REFERENCES "public"."company_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_pipelines" ADD CONSTRAINT "talent_pipelines_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_pipelines" ADD CONSTRAINT "talent_pipelines_partner_id_education_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."education_partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_scarcity_indicators" ADD CONSTRAINT "talent_scarcity_indicators_role_id_workforce_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."workforce_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_scarcity_indicators" ADD CONSTRAINT "talent_scarcity_indicators_company_location_id_company_locations_id_fk" FOREIGN KEY ("company_location_id") REFERENCES "public"."company_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_scarcity_indicators" ADD CONSTRAINT "talent_scarcity_indicators_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_program_occupations" ADD CONSTRAINT "training_program_occupations_program_id_training_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."training_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_program_occupations" ADD CONSTRAINT "training_program_occupations_occupation_id_civilian_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."civilian_occupations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_program_skills" ADD CONSTRAINT "training_program_skills_program_id_training_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."training_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_program_skills" ADD CONSTRAINT "training_program_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_partner_id_education_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."education_partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_assessment_assumptions" ADD CONSTRAINT "workforce_assessment_assumptions_assessment_id_workforce_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."workforce_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_assessment_assumptions" ADD CONSTRAINT "workforce_assessment_assumptions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_assessment_data_sources" ADD CONSTRAINT "workforce_assessment_data_sources_assessment_id_workforce_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."workforce_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_assessment_locations" ADD CONSTRAINT "workforce_assessment_locations_assessment_id_workforce_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."workforce_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_assessment_locations" ADD CONSTRAINT "workforce_assessment_locations_company_location_id_company_locations_id_fk" FOREIGN KEY ("company_location_id") REFERENCES "public"."company_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_assessments" ADD CONSTRAINT "workforce_assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_assessments" ADD CONSTRAINT "workforce_assessments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_assessments" ADD CONSTRAINT "workforce_assessments_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_assessments" ADD CONSTRAINT "workforce_assessments_solution_plan_id_solution_plans_id_fk" FOREIGN KEY ("solution_plan_id") REFERENCES "public"."solution_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_assessments" ADD CONSTRAINT "workforce_assessments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_assessments" ADD CONSTRAINT "workforce_assessments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_assessments" ADD CONSTRAINT "workforce_assessments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_assessments" ADD CONSTRAINT "workforce_assessments_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_baselines" ADD CONSTRAINT "workforce_baselines_assessment_id_workforce_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."workforce_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_baselines" ADD CONSTRAINT "workforce_baselines_role_id_workforce_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."workforce_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_baselines" ADD CONSTRAINT "workforce_baselines_company_location_id_company_locations_id_fk" FOREIGN KEY ("company_location_id") REFERENCES "public"."company_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_baselines" ADD CONSTRAINT "workforce_baselines_import_id_workforce_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."workforce_imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_baselines" ADD CONSTRAINT "workforce_baselines_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_forecast_components" ADD CONSTRAINT "workforce_forecast_components_forecast_id_workforce_forecasts_id_fk" FOREIGN KEY ("forecast_id") REFERENCES "public"."workforce_forecasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_forecast_overrides" ADD CONSTRAINT "workforce_forecast_overrides_forecast_id_workforce_forecasts_id_fk" FOREIGN KEY ("forecast_id") REFERENCES "public"."workforce_forecasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_forecast_overrides" ADD CONSTRAINT "workforce_forecast_overrides_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_forecast_results" ADD CONSTRAINT "workforce_forecast_results_forecast_id_workforce_forecasts_id_fk" FOREIGN KEY ("forecast_id") REFERENCES "public"."workforce_forecasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_forecast_results" ADD CONSTRAINT "workforce_forecast_results_role_id_workforce_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."workforce_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_forecast_results" ADD CONSTRAINT "workforce_forecast_results_company_location_id_company_locations_id_fk" FOREIGN KEY ("company_location_id") REFERENCES "public"."company_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_forecast_results" ADD CONSTRAINT "workforce_forecast_results_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_forecasts" ADD CONSTRAINT "workforce_forecasts_assessment_id_workforce_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."workforce_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_forecasts" ADD CONSTRAINT "workforce_forecasts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_forecasts" ADD CONSTRAINT "workforce_forecasts_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_forecasts" ADD CONSTRAINT "workforce_forecasts_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_gap_thresholds" ADD CONSTRAINT "workforce_gap_thresholds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_gaps" ADD CONSTRAINT "workforce_gaps_assessment_id_workforce_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."workforce_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_gaps" ADD CONSTRAINT "workforce_gaps_forecast_result_id_workforce_forecast_results_id_fk" FOREIGN KEY ("forecast_result_id") REFERENCES "public"."workforce_forecast_results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_gaps" ADD CONSTRAINT "workforce_gaps_role_id_workforce_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."workforce_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_gaps" ADD CONSTRAINT "workforce_gaps_company_location_id_company_locations_id_fk" FOREIGN KEY ("company_location_id") REFERENCES "public"."company_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_gaps" ADD CONSTRAINT "workforce_gaps_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_geographies" ADD CONSTRAINT "workforce_geographies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_imports" ADD CONSTRAINT "workforce_imports_assessment_id_workforce_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."workforce_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_imports" ADD CONSTRAINT "workforce_imports_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_kpis" ADD CONSTRAINT "workforce_kpis_assessment_id_workforce_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."workforce_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_pipeline_plans" ADD CONSTRAINT "workforce_pipeline_plans_assessment_id_workforce_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."workforce_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_pipeline_plans" ADD CONSTRAINT "workforce_pipeline_plans_project_deliverable_id_project_deliverables_id_fk" FOREIGN KEY ("project_deliverable_id") REFERENCES "public"."project_deliverables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_pipeline_plans" ADD CONSTRAINT "workforce_pipeline_plans_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_pipeline_plans" ADD CONSTRAINT "workforce_pipeline_plans_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_pipeline_plans" ADD CONSTRAINT "workforce_pipeline_plans_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_recommendations" ADD CONSTRAINT "workforce_recommendations_assessment_id_workforce_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."workforce_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_recommendations" ADD CONSTRAINT "workforce_recommendations_generated_by_agent_id_agents_id_fk" FOREIGN KEY ("generated_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_recommendations" ADD CONSTRAINT "workforce_recommendations_generated_by_user_id_users_id_fk" FOREIGN KEY ("generated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_recommendations" ADD CONSTRAINT "workforce_recommendations_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_recommendations" ADD CONSTRAINT "workforce_recommendations_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_recommendations" ADD CONSTRAINT "workforce_recommendations_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_risks" ADD CONSTRAINT "workforce_risks_assessment_id_workforce_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."workforce_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_risks" ADD CONSTRAINT "workforce_risks_role_id_workforce_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."workforce_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_risks" ADD CONSTRAINT "workforce_risks_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_roadmap_items" ADD CONSTRAINT "workforce_roadmap_items_assessment_id_workforce_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."workforce_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_roadmap_items" ADD CONSTRAINT "workforce_roadmap_items_recommendation_id_workforce_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."workforce_recommendations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_roadmap_items" ADD CONSTRAINT "workforce_roadmap_items_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_roadmap_items" ADD CONSTRAINT "workforce_roadmap_items_project_task_id_project_tasks_id_fk" FOREIGN KEY ("project_task_id") REFERENCES "public"."project_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_role_skills" ADD CONSTRAINT "workforce_role_skills_role_id_workforce_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."workforce_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_role_skills" ADD CONSTRAINT "workforce_role_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_roles" ADD CONSTRAINT "workforce_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_roles" ADD CONSTRAINT "workforce_roles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_roles" ADD CONSTRAINT "workforce_roles_assessment_id_workforce_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."workforce_assessments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_roles" ADD CONSTRAINT "workforce_roles_civilian_occupation_id_civilian_occupations_id_fk" FOREIGN KEY ("civilian_occupation_id") REFERENCES "public"."civilian_occupations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_roles" ADD CONSTRAINT "workforce_roles_company_location_id_company_locations_id_fk" FOREIGN KEY ("company_location_id") REFERENCES "public"."company_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_scenario_inputs" ADD CONSTRAINT "workforce_scenario_inputs_scenario_id_workforce_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."workforce_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_scenario_outputs" ADD CONSTRAINT "workforce_scenario_outputs_scenario_id_workforce_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."workforce_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_scenario_outputs" ADD CONSTRAINT "workforce_scenario_outputs_role_id_workforce_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."workforce_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_scenario_outputs" ADD CONSTRAINT "workforce_scenario_outputs_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_scenarios" ADD CONSTRAINT "workforce_scenarios_assessment_id_workforce_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."workforce_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_scenarios" ADD CONSTRAINT "workforce_scenarios_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_scenarios" ADD CONSTRAINT "workforce_scenarios_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_supply_entries" ADD CONSTRAINT "workforce_supply_entries_assessment_id_workforce_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."workforce_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_supply_entries" ADD CONSTRAINT "workforce_supply_entries_role_id_workforce_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."workforce_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_supply_entries" ADD CONSTRAINT "workforce_supply_entries_company_location_id_company_locations_id_fk" FOREIGN KEY ("company_location_id") REFERENCES "public"."company_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_supply_entries" ADD CONSTRAINT "workforce_supply_entries_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apprenticeships_organization_id_idx" ON "apprenticeships" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "apprenticeships_company_id_idx" ON "apprenticeships" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "apprenticeships_partner_id_idx" ON "apprenticeships" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "apprenticeships_occupation_id_idx" ON "apprenticeships" USING btree ("occupation_id");--> statement-breakpoint
CREATE INDEX "career_path_edges_path_id_idx" ON "career_path_edges" USING btree ("path_id");--> statement-breakpoint
CREATE INDEX "career_path_edges_from_level_id_idx" ON "career_path_edges" USING btree ("from_level_id");--> statement-breakpoint
CREATE INDEX "career_path_edges_to_level_id_idx" ON "career_path_edges" USING btree ("to_level_id");--> statement-breakpoint
CREATE INDEX "career_path_level_skills_level_id_idx" ON "career_path_level_skills" USING btree ("level_id");--> statement-breakpoint
CREATE INDEX "career_path_level_skills_skill_id_idx" ON "career_path_level_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "career_path_levels_path_id_idx" ON "career_path_levels" USING btree ("path_id");--> statement-breakpoint
CREATE INDEX "career_path_levels_civilian_occupation_id_idx" ON "career_path_levels" USING btree ("civilian_occupation_id");--> statement-breakpoint
CREATE INDEX "career_paths_organization_id_idx" ON "career_paths" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "career_paths_company_id_idx" ON "career_paths" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "education_partner_clients_partner_id_idx" ON "education_partner_clients" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "education_partner_clients_company_id_idx" ON "education_partner_clients" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "education_partner_contacts_partner_id_idx" ON "education_partner_contacts" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "education_partner_contacts_contact_id_idx" ON "education_partner_contacts" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "education_partner_locations_partner_id_idx" ON "education_partner_locations" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "education_partners_organization_id_idx" ON "education_partners" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "education_partners_company_id_idx" ON "education_partners" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "labor_market_observations_organization_id_idx" ON "labor_market_observations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "labor_market_source_metadata_organization_id_idx" ON "labor_market_source_metadata" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "skills_gap_analyses_assessment_id_idx" ON "skills_gap_analyses" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "skills_gap_analyses_role_id_idx" ON "skills_gap_analyses" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "skills_gap_analyses_candidate_id_idx" ON "skills_gap_analyses" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "skills_gap_analyses_reviewer_user_id_idx" ON "skills_gap_analyses" USING btree ("reviewer_user_id");--> statement-breakpoint
CREATE INDEX "skills_gap_items_analysis_id_idx" ON "skills_gap_items" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "skills_gap_items_skill_id_idx" ON "skills_gap_items" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "talent_pipeline_allocations_pipeline_id_idx" ON "talent_pipeline_allocations" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "talent_pipeline_allocations_gap_id_idx" ON "talent_pipeline_allocations" USING btree ("gap_id");--> statement-breakpoint
CREATE INDEX "talent_pipelines_organization_id_idx" ON "talent_pipelines" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "talent_pipelines_company_id_idx" ON "talent_pipelines" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "talent_pipelines_assessment_id_idx" ON "talent_pipelines" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "talent_pipelines_gap_id_idx" ON "talent_pipelines" USING btree ("gap_id");--> statement-breakpoint
CREATE INDEX "talent_pipelines_role_id_idx" ON "talent_pipelines" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "talent_pipelines_company_location_id_idx" ON "talent_pipelines" USING btree ("company_location_id");--> statement-breakpoint
CREATE INDEX "talent_pipelines_owner_user_id_idx" ON "talent_pipelines" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "talent_pipelines_partner_id_idx" ON "talent_pipelines" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "talent_scarcity_indicators_role_id_idx" ON "talent_scarcity_indicators" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "talent_scarcity_indicators_company_location_id_idx" ON "talent_scarcity_indicators" USING btree ("company_location_id");--> statement-breakpoint
CREATE INDEX "talent_scarcity_indicators_reviewer_user_id_idx" ON "talent_scarcity_indicators" USING btree ("reviewer_user_id");--> statement-breakpoint
CREATE INDEX "training_program_occupations_program_id_idx" ON "training_program_occupations" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "training_program_occupations_occupation_id_idx" ON "training_program_occupations" USING btree ("occupation_id");--> statement-breakpoint
CREATE INDEX "training_program_skills_program_id_idx" ON "training_program_skills" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "training_program_skills_skill_id_idx" ON "training_program_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "training_programs_organization_id_idx" ON "training_programs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "training_programs_partner_id_idx" ON "training_programs" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "workforce_assessment_assumptions_assessment_id_idx" ON "workforce_assessment_assumptions" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "workforce_assessment_assumptions_created_by_user_id_idx" ON "workforce_assessment_assumptions" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "workforce_assessment_data_sources_assessment_id_idx" ON "workforce_assessment_data_sources" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "workforce_assessment_locations_assessment_id_idx" ON "workforce_assessment_locations" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "workforce_assessment_locations_company_location_id_idx" ON "workforce_assessment_locations" USING btree ("company_location_id");--> statement-breakpoint
CREATE INDEX "workforce_assessments_organization_id_idx" ON "workforce_assessments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workforce_assessments_company_id_idx" ON "workforce_assessments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "workforce_assessments_opportunity_id_idx" ON "workforce_assessments" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "workforce_assessments_solution_plan_id_idx" ON "workforce_assessments" USING btree ("solution_plan_id");--> statement-breakpoint
CREATE INDEX "workforce_assessments_service_id_idx" ON "workforce_assessments" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "workforce_assessments_project_id_idx" ON "workforce_assessments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "workforce_assessments_created_by_user_id_idx" ON "workforce_assessments" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "workforce_assessments_approved_by_user_id_idx" ON "workforce_assessments" USING btree ("approved_by_user_id");--> statement-breakpoint
CREATE INDEX "workforce_assessments_supersedes_assessment_id_idx" ON "workforce_assessments" USING btree ("supersedes_assessment_id");--> statement-breakpoint
CREATE INDEX "workforce_baselines_assessment_id_idx" ON "workforce_baselines" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "workforce_baselines_role_id_idx" ON "workforce_baselines" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "workforce_baselines_company_location_id_idx" ON "workforce_baselines" USING btree ("company_location_id");--> statement-breakpoint
CREATE INDEX "workforce_baselines_import_id_idx" ON "workforce_baselines" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "workforce_baselines_reviewer_user_id_idx" ON "workforce_baselines" USING btree ("reviewer_user_id");--> statement-breakpoint
CREATE INDEX "workforce_forecast_components_forecast_id_idx" ON "workforce_forecast_components" USING btree ("forecast_id");--> statement-breakpoint
CREATE INDEX "workforce_forecast_overrides_forecast_id_idx" ON "workforce_forecast_overrides" USING btree ("forecast_id");--> statement-breakpoint
CREATE INDEX "workforce_forecast_overrides_actor_user_id_idx" ON "workforce_forecast_overrides" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "workforce_forecast_results_forecast_id_idx" ON "workforce_forecast_results" USING btree ("forecast_id");--> statement-breakpoint
CREATE INDEX "workforce_forecast_results_role_id_idx" ON "workforce_forecast_results" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "workforce_forecast_results_company_location_id_idx" ON "workforce_forecast_results" USING btree ("company_location_id");--> statement-breakpoint
CREATE INDEX "workforce_forecast_results_reviewer_user_id_idx" ON "workforce_forecast_results" USING btree ("reviewer_user_id");--> statement-breakpoint
CREATE INDEX "workforce_forecasts_assessment_id_idx" ON "workforce_forecasts" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "workforce_forecasts_created_by_user_id_idx" ON "workforce_forecasts" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "workforce_forecasts_reviewed_by_user_id_idx" ON "workforce_forecasts" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE INDEX "workforce_forecasts_reviewer_user_id_idx" ON "workforce_forecasts" USING btree ("reviewer_user_id");--> statement-breakpoint
CREATE INDEX "workforce_gap_thresholds_organization_id_idx" ON "workforce_gap_thresholds" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workforce_gaps_assessment_id_idx" ON "workforce_gaps" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "workforce_gaps_forecast_result_id_idx" ON "workforce_gaps" USING btree ("forecast_result_id");--> statement-breakpoint
CREATE INDEX "workforce_gaps_role_id_idx" ON "workforce_gaps" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "workforce_gaps_company_location_id_idx" ON "workforce_gaps" USING btree ("company_location_id");--> statement-breakpoint
CREATE INDEX "workforce_gaps_reviewer_user_id_idx" ON "workforce_gaps" USING btree ("reviewer_user_id");--> statement-breakpoint
CREATE INDEX "workforce_geographies_organization_id_idx" ON "workforce_geographies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workforce_geographies_reference_id_idx" ON "workforce_geographies" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "workforce_imports_assessment_id_idx" ON "workforce_imports" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "workforce_imports_created_by_user_id_idx" ON "workforce_imports" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "workforce_kpis_assessment_id_idx" ON "workforce_kpis" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "workforce_pipeline_plans_assessment_id_idx" ON "workforce_pipeline_plans" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "workforce_pipeline_plans_project_deliverable_id_idx" ON "workforce_pipeline_plans" USING btree ("project_deliverable_id");--> statement-breakpoint
CREATE INDEX "workforce_pipeline_plans_approval_id_idx" ON "workforce_pipeline_plans" USING btree ("approval_id");--> statement-breakpoint
CREATE INDEX "workforce_pipeline_plans_approved_by_user_id_idx" ON "workforce_pipeline_plans" USING btree ("approved_by_user_id");--> statement-breakpoint
CREATE INDEX "workforce_pipeline_plans_reviewer_user_id_idx" ON "workforce_pipeline_plans" USING btree ("reviewer_user_id");--> statement-breakpoint
CREATE INDEX "workforce_recommendations_assessment_id_idx" ON "workforce_recommendations" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "workforce_recommendations_generated_by_agent_id_idx" ON "workforce_recommendations" USING btree ("generated_by_agent_id");--> statement-breakpoint
CREATE INDEX "workforce_recommendations_generated_by_user_id_idx" ON "workforce_recommendations" USING btree ("generated_by_user_id");--> statement-breakpoint
CREATE INDEX "workforce_recommendations_approval_id_idx" ON "workforce_recommendations" USING btree ("approval_id");--> statement-breakpoint
CREATE INDEX "workforce_recommendations_approved_by_user_id_idx" ON "workforce_recommendations" USING btree ("approved_by_user_id");--> statement-breakpoint
CREATE INDEX "workforce_recommendations_reviewer_user_id_idx" ON "workforce_recommendations" USING btree ("reviewer_user_id");--> statement-breakpoint
CREATE INDEX "workforce_risks_assessment_id_idx" ON "workforce_risks" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "workforce_risks_role_id_idx" ON "workforce_risks" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "workforce_risks_owner_user_id_idx" ON "workforce_risks" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "workforce_roadmap_items_assessment_id_idx" ON "workforce_roadmap_items" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "workforce_roadmap_items_recommendation_id_idx" ON "workforce_roadmap_items" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "workforce_roadmap_items_owner_user_id_idx" ON "workforce_roadmap_items" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "workforce_roadmap_items_project_task_id_idx" ON "workforce_roadmap_items" USING btree ("project_task_id");--> statement-breakpoint
CREATE INDEX "workforce_role_skills_role_id_idx" ON "workforce_role_skills" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "workforce_role_skills_skill_id_idx" ON "workforce_role_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "workforce_roles_organization_id_idx" ON "workforce_roles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workforce_roles_company_id_idx" ON "workforce_roles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "workforce_roles_assessment_id_idx" ON "workforce_roles" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "workforce_roles_civilian_occupation_id_idx" ON "workforce_roles" USING btree ("civilian_occupation_id");--> statement-breakpoint
CREATE INDEX "workforce_roles_company_location_id_idx" ON "workforce_roles" USING btree ("company_location_id");--> statement-breakpoint
CREATE INDEX "workforce_scenario_inputs_scenario_id_idx" ON "workforce_scenario_inputs" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX "workforce_scenario_outputs_scenario_id_idx" ON "workforce_scenario_outputs" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX "workforce_scenario_outputs_role_id_idx" ON "workforce_scenario_outputs" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "workforce_scenario_outputs_reviewer_user_id_idx" ON "workforce_scenario_outputs" USING btree ("reviewer_user_id");--> statement-breakpoint
CREATE INDEX "workforce_scenarios_assessment_id_idx" ON "workforce_scenarios" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "workforce_scenarios_created_by_user_id_idx" ON "workforce_scenarios" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "workforce_scenarios_reviewer_user_id_idx" ON "workforce_scenarios" USING btree ("reviewer_user_id");--> statement-breakpoint
CREATE INDEX "workforce_supply_entries_assessment_id_idx" ON "workforce_supply_entries" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "workforce_supply_entries_role_id_idx" ON "workforce_supply_entries" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "workforce_supply_entries_company_location_id_idx" ON "workforce_supply_entries" USING btree ("company_location_id");--> statement-breakpoint
CREATE INDEX "workforce_supply_entries_reviewer_user_id_idx" ON "workforce_supply_entries" USING btree ("reviewer_user_id");