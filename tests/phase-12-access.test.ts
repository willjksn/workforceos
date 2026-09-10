import { describe, expect, it } from "vitest";

import {
  FUNCTIONAL_BUNDLE_SLUGS,
  isAccessTemplateSlug,
  isFunctionalBundleSlug,
} from "../lib/rbac/access-bundles";
import {
  AuthorizationError,
  ROLE_PERMISSIONS,
  applyPermissionOverrides,
  can,
  requirePermission,
  type Principal,
} from "../lib/rbac/permissions";
import { ACCESS_BUNDLE_LABELS } from "../lib/rbac/role-guide";
import { assignableRoleSlugs, assertAccessBundlesAllowed } from "../lib/rbac/assign-role";
import { navGroupsForPrincipal } from "../components/navigation/nav-config";

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

function union(...slugs: Array<keyof typeof ROLE_PERMISSIONS>) {
  return applyPermissionOverrides(slugs.flatMap((slug) => ROLE_PERMISSIONS[slug]));
}

describe("Phase 12 flexible access", () => {
  it("lets admin assign module bundles and keeps Recruiter, Ops, and title out of authorization", () => {
    const admin = principalFor("managing-partner");
    const tech = principalFor("strategy-technology-administrator");
    const ops = principalFor("operations-administrator");
    const recruiter = principalFor("recruiter");

    expect(can(admin, "admin.roles")).toBe(true);
    expect(can(tech, "admin.roles")).toBe(true);
    expect(assignableRoleSlugs(admin)).toEqual(expect.arrayContaining([...FUNCTIONAL_BUNDLE_SLUGS]));
    expect(assignableRoleSlugs(tech)).toContain("finance");
    expect(assignableRoleSlugs(tech)).toContain("military-talent");
    expect(assignableRoleSlugs(tech)).not.toContain("managing-partner");
    expect(assignableRoleSlugs(ops)).toEqual([]);
    expect(assignableRoleSlugs(recruiter)).toEqual([]);
    expect(can(recruiter, "admin.roles")).toBe(false);
    expect(() => requirePermission(recruiter, "admin.roles")).toThrow(AuthorizationError);
    expect("organizationalTitle" in recruiter).toBe(false);
  });

  it("TEST A — Recruiting + Military Talent + Projects can access all three", () => {
    const perms = union("recruiting", "military-talent", "projects");
    const user = principalFor("recruiting", { roleSlugs: ["recruiting", "military-talent", "projects"], permissions: perms });
    expect(can(user, "jobs.write")).toBe(true);
    expect(can(user, "military.write")).toBe(true);
    expect(can(user, "skillbridge.manage")).toBe(true);
    expect(can(user, "projects.write")).toBe(true);
  });

  it("TEST B — same mix without Finance cannot see or access Finance", () => {
    const perms = union("recruiting", "military-talent", "projects");
    const user = principalFor("recruiting", { roleSlugs: ["recruiting", "military-talent", "projects"], permissions: perms });
    expect(can(user, "finance.read")).toBe(false);
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("finance.read");
    const links = navGroupsForPrincipal(user).flatMap((group) => group.items.map((item) => item.href));
    expect(links).not.toContain("/app/finance");
    expect(() => requirePermission(user, "finance.read")).toThrow(AuthorizationError);
  });

  it("TEST C — Talent Partner with submissions.write DENY can manage candidates but cannot submit", () => {
    const perms = applyPermissionOverrides(ROLE_PERMISSIONS["talent-partner"], [
      { permission: "submissions.write", effect: "deny" },
    ]);
    const user = principalFor("talent-partner", { permissions: perms });
    expect(can(user, "candidates.write")).toBe(true);
    expect(can(user, "candidates.read")).toBe(true);
    expect(can(user, "submissions.write")).toBe(false);
    expect(() => requirePermission(user, "submissions.write")).toThrow(AuthorizationError);
  });

  it("TEST D — Scout without AI Administration can use Scout and cannot administer AI costs", () => {
    const perms = union("scout", "ai-review");
    const user = principalFor("scout", { roleSlugs: ["scout", "ai-review"], permissions: perms });
    expect(can(user, "scout.use")).toBe(true);
    expect(can(user, "scout.draft")).toBe(true);
    expect(can(user, "agents.read")).toBe(true);
    expect(can(user, "agents.manage")).toBe(false);
    const links = navGroupsForPrincipal(user).flatMap((group) => group.items.map((item) => item.href));
    expect(links).toContain("/app/ai-operations/review");
    expect(links).not.toContain("/app/ai-operations");
    expect(links).not.toContain("/app/ai-operations/costs");
  });

  it("TEST E — System Administration can manage user access; Recruiter cannot", () => {
    const admin = principalFor("system-administration");
    expect(can(admin, "admin.roles")).toBe(true);
    expect(can(admin, "admin.users")).toBe(true);
    expect(assignableRoleSlugs(admin)).toContain("finance");
    expect(assignableRoleSlugs(principalFor("recruiter"))).toEqual([]);
  });

  it("TEST F — direct permission check without Finance is rejected server-side", () => {
    expect(() => requirePermission(principalFor("recruiter"), "finance.read")).toThrow(AuthorizationError);
    expect(() => requirePermission(principalFor("recruiter"), "opportunities.read")).toThrow(AuthorizationError);
  });

  it("TEST G — copying Recruiter + Finance produces the union", () => {
    const copied = union("recruiter", "finance");
    expect(copied.has("jobs.write")).toBe(true);
    expect(copied.has("finance.read")).toBe(true);
    expect(copied.has("opportunities.read")).toBe(false);
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("opportunities.read");
  });

  it("TEST H — assigning a second module unions and does not overwrite the first", () => {
    const first = union("recruiting");
    const both = union("recruiting", "military-talent");
    expect(first.has("jobs.write")).toBe(true);
    expect(first.has("military.review")).toBe(false);
    expect(both.has("jobs.write")).toBe(true);
    expect(both.has("military.review")).toBe(true);
    expect(() =>
      assertAccessBundlesAllowed({
        actor: principalFor("managing-partner"),
        nextSlugs: ["recruiting", "military-talent", "finance"],
        currentSlugs: ["recruiting"],
        managingPartnerCount: 1,
      }),
    ).not.toThrow();
  });

  it("keeps templates distinct from functional modules and uses Military Talent Partner language", () => {
    expect(isAccessTemplateSlug("recruiter")).toBe(true);
    expect(isFunctionalBundleSlug("recruiter")).toBe(false);
    expect(isFunctionalBundleSlug("finance")).toBe(true);
    expect(isFunctionalBundleSlug("military-talent")).toBe(true);
    expect(ACCESS_BUNDLE_LABELS["military-talent"]).toBe("Military Talent");
    expect(ACCESS_BUNDLE_LABELS["military-talent-partner"]).toBe("Military Talent Partner");
    expect(ACCESS_BUNDLE_LABELS["crm-business-development"]).toBe("CRM & Business Development");
    expect(ROLE_PERMISSIONS["crm-business-development"]).toContain("opportunities.read");
    expect(ROLE_PERMISSIONS.recruiting).not.toContain("opportunities.read");
    expect(Object.values(ACCESS_BUNDLE_LABELS).some((label) => /Talent Specialist/i.test(label))).toBe(false);
  });
});
