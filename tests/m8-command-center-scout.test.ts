import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { composeOperationalBoard, type CommandCenterFacts } from "../lib/command-center/compose";
import { careerSourceHonesty } from "../lib/command-center/source-health";
import { ROLE_PERMISSIONS, type Principal } from "../lib/rbac/permissions";
import {
  moreGroupsForPrincipal,
  navGroupsForPrincipal,
  SIDEBAR_TOP_LEVEL_COUNT_BEFORE_M8,
  topLevelNavHrefs,
} from "../components/navigation/nav-config";
import { executeOperationalScoutCommand } from "../lib/scout/operational-execute";
import {
  formatMilitarySupply,
  formatWhyMatch,
  labelPublicOpportunity,
  matchOperationalPrompt,
  OPERATIONAL_COMMANDS,
  operationalCommand,
} from "../lib/scout/operational-commands";
import { parseScoutIntent } from "../lib/scout/parse-intent";

const root = path.resolve(__dirname, "..");

function principalFor(role: keyof typeof ROLE_PERMISSIONS, extras?: Partial<Principal>): Principal {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    status: "active",
    organizationId: "00000000-0000-4000-8000-000000000010",
    roleSlugs: [role],
    permissions: new Set(ROLE_PERMISSIONS[role]),
    ...extras,
  };
}

function facts(partial: Partial<CommandCenterFacts> = {}): CommandCenterFacts {
  return {
    now: new Date("2026-10-22T12:00:00.000Z"),
    engagements: { ok: true, value: [] },
    talent: { ok: true, value: { newMembers: 0, profilesNeedingInformation: 0, waitingBeyondDays: null, withoutWorkflow: 0 } },
    demand: { ok: true, value: { newPublicJobs: 0, changedPublicJobs: 0, requirementReview: 0, openWithoutStrongMatch: 0, staleMatches: 0 } },
    workforce: { ok: true, value: [] },
    reviews: { ok: true, value: { militaryMappings: 0, candidateCapabilities: 0, jobRequirements: 0 } },
    system: { ok: true, value: [] },
    ...partial,
  };
}

