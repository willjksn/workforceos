import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getAcademyArticle } from "../lib/academy/catalog";
import { academyScoutCards } from "../lib/academy/scout";
import { updateAcademyTrainingAction } from "../lib/actions/academy";
import { navGroupsForPrincipal } from "../components/navigation/nav-config";
import { ROLE_PERMISSIONS, type Principal } from "../lib/rbac/permissions";
import { parseScoutIntent } from "../lib/scout/parse-intent";
import { isScoutExternalSendEnabled } from "../lib/scout/execute";
import {
  assertManagerNotSelf,
  deriveStaffOnboardingCadence,
  suggestedCadenceFromElapsed,
  week1RequiredSlugs,
} from "../lib/staff-onboarding/cadence";

const root = path.resolve(__dirname, "..");

function read(relative: string) {
  return readFileSync(path.join(root, relative), "utf8");
}

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

describe("Phase H staff onboarding", () => {
  it("derives cadence from completed work, not a calendar", () => {
    expect(
      deriveStaffOnboardingCadence({
        day1AcademyComplete: false,
        week1RequiredComplete: false,
        week2ShadowComplete: false,
        week3SupervisedComplete: false,
        week4Reviewed: false,
      }),
    ).toBe("day_1");
    expect(
      deriveStaffOnboardingCadence({
        day1AcademyComplete: true,
        week1RequiredComplete: false,
        week2ShadowComplete: false,
        week3SupervisedComplete: false,
        week4Reviewed: false,
      }),
    ).toBe("week_1");
    expect(
      deriveStaffOnboardingCadence({
        day1AcademyComplete: true,
        week1RequiredComplete: true,
        week2ShadowComplete: true,
        week3SupervisedComplete: true,
        week4Reviewed: false,
      }),
    ).toBe("week_4");
    expect(
      deriveStaffOnboardingCadence({
        day1AcademyComplete: true,
        week1RequiredComplete: true,
        week2ShadowComplete: true,
        week3SupervisedComplete: true,
        week4Reviewed: true,
      }),
    ).toBe("complete");
  });

  it("suggests elapsed cadence without auto-advancing stored state", () => {
    const start = new Date("2026-09-01T12:00:00.000Z");
    expect(suggestedCadenceFromElapsed(start, new Date("2026-09-01T18:00:00.000Z"))).toBe("day_1");
    expect(suggestedCadenceFromElapsed(start, new Date("2026-09-04T12:00:00.000Z"))).toBe("week_1");
    expect(suggestedCadenceFromElapsed(start, new Date("2026-09-12T12:00:00.000Z"))).toBe("week_2");
    expect(suggestedCadenceFromElapsed(start, new Date("2026-09-20T12:00:00.000Z"))).toBe("week_3");
    expect(suggestedCadenceFromElapsed(start, new Date("2026-09-28T12:00:00.000Z"))).toBe("week_4");
  });

  it("maps Week 1 required modules from effective access, not title", () => {
    const recruiter = principalFor("recruiter");
    const week1 = week1RequiredSlugs(recruiter);
    expect(week1).toContain("recruiting-hiring");
    expect(week1).toContain("military-talent");
    expect(week1).not.toContain("getting-started");
    expect(week1).not.toContain("ai-cost-admin");
    expect(week1).not.toContain("finance");
    expect("organizationalTitle" in recruiter).toBe(false);
  });

  it("rejects a self-manager", () => {
    expect(() => assertManagerNotSelf("user-1", "user-1")).toThrow(/own manager/i);
    expect(() => assertManagerNotSelf("user-1", "user-2")).not.toThrow();
    expect(() => assertManagerNotSelf("user-1", null)).not.toThrow();
    expect(read("db/schema/core.ts")).toMatch(/users_manager_not_self/);
    expect(read("lib/staff-onboarding/service.ts")).toMatch(/assertManagerNotSelf/);
  });

  it("persists policy acknowledgements without granting access", () => {
    const service = read("lib/staff-onboarding/service.ts");
    expect(service).toMatch(/insert\(staffPolicyAcknowledgements\)/);
    expect(service).toMatch(/staff_onboarding\.policy_acknowledged/);
    expect(service).not.toMatch(/setUserAccessBundles|userPermissionOverrides|assignUserRole/);
    expect(read("db/schema/staff/index.ts")).toMatch(/staff_policy_acknowledgements_user_policy_uq/);
    expect(read("lib/actions/staff-onboarding.ts")).toMatch(/acknowledgeStaffPolicy/);
  });

  it("does not grant permissions when training or Week 4 review completes", () => {
    const academy = read("lib/actions/academy.ts");
    expect(academy).toMatch(/upsertTrainingProgress/);
    expect(academy).not.toMatch(/userRoles|rolePermissions|userPermissionOverrides|applyPermissionOverrides/);
    const review = read("lib/staff-onboarding/service.ts");
    expect(review).toMatch(/recordStaffOnboardingWeek4Review/);
    expect(review).toMatch(/Does not assign roles, grant permissions/);
    expect(review).not.toMatch(/setUserAccessBundles|setUserPermissionOverride|assignUserRole/);
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("opportunities.read");
    expect(typeof updateAcademyTrainingAction).toBe("function");
  });

  it("keeps ATS hire onboarding as a separate product", () => {
    expect(existsSync(path.join(root, "app/(internal)/app/onboarding/page.tsx"))).toBe(true);
    expect(existsSync(path.join(root, "app/(internal)/app/academy/onboarding/page.tsx"))).toBe(true);
    expect(existsSync(path.join(root, "app/(internal)/app/admin/users/[id]/onboarding/page.tsx"))).toBe(true);
    const ats = read("app/(internal)/app/onboarding/page.tsx");
    expect(ats).toMatch(/listOnboardingQueue/);
    expect(ats).toMatch(/onboarding\.read/);
    expect(ats).not.toMatch(/staffOnboarding|staff_onboarding|getStaffOnboardingSnapshot/);
    expect(read("app/(internal)/app/academy/onboarding/page.tsx")).toMatch(/not the ATS hire queue/);
    expect(read("db/schema/staff/index.ts")).toMatch(/distinct from ATS hire/);
  });

  it("publishes the Employee onboarding Academy article and staff routes", () => {
    const article = getAcademyArticle("employee-onboarding");
    expect(article?.title).toBe("Employee onboarding");
    expect(article?.stepByStep.join(" ")).toMatch(/Military Talent Partner/);
    expect(article?.stepByStep.join(" ")).not.toMatch(/Military Talent Specialist/);
    expect(article?.stepByStep.join(" ")).toMatch(/does not assign bundles/);
    const recruiterLinks = navGroupsForPrincipal(principalFor("recruiter")).flatMap((group) =>
      group.items.map((item) => item.href),
    );
    expect(recruiterLinks).toContain("/app/academy/onboarding");
    expect(recruiterLinks).toContain("/app/onboarding");
    expect(recruiterLinks.filter((href) => href === "/app/onboarding")).toHaveLength(1);
  });

  it("lets Scout link the Academy onboarding article without sending or SQL", () => {
    const parsed = parseScoutIntent("How do I run employee onboarding?");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.dto.entity).toBe("academy");
      expect(parsed.dto.family).toBe("SEARCH");
    }
    const cards = academyScoutCards("employee onboarding");
    expect(cards.some((card) => card.href === "/app/academy/employee-onboarding")).toBe(true);
    expect(isScoutExternalSendEnabled()).toBe(false);
    expect(read("lib/scout/execute.ts")).toMatch(/export function isScoutExternalSendEnabled\(\) \{\s*return false;/);
  });
});
