CREATE TYPE "public"."gtm_region" AS ENUM('southeast', 'national');--> statement-breakpoint
CREATE TYPE "public"."gtm_tier" AS ENUM('tier_1', 'tier_2');--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "gtm_tier" "gtm_tier";--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "gtm_region" "gtm_region";--> statement-breakpoint
CREATE INDEX "companies_gtm_tier_idx" ON "companies" USING btree ("organization_id","gtm_tier");--> statement-breakpoint
CREATE INDEX "companies_gtm_region_idx" ON "companies" USING btree ("organization_id","gtm_region");