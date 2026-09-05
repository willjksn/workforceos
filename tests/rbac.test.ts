import { describe, expect, it } from "vitest";

import {
  AuthorizationError,
  ROLE_PERMISSIONS,
  can,
  isPlatformAdmin,
  requirePermission,
  type Principal,
} from "../lib/rbac/permissions";
import { assertAccountAccessChange, assertRoleAssignmentAllowed, assignableRoleSlugs } from "../lib/rbac/assign-role";

function principalFor(role: keyof typeof ROLE_PERMISSIONS, status: Principal["status"] = "active"): Principal {
  return {
    id: "user-1",
    status,
    organizationId: "org-1",
    roleSlugs: [role],
    permissions: new Set(ROLE_PERMISSIONS[role]),
  };
}

describe("RBAC", () => {
  it("prevents Read Only from mutating", () => {
    const reader = principalFor("read-only");
    expect(can(reader, "companies.read")).toBe(true);
    expect(can(reader, "companies.write")).toBe(false);
    expect(can(reader, "reports.read")).toBe(true);
    expect(can(reader, "reports.export")).toBe(false);
    expect(can(reader, "reports.export_pii")).toBe(false);
    expect(can(reader, "candidates.write")).toBe(false);
    expect(can(reader, "candidate_pii.read")).toBe(false);
    expect(() => requirePermission(reader, "jobs.write")).toThrow(AuthorizationError);
  });

  it("prevents Recruiter from accessing administrative role configuration", () => {
    const recruiter = principalFor("recruiter");
    expect(can(recruiter, "jobs.write")).toBe(true);
    expect(can(recruiter, "admin.roles")).toBe(false);
    expect(can(recruiter, "admin.users")).toBe(false);
    expect(() => requirePermission(recruiter, "admin.roles")).toThrow(AuthorizationError);
  });

  it("treats Managing Partner and Administrator roles as platform admins", () => {
    expect(isPlatformAdmin(principalFor("managing-partner"))).toBe(true);
    expect(isPlatformAdmin(principalFor("operations-administrator"))).toBe(true);
    expect(isPlatformAdmin(principalFor("strategy-technology-administrator"))).toBe(true);
    expect(isPlatformAdmin(principalFor("recruiter"))).toBe(false);
    expect(isPlatformAdmin(principalFor("talent-partner"))).toBe(false);
  });

  it("rejects disabled users even if they still have roles", () => {
    const disabled = principalFor("managing-partner", "disabled");
    expect(can(disabled, "companies.read")).toBe(false);
  });

  it("lets Strategy & Technology Administrator assign roles except Managing Partner", () => {
    const tech = principalFor("strategy-technology-administrator");
    expect(assignableRoleSlugs(tech)).toContain("recruiter");
    expect(assignableRoleSlugs(tech)).toContain("operations-administrator");
    expect(assignableRoleSlugs(tech)).not.toContain("managing-partner");
    expect(() =>
      assertRoleAssignmentAllowed({
        actor: tech,
        nextSlug: "managing-partner",
        currentSlugs: ["recruiter"],
        managingPartnerCount: 1,
      }),
    ).toThrow(AuthorizationError);
  });

  it("prevents removing the last Managing Partner", () => {
    const partner = principalFor("managing-partner");
    expect(() =>
      assertRoleAssignmentAllowed({
        actor: partner,
        nextSlug: "recruiter",
        currentSlugs: ["managing-partner"],
        managingPartnerCount: 1,
      }),
    ).toThrow(/at least one Managing Partner/);
    expect(() =>
      assertRoleAssignmentAllowed({
        actor: partner,
        nextSlug: "recruiter",
        currentSlugs: ["managing-partner"],
        managingPartnerCount: 2,
      }),
    ).not.toThrow();
  });

  it("does not let Operations Administrator assign roles", () => {
    const ops = principalFor("operations-administrator");
    expect(assignableRoleSlugs(ops)).toEqual([]);
    expect(() =>
      assertRoleAssignmentAllowed({
        actor: ops,
        nextSlug: "recruiter",
        currentSlugs: [],
        managingPartnerCount: 1,
      }),
    ).toThrow(AuthorizationError);
  });

  it("prevents a person from disabling themselves or the last Managing Partner", () => {
    const partner = principalFor("managing-partner");
    expect(() =>
      assertAccountAccessChange({
        actor: partner,
        targetUserId: partner.id,
        targetRoleSlugs: ["managing-partner"],
        action: "disable",
        activeManagingPartnerCount: 2,
      }),
    ).toThrow(/your own access/);
    expect(() =>
      assertAccountAccessChange({
        actor: partner,
        targetUserId: "someone-else",
        targetRoleSlugs: ["managing-partner"],
        action: "archive",
        activeManagingPartnerCount: 1,
      }),
    ).toThrow(/at least one active Managing Partner/);
  });
});
