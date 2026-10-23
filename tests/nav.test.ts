import { describe, expect, it } from "vitest";

import { moreGroupsForPrincipal, navGroupsForPrincipal, SIDEBAR_TOP_LEVEL_COUNT_BEFORE_M8, topLevelNavHrefs } from "../components/navigation/nav-config";
import { ROLE_PERMISSIONS, type Principal } from "../lib/rbac/permissions";

function principalFor(role: keyof typeof ROLE_PERMISSIONS): Principal {
  return {
    id: "user-1",
    status: "active",
    organizationId: "org-1",
    roleSlugs: [role],
    permissions: new Set(ROLE_PERMISSIONS[role]),
  };
}

function hrefs(principal: ReturnType<typeof principalFor>) {
  return navGroupsForPrincipal(principal).flatMap((group) => group.items.map((item) => item.href));
}

describe("admin navigation", () => {
  it("groups operating work around the lifecycle", () => {
    const labels = navGroupsForPrincipal(principalFor("managing-partner")).map((group) => group.label);
    expect(labels).toEqual(["", "Work"]);
    const hrefs = topLevelNavHrefs(principalFor("managing-partner"));
    expect(hrefs).toContain("/app");
    expect(hrefs).toContain("/app/jobs");
    expect(hrefs).toContain("/app/talent");
    expect(hrefs).not.toContain("/app/opportunities");
    expect(hrefs.length).toBeLessThan(SIDEBAR_TOP_LEVEL_COUNT_BEFORE_M8 / 2);
  });

  it("keeps Jobs as the recruiting entry and leaves requisition and search-project URLs off the sidebar", () => {
    const links = hrefs(principalFor("recruiter"));
    expect(links).toContain("/app/jobs");
    expect(links).not.toContain("/app/recruiting/requisitions");
    expect(links).not.toContain("/app/search-projects");
  });

  it("hides Admin people screens from operating staff", () => {
    const links = hrefs(principalFor("recruiter"));
    expect(links.some((href) => href.startsWith("/app/admin"))).toBe(false);
    expect(links).not.toContain("/app/ai-operations");
    expect(links).not.toContain("/app/ai-operations/costs");
    expect(links).not.toContain("/app/ai-operations/runs");
    expect(links).not.toContain("/app/ai-operations/prompts");
    expect(links).not.toContain("/app/ai-operations/knowledge");
    expect(links).toContain("/app/reports");
    expect(links).not.toContain("/app/alerts");
    expect(links).not.toContain("/app/academy");
    const more = moreGroupsForPrincipal(principalFor("recruiter")).flatMap((group) => group.items.map((item) => item.href));
    expect(more).toContain("/app/alerts");
    expect(more).toContain("/app/academy");
  });

  it("shows operating Admin screens to Managing Partner and hides engineering registries", () => {
    const links = hrefs(principalFor("managing-partner"));
    const admin = moreGroupsForPrincipal(principalFor("managing-partner")).find((group) => group.label === "Admin");
    expect(admin?.items.map((item) => item.href)).toEqual([
      "/app/ai-operations",
      "/app/ai-operations/review",
      "/app/admin/approvals",
      "/app/integrations",
      "/app/admin/system-health",
      "/app/public-content",
      "/app/admin/users",
      "/app/alerts",
      "/app/academy",
      "/app/academy/onboarding",
    ]);
    expect(links).not.toContain("/app/admin/users");
    expect(links).not.toContain("/app/integrations");
    expect(links).toContain("/app/reports");
    expect(links).not.toContain("/app/alerts");
    expect(links).not.toContain("/app/academy");
    expect(links).not.toContain("/app/ai-operations");
    expect(links).not.toContain("/app/admin/roles");
    expect(links).not.toContain("/app/admin/integrations");
    expect(links).not.toContain("/app/admin/system-health");
    expect(links).not.toContain("/app/admin/approvals");
    expect(links).not.toContain("/app/admin/data-quality");
    expect(links).not.toContain("/app/admin/access-review");
    expect(links).not.toContain("/app/ai-operations/knowledge");
    expect(links).not.toContain("/app/ai-operations/costs");
    expect(links).not.toContain("/app/admin/agents");
    expect(links).not.toContain("/app/admin/requirements");
    expect(links).not.toContain("/app/admin/decisions");
    expect(admin?.items.some((item) => item.label === "AI & Automation")).toBe(true);
  });

  it("labels Military Talent pathway operations instead of a SkillBridge program", () => {
    const military = moreGroupsForPrincipal(principalFor("recruiter")).find((group) => group.label === "Military tools");
    expect(military?.items.some((item) => item.label === "Pathway operations")).toBe(true);
    expect(military?.items.some((item) => item.label === "SkillBridge")).toBe(false);
    const talent = navGroupsForPrincipal(principalFor("recruiter"))
      .flatMap((group) => group.items)
      .find((item) => item.label === "Talent");
    expect(talent?.children?.some((item) => item.href === "/app/military")).toBe(true);
  });

  it("does not show role configuration to Operations Administrator", () => {
    const links = hrefs(principalFor("operations-administrator"));
    const more = moreGroupsForPrincipal(principalFor("operations-administrator")).flatMap((group) => group.items.map((item) => item.href));
    expect(links).not.toContain("/app/admin/users");
    expect(more).toContain("/app/admin/users");
    expect(links).not.toContain("/app/admin/roles");
    expect(more).toContain("/app/ai-operations/review");
    expect(links).not.toContain("/app/ai-operations");
    expect(more).not.toContain("/app/ai-operations");
    expect(links).not.toContain("/app/ai-operations/costs");
  });

  it("keeps Talent Partner on Review Queue without AI cost consoles or knowledge in the sidebar", () => {
    const admin = moreGroupsForPrincipal(principalFor("talent-partner")).find((group) => group.label === "Admin");
    const links = hrefs(principalFor("talent-partner"));
    expect(links).not.toContain("/app/ai-operations/costs");
    expect(links).not.toContain("/app/ai-operations/runs");
    expect(admin?.items.some((item) => item.label === "AI & Automation")).toBe(false);
    expect(admin?.items.some((item) => item.href === "/app/ai-operations/knowledge")).toBe(false);
    expect(admin?.items.some((item) => item.href === "/app/ai-operations/review")).toBe(true);
  });

  it("does not put commercial opportunities on the Recruiter sidebar", () => {
    const links = hrefs(principalFor("recruiter"));
    expect(links).not.toContain("/app/opportunities");
    expect(links).not.toContain("/app/crm/inquiries");
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("opportunities.read");
  });
});
