import { describe, expect, it } from "vitest";

import { applyScenarioDeltas, computeDemandForecast, defaultForecastComponents } from "../lib/workforce/forecast";
import { classifyGapSeverity, computeGap, pipelineCoverage } from "../lib/workforce/gaps";
import { excelImportNotConfigured, parseCsv } from "../lib/workforce/import";
import { presentLaborMarketValue } from "../lib/integrations/labor-market";
import { ROLE_PERMISSIONS, can, type Principal } from "../lib/rbac/permissions";

function principalFor(role: keyof typeof ROLE_PERMISSIONS): Principal {
  return {
    id: "user-1",
    status: "active",
    organizationId: "org-1",
    roleSlugs: [role],
    permissions: new Set(ROLE_PERMISSIONS[role]),
  };
}

describe("Phase 5 workforce intelligence", () => {
  it("computes configurable demand rather than a single hardcoded formula", () => {
    const components = defaultForecastComponents({
      attritionRatePercent: 12,
      retirementRatePercent: 6,
      growthRatePercent: 10,
      backlog: 5,
      internalMobilityRatePercent: 4,
    });
    const included = computeDemandForecast({
      currentHeadcount: 100,
      vacancies: 5,
      horizonMonths: 12,
      components,
    });
    const withoutGrowth = computeDemandForecast({
      currentHeadcount: 100,
      vacancies: 5,
      horizonMonths: 12,
      components: components.map((component) =>
        component.code === "growth" ? { ...component, included: false } : component,
      ),
    });
    expect(included.futureDemand).toBeGreaterThan(withoutGrowth.futureDemand);
    expect(included.calculationMethod).toMatch(/Estimate/i);
  });

  it("classifies gap severity from stored thresholds", () => {
    expect(classifyGapSeverity(30, 80)).toBe("critical");
    expect(classifyGapSeverity(2, 80)).toBe("low");
    expect(computeGap(50, 20)).toBe(30);
  });

  it("warns when planned pipeline capacity is below the gap", () => {
    const coverage = pipelineCoverage(100, [
      { sourceType: "military", plannedCount: 25 },
      { sourceType: "apprenticeship", plannedCount: 20 },
    ]);
    expect(coverage.coversGap).toBe(false);
    expect(coverage.warning).toMatch(/does not cover/);
  });

  it("applies scenario deltas without presenting certainty", () => {
    const base = defaultForecastComponents({ growthRatePercent: 3 });
    const high = applyScenarioDeltas(base, { growthDeltaPercent: 8 });
    const growth = high.find((component) => component.code === "growth");
    expect(growth?.ratePercent).toBe(11);
  });

  it("parses CSV and refuses unconfigured Excel", () => {
    const rows = parseCsv("role title,headcount\nElectrical Technician,42");
    expect(rows[0].headcount).toBe("42");
    expect(excelImportNotConfigured()).toMatch(/Excel parsing is not configured/);
  });

  it("never presents unconfigured labor-market fixtures as live intelligence", () => {
    const presented = presentLaborMarketValue({
      provider: "bls",
      metric: "employment_count",
      value: 12,
      asOfDate: null,
      sourceVersion: null,
      isFixture: true,
      label: "fixture",
      notes: "fixture",
    });
    expect(presented.isFixture).toBe(true);
    expect(presented.display).not.toBe("12");
  });

  it("grants workforce consultant analyze/approve and denies recruiter writes", () => {
    const consultant = principalFor("workforce-consultant");
    const recruiter = principalFor("recruiter");
    const reader = principalFor("read-only");
    expect(can(consultant, "workforce.approve")).toBe(true);
    expect(can(consultant, "forecasts.write")).toBe(true);
    expect(can(recruiter, "workforce.read")).toBe(true);
    expect(can(recruiter, "workforce.write")).toBe(false);
    expect(can(reader, "workforce.read")).toBe(true);
    expect(can(reader, "workforce.write")).toBe(false);
    expect(can(reader, "candidate_pii.read")).toBe(false);
  });
});
