import { describe, expect, it } from "vitest";

import {
  LEGACY_ROLE_SLUG_ALIASES,
  ROLE_PERMISSIONS,
  ROLE_SLUGS,
  applyPermissionOverrides,
  asRoleSlug,
  can,
  canonicalizeRoleSlug,
  type Principal,
} from "../lib/rbac/permissions";

function principalFor(role: keyof typeof ROLE_PERMISSIONS, extra: Partial<Principal> = {}): Principal {
  return {
    id: "user-1",
    status: "active",
    organizationId: "org-1",
    roleSlugs: [role],
    permissions: new Set(ROLE_PERMISSIONS[role]),
    ...extra,
  };
}

describe("Phase C Title ≠ Access", () => {
  it("unions permissions from multiple access bundles", () => {
    const union = applyPermissionOverrides([
      ...ROLE_PERMISSIONS.recruiter,
      ...ROLE_PERMISSIONS["military-talent-partner"],
    ]);
    expect(union.has("jobs.write")).toBe(true);
    expect(union.has("military.review")).toBe(true);
    expect(union.has("opportunities.read")).toBe(false);
    expect(union.has("admin.roles")).toBe(false);
  });

  it("lets an explicit deny override a bundle grant", () => {
    const effective = applyPermissionOverrides(ROLE_PERMISSIONS["talent-partner"], [
      { permission: "opportunities.read", effect: "deny" },
    ]);
    expect(ROLE_PERMISSIONS["talent-partner"]).toContain("opportunities.read");
    expect(effective.has("opportunities.read")).toBe(false);
    expect(effective.has("candidates.read")).toBe(true);
  });

  it("lets an explicit grant add a permission the bundles do not have", () => {
    const effective = applyPermissionOverrides(ROLE_PERMISSIONS.recruiter, [
      { permission: "opportunities.read", effect: "grant" },
    ]);
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("opportunities.read");
    expect(effective.has("opportunities.read")).toBe(true);
  });

  it("lets deny win when the same permission is both granted and denied", () => {
    const effective = applyPermissionOverrides(ROLE_PERMISSIONS.recruiter, [
      { permission: "opportunities.read", effect: "grant" },
      { permission: "opportunities.read", effect: "deny" },
    ]);
    expect(effective.has("opportunities.read")).toBe(false);
  });

  it("does not treat organizational title as a permission", () => {
    const titled = principalFor("recruiter");
    expect(can(titled, "admin.users")).toBe(false);
    expect(can(titled, "opportunities.read")).toBe(false);
    expect("organizationalTitle" in titled).toBe(false);
  });

  it("renames the Military Talent Partner slug and keeps a one-release alias", () => {
    expect(ROLE_SLUGS).toContain("military-talent-partner");
    expect(ROLE_SLUGS).not.toContain("military-talent-specialist");
    expect(canonicalizeRoleSlug("military-talent-specialist")).toBe("military-talent-partner");
    expect(asRoleSlug("military-talent-specialist")).toBe("military-talent-partner");
    expect(LEGACY_ROLE_SLUG_ALIASES["military-talent-specialist"]).toBe("military-talent-partner");
    expect(can(principalFor("military-talent-partner"), "military.review")).toBe(true);
    expect(can(principalFor("military-talent-partner"), "admin.roles")).toBe(false);
  });

  it("keeps Recruiter Standard without opportunities.read (DEC-RBAC-001)", () => {
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("opportunities.read");
    expect(can(principalFor("recruiter"), "opportunities.read")).toBe(false);
    expect(can(principalFor("recruiter"), "jobs.write")).toBe(true);
  });
});
