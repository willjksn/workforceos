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
  it("hides Admin from operating staff", () => {
    const links = hrefs(principalFor("recruiter"));
    expect(links.some((href) => href.startsWith("/app/admin"))).toBe(false);
    expect(links).not.toContain("/app/ai-operations");
    expect(links).not.toContain("/app/ai-operations/costs");
    expect(links).not.toContain("/app/ai-operations/runs");
    expect(links).not.toContain("/app/ai-operations/prompts");
    expect(links).not.toContain("/app/ai-operations/knowledge");
    expect(links).toContain("/app/reports");
    expect(links).toContain("/app/alerts");
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
    expect(links).toContain("/app/ai-operations");
    expect(links).toContain("/app/ai-operations/costs");
    expect(links).not.toContain("/app/admin/agents");
    expect(links).not.toContain("/app/admin/requirements");
    expect(links).not.toContain("/app/admin/decisions");
    expect(links).not.toContain("/app/admin/agents");
  });

  it("labels Military Talent pathway operations instead of a SkillBridge program", () => {
    const military = navGroupsForPrincipal(principalFor("recruiter")).find((group) => group.label === "Military Talent");
    expect(military?.items.some((item) => item.label === "Pathway operations")).toBe(true);
    expect(military?.items.some((item) => item.label === "SkillBridge")).toBe(false);
  });

  it("does not show role configuration to Operations Administrator", () => {
    const links = hrefs(principalFor("operations-administrator"));
    expect(links).toContain("/app/admin/users");
    expect(links).not.toContain("/app/admin/roles");
    expect(links).toContain("/app/ai-operations/review");
    expect(links).not.toContain("/app/ai-operations/costs");
  });

  it("keeps Talent Partner on Scout and playbooks without AI cost consoles", () => {
    const groups = navGroupsForPrincipal(principalFor("talent-partner"));
    const ai = groups.find((group) => group.label === "AI Operations");
    const links = hrefs(principalFor("talent-partner"));
    expect(links).not.toContain("/app/ai-operations/costs");
    expect(links).not.toContain("/app/ai-operations/runs");
    expect(ai?.items.some((item) => item.label === "AI administration")).toBe(false);
    expect(ai?.items.some((item) => item.href === "/app/ai-operations/knowledge")).toBe(true);
  });
});
