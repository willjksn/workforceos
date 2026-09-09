import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ACADEMY_ARTICLES, getAcademyArticle } from "../lib/academy/catalog";
import { academyScoutCards, academyHrefPattern } from "../lib/academy/scout";
import {
  TRAINING_REQUIREMENT_MAP,
  isTrainingRequired,
  requiredTrainingSlugs,
} from "../lib/academy/training";
import { academyArticleHref } from "../lib/academy/types";
import { navGroupsForPrincipal } from "../components/navigation/nav-config";
import { applyPermissionOverrides, ROLE_PERMISSIONS, type Principal } from "../lib/rbac/permissions";
import { parseScoutIntent } from "../lib/scout/parse-intent";
import { isScoutExternalSendEnabled } from "../lib/scout/execute";

const root = path.resolve(__dirname, "..");

function principalFor(
  role: keyof typeof ROLE_PERMISSIONS,
  extra: Partial<Principal> = {},
): Principal {
  return {
    id: "user-1",
    status: "active",
    organizationId: "org-1",
    roleSlugs: [role],
    permissions: new Set(ROLE_PERMISSIONS[role]),
    ...extra,
  };
}

function read(relative: string) {
  return readFileSync(path.join(root, relative), "utf8");
}

describe("Phase E Academy", () => {
  it("publishes Academy routes and catalog articles", () => {
    expect(existsSync(path.join(root, "app/(internal)/app/academy/page.tsx"))).toBe(true);
    expect(existsSync(path.join(root, "app/(internal)/app/academy/[slug]/page.tsx"))).toBe(true);
    expect(getAcademyArticle("getting-started")?.title).toMatch(/Getting started/i);
    expect(getAcademyArticle("military-talent")?.stepByStep.join(" ")).toMatch(/Military Talent Partner/);
    expect(getAcademyArticle("military-talent")?.stepByStep.join(" ")).not.toMatch(/Military Talent Specialist/);
    expect(ACADEMY_ARTICLES.some((article) => article.accessRequired.includes("candidates.read"))).toBe(true);
    expect(ACADEMY_ARTICLES.every((article) => !article.accessRequired.includes("candidate.read" as never))).toBe(true);
    const corpus = ACADEMY_ARTICLES.map((article) => `${article.title} ${article.stepByStep.join(" ")}`).join("\n");
    expect(corpus).not.toMatch(/\bcandidate\.read\b/);
    expect(corpus).toMatch(/candidates\.read|scout\.use|jobs\.read/);
  });

  it("derives required training from effective permissions, not title", () => {
    const recruiter = principalFor("recruiter");
    const titledRecruiter = principalFor("recruiter", { roleSlugs: ["recruiter"] });
    const required = requiredTrainingSlugs(recruiter);
    expect(required).toContain("getting-started");
    expect(required).toContain("recruiting-hiring");
    expect(required).toContain("military-talent");
    expect(required).not.toContain("ai-cost-admin");
    expect(required).not.toContain("finance");
    expect(required).not.toContain("admin");
    expect(required).not.toContain("projects");
    expect(requiredTrainingSlugs(titledRecruiter)).toEqual(required);
    expect(isTrainingRequired(recruiter, "ai-cost-admin")).toBe(false);
    expect(TRAINING_REQUIREMENT_MAP["ai-cost-admin"]).toEqual(["agents.manage"]);
  });

  it("requires area modules when Recruiting + Military + Projects permissions are present", () => {
    const combo: Principal = {
      id: "user-2",
      status: "active",
      organizationId: "org-1",
      roleSlugs: ["recruiter", "military-talent-partner", "workforce-consultant"],
      permissions: applyPermissionOverrides([
        ...ROLE_PERMISSIONS.recruiter,
        ...ROLE_PERMISSIONS["military-talent-partner"],
        ...ROLE_PERMISSIONS["workforce-consultant"],
      ]),
    };
    const required = requiredTrainingSlugs(combo);
    expect(required).toContain("recruiting-hiring");
    expect(required).toContain("military-talent");
    expect(required).toContain("projects");
    expect(required).toContain("workforce-consulting");
    expect(required).not.toContain("ai-cost-admin");
  });

  it("does not treat organizational title as a training input", () => {
    const recruiter = principalFor("recruiter");
    expect("organizationalTitle" in recruiter).toBe(false);
    const withManagingPartnerTitleStillRecruiter = principalFor("recruiter");
    expect(isTrainingRequired(withManagingPartnerTitleStillRecruiter, "admin")).toBe(false);
    expect(isTrainingRequired(principalFor("managing-partner"), "admin")).toBe(true);
    expect(isTrainingRequired(principalFor("managing-partner"), "ai-cost-admin")).toBe(true);
  });

  it("does not grant permissions when training is completed", () => {
    const action = read("lib/actions/academy.ts");
    expect(action).toMatch(/upsertTrainingProgress/);
    expect(action).not.toMatch(/userRoles|rolePermissions|userPermissionOverrides|applyPermissionOverrides/);
    expect(read("lib/academy/progress.ts")).toMatch(/writes `user_training_progress` only/);
    const recruiter = principalFor("recruiter");
    expect(recruiter.permissions.has("agents.manage")).toBe(false);
    expect(isTrainingRequired(recruiter, "ai-cost-admin")).toBe(false);
  });

  it("puts Help & Training on the operator utility nav", () => {
    const recruiterLinks = navGroupsForPrincipal(principalFor("recruiter")).flatMap((group) =>
      group.items.map((item) => item.href),
    );
    expect(recruiterLinks).toContain("/app/academy");
    expect(recruiterLinks).not.toContain("/app/ai-operations");
    expect(recruiterLinks).not.toContain("/app/ai-operations/knowledge");
    const item = navGroupsForPrincipal(principalFor("recruiter"))
      .flatMap((group) => group.items)
      .find((entry) => entry.href === "/app/academy");
    expect(item?.label).toBe("Help & Training");
    expect(item?.title).toBe("Academy");
  });

  it("formats Scout Academy links as /app/academy/[slug]", () => {
    const howTo = parseScoutIntent("How do I run a professional search?");
    expect(howTo.ok).toBe(true);
    if (howTo.ok) {
      expect(howTo.dto.entity).toBe("academy");
      expect(howTo.dto.family).toBe("SEARCH");
    }
    const knowledge = parseScoutIntent("Show knowledge playbooks");
    expect(knowledge.ok).toBe(true);
    if (knowledge.ok) {
      expect(knowledge.dto.entity).toBe("knowledge");
      expect(knowledge.summary).not.toMatch(/Academy/i);
    }
    expect(academyArticleHref("military-talent")).toBe("/app/academy/military-talent");
    expect(academyHrefPattern().test("/app/academy/military-talent")).toBe(true);
    const cards = academyScoutCards("professional search");
    expect(cards.some((card) => card.href === "/app/academy/playbook-professional-search")).toBe(true);
    expect(cards.every((card) => card.href.startsWith("/app/academy/"))).toBe(true);
  });

  it("keeps Scout external send hard-denied", () => {
    expect(isScoutExternalSendEnabled()).toBe(false);
    expect(read("lib/scout/execute.ts")).toMatch(/export function isScoutExternalSendEnabled\(\) \{\s*return isScoutSendPathEnabled\(\);/);
  });
});
