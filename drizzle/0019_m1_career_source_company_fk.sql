-- M1 tenant integrity. Unique targets are created before the composite foreign keys
-- that reference them. 0018 stays unchanged because it is already applied on development.
ALTER TABLE "companies" ADD CONSTRAINT "companies_id_organization_uq" UNIQUE("id","organization_id");--> statement-breakpoint
ALTER TABLE "career_sources" ADD CONSTRAINT "career_sources_id_organization_company_uq" UNIQUE("id","organization_id","company_id");--> statement-breakpoint
ALTER TABLE "career_sources" ADD CONSTRAINT "career_sources_company_organization_fk" FOREIGN KEY ("company_id","organization_id") REFERENCES "public"."companies"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_sourced_job_has_company" CHECK ("jobs"."career_source_id" is null or "jobs"."company_id" is not null);--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_career_source_company_fk" FOREIGN KEY ("career_source_id","organization_id","company_id") REFERENCES "public"."career_sources"("id","organization_id","company_id") ON DELETE restrict ON UPDATE no action;