describe("M8 command center and scout", () => {
  it("A — recruiter command center links overdue follow-ups", () => {
    const board = composeOperationalBoard(principalFor("recruiter"), facts({
      engagements: { ok: true, value: [{ id: "e1", status: "contacted", buckets: ["overdue"], agingDays: 6, candidateName: "Hidden Person" }] },
    }));
    const attention = board.sections.find((section) => section.id === "needsAttention");
    const overdue = attention?.items.find((item) => item.type === "overdue_follow_ups");
    expect(overdue?.count).toBe(1);
    expect(overdue?.href).toBe("/app/jobs/engagements?bucket=overdue");
    expect(JSON.stringify(board)).not.toContain("Hidden Person");
  });

  it("B — recruiter command center and navigation omit CRM opportunities", () => {
    const board = composeOperationalBoard(principalFor("recruiter"), facts());
    expect(JSON.stringify(board)).not.toContain("/app/opportunities");
    const hrefs = [
      ...topLevelNavHrefs(principalFor("recruiter")),
      ...moreGroupsForPrincipal(principalFor("recruiter")).flatMap((group) => group.items.map((item) => item.href)),
    ];
    expect(hrefs).not.toContain("/app/opportunities");
  });

  it("C — workforce planner sees critical roles", () => {
    const board = composeOperationalBoard(principalFor("workforce-consultant"), facts({
      workforce: {
        ok: true,
        value: [{ id: "role-1", title: "Electrical Technician", health: "critical", quantityGap: 4, knownSupply: 1, demandQuantity: 8, activePipeline: 0 }],
      },
    }));
    expect(board.sections[0]?.id).toBe("workforce");
    const critical = board.sections.find((section) => section.id === "workforce")?.items.find((item) => item.type === "critical_roles");
    expect(critical?.href).toBe("/app/workforce?health=critical");
    expect(critical?.detail).toMatch(/Electrical Technician/);
    expect(critical?.detail).toMatch(/Derived WorkforceOS calculation/);
  });

  it("D — planner without candidates.read sees workforce aggregates and not candidate names", () => {
    const board = composeOperationalBoard(principalFor("workforce-consulting"), facts({
      engagements: { ok: true, value: [{ id: "e1", status: "contacted", buckets: ["overdue"], agingDays: 9, candidateName: "Secret Person" }] },
      workforce: {
        ok: true,
        value: [{ id: "role-1", title: "Plant Electrician", health: "gap", quantityGap: 2, knownSupply: 3, demandQuantity: 5, activePipeline: 1 }],
      },
    }));
    expect(board.sections.some((section) => section.id === "workforce")).toBe(true);
    expect(board.sections.some((section) => section.id === "talent")).toBe(false);
    expect(JSON.stringify(board)).not.toContain("Secret Person");
    expect(JSON.stringify(board)).toContain("Plant Electrician");
  });

  it("E — military reviewer sees pending military review work", () => {
    const board = composeOperationalBoard(principalFor("military-talent-partner"), facts({
      reviews: { ok: true, value: { militaryMappings: 4, candidateCapabilities: 3, jobRequirements: 6 } },
    }));
    const attention = board.sections.find((section) => section.id === "needsAttention");
    expect(attention?.items.some((item) => item.href === "/app/military/review" && item.count === 4)).toBe(true);
    expect(board.sections[1]?.id).toBe("talent");
  });

  it("distinguishes an empty attention list from a failed query", () => {
    const empty = composeOperationalBoard(principalFor("recruiter"), facts());
    expect(empty.sections.find((section) => section.id === "needsAttention")?.status).toBe("empty");
    const failed = composeOperationalBoard(principalFor("recruiter"), facts({ engagements: { ok: false, error: "database unavailable" }, reviews: null }));
    const attention = failed.sections.find((section) => section.id === "needsAttention");
    expect(attention?.status).toBe("error");
    expect(attention?.items).toEqual([]);
    expect(attention?.error).toMatch(/database unavailable/);
  });

  it("does not call a live career source LIVE without a successful sync", () => {
    expect(careerSourceHonesty("live", null)).toBe("NOT CONFIGURED");
    expect(careerSourceHonesty("live", new Date())).toBe("LIVE");
    expect(careerSourceHonesty("error", null)).toBe("ERROR");
    expect(careerSourceHonesty("manual", null)).toBe("MANUAL");
    expect(careerSourceHonesty("blocked", null)).toBe("DEGRADED");
    expect(careerSourceHonesty("not_yet_synced", null)).toBe("NOT CONFIGURED");
  });

  it("F — strips candidate email and phone without candidate_pii.read", async () => {
    const result = await executeOperationalScoutCommand({
      principal: principalFor("read-only"),
      dto: { family: "SEARCH", commandId: "talent.by_capability", skill: "Electrical Troubleshooting" },
      ports: {
        searchBySkill: async () => [{ id: "c1", name: "Michael Carter", skill: "Electrical Troubleshooting", email: "secret@example.com", phone: "555-0100" } as { id: string; name: string; skill: string }],
      },
    });
    expect(JSON.stringify(result)).not.toContain("secret@example.com");
    expect(JSON.stringify(result)).not.toContain("555-0100");
    expect(result.cards[0]?.title).toBe("Michael Carter");
  });

  it("G — why match returns the stored M5 explanation", async () => {
    const result = await executeOperationalScoutCommand({
      principal: principalFor("recruiter"),
      dto: { family: "SHOW_RECORD", commandId: "match.explain", subjectName: "Michael Carter", objectName: "Plant Electrician" },
      ports: {
        resolve: async () => [{ id: "cand-1", label: "Michael Carter", href: "/app/talent/cand-1" }],
        candidateMatches: async () => [{
          matchId: "m1",
          candidateId: "cand-1",
          candidateName: "Michael Carter",
          jobId: "job-1",
          jobTitle: "Plant Electrician",
          companyName: "Harbor",
          locationLabel: null,
          contextLabel: "Client job",
          contextType: "client",
          skillbridgeEligible: false,
          sourceUrl: null,
          jobStatus: "open",
          category: "possible_match",
          categoryLabel: "Possible Match",
          freshness: "current",
          explanation: "Stored explanation: two required capabilities align.",
          aligned: ["Electrical Troubleshooting"],
          gaps: ["Clearance unknown"],
          evidence: ["Navy tour"],
          lastEvaluatedAt: "2026-10-22T18:00:00.000Z",
          disposition: null,
          military: { branch: "navy", occupation: "EM", timing: "available 2026-11-01" },
        }],
      },
    });
    expect(result.message).toContain("Stored M5 explanation");
    expect(result.message).toContain("Possible Match");
    expect(result.message).toContain("Electrical Troubleshooting");
    expect(result.message).toContain("Clearance unknown");
    expect(result.message).toContain("Stored explanation: two required capabilities align.");
    expect(result.message).not.toMatch(/I think|likely a great fit/);
  });

  it("H and I — candidate and job queries use canonical match ports", async () => {
    const candidate = await executeOperationalScoutCommand({
      principal: principalFor("recruiter"),
      dto: { family: "FIND_MATCHES", commandId: "match.candidate_opportunities", subjectName: "Michael Carter" },
      ports: {
        resolve: async () => [{ id: "cand-1", label: "Michael Carter", href: "/app/talent/cand-1" }],
        candidateMatches: async () => [{
          matchId: "m1",
          candidateId: "cand-1",
          candidateName: "Michael Carter",
          jobId: "job-public",
          jobTitle: "Utility Electrician",
          companyName: null,
          locationLabel: null,
          contextLabel: "Public opportunity",
          contextType: "monitored_public",
          skillbridgeEligible: false,
          sourceUrl: "https://example.com/job",
          jobStatus: "open",
          category: "strong_match",
          categoryLabel: "Strong Match",
          freshness: "current",
          explanation: "stored",
          aligned: [],
          gaps: [],
          evidence: [],
          lastEvaluatedAt: null,
          disposition: null,
          military: null,
        }],
      },
    });
    expect(candidate.cards[0]?.meta).toContain("Public opportunity");
    expect(candidate.message).toMatch(/No new Scout score/);

    const job = await executeOperationalScoutCommand({
      principal: principalFor("recruiter"),
      dto: { family: "FIND_MATCHES", commandId: "match.job_candidates", objectName: "Plant Electrician" },
      ports: {
        resolve: async () => [{ id: "job-1", label: "Plant Electrician", href: "/app/jobs/job-1" }],
        jobMatches: async () => [{
          matchId: "m2",
          candidateId: "cand-1",
          candidateName: "Michael Carter",
          jobId: "job-1",
          jobTitle: "Plant Electrician",
          companyName: null,
          locationLabel: null,
          contextLabel: "Client job",
          contextType: "client",
          skillbridgeEligible: false,
          sourceUrl: null,
          jobStatus: "open",
          category: "strong_match",
          categoryLabel: "Strong Match",
          freshness: "current",
          explanation: "stored",
          aligned: [],
          gaps: [],
          evidence: [],
          lastEvaluatedAt: null,
          disposition: null,
          military: null,
        }],
      },
    });
    expect(job.cards[0]?.title).toBe("Michael Carter");
    expect(job.message).toMatch(/does not submit or reject/);
  });

  it("J — waiting more than 5 days uses M6 aging", async () => {
    const result = await executeOperationalScoutCommand({
      principal: principalFor("recruiter"),
      now: new Date("2026-10-22T12:00:00.000Z"),
      dto: { family: "SEARCH", commandId: "talent.waiting_over_days", waitingDays: 5 },
      ports: {
        queue: async () => [
          queueRow({ id: "old", agingDays: 6, candidateName: "Older" }),
          queueRow({ id: "new", agingDays: 5, candidateName: "Newer" }),
        ] as never,
      },
    });
    expect(result.cards.map((card) => card.id)).toEqual(["old"]);
    expect(result.message).toMatch(/M6/);
  });

  it("K and L — workforce gaps and occupation channels stay distinct from people", async () => {
    const gaps = await executeOperationalScoutCommand({
      principal: principalFor("workforce-consultant"),
      dto: { family: "SHOW_DASHBOARD", commandId: "workforce.largest_gaps" },
      ports: {
        portfolio: async () => ({
          calculatedAt: "2026-10-22T12:00:00.000Z",
          families: [],
          unlinkedRoles: [],
          roles: [
            { id: "r1", title: "Electrical Technician", demandQuantity: 8, demandHorizon: "future", knownSupply: 1, militarySupply: 1, nonMilitarySupply: 0, quantityGap: 7, activePipeline: 0, placements: 0, health: "critical", currentOpenings: 0, jobFamilyName: null },
            { id: "r2", title: "Filled Role", demandQuantity: 1, demandHorizon: "future", knownSupply: 2, militarySupply: 0, nonMilitarySupply: 2, quantityGap: 0, activePipeline: 1, placements: 0, health: "healthy", currentOpenings: 0, jobFamilyName: null },
          ],
        }) as never,
      },
    });
    expect(gaps.cards.map((card) => card.title)).toEqual(["Electrical Technician"]);
    expect(gaps.message).toMatch(/not included/);

    const text = formatMilitarySupply({
      knownSupply: 4,
      militarySupply: 3,
      nonMilitarySupply: 1,
      channels: [{ code: "EM", title: "Electrician's Mate" }, { code: "CE", title: "Construction Electrician" }],
      asOf: "2026-10-22T12:00:00.000Z",
      roleTitle: "Electrical Technician",
    });
    expect(text).toContain("Known supply is 4 stored people");
    expect(text).toContain("EM Electrician's Mate");
    expect(text).toMatch(/not people/);
    expect(text).not.toMatch(/2 candidates/);
  });

  it("M and N — SQL and unknown commands are rejected", () => {
    const sql = parseScoutIntent("SELECT count(*) FROM candidates");
    expect(sql.ok).toBe(false);
    if (!sql.ok) expect(sql.code).toBe("sql_rejected");
    const unknown = parseScoutIntent("RUN_THIS_NOW");
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.code).toBe("unknown_command");
    expect(operationalCommand("drop_table")).toBeNull();
  });

  it("O — missing permission rejects the command before the port runs", async () => {
    let called = false;
    const result = await executeOperationalScoutCommand({
      principal: principalFor("recruiter"),
      dto: { family: "SEARCH", commandId: "demand.crm_pursuits" },
      ports: { crm: async () => { called = true; return []; } },
    });
    expect(called).toBe(false);
    expect(result.message).toMatch(/Missing permission: opportunities.read/);
    expect(result.cards).toEqual([]);
  });

  it("P and Q — a controlled write requires confirmation and then calls the canonical service", async () => {
    let calls = 0;
    const rejected = await executeOperationalScoutCommand({
      principal: principalFor("recruiter"),
      dto: { family: "CREATE_FOLLOW_UP", commandId: "ops.set_follow_up", engagementId: "00000000-0000-4000-8000-000000000099" },
      confirmed: false,
      ports: { setFollowUp: async () => { calls += 1; return {} as never; } },
    });
    expect(calls).toBe(0);
    expect(rejected.message).toMatch(/confirmation/i);

    const accepted = await executeOperationalScoutCommand({
      principal: principalFor("recruiter"),
      confirmed: true,
      dto: { family: "CREATE_FOLLOW_UP", commandId: "ops.set_follow_up", engagementId: "00000000-0000-4000-8000-000000000099" },
      ports: { setFollowUp: async () => { calls += 1; return {} as never; } },
    });
    expect(calls).toBe(1);
    expect(accepted.message).toMatch(/setEngagementFollowUp/);
    expect(OPERATIONAL_COMMANDS["ops.set_follow_up"].confirm).toBe(true);
    expect(OPERATIONAL_COMMANDS["ops.set_follow_up"].audit).toBe(true);
  });

  it("R — Scout hands external sends back to M6", async () => {
    const parsed = parseScoutIntent("Email the employer about Michael Carter");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.dto.commandId).toBe("ops.m6_handoff");
    const result = await executeOperationalScoutCommand({
      principal: principalFor("recruiter"),
      dto: { family: "SHOW_RECORD", commandId: "ops.m6_handoff" },
    });
    expect(result.message).toMatch(/cannot email/);
    expect(result.links[0]?.href).toBe("/app/jobs/engagements");
    const source = await import("node:fs").then((fs) => fs.readFileSync(path.join(root, "lib/scout/operational-execute.ts"), "utf8"));
    expect(source).not.toMatch(/confirmExternalSend|startEmployerOutreach|markSentManually|recordFormalSubmission/);
  });

  it("S and T — public jobs and CRM pursuits stay distinct", () => {
    expect(labelPublicOpportunity("monitored_public")).toBe("Public opportunity");
    const discovered = parseScoutIntent("What public opportunities were discovered recently?");
    expect(discovered.ok).toBe(true);
    if (discovered.ok) {
      expect(discovered.dto.commandId).toBe("demand.recent_public");
      expect(discovered.dto.entity).not.toBe("opportunities");
    }
    const crm = parseScoutIntent("Show CRM opportunities");
    expect(crm.ok).toBe(true);
    if (crm.ok) {
      expect(crm.dto.commandId).toBe("demand.crm_pursuits");
      expect(crm.dto.entity).toBe("opportunities");
    }
    const empty = formatWhyMatch(null, "2026-10-22T12:00:00.000Z");
    expect(empty).toMatch(/will not invent/);
  });

  it("returns options when several entities match", async () => {
    const result = await executeOperationalScoutCommand({
      principal: principalFor("recruiter"),
      dto: { family: "SHOW_RECORD", commandId: "match.explain", subjectName: "Michael", objectName: "Electrician" },
      ports: {
        resolve: async () => [
          { id: "c1", label: "Michael Carter", href: "/app/talent/c1" },
          { id: "c2", label: "Michael Nguyen", href: "/app/talent/c2" },
        ],
        candidateMatches: async () => { throw new Error("should not guess"); },
      },
    });
    expect(result.message).toMatch(/will not guess/);
    expect(result.links).toHaveLength(2);
  });

  it("U and V — legacy routes remain and the sidebar is smaller", () => {
    for (const route of [
      "app/(internal)/app/military/crosswalk/page.tsx",
      "app/(internal)/app/military/reverse/page.tsx",
      "app/(internal)/app/military/translator/page.tsx",
      "app/(internal)/app/military/candidates/page.tsx",
      "app/(internal)/app/jobs/page.tsx",
      "app/(internal)/app/opportunities/page.tsx",
      "app/(internal)/app/talent/[id]/page.tsx",
    ]) {
      expect(existsSync(path.join(root, route))).toBe(true);
    }
    const before = SIDEBAR_TOP_LEVEL_COUNT_BEFORE_M8;
    const after = topLevelNavHrefs(principalFor("managing-partner")).length;
    expect(before).toBe(56);
    expect(after).toBeLessThan(before / 2);
    expect(navGroupsForPrincipal(principalFor("managing-partner")).flatMap((group) => group.items).some((item) => item.label === "Scout")).toBe(true);
  });

  it("W — phone, tablet, and desktop navigation stay in the shell", async () => {
    const shell = await import("node:fs").then((fs) => fs.readFileSync(path.join(root, "components/layout/app-shell.tsx"), "utf8"));
    const bar = await import("node:fs").then((fs) => fs.readFileSync(path.join(root, "components/layout/top-bar.tsx"), "utf8"));
    expect(shell).toMatch(/lg:block/);
    expect(shell).toMatch(/md:block lg:hidden/);
    expect(bar).toMatch(/md:hidden/);
    expect(shell).toMatch(/aria-label="Close navigation"/);
  });

  it("parses the founder questions onto closed command ids", () => {
    const prompts: Array<[string, string]> = [
      ["Show candidates with Electrical Troubleshooting.", "talent.by_capability"],
      ["Which transitioning military candidates have no active opportunity workflow?", "talent.without_workflow"],
      ["Which candidates are waiting more than 5 days?", "talent.waiting_over_days"],
      ["Why does Michael Carter match Plant Electrician?", "match.explain"],
      ["Show the strongest opportunities for Michael Carter.", "match.candidate_opportunities"],
      ["Who matches Plant Electrician?", "match.job_candidates"],
      ["Which open jobs have strong matches but no engagement?", "demand.strong_without_engagement"],
      ["Which jobs need requirement review?", "demand.requirement_review"],
      ["Show overdue employer follow-ups.", "ops.overdue_follow_ups"],
      ["Which referrals still need routing?", "ops.referrals_need_routing"],
      ["Which No Fit candidates need another opportunity?", "ops.no_fit_needs_path"],
      ["Which interviews need a next step?", "ops.interviews_need_next"],
      ["Where are our largest workforce gaps?", "workforce.largest_gaps"],
      ["Which workforce roles are critical?", "workforce.critical_roles"],
      ["What capabilities are scarce?", "workforce.scarce_capabilities"],
      ["How much known military supply do we have for this workforce role?", "workforce.military_supply"],
      ["Which military occupation channels could support this workforce role?", "workforce.occupation_channels"],
    ];
    for (const [prompt, id] of prompts) {
      const parsed = parseScoutIntent(prompt);
      expect(parsed.ok, prompt).toBe(true);
      if (parsed.ok) expect(parsed.dto.commandId, prompt).toBe(id);
    }
    expect(matchOperationalPrompt("weekly operating review")).toBeNull();
  });
});

function queueRow(input: { id: string; agingDays: number; candidateName: string }) {
  return {
    id: input.id,
    candidateId: input.id,
    jobId: "job-1",
    candidateName: input.candidateName,
    jobTitle: "Plant Electrician",
    status: "contacted",
    waitingOn: "employer",
    agingDays: input.agingDays,
    buckets: [],
    jobContextType: "client",
    contextLabel: "Client job",
    publicLabel: null,
  };
}
