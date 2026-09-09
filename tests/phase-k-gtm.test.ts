import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getAcademyArticle } from "../lib/academy/catalog";
import { navGroupsForPrincipal } from "../components/navigation/nav-config";
import { LAUNCH_SERVICE_CODES } from "../lib/crm/stages";
import {
  GTM_CADENCE_HREF,
  GTM_FOCUS_INDUSTRIES,
  GTM_LAUNCH_SERVICE_CODES,
  GTM_MILITARY_SERVICE_CODE,
  GTM_PLAN_PATH,
  GTM_REGIONS,
  GTM_TIER_1_INDUSTRIES,
  GTM_TIER_2_INDUSTRIES,
  GTM_TIERS,
} from "../lib/gtm/focus";
import { ROLE_PERMISSIONS, can, type Principal } from "../lib/rbac/permissions";
import {
  CADENCE_IDS,
  GTM_RHYTHM_WIDGET_IDS,
  RHYTHM_EXCEPTION_LIMIT,
  RHYTHM_WIDGET_DEFS,
  formatScoutExecutiveSummary,
  rhythmPayloadLooksLikePii,
  visibleCadenceIds,
  visibleRhythmWidgetDefs,
} from "../lib/reporting/operating-rhythms";
import { isScoutExternalSendEnabled } from "../lib/scout/execute";
import { parseScoutIntent } from "../lib/scout/parse-intent";

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

