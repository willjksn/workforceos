import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { moreGroupsForPrincipal, navGroupsForPrincipal, topLevelNavHrefs } from "../components/navigation/nav-config";
import { COMPANY_NAME, PRODUCT_IDENTITY, PRODUCT_NAME } from "../lib/brand/identity";
import { INSUFFICIENT_BELOW, OPERATIONAL_PATTERN_AT } from "../lib/outcome-learning/thresholds";
import { publicOpportunityLabel } from "../lib/recruiting/engagement-policy";
import { ROLE_PERMISSIONS, type Principal } from "../lib/rbac/permissions";
import { operationalCommandIds } from "../lib/scout/operational-commands";

function read(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function principal(): Principal {
  return {
    id: "user-1",
    status: "active",
    organizationId: "org-1",
    roleSlugs: ["managing-partner"],
    permissions: new Set(ROLE_PERMISSIONS["managing-partner"]),
  };
}

const shellFiles = [
  "components/branding/brand-mark.tsx",
  "components/layout/app-sidebar.tsx",
  "app/layout.tsx",
  "app/page.tsx",
  "app/sign-in/[[...sign-in]]/page.tsx",
];

describe("M10 Pier 24 Partners identity", () => {
  it("keeps WorkforceOS as the product and Pier 24 Partners as the company", () => {
    expect(PRODUCT_NAME).toBe("WorkforceOS");
    expect(COMPANY_NAME).toBe("Pier 24 Partners");
    expect(PRODUCT_IDENTITY).toBe("WorkforceOS by Pier 24 Partners");
    expect(COMPANY_NAME).not.toContain("Pier24 Solutions");
  });

  it("does not show PierOne in the primary app shell", () => {
    for (const file of shellFiles) {
      const source = read(file);
      expect(source, file).not.toMatch(/PierOne/);
      expect(source, file).not.toMatch(/Pier One/);
    }
    const mark = read("components/branding/brand-mark.tsx");
    expect(mark).toContain("Pier <span");
    expect(mark).toContain("24");
    expect(mark).toContain("Partners");
    expect(read("components/layout/app-sidebar.tsx")).toContain("WorkforceOS");
    expect(read("lib/brand/identity.ts")).toContain("WorkforceOS by Pier 24 Partners");
    expect(read("app/layout.tsx")).toContain("PRODUCT_IDENTITY");
  });

  it("keeps the public site on Pier 24 Partners and off Pier24 Solutions", () => {
    const content = read("sites/pierone/lib/content.ts");
    expect(content).toContain('export const SITE_NAME = "Pier 24 Partners"');
    expect(content).toContain(
      "We help organizations build the workforce they need today and prepare for the workforce they will need tomorrow.",
    );
    expect(content).not.toMatch(/PierOne/);
    expect(content).not.toMatch(/Pier24 Solutions/);
    expect(content).toContain("Professional & Technical Search");
    expect(content).toContain("Military Talent Opportunity Assessment");
    expect(content).toContain("Talent Acquisition Performance Assessment");
    expect(content).toContain("Fractional Talent Partner");
    expect(content).toContain("Workforce Pipeline Assessment");
    expect(content).toContain("does not place SkillBridge interns");
    expect(content).not.toMatch(/guarantee an interview|guaranteed placement|we guarantee/i);
  });

  it("keeps Military Talent language and does not revive Military Talent Specialist in the shell", () => {
    const surfaces = [
      ...shellFiles,
      "components/navigation/nav-config.ts",
      "sites/pierone/lib/content.ts",
      "sites/pierone/app/military-talent/page.tsx",
      "app/(internal)/app/military/page.tsx",
    ].map(read).join("\n");
    expect(surfaces).toContain("Military Talent");
    expect(surfaces).not.toContain("Military Talent Specialist");
  });

  it("keeps public opportunities and CRM opportunities distinct", () => {
    expect(publicOpportunityLabel("monitored_public")).toBe("Public opportunity");
    const nav = read("components/navigation/nav-config.ts");
    expect(nav).toContain('label: "CRM Opportunities"');
    expect(nav).toContain("Commercial pursuits, not jobs");
    expect(nav).not.toContain("Partner opportunity");
  });

  it("keeps the M8 navigation hierarchy", () => {
    const hrefs = topLevelNavHrefs(principal());
    expect(hrefs).toEqual([
      "/app",
      "/app/talent",
      "/app/jobs",
      "/app/companies",
      "/app/workforce",
      "/app/scout",
      "/app/reports",
      "/app/more",
    ]);
    const labels = navGroupsForPrincipal(principal()).flatMap((group) => group.items.map((item) => item.label));
    expect(labels).toEqual([
      "Command Center",
      "Talent",
      "Jobs",
      "Companies",
      "Workforce",
      "Scout",
      "Reports",
      "More",
    ]);
    expect(moreGroupsForPrincipal(principal()).map((group) => group.label)).toEqual([
      "CRM",
      "Delivery",
      "Talent tools",
      "Military tools",
      "Workforce tools",
      "Admin",
    ]);
  });

  it("keeps the Scout command registry and M9 sample threshold", () => {
    expect(operationalCommandIds).toEqual([
      "talent.by_capability",
      "talent.without_workflow",
      "talent.waiting_over_days",
      "match.explain",
      "match.candidate_opportunities",
      "match.job_candidates",
      "demand.recent_public",
      "demand.strong_without_engagement",
      "demand.requirement_review",
      "demand.crm_pursuits",
      "ops.overdue_follow_ups",
      "ops.waiting_on_employer",
      "ops.waiting_on_candidate",
      "ops.referrals_need_routing",
      "ops.no_fit_needs_path",
      "ops.interviews_need_next",
      "ops.set_follow_up",
      "ops.m6_handoff",
      "workforce.largest_gaps",
      "workforce.critical_roles",
      "workforce.scarce_capabilities",
      "workforce.military_supply",
      "workforce.occupation_channels",
      "learning.match_performance",
      "learning.nofit_gaps",
      "learning.mapping_placements",
      "learning.pipeline_leak",
      "learning.slow_employers",
      "learning.family_interview_rate",
    ]);
    expect(INSUFFICIENT_BELOW).toBe(5);
    expect(OPERATIONAL_PATTERN_AT).toBe(20);
    expect(read("lib/scout/operational-commands.ts")).not.toMatch(/PierOne/);
  });

  it("does not add a brand migration", () => {
    expect(read("drizzle/meta/_journal.json")).not.toContain("0028");
    expect(read("lib/public-api/hmac.ts")).toContain("x-pierone-site-timestamp");
    expect(read("db/schema/public-site/index.ts")).toContain('default("pierone_public_website")');
  });
});
