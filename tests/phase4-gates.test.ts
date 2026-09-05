import { describe, expect, it } from "vitest";

import {
  APPROVED_EXPANSION_MAP,
  expansionCodesFromVersion,
} from "../lib/delivery/expansion";
import {
  assertApprovedVersionImmutable,
  assertCanDeliverClientFacing,
  assertCanSendProposal,
  assertCloseoutAllowed,
  assertProjectCreationAllowed,
  DeliveryError,
  projectHealthFromRisks,
} from "../lib/delivery/gates";
import { legalPackageForService } from "../lib/delivery/legal-packages";
import { pricingOutsideRange } from "../lib/delivery/pricing";
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

describe("Phase 4 gates", () => {
  it("never overwrites an approved service version", () => {
    expect(() => assertApprovedVersionImmutable("approved")).toThrow(DeliveryError);
    expect(() => assertApprovedVersionImmutable("draft")).not.toThrow();
  });

  it("blocks sending an unapproved proposal", () => {
    expect(() => assertCanSendProposal("draft")).toThrow(/approved/);
    expect(() => assertCanSendProposal("approved")).not.toThrow();
  });

  it("blocks client-facing delivery without approval", () => {
    expect(() =>
      assertCanDeliverClientFacing({ clientFacing: true, status: "in_progress" }),
    ).toThrow(/approval/);
    expect(() =>
      assertCanDeliverClientFacing({ clientFacing: true, status: "approved", approvedAt: new Date() }),
    ).not.toThrow();
  });

  it("requires pricing approval outside range", () => {
    expect(pricingOutsideRange({ price: "100000", minPrice: "25000", maxPrice: "75000" })).toBe(true);
    expect(pricingOutsideRange({ price: "30000", minPrice: "25000", maxPrice: "75000" })).toBe(false);
  });

  it("blocks project creation without executed contract unless Managing Partner override", () => {
    expect(() =>
      assertProjectCreationAllowed({ planStatus: "approved", contractStatus: "draft" }),
    ).toThrow(/executed contract/);
    expect(() =>
      assertProjectCreationAllowed({
        planStatus: "approved",
        contractStatus: "draft",
        overrideReason: "start now",
        roleSlugs: ["managing-partner"],
      }),
    ).not.toThrow();
    expect(() =>
      assertProjectCreationAllowed({ planStatus: "approved", contractStatus: "executed" }),
    ).not.toThrow();
  });

  it("blocks closeout when required deliverables are incomplete", () => {
    expect(() =>
      assertCloseoutAllowed({ requiredDeliverablesIncomplete: true, approvalsIncomplete: false }),
    ).toThrow(/closeout/);
  });

  it("selects Professional Search legal package from service rules", () => {
    const spec = legalPackageForService(undefined, "professional-search");
    expect(spec.required).toContain("direct_hire_search_agreement");
  });

  it("surfaces expansion codes from the approved map", () => {
    expect(expansionCodesFromVersion(null, "professional-search")).toEqual(
      APPROVED_EXPANSION_MAP["professional-search"],
    );
  });

  it("marks health at risk when material high-severity risks are open", () => {
    expect(projectHealthFromRisks([{ severity: "high", status: "open" }])).toBe("at_risk");
    expect(projectHealthFromRisks([{ severity: "low", status: "open" }])).toBe("healthy");
  });

  it("enforces Phase 4 RBAC on write versus read", () => {
    const reader = principalFor("read-only");
    const partner = principalFor("managing-partner");
    expect(can(reader, "proposals.read")).toBe(true);
    expect(can(reader, "proposals.approve")).toBe(false);
    expect(can(reader, "pricing.approve")).toBe(false);
    expect(can(partner, "contracts.approve")).toBe(true);
    expect(can(principalFor("recruiter"), "projects.write")).toBe(false);
  });
});
