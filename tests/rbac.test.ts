import { describe, expect, it } from "vitest";

import {
  AuthorizationError,
  ROLE_PERMISSIONS,
  can,
  requirePermission,
  type Principal,
} from "../lib/rbac/permissions";

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

  it("allows Managing Partner all current operational permissions", () => {
    const partner = principalFor("managing-partner");
    for (const permission of ROLE_PERMISSIONS["managing-partner"]) {
      expect(can(partner, permission)).toBe(true);
    }
  });

  it("rejects disabled users even if they still have roles", () => {
    const disabled = principalFor("managing-partner", "disabled");
    expect(can(disabled, "companies.read")).toBe(false);
  });
});
