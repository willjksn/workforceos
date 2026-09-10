import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getAcademyArticle, searchAcademyArticles } from "../lib/academy/catalog";
import { displayServiceName, PROFESSIONAL_SEARCH_CODE, PROFESSIONAL_SEARCH_DISPLAY_NAME } from "../lib/services/labels";
import {
  commercialPathSummary,
  resolveCommercialPrimaryCta,
  type CommercialPathRecord,
} from "../lib/delivery/commercial-path";
import { FINANCE_SPINE } from "../lib/ia/concepts";
import { LEGAL_TEMPLATE_APPROVED_LABEL, LEGAL_TEMPLATE_DRAFT_LABEL, legalTemplateUseLabel } from "../lib/legal/labels";
import { REPORT_QUESTIONS } from "../lib/reporting/filters";
import { navGroupsForPrincipal } from "../components/navigation/nav-config";
import { ROLE_PERMISSIONS, type Principal } from "../lib/rbac/permissions";

const root = path.resolve(__dirname, "..");

function principalFor(role: keyof typeof ROLE_PERMISSIONS): Principal {
  return {
    id: "user-1",
    status: "active",
    organizationId: "org-1",
    roleSlugs: [role],
    permissions: new Set(ROLE_PERMISSIONS[role]),
  };
}

function emptyPath(): CommercialPathRecord {
  return { discoveries: [], plans: [], proposals: [], contracts: [], projects: [] };
}