describe("Phase K 90-day GTM", () => {
  it("hides the GTM cadence without opportunities.read", () => {
    const recruiter = principalFor("recruiter");
    const partner = principalFor("talent-partner");
    const military = principalFor("military-talent-partner");
    const recruiterIds = visibleRhythmWidgetDefs(recruiter).map((def) => def.id);
    const partnerIds = visibleRhythmWidgetDefs(partner).map((def) => def.id);

    expect(can(recruiter, "opportunities.read")).toBe(false);
    expect(can(recruiter, "companies.read")).toBe(true);
    expect(can(partner, "opportunities.read")).toBe(true);
    expect(visibleCadenceIds(recruiter)).not.toContain("gtm");
    expect(visibleCadenceIds(military)).not.toContain("gtm");
    expect(visibleCadenceIds(partner)).toContain("gtm");
    for (const id of GTM_RHYTHM_WIDGET_IDS) {
      expect(recruiterIds).not.toContain(id);
      expect(partnerIds).toContain(id);
    }
    expect(GTM_RHYTHM_WIDGET_IDS).toEqual(
      expect.arrayContaining([
        "gtm-target-accounts",
        "gtm-open-opportunities",
        "gtm-discovery",
        "gtm-proposals",
        "gtm-win-conversion",
        "gtm-military-employers",
        "gtm-inquiries",
        "gtm-thought-leadership",
        "gtm-overdue-followups",
      ]),
    );
  });

  it("keeps GTM aggregates bounded and free of candidate PII fields", () => {
    expect(RHYTHM_EXCEPTION_LIMIT).toBe(8);
    const gtmDefs = RHYTHM_WIDGET_DEFS.filter((def) => def.cadence === "gtm");
    expect(rhythmPayloadLooksLikePii(gtmDefs)).toBe(false);
    expect(gtmDefs.every((def) => def.commercial)).toBe(true);
    const summary = formatScoutExecutiveSummary([
      {
        id: "gtm",
        title: "GTM",
        summary: "90-day GTM review",
        widgets: [
          {
            id: "gtm-inquiries",
            cadence: "gtm",
            question: "How many website inquiries are still intake (not converted or closed)?",
            value: 2,
            href: "/app/crm/inquiries",
            exceptions: [{ id: "inq-1", title: "Harbor Utilities", meta: "professional search · new", href: "/app/crm/inquiries/inq-1" }],
            provenance: "live_aggregate",
          },
        ],
      },
    ]);
    expect(rhythmPayloadLooksLikePii(summary)).toBe(false);
    expect(summary.message).toMatch(/live PostgreSQL aggregates/);
    expect(summary.links.some((link) => link.href === GTM_CADENCE_HREF)).toBe(true);
    expect(summary.message).not.toMatch(/@|555-|resume\.pdf|\$150,000/);
  });

  it("does not hydrate a full recruiting graph for GTM counts", () => {
    const source = read("lib/reporting/operating-rhythms.ts");
    expect(source).toMatch(/case "gtm"/);
    expect(source).toMatch(/RHYTHM_EXCEPTION_LIMIT/);
    expect(source).toMatch(/select\(\{ value: count\(\) \}\)/);
    expect(source).not.toMatch(/recruitingAnalytics|getSkillBridgeMetrics|listSkillBridgeCards|financeOverview|getExecutiveCommandCenter/);
  });

  it("keeps five launch services only in the written plan", () => {
    expect(existsSync(path.join(root, GTM_PLAN_PATH))).toBe(true);
    const plan = read(GTM_PLAN_PATH);
    for (const code of LAUNCH_SERVICE_CODES) {
      expect(plan).toContain(code);
    }
    expect(GTM_LAUNCH_SERVICE_CODES).toEqual(LAUNCH_SERVICE_CODES);
    expect(GTM_MILITARY_SERVICE_CODE).toBe("military-talent-opportunity-assessment");
    expect(plan).toMatch(/Five launch services only/);
    expect(plan).toMatch(/DEC-WEB-004/);
    expect(plan).toMatch(/DEC-RBAC-001/);
    expect(plan).toMatch(/\/app\?cadence=gtm/);
    expect(plan).toMatch(/Southeast/);
    expect(plan).toMatch(/national recruiting/i);
    expect(plan).toMatch(/Do not sell temp staffing, payroll/);
    expect(plan).toMatch(/Do not invent a sixth launch service/);
    expect(plan).not.toMatch(/Military Talent Specialist/);
    expect(plan).toMatch(/Military Talent Partner/);
    expect(plan).toMatch(/intermediary/);
    expect(GTM_TIERS).toEqual(["tier_1", "tier_2"]);
    expect(GTM_REGIONS).toEqual(["southeast", "national"]);
    expect(GTM_TIER_1_INDUSTRIES.join(" ")).toMatch(/Energy/);
    expect(GTM_TIER_2_INDUSTRIES.join(" ")).toMatch(/Data Centers/);
    expect(GTM_FOCUS_INDUSTRIES).toHaveLength(8);
  });

  it("parses a Scout GTM review as SHOW_DASHBOARD gtm and still rejects SQL", () => {
    const gtm = parseScoutIntent("weekly GTM review", {
      pathname: "/app",
      module: "command_center",
      entityType: null,
      entityId: null,
    });
    expect(gtm.ok).toBe(true);
    if (gtm.ok) {
      expect(gtm.dto.family).toBe("SHOW_DASHBOARD");
      expect(gtm.dto.dashboard).toBe("gtm");
      expect(gtm.dto.entity).toBe("gtm");
    }

    const plan = parseScoutIntent("90-day GTM plan");
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.dto.dashboard).toBe("gtm");

    const sql = parseScoutIntent("SELECT count(*) FROM companies WHERE gtm_tier = 'tier_1'");
    expect(sql.ok).toBe(false);
    if (!sql.ok) expect(sql.code).toBe("sql_rejected");
  });

  it("does not add a GTM nav item and publishes the Academy article", () => {
    const links = navGroupsForPrincipal(principalFor("managing-partner")).flatMap((group) =>
      group.items.map((item) => item.href),
    );
    expect(links.some((href) => href.startsWith("/app?cadence="))).toBe(false);
    expect(CADENCE_IDS).toContain("gtm");

    const article = getAcademyArticle("ninety-day-gtm-review");
    expect(article?.title).toBe("90-day GTM review");
    expect(article?.sources.join(" ")).toMatch(/PIERONE_90_DAY_GTM_PLAN/);
    expect(article?.stepByStep.join(" ")).toMatch(/DEC-RBAC-001/);
    expect(article?.stepByStep.join(" ")).toMatch(/DEC-WEB-004/);
    expect(article?.stepByStep.join(" ")).not.toMatch(/Military Talent Specialist/);
    expect(article?.stepByStep.join(" ")).not.toMatch(/PierOne SkillBridge program/);
    expect(isScoutExternalSendEnabled()).toBe(false);
  });
});
