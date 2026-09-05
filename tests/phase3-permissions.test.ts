import { describe, expect, it } from "vitest";

import { skillRequirementTypeEnum } from "../db/schema/enums";
import { ROLE_PERMISSIONS, can, type Principal } from "../lib/rbac/permissions";
import { presentCandidate } from "../lib/privacy/present-candidate";

function principalFor(role: keyof typeof ROLE_PERMISSIONS): Principal {
  return {
    id: "user-1",
    status: "active",
    organizationId: "org-1",
    roleSlugs: [role],
    permissions: new Set(ROLE_PERMISSIONS[role]),
  };
}

describe("Phase 3 permissions and skills", () => {
  it("supports required, preferred, and nice-to-have job skills", () => {
    expect(skillRequirementTypeEnum.enumValues).toEqual(["required", "preferred", "nice_to_have"]);
  });

  it("denies Read Only from offers, placements, military review, and candidate PII", () => {
    const reader = principalFor("read-only");
    expect(can(reader, "offers.write")).toBe(false);
    expect(can(reader, "placements.write")).toBe(false);
    expect(can(reader, "military.review")).toBe(false);
    expect(can(reader, "candidate_pii.read")).toBe(false);
    expect(can(reader, "recruiting.analytics.read")).toBe(true);
  });

  it("lets a military specialist review mappings without admin rights", () => {
    const specialist = principalFor("military-talent-specialist");
    expect(can(specialist, "military.review")).toBe(true);
    expect(can(specialist, "military_reference.manage")).toBe(true);
    expect(can(specialist, "admin.roles")).toBe(false);
  });

  it("redacts compensation expectations without candidate_pii.read", () => {
    const presented = presentCandidate(
      { email: "hidden@example.test", compensationExpectations: "120000" },
      false,
    );
    expect(presented.email).toBeNull();
    expect(presented.compensationExpectations).toBeNull();
  });
});
