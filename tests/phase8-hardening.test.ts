import { afterEach, describe, expect, it, vi } from "vitest";

import { ROLE_PERMISSIONS, can, type Principal } from "../lib/rbac/permissions";
import { assertOrganizationScope } from "../lib/security/record-scope";
import { AuthorizationError } from "../lib/rbac/permissions";
import { consumeMemoryBucket, resetMemoryRateLimits } from "../lib/security/rate-limit";
import { assertDevSeedAllowed, SeedGuardError } from "../lib/seed/guards";
import { resetServerEnvCache } from "../lib/env";
import { redactLogValue } from "../lib/observability/monitor";
import { reportToCsv } from "../lib/reporting/export";
import { parseReportFilters } from "../lib/reporting/filters";

function principalFor(role: keyof typeof ROLE_PERMISSIONS): Principal {
  return {
    id: "user-1",
    status: "active",
    organizationId: "org-1",
    roleSlugs: [role],
    permissions: new Set(ROLE_PERMISSIONS[role]),
  };
}

afterEach(() => {
  resetMemoryRateLimits();
  vi.unstubAllEnvs();
  resetServerEnvCache();
});

describe("Phase 8 security hardening", () => {
  it("blocks privilege escalation for PII export and privacy deletion", () => {
    const recruiter = principalFor("recruiter");
    const reader = principalFor("read-only");
    const partner = principalFor("managing-partner");
    expect(can(recruiter, "reports.read")).toBe(true);
    expect(can(recruiter, "reports.export_pii")).toBe(false);
    expect(can(recruiter, "privacy.delete")).toBe(false);
    expect(can(recruiter, "admin.roles")).toBe(false);
    expect(can(reader, "reports.export")).toBe(false);
    expect(can(reader, "reports.export_pii")).toBe(false);
    expect(can(partner, "reports.export_pii")).toBe(true);
    expect(can(partner, "privacy.delete")).toBe(true);
  });

  it("treats cross-organization access as not found", () => {
    expect(() => assertOrganizationScope("org-a", "org-b")).toThrow(AuthorizationError);
    expect(() => assertOrganizationScope("org-a", "org-a")).not.toThrow();
  });

  it("enforces in-memory rate limits without blocking the first requests", () => {
    const first = consumeMemoryBucket({ key: "test:export", limit: 3, windowSeconds: 60 });
    expect(first.allowed).toBe(true);
    consumeMemoryBucket({ key: "test:export", limit: 3, windowSeconds: 60 });
    consumeMemoryBucket({ key: "test:export", limit: 3, windowSeconds: 60 });
    const blocked = consumeMemoryBucket({ key: "test:export", limit: 3, windowSeconds: 60 });
    expect(blocked.allowed).toBe(false);
  });

  it("refuses development fixtures when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEV_SEED", "");
    resetServerEnvCache();
    expect(() => assertDevSeedAllowed()).toThrow(SeedGuardError);
  });

  it("redacts secrets and contact fields from observability payloads", () => {
    const redacted = redactLogValue({
      token: "secret-token",
      email: "taylor@example.test",
      jobTitle: "Electrician",
    }) as Record<string, unknown>;
    expect(redacted.token).toBe("[redacted]");
    expect(redacted.email).toBe("[redacted]");
    expect(redacted.jobTitle).toBe("Electrician");
  });

  it("parses report filters and emits CSV without inventing rows", () => {
    const filters = parseReportFilters({ from: "2026-01-01", companyId: "abc" });
    expect(filters.companyId).toBe("abc");
    expect(filters.from?.toISOString().startsWith("2026-01-01")).toBe(true);
    expect(reportToCsv(["Name"], [{ cells: ["Harbor, Inc"] }])).toContain("\"Harbor, Inc\"");
  });
});
