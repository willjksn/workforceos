import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getAcademyArticle } from "../lib/academy/catalog";
import { navGroupsForPrincipal } from "../components/navigation/nav-config";
import { ROLE_PERMISSIONS, can, type Principal } from "../lib/rbac/permissions";
import {
  CADENCE_IDS,
  COMMERCIAL_RHYTHM_WIDGET_IDS,
  RHYTHM_EXCEPTION_LIMIT,
  RHYTHM_WIDGET_DEFS,
  SKILLBRIDGE_WINDOW_DAYS,
  STALE_RECORD_DAYS,
  formatScoutExecutiveSummary,
  rhythmCtaLabel,
  rhythmPayloadLooksLikePii,
  visibleCadenceIds,
  visibleRhythmWidgetDefs,
} from "../lib/reporting/operating-rhythms";
import { parseScoutIntent } from "../lib/scout/parse-intent";
import { isScoutExternalSendEnabled } from "../lib/scout/execute";

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

describe("Phase J management operating rhythms", () => {
  it("gates commercial pipeline from Recruiter and shows it to Talent Partner", () => {
    const recruiter = principalFor("recruiter");
    const partner = principalFor("talent-partner");
    const recruiterIds = visibleRhythmWidgetDefs(recruiter).map((def) => def.id);
    const partnerIds = visibleRhythmWidgetDefs(partner).map((def) => def.id);

    expect(can(recruiter, "opportunities.read")).toBe(false);
    expect(can(partner, "opportunities.read")).toBe(true);
    expect(COMMERCIAL_RHYTHM_WIDGET_IDS).toEqual(expect.arrayContaining(["weekly-pipeline", "open-proposals"]));
    expect(recruiterIds).not.toContain("weekly-pipeline");
    expect(recruiterIds).not.toContain("open-proposals");
    expect(partnerIds).toContain("weekly-pipeline");
    expect(partnerIds).toContain("open-proposals");
    expect(visibleCadenceIds(recruiter)).not.toContain("finance");
    expect(visibleCadenceIds(partner)).toContain("finance");
  });

  it("hides finance cadence without finance.read and keeps Military Talent Partner off commercial spine", () => {
    const military = principalFor("military-talent-partner");
    const financeOps = principalFor("operations-administrator");
    const militaryIds = visibleRhythmWidgetDefs(military).map((def) => def.id);
    const financeIds = visibleRhythmWidgetDefs(financeOps).map((def) => def.id);

    expect(can(military, "finance.read")).toBe(false);
    expect(can(military, "opportunities.read")).toBe(false);
    expect(can(financeOps, "finance.read")).toBe(true);
    expect(visibleCadenceIds(military)).toContain("military");
    expect(visibleCadenceIds(military)).not.toContain("finance");
    expect(militaryIds).not.toContain("weekly-pipeline");
    expect(militaryIds).not.toContain("invoices");
    expect(financeIds).toContain("invoices");
    expect(financeIds).toContain("ar-aging");
    expect(financeIds).toContain("expected-revenue");
  });

  it("keeps aggregates free of candidate PII fields and bounds exception lists", () => {
    expect(RHYTHM_EXCEPTION_LIMIT).toBe(8);
    expect(rhythmPayloadLooksLikePii(RHYTHM_WIDGET_DEFS)).toBe(false);
    const summary = formatScoutExecutiveSummary([
      {
        id: "talent",
        title: "Talent",
        summary: "Jobs and candidates",
        widgets: [
          {
            id: "jobs",
            cadence: "talent",
            question: "How many jobs are open or in active search?",
            value: 4,
            href: "/app/jobs",
            exceptions: [{ id: "job-1", title: "Plant electrician", meta: "open", href: "/app/jobs/job-1" }],
            provenance: "live_aggregate",
          },
        ],
      },
    ]);
    expect(rhythmPayloadLooksLikePii(summary)).toBe(false);
    expect(summary.message).toMatch(/live PostgreSQL aggregates/);
    expect(summary.message).not.toMatch(/@|555-|resume\.pdf|\$150,000/);
  });

  it("does not hydrate a full recruiting graph for cadence counts", () => {
    const source = read("lib/reporting/operating-rhythms.ts");
    expect(source).toMatch(/select\(\{ value: count\(\) \}\)/);
    expect(source).toMatch(/RHYTHM_EXCEPTION_LIMIT/);
    expect(source).not.toMatch(/recruitingAnalytics|getSkillBridgeMetrics|listSkillBridgeCards|financeOverview|getExecutiveCommandCenter/);
    expect(source).not.toMatch(/getWorkforceCommandSnapshot|engagementEconomics/);
    expect(read("app/(internal)/app/page.tsx")).toMatch(/getOperatingRhythmBoards\(principal, \{ cadence \}\)/);
  });

  it("uses intermediary Military Talent copy and reused SkillBridge windows", () => {
    const article = getAcademyArticle("weekly-operating-review");
    const corpus = [
      ...RHYTHM_WIDGET_DEFS.map((def) => `${def.question} ${def.windowHint ?? ""}`),
      article?.title,
      article?.summary,
      article?.stepByStep.join(" "),
      read("lib/reporting/operating-rhythms.ts"),
      read("app/(internal)/app/page.tsx"),
    ].join("\n");
    expect(corpus).toMatch(/Military Talent/);
    expect(corpus).toMatch(/SkillBridge pathway|pathway type|SkillBridge alert constant/);
    expect(corpus).not.toMatch(/PierOne SkillBridge program/);
    expect(corpus).not.toMatch(/Military Talent Specialist/);
    expect(`${article?.stepByStep.join(" ")} ${article?.commonMistakes.join(" ")}`).toMatch(
      /pathway type|intermediary|PierOne-owned/,
    );
    expect(SKILLBRIDGE_WINDOW_DAYS).toBe(90);
    expect(STALE_RECORD_DAYS).toBe(14);
  });

  it("uses operator cadence copy and named screen CTAs", () => {
    const hints = RHYTHM_WIDGET_DEFS.map((def) => `${def.question} ${def.windowHint ?? ""}`).join("\n");
    expect(hints).not.toMatch(/DEC-[A-Z]+-\d+/);
    expect(hints).not.toMatch(
      /created_at|last_activity_at|updated_at|last_contacted_at|started_at|next_action_at|follow_up_at|window_approaching|conversion_pending/,
    );
    expect(hints).not.toMatch(/companies\.gtm_tier/);
    expect(rhythmCtaLabel("/app/opportunities")).toBe("Open Opportunities");
    expect(rhythmCtaLabel("/app/military/skillbridge?view=windows")).toBe("Open Pathway operations");
    expect(rhythmCtaLabel("/app/projects/deliverables")).toBe("Open Deliverables");
    expect(RHYTHM_WIDGET_DEFS.every((def) => rhythmCtaLabel(def.href) !== "Open linked screen")).toBe(true);

    const page = read("app/(internal)/app/page.tsx");
    expect(page).toMatch(/href="\/app\/finance\/payments"/);
    expect(page).toMatch(/Talent pools/);
    expect(page).toMatch(/No employer\/host opportunity/);
    expect(page).toMatch(/SkillBridge pathway active/);
    expect(page).not.toMatch(/AI & Automation/);
    expect(page).not.toMatch(/\/app\/ai-operations/);
    expect(page).toMatch(/alert\.domain !== "ai"/);
    expect(page).not.toMatch(/href="\/app\/admin\/approvals"/);
    expect(read("lib/hiring/service.ts")).toMatch(/isNull\(applications\.archivedAt\)/);
    expect(read("app/(internal)/app/admin/approvals/page.tsx")).toMatch(/requirePlatformAdmin/);
    expect(read("lib/skillbridge/rules.ts")).toMatch(/must not abort the request/);
    expect(read("lib/skillbridge/rules.ts")).not.toMatch(/getSkillBridgeAlertRules[\s\S]{0,80}ensureSkillBridgeAlertRules/);
    expect(can(principalFor("recruiter"), "opportunities.read")).toBe(false);
  });

  it("parses a Scout executive summary as SHOW_DASHBOARD command_center", () => {
    const weekly = parseScoutIntent("weekly operating review", {
      pathname: "/app",
      module: "command_center",
      entityType: null,
      entityId: null,
    });
    expect(weekly.ok).toBe(true);
    if (weekly.ok) {
      expect(weekly.dto.family).toBe("SHOW_DASHBOARD");
      expect(weekly.dto.dashboard).toBe("command_center");
      expect(weekly.dto.entity).toBe("command_center");
    }

    const sql = parseScoutIntent("SELECT count(*) FROM opportunities");
    expect(sql.ok).toBe(false);
    if (!sql.ok) expect(sql.code).toBe("sql_rejected");

    const daily = parseScoutIntent("today's priorities");
    expect(daily.ok).toBe(true);
    if (daily.ok) expect(daily.dto.dashboard).toBe("daily_brief");
  });

  it("does not add five cadence destinations to the sidebar", () => {
    const links = navGroupsForPrincipal(principalFor("managing-partner")).flatMap((group) =>
      group.items.map((item) => item.href),
    );
    expect(links.filter((href) => href === "/app")).toHaveLength(1);
    expect(links.some((href) => href.startsWith("/app?cadence="))).toBe(false);
    expect(CADENCE_IDS).toEqual(["leadership", "operations", "talent", "military", "finance", "gtm"]);
  });

  it("publishes the Academy article and keeps Scout send denied", () => {
    expect(existsSync(path.join(root, "app/(internal)/app/page.tsx"))).toBe(true);
    const article = getAcademyArticle("weekly-operating-review");
    expect(article?.title).toBe("Weekly operating review");
    expect(article?.stepByStep.join(" ")).toMatch(/DEC-RBAC-001/);
    expect(article?.stepByStep.join(" ")).not.toMatch(/PierOne SkillBridge program/);
    expect(isScoutExternalSendEnabled()).toBe(false);
  });
});
