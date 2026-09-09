import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isPublicPath } from "../lib/auth/public-paths";
import { ROLE_PERMISSIONS, can, type Principal } from "../lib/rbac/permissions";
import { MAX_LIST_PAGE_SIZE, parseListPage } from "../lib/pagination";
import { hashPublicAccessToken, publicAccessPath, tokensMatch } from "../lib/public-access/tokens";
import { SCOUT_MAX_RESULTS, SCOUT_PAGE_SIZE } from "../lib/scout/search";
import { parseScoutIntent } from "../lib/scout/parse-intent";
import { isScoutExternalSendEnabled } from "../lib/scout/execute";
import { presentLaborMarketValue, type LaborMarketObservation } from "../lib/integrations/labor-market";
import { DEFAULT_SKILLBRIDGE_ALERT_RULES } from "../lib/skillbridge/rules";
import { serviceEndFields } from "../lib/skillbridge/service-end";
import { nextReportRunAt } from "../lib/reporting/schedules";

const root = path.resolve(__dirname, "..");

function read(relative: string) {
  return readFileSync(path.join(root, relative), "utf8");
}

function principalFor(role: keyof typeof ROLE_PERMISSIONS): Principal {
  return {
    id: "user-1",
    status: "active",
    organizationId: "org-1",
    roleSlugs: [role],
    permissions: new Set(ROLE_PERMISSIONS[role]),
  };
}