describe("leftover IA", () => {
  it("uses Professional & Technical Search as the operator display name", () => {
    expect(PROFESSIONAL_SEARCH_CODE).toBe("professional-search");
    expect(PROFESSIONAL_SEARCH_DISPLAY_NAME).toBe("Professional & Technical Search");
    expect(displayServiceName("professional-search", "Professional Search")).toBe("Professional & Technical Search");
    expect(readFileSync(path.join(root, "docs/decisions/DECISION_LOG.md"), "utf8")).toMatch(/DEC-SVC-005/);
    expect(readFileSync(path.join(root, "docs/business/SERVICE_CATALOG.md"), "utf8")).toMatch(
      /Display name: \*\*Professional & Technical Search\*\*/,
    );
    expect(readFileSync(path.join(root, "docs/business/SERVICE_CATALOG.md"), "utf8")).toMatch(
      /Code: `professional-search`/,
    );
    expect(searchAcademyArticles("professional search").some((article) => article.slug === "playbook-professional-search")).toBe(
      true,
    );
  });

  it("keeps the commercial path and hides Build proposal until the plan is approved", () => {
    expect(commercialPathSummary()).toContain("Company → Opportunity → Discovery");
    expect(commercialPathSummary()).toContain("Build Proposal");
    expect(commercialPathSummary()).toContain("Contract / SOW");

    const start = resolveCommercialPrimaryCta(emptyPath(), "opp-1");
    expect(start).toMatchObject({ kind: "link", label: "Start discovery" });

    const beforePlan = resolveCommercialPrimaryCta(
      {
        ...emptyPath(),
        discoveries: [{ id: "d1", title: "D", status: "approved" }],
      },
      "opp-1",
    );
    expect(beforePlan.kind).toBe("link");
    if (beforePlan.kind === "link") expect(beforePlan.label).toBe("Create solution plan");

    const draftPlan = resolveCommercialPrimaryCta(
      {
        ...emptyPath(),
        discoveries: [{ id: "d1", title: "D", status: "approved" }],
        plans: [{ id: "p1", title: "P", status: "draft" }],
      },
      "opp-1",
    );
    expect(draftPlan.kind).not.toBe("build_proposal");

    const ready = resolveCommercialPrimaryCta(
      {
        ...emptyPath(),
        discoveries: [{ id: "d1", title: "D", status: "approved" }],
        plans: [{ id: "p1", title: "P", status: "approved" }],
      },
      "opp-1",
    );
    expect(ready).toEqual({ kind: "build_proposal", label: "Build proposal", planId: "p1" });
  });

  it("labels legal templates as draft or attorney approved", () => {
    expect(legalTemplateUseLabel(false)).toBe(LEGAL_TEMPLATE_DRAFT_LABEL);
    expect(legalTemplateUseLabel(true)).toBe(LEGAL_TEMPLATE_APPROVED_LABEL);
    expect(readFileSync(path.join(root, "app/(internal)/app/legal/templates/page.tsx"), "utf8")).not.toMatch(
      /Structural templates/,
    );
    expect(readFileSync(path.join(root, "app/(internal)/app/legal/templates/page.tsx"), "utf8")).toMatch(
      /\/app\/legal\/templates\/\$\{row\.id\}/,
    );
    expect(existsSync(path.join(root, "app/(internal)/app/legal/templates/[id]/page.tsx"))).toBe(true);
  });

  it("asks business questions in reports and drops leftover implementation wording", () => {
    expect(REPORT_QUESTIONS.business.title).toMatch(/\?$/);
    const corpus = Object.values(REPORT_QUESTIONS)
      .map((item) => `${item.title} ${item.summary}`)
      .join("\n");
    expect(corpus).not.toMatch(/Stored records only/);
    const categoryPage = readFileSync(path.join(root, "app/(internal)/app/reports/[category]/page.tsx"), "utf8");
    expect(categoryPage).not.toMatch(/No stored records answer this yet/);
    expect(categoryPage).not.toMatch(/Stored jobs only/);
  });

  it("puts AI costs under Admin → AI & Automation and keeps recruiters off that dest", () => {
    const recruiter = navGroupsForPrincipal(principalFor("recruiter")).flatMap((group) =>
      group.items.map((item) => item.href),
    );
    expect(recruiter).not.toContain("/app/ai-operations");
    expect(recruiter).not.toContain("/app/ai-operations/costs");
    expect(recruiter).toContain("/app/ai-operations/review");
    expect(ROLE_PERMISSIONS.recruiter).toContain("agents.read");
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("agents.manage");
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("opportunities.read");
    const admin = navGroupsForPrincipal(principalFor("managing-partner")).find((group) => group.label === "Admin");
    expect(admin?.items.some((item) => item.label === "AI & Automation" && item.href === "/app/ai-operations")).toBe(
      true,
    );
    const commandCenter = readFileSync(path.join(root, "app/(internal)/app/page.tsx"), "utf8");
    expect(commandCenter).not.toMatch(/AI & Automation/);
    expect(commandCenter).not.toMatch(/\/app\/ai-operations/);
    expect(readFileSync(path.join(root, "lib/reporting/executive.ts"), "utf8")).not.toMatch(/usageSummary/);
  });

  it("redirects old requisition and search-project list URLs onto Jobs", () => {
    expect(readFileSync(path.join(root, "app/(internal)/app/recruiting/requisitions/page.tsx"), "utf8")).toMatch(
      /\/app\/jobs\?view=headcount/,
    );
    expect(readFileSync(path.join(root, "app/(internal)/app/search-projects/page.tsx"), "utf8")).toMatch(
      /\/app\/jobs\?view=searches/,
    );
    expect(existsSync(path.join(root, "app/(internal)/app/search-projects/[id]/page.tsx"))).toBe(true);
  });

  it("redirects the removed Admin hub to Team & Access", () => {
    expect(readFileSync(path.join(root, "app/(internal)/app/admin/page.tsx"), "utf8")).toMatch(
      /redirect\("\/app\/admin\/users"\)/,
    );
  });

  it("publishes concept and finance-spine copy", () => {
    const concepts = getAcademyArticle("operating-concepts");
    expect(concepts?.stepByStep.join(" ")).toMatch(/Candidate vs application/);
    expect(concepts?.stepByStep.join(" ")).toMatch(/Employer opportunity vs job/);
    expect(concepts?.stepByStep.join(" ")).toMatch(/ATTORNEY APPROVED/);
    expect(FINANCE_SPINE.map((step) => step.label)).toEqual([
      "Proposal Pricing",
      "Contract Value",
      "Project Value",
      "Invoice",
      "AR",
      "Payment",
      "Revenue Reporting",
    ]);
  });
});
