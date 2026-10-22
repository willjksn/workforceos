import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  careerSourceTypeEnum,
  jobContextTypeEnum,
  jobDemandHorizonEnum,
} from "../db/schema/enums";
import { careerSources, jobDescriptionVersions, jobs } from "../db/schema";
import { ROLE_PERMISSIONS, can } from "../lib/rbac/permissions";
import { createEmployerDemandJob } from "../lib/recruiting/employer-demand";

const root = path.resolve(import.meta.dirname, "..");

describe("M1 employer demand model", () => {
  it("keeps existing job contexts and adds only monitored public and exploratory", () => {
    expect(jobContextTypeEnum.enumValues).toEqual([
      "internal",
      "client",
      "skillbridge",
      "monitored_public",
      "exploratory",
    ]);
  });

  it("stores evergreen and future demand as a horizon, not more context types", () => {
    expect(jobDemandHorizonEnum.enumValues).toEqual(["current", "evergreen", "future"]);
    expect(jobContextTypeEnum.enumValues).not.toContain("evergreen");
    expect(jobContextTypeEnum.enumValues).not.toContain("future");
    expect(jobContextTypeEnum.enumValues).not.toContain("direct_hire");
  });

  it("limits career sources to categories and does not store vendor credentials", () => {
    expect(careerSourceTypeEnum.enumValues).toEqual([
      "public_careers_page",
      "feed",
      "employer_api",
      "manual_url",
      "csv",
    ]);
    const columns = getTableConfig(careerSources).columns.map((column) => column.name);
    expect(columns).toEqual(
      expect.arrayContaining([
        "organization_id",
        "company_id",
        "source_type",
        "name",
        "base_url",
        "careers_url",
        "active",
        "last_successful_sync_at",
        "last_attempt_at",
        "last_error",
      ]),
    );
    expect(columns.some((name) => /secret|token|password|credential|api_key/i.test(name))).toBe(false);
  });

  it("deduplicates external jobs on career source plus external key", () => {
    const unique = getTableConfig(jobs).uniqueConstraints.find(
      (constraint) => constraint.name === "jobs_career_source_external_key_uq",
    );
    expect(unique?.columns.map((column) => column.name)).toEqual(["career_source_id", "external_key"]);
  });

  it("keeps job description history on the existing version table", () => {
    const config = getTableConfig(jobDescriptionVersions);
    expect(config.name).toBe("job_description_versions");
    const unique = config.uniqueConstraints.find(
      (constraint) => constraint.name === "job_description_versions_job_version_uq",
    );
    expect(unique?.columns.map((column) => column.name)).toEqual(["job_id", "version"]);
  });

  it("lets a recruiter read and write jobs without CRM opportunity access", () => {
    const recruiter = {
      id: "recruiter",
      status: "active" as const,
      organizationId: "org",
      roleSlugs: ["recruiter"],
      permissions: new Set(ROLE_PERMISSIONS.recruiter),
    };
    expect(can(recruiter, "jobs.read")).toBe(true);
    expect(can(recruiter, "jobs.write")).toBe(true);
    expect(can(recruiter, "opportunities.read")).toBe(false);
    expect(can(recruiter, "opportunities.write")).toBe(false);
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("opportunities.read");
  });

  it("rejects a monitored public job that has no career source before touching the database", async () => {
    await expect(
      createEmployerDemandJob({
        organizationId: "00000000-0000-4000-8000-000000000099",
        actorUserId: "00000000-0000-4000-8000-000000000098",
        title: "Technician",
        jobContextType: "monitored_public",
        companyId: "00000000-0000-4000-8000-000000000097",
      }),
    ).rejects.toThrow(/career source/i);
  });

  it("adds the demand columns without dropping existing military or CRM tables", () => {
    const migration = readdirSync(path.join(root, "drizzle")).find((file) => {
      if (!file.endsWith(".sql")) return false;
      return readFileSync(path.join(root, "drizzle", file), "utf8").includes('CREATE TABLE "career_sources"');
    });
    expect(migration).toBeTruthy();
    const sql = readFileSync(path.join(root, "drizzle", migration ?? ""), "utf8");
    expect(sql).toContain("ADD VALUE 'monitored_public'");
    expect(sql).toContain("ADD VALUE 'exploratory'");
    expect(sql).toContain('"demand_horizon"');
    expect(sql).toContain("jobs_career_source_organization_fk");
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/skillbridge_profiles/i);
    expect(sql).not.toMatch(/opportunities/i);
    expect(sql).not.toMatch(/credential|api_key|password/i);
  });

  it("keeps a career source company inside the same organization", () => {
    const sql = readFileSync(path.join(root, "drizzle", "0019_m1_career_source_company_fk.sql"), "utf8");
    const uniqueAt = sql.indexOf("companies_id_organization_uq");
    const sourceFkAt = sql.indexOf("career_sources_company_organization_fk");
    const jobFkAt = sql.indexOf("jobs_career_source_company_fk");
    expect(uniqueAt).toBeGreaterThan(-1);
    expect(sourceFkAt).toBeGreaterThan(uniqueAt);
    expect(sql).toContain(
      'FOREIGN KEY ("company_id","organization_id") REFERENCES "public"."companies"("id","organization_id")',
    );
    expect(sql).toContain("jobs_sourced_job_has_company");
    expect(jobFkAt).toBeGreaterThan(sql.indexOf("career_sources_id_organization_company_uq"));
    expect(sql).not.toMatch(/DROP TABLE/i);
  });
});
