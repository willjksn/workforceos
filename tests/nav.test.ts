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
    expect(links).toContain("/app/ai-operations");
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
    expect(links).not.toContain("/app/admin/agents");
    expect(links).not.toContain("/app/admin/requirements");
    expect(links).not.toContain("/app/admin/decisions");
    expect(links).not.toContain("/app/admin/agents");
  });

  it("does not show role configuration to Operations Administrator", () => {
    const links = hrefs(principalFor("operations-administrator"));
    expect(links).toContain("/app/admin/users");
    expect(links).not.toContain("/app/admin/roles");
  });
});