describe("Phase L post-launch scale", () => {
  it("caps list pagination at a safe page size", () => {
    expect(parseListPage({ page: "0", pageSize: "999" })).toEqual({
      page: 1,
      pageSize: MAX_LIST_PAGE_SIZE,
      offset: 0,
    });
    expect(parseListPage({ page: "3", pageSize: "25" }).offset).toBe(50);
    expect(MAX_LIST_PAGE_SIZE).toBe(100);
    const jobs = read("lib/repositories/recruiting.ts");
    const talent = read("lib/repositories/talent.ts");
    const apps = read("lib/hiring/service.ts");
    expect(jobs).toMatch(/\.limit\(pageSize\)/);
    expect(jobs).toMatch(/\.offset\(offset\)/);
    expect(talent).toMatch(/\.limit\(pageSize\)/);
    expect(apps).toMatch(/listPageResult/);
  });

  it("does not hydrate full recruiting graphs for Command Center counts", () => {
    const source = read("lib/repositories/recruiting-delivery.ts");
    expect(source).toMatch(/ANALYTICS_EXCEPTION_LIMIT/);
    expect(source).toMatch(/select\(\{ status: jobs.status, value: count\(\) \}\)/);
    expect(source).not.toMatch(/const submissionRows = await listSubmissions/);
    expect(source).not.toMatch(/const interviewRows = await listInterviews/);
    expect(source).not.toMatch(/const offerRows = await listOffers/);
    expect(source).not.toMatch(/const placementRows = await listPlacements/);
    expect(source).not.toMatch(/db\.select\(\)\.from\(jobs\)\.where\(and\(eq\(jobs\.organizationId/);
  });

  it("persists SkillBridge alert-rule codes including 14-day windows", () => {
    expect(DEFAULT_SKILLBRIDGE_ALERT_RULES.map((rule) => rule.code)).toEqual(
      expect.arrayContaining(["window_starting_soon", "window_ending_soon"]),
    );
    expect(read("lib/skillbridge/rules.ts")).toMatch(/updateSkillBridgeAlertRule/);
    expect(read("app/(internal)/app/military/skillbridge/alerts/page.tsx")).toMatch(/skillbridge.manage/);
    expect(read("app/(internal)/app/military/skillbridge/alerts/page.tsx")).toMatch(/military.review/);
  });

  it("rejects self-schedule and hire onboarding without a token", () => {
    expect(isPublicPath("/schedule/abc")).toBe(true);
    expect(isPublicPath("/onboarding/access")).toBe(true);
    expect(isPublicPath("/careers/status/abc")).toBe(true);
    expect(isPublicPath("/app/onboarding")).toBe(false);
    expect(isPublicPath("/app/academy/onboarding")).toBe(false);
    expect(read("lib/hiring/self-schedule.ts")).toMatch(/resolvePublicAccessToken/);
    expect(read("lib/hiring/self-schedule.ts")).toMatch(/interview_self_schedule/);
    expect(read("app/schedule/[token]/page.tsx")).toMatch(/getSelfScheduleContext\(token\)/);
    expect(read("app/onboarding/access/page.tsx")).toMatch(/if \(!token\)/);
    expect(read("app/onboarding/access/page.tsx")).toMatch(/not PierOne staff/);
    expect(read("app/(internal)/app/academy/onboarding/page.tsx")).not.toMatch(/hire_onboarding/);
  });

  it("keeps Recruiter off opportunities.read", () => {
    const recruiter = principalFor("recruiter");
    expect(can(recruiter, "opportunities.read")).toBe(false);
    expect(can(recruiter, "interviews.schedule")).toBe(true);
    expect(can(recruiter, "reports.export_pii")).toBe(false);
  });

  it("pages Scout results with a hard max", () => {
    expect(SCOUT_PAGE_SIZE).toBe(25);
    expect(SCOUT_MAX_RESULTS).toBe(100);
    const parsed = parseScoutIntent("search candidates page 3");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.dto.filters?.offset).toBe(50);
    }
    expect(isScoutExternalSendEnabled()).toBe(false);
  });

  it("stores ETS / EAOS labels without duplicating candidates", () => {
    const fields = serviceEndFields({
      endOfServiceDate: new Date("2027-06-01"),
      etsDate: new Date("2027-06-01"),
      eaosDate: null,
    });
    expect(fields.map((field) => field.label).join(" ")).toMatch(/ETS \(Army \/ USMC\)/);
    expect(fields.map((field) => field.label).join(" ")).toMatch(/EAOS \(Navy\)/);
    expect(read("db/schema/skillbridge/index.ts")).toMatch(/etsDate/);
    expect(read("db/schema/skillbridge/index.ts")).toMatch(/eaosDate/);
  });

  it("labels BLS/Census fixtures and never fakes live", () => {
    const fixture: LaborMarketObservation = {
      provider: "bls",
      metric: "unemployment",
      value: null,
      asOfDate: null,
      sourceVersion: null,
      isFixture: true,
      label: "not_configured",
      notes: "unset",
    };
    expect(presentLaborMarketValue(fixture).isFixture).toBe(true);
    expect(read("lib/integrations/labor-market.ts")).toMatch(/BLS_API_KEY is unset/);
    expect(read("lib/integrations/labor-market.ts")).toMatch(/labeled fixture/);
    expect(read("lib/integrations/providers.ts")).toMatch(/isBlsConfigured/);
  });

  it("hashes public tokens and keeps scheduled reports non-PII", () => {
    const token = "test-token";
    const hash = hashPublicAccessToken(token);
    expect(tokensMatch(token, hash)).toBe(true);
    expect(tokensMatch("other", hash)).toBe(false);
    expect(publicAccessPath("hire_onboarding", token)).toContain("/onboarding/access");
    expect(nextReportRunAt("weekly").getTime()).toBeGreaterThan(Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(read("lib/reporting/schedules.ts")).toMatch(/Scheduled talent PII exports are not allowed/);
    expect(read("lib/inngest/functions/reports.ts")).toMatch(/workforceos-scheduled-report-exports/);
  });

  it("adds the Phase L migration and keeps staff vs hire onboarding distinct", () => {
    expect(existsSync(path.join(root, "drizzle/0017_quiet_scale.sql"))).toBe(true);
    const sql = read("drizzle/0017_quiet_scale.sql");
    expect(sql).toMatch(/public_access_tokens/);
    expect(sql).toMatch(/report_export_schedules/);
    expect(sql).toMatch(/ets_date/);
    expect(sql).toMatch(/ON DELETE restrict/);
    expect(read("app/onboarding/access/page.tsx")).toMatch(/not PierOne staff training at \/app\/academy\/onboarding/);
    expect(read("app/(internal)/app/academy/onboarding/page.tsx")).toMatch(/staff|Day 1|Week 4/i);
  });
});
