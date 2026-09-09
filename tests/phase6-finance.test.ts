import { describe, expect, it } from "vitest";

import { agingBucket, daysPastDue } from "../lib/finance/aging";
import { assertFeeOverrideAllowed } from "../lib/finance/gates";
import { FinanceError } from "../lib/finance/money";
import { calculatePlacementFee } from "../lib/finance/placement-fees";
import { verifyWebhookSignature } from "../lib/integrations/providers";
import { IntegrationError, getLinkedInAdapter, getSeekOutAdapter } from "../lib/integrations/providers";
import { canOpenExternalSourcing } from "../lib/recruiting/external-sourcing";
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

describe("Phase 6 finance gates", () => {
  it("calculates placement fee from salary and percent", () => {
    expect(calculatePlacementFee({ startingSalary: 82000, feePercent: 25 }).fee).toBe(20500);
  });

  it("respects a stored minimum fee", () => {
    const result = calculatePlacementFee({ startingSalary: 70000, feePercent: 25, minimumFee: 20000 });
    expect(result.calculated).toBe(17500);
    expect(result.fee).toBe(20000);
    expect(result.minimumFeeApplied).toBe(true);
  });

  it("refuses to invent fee terms", () => {
    expect(() => calculatePlacementFee({ startingSalary: 82000 })).toThrow(FinanceError);
  });

  it("requires approval for fee overrides", () => {
    expect(() => assertFeeOverrideAllowed({ reason: "discount", approved: false })).toThrow(/approval/);
    expect(() => assertFeeOverrideAllowed({ reason: "discount", approved: true })).not.toThrow();
  });

  it("computes AR aging buckets", () => {
    const asOf = new Date("2026-09-05T00:00:00.000Z");
    expect(agingBucket(new Date("2026-09-10T00:00:00.000Z"), asOf)).toBe("current");
    expect(agingBucket(new Date("2026-08-20T00:00:00.000Z"), asOf)).toBe("1_30");
    expect(agingBucket(new Date("2026-07-20T00:00:00.000Z"), asOf)).toBe("31_60");
    expect(agingBucket(new Date("2026-07-01T00:00:00.000Z"), asOf)).toBe("61_90");
    expect(agingBucket(new Date("2026-04-01T00:00:00.000Z"), asOf)).toBe("90_plus");
    expect(daysPastDue(new Date("2026-08-06T00:00:00.000Z"), asOf)).toBe(30);
  });

  it("blocks unauthorized finance writes", () => {
    const recruiter = principalFor("recruiter");
    expect(can(recruiter, "finance.read")).toBe(false);
    expect(can(recruiter, "invoices.write")).toBe(false);
    expect(can(recruiter, "finance.approve")).toBe(false);
    expect(can(principalFor("read-only"), "finance.read")).toBe(true);
    expect(can(principalFor("read-only"), "finance.write")).toBe(false);
  });
});

describe("Phase 6 integrations", () => {
  it("rejects unsigned webhook signatures", () => {
    expect(
      verifyWebhookSignature({
        provider: "docusign",
        rawBody: "{}",
        signature: null,
        secret: "secret",
      }),
    ).toBe(false);
  });

  it("keeps internal Talent Network first for SeekOut", async () => {
    expect(canOpenExternalSourcing(null)).toBe(false);
    await expect(
      getSeekOutAdapter().lookupCandidates({
        jobId: "job-1",
        internalSearchCompletedAt: null,
        query: "electrician",
      }),
    ).rejects.toThrow(/Internal Talent Network/);
  });

  it("does not scrape LinkedIn", () => {
    expect(() => getLinkedInAdapter().scrape()).toThrow(IntegrationError);
  });
});
