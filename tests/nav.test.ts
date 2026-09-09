import { describe, expect, it } from "vitest";

import { navGroupsForPrincipal } from "../components/navigation/nav-config";
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
    expect(labels).toEqual(["", "Commercial", "Delivery", "Talent", "Pathway", "Admin"]);
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
    expect(links).toContain("/app/alerts");
    expect(links).toContain("/app/academy");
  });

  it("shows operating Admin screens to Managing Partner and hides engineering registries", () => {
    const links = hrefs(principalFor("managing-partner"));
    expect(links).toContain("/app/admin/users");
    expect(links).toContain("/app/admin/roles");
    expect(links).toContain("/app/admin/integrations");
    expect(links).toContain("/app/admin/system-health");
    expect(links).toContain("/app/admin/approvals");
    expect(links).toContain("/app/admin/data-quality");
    expect(links).toContain("/app/admin/access-review");
    expect(links).toContain("/app/reports");
    expect(links).toContain("/app/alerts");
    expect(links).toContain("/app/academy");
    expect(links).toContain("/app/ai-operations");
    expect(links).toContain("/app/ai-operations/knowledge");
    expect(links).not.toContain("/app/ai-operations/costs");
    expect(links).not.toContain("/app/admin/agents");
    expect(links).not.toContain("/app/admin/requirements");
    expect(links).not.toContain("/app/admin/decisions");
  });

  it("labels Military Talent pathway operations instead of a SkillBridge program", () => {
    const pathway = navGroupsForPrincipal(principalFor("recruiter")).find((group) => group.label === "Pathway");
    expect(pathway?.items.some((item) => item.label === "Pathway operations")).toBe(true);
    expect(pathway?.items.some((item) => item.label === "SkillBridge")).toBe(false);
  });

  it("does not show role configuration to Operations Administrator", () => {
    const links = hrefs(principalFor("operations-administrator"));
    expect(links).toContain("/app/admin/users");
    expect(links).not.toContain("/app/admin/roles");
    expect(links).toContain("/app/ai-operations/review");
    expect(links).not.toContain("/app/ai-operations");
    expect(links).not.toContain("/app/ai-operations/costs");
  });

  it("keeps Talent Partner on knowledge without AI cost consoles", () => {
    const groups = navGroupsForPrincipal(principalFor("talent-partner"));
    const admin = groups.find((group) => group.label === "Admin");
    const links = hrefs(principalFor("talent-partner"));
    expect(links).not.toContain("/app/ai-operations/costs");
    expect(links).not.toContain("/app/ai-operations/runs");
    expect(admin?.items.some((item) => item.label === "AI administration")).toBe(false);
    expect(admin?.items.some((item) => item.href === "/app/ai-operations/knowledge")).toBe(true);
  });

  it("does not put commercial opportunities on the Recruiter sidebar", () => {
    const links = hrefs(principalFor("recruiter"));
    expect(links).not.toContain("/app/opportunities");
    expect(links).not.toContain("/app/crm/inquiries");
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("opportunities.read");
  });
});
