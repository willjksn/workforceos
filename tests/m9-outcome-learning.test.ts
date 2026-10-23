import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { analyzeOutcomes, programFunnelSentence, type MatchCountRow, type RecommendationDraft } from "../lib/outcome-learning/analyze";
import { advisoryTextAllowed } from "../lib/outcome-learning/guardrails";
import { ADVISORY_BOUNDARY, evidenceBand, formatCount } from "../lib/outcome-learning/thresholds";
import {
  categoryAfterLearning,
  classifyOutcome,
  contextBucket,
  countsAsEmployerRejection,
  countsAsPoorMatch,
  programBucket,
  type OutcomeInput,
} from "../lib/outcome-learning/vocabulary";
import { MATCH_WEIGHTS } from "../lib/recruiting/opportunity-match";
import { externalDeliveryPlan } from "../lib/recruiting/engagement-policy";
import { ROLE_PERMISSIONS, type Principal } from "../lib/rbac/permissions";
import { executeOperationalScoutCommand } from "../lib/scout/operational-execute";
import { matchOperationalPrompt, OPERATIONAL_COMMANDS } from "../lib/scout/operational-commands";
import { parseScoutIntent } from "../lib/scout/parse-intent";
import type { OutcomeReport } from "../lib/outcome-learning/load";

const root = path.resolve(__dirname, "..");

function blank(partial: Partial<OutcomeInput> = {}): OutcomeInput {
  return {
    engagementStatus: null,
    employerResponse: null,
    candidateResponse: null,
    recruiterDisposition: null,
    hasEngagement: false,
    interviewId: null,
    interviewStatus: null,
    placementId: null,
    ...partial,
  };
}

function row(partial: Partial<MatchCountRow> & Pick<MatchCountRow, "matchCategory" | "outcome" | "matches">): MatchCountRow {
  return {
    context: "client_routing",
    program: "other",
    jobFamily: "Instrumentation & Controls",
    companyId: "company-1",
    companyName: "Harbor Instruments",
    engagements: 0,
    interviews: 0,
    placements: 0,
    viable: partial.matches,
    interested: 0,
    responded: 0,
    followUpTracked: 0,
    followUpOverdue: 0,
    ...partial,
  };
}

function reportFrom(partial: Parameters<typeof analyzeOutcomes>[0]): OutcomeReport {
  const analysis = analyzeOutcomes(partial);
  return {
    ...analysis,
    asOf: "2026-10-22T12:00:00.000Z",
    window: "90d",
    windowLabel: "the last 90 days",
    windowStart: "2026-07-24T12:00:00.000Z",
    windowEnd: "2026-10-22T12:00:00.000Z",
    caveat: "Observed outcomes are not causal.",
    directQuery: true,
  };
}

function principal(permissions: string[]): Principal {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    status: "active",
    organizationId: "00000000-0000-4000-8000-000000000010",
    roleSlugs: ["recruiter"],
    permissions: new Set(permissions),
  };
}

describe("M9 outcome learning", () => {
  it("classifies outcomes without collapsing distinct negatives", () => {
    expect(classifyOutcome(blank({ engagementStatus: "placed", placementId: "p1", interviewId: "i1" }))).toBe("placement");
    expect(classifyOutcome(blank({ engagementStatus: "interview", hasEngagement: true }))).toBe("interview");
    expect(classifyOutcome(blank({ employerResponse: "interested", engagementStatus: "interested", hasEngagement: true }))).toBe("employer_interested");
    expect(classifyOutcome(blank({ employerResponse: "no_response", engagementStatus: "contacted", hasEngagement: true }))).toBe("no_response");
    expect(countsAsEmployerRejection("no_response")).toBe(false);
    expect(classifyOutcome(blank({ candidateResponse: "declined", engagementStatus: "withdrawn", hasEngagement: true }))).toBe("candidate_declined");
    expect(countsAsPoorMatch("candidate_declined")).toBe(false);
    expect(countsAsPoorMatch("employer_not_a_fit")).toBe(true);
    expect(classifyOutcome(blank({ employerResponse: "not_a_fit", engagementStatus: "no_fit", hasEngagement: true }))).toBe("employer_not_a_fit");
    expect(categoryAfterLearning("strong_match")).toBe("strong_match");
    expect(classifyOutcome(blank({ recruiterDisposition: "not_viable" }))).toBe("recruiter_not_viable");
    expect(contextBucket({ mode: "public_outreach", jobContextType: "monitored_public" })).toBe("public_outreach");
    expect(contextBucket({ mode: "authorized_routing", jobContextType: "client" })).toBe("client_routing");
    expect(programBucket("veteran")).toBe("military");
    expect(programBucket("none")).toBe("other");
    expect(programBucket("unknown")).toBe("not_recorded");
  });

  it("A–H — match performance keeps categories, contexts, and outcomes apart", () => {
    const analysis = analyzeOutcomes({
      windowLabel: "the last 90 days",
      matches: [
        row({ matchCategory: "strong_match", outcome: "interview", matches: 7, engagements: 7, interviews: 7, interested: 4 }),
        row({ matchCategory: "strong_match", outcome: "no_engagement", matches: 11, engagements: 0 }),
        row({ matchCategory: "possible_match", outcome: "employer_interested", matches: 3, engagements: 3, interested: 3 }),
        row({ matchCategory: "strong_match", outcome: "no_response", matches: 4, engagements: 4, responded: 4, context: "public_outreach" }),
        row({ matchCategory: "strong_match", outcome: "candidate_declined", matches: 2, engagements: 2 }),
        row({ matchCategory: "strong_match", outcome: "placement", matches: 1, engagements: 1, placements: 1 }),
        row({ matchCategory: "strong_match", outcome: "employer_not_a_fit", matches: 2, engagements: 2 }),
      ],
      factors: [],
      capabilities: [],
      mappings: [],
      requirements: [],
      timing: [],
    });
    const strong = analysis.matchPerformance.find((item) => item.category === "strong_match" && item.context === "client_routing");
    const possible = analysis.matchPerformance.find((item) => item.category === "possible_match" && item.context === "client_routing");
    const publicStrong = analysis.matchPerformance.find((item) => item.category === "strong_match" && item.context === "public_outreach");
    expect(strong?.sample).toBe(23);
    expect(strong?.interview).toEqual({ numerator: 7, denominator: 23, text: formatCount(7, 23) });
    expect(strong?.placement.text).toBe("1 of 23 (4%)");
    expect(strong?.noResponse.numerator).toBe(0);
    expect(strong?.candidateDeclined.numerator).toBe(2);
    expect(strong?.noFit.numerator).toBe(2);
    expect(possible?.sample).toBe(3);
    expect(possible?.interest.numerator).toBe(3);
    expect(publicStrong?.sample).toBe(4);
    expect(publicStrong?.noResponse.numerator).toBe(4);
    expect(analysis.funnels.filter((item) => item.program === "all" && item.jobFamily === "All reviewed families").map((item) => item.context).sort())
      .toEqual(["client_routing", "public_outreach"]);
    expect(JSON.stringify(analysis)).not.toMatch(/email|phone|compensationExpectations/);
  });

  it("N and O — sample thresholds gate signals and recommendations carry provenance", () => {
    expect(evidenceBand(4)).toBe("insufficient");
    expect(evidenceBand(5)).toBe("early_signal");
    expect(evidenceBand(20)).toBe("operational_pattern");
    const small = analyzeOutcomes({
      windowLabel: "the last 90 days",
      matches: [row({ matchCategory: "developmental_match", outcome: "no_engagement", matches: 2 })],
      factors: [{
        label: "PLC Programming",
        dimension: "capability",
        group: "documented_gap",
        outcome: "employer_not_a_fit",
        jobFamily: "Instrumentation & Controls",
        matches: 2,
      }],
      capabilities: [],
      mappings: [],
      requirements: [],
      timing: [],
    });
    expect(small.factorSignals).toHaveLength(0);
    expect(small.withheldFactorLabels).toBe(1);
    expect(small.matchPerformance[0]?.band).toBe("insufficient");
    expect(small.recommendations.some((item) => item.recommendationType === "INSUFFICIENT_DATA" && item.sampleCount === 2)).toBe(true);

    const signaled = analyzeOutcomes({
      windowLabel: "the last 90 days",
      matches: [row({ matchCategory: "strong_match", outcome: "employer_not_a_fit", matches: 10, engagements: 10 })],
      factors: [{
        label: "PLC Programming",
        dimension: "capability",
        group: "documented_gap",
        outcome: "employer_not_a_fit",
        jobFamily: "Instrumentation & Controls",
        matches: 6,
      }],
      capabilities: [{ skillName: "Electrical Troubleshooting", matches: 8, engagements: 8, interviews: 3, placements: 1, noFit: 4 }],
      mappings: [{
        mappingId: "map-1",
        occupationCode: "EM",
        occupationTitle: "Electrician's Mate",
        skillName: "Electrical Troubleshooting",
        reviewStatus: "pending",
        candidates: 8,
        matches: 8,
        interviews: 3,
        placements: 1,
        noFit: 6,
      }],
      requirements: [{
        requirementId: "req-1",
        jobId: "job-1",
        kind: "license",
        label: "State electrician license",
        reviewStatus: "approved",
        gapNoFit: 6,
        alignedPlacements: 1,
        noFitOnJob: 10,
      }],
      timing: [],
      roles: [{
        id: "role-1",
        title: "Instrumentation Technician",
        jobFamilyName: "Instrumentation & Controls",
        demandQuantity: 12,
        knownSupply: 4,
        activePipeline: 2,
      }],
    });
    const gap = signaled.factorSignals.find((item) => item.label === "PLC Programming");
    expect(gap?.text).toMatch(/6 of 10/);
    expect(gap?.denominator).toBe(10);
    expect(signaled.capabilitySignals[0]?.skillName).toBe("Electrical Troubleshooting");
    expect(signaled.capabilitySignals[0]?.note).toMatch(/not evidence the capability is wrong/);
    expect(signaled.mappingSignals[0]?.reviewStatus).toBe("pending");
    expect(signaled.workforceFeedback[0]?.knownSupply).toBe(4);
    const stored = signaled.recommendations.find((item) => item.recommendationType === "REVIEW_MATCH_ASSUMPTION");
    expect(stored).toMatchObject({
      sampleCount: 10,
      sourceRecords: expect.stringMatching(/candidate_job_match_factors/),
    } satisfies Partial<RecommendationDraft>);
    expect(stored?.observedPattern).toMatch(/the last 90 days/);
    expect(stored?.observedPattern).toMatch(/Sample size 10/);
    expect(advisoryTextAllowed(signaled.recommendations.map((item) => item.observedPattern).join(" "))).toBe(true);
    expect(signaled.recommendations.some((item) => /reject candidates|performs poorly|suppress/i.test(item.observedPattern))).toBe(false);
  });

  it("I — military program copy stays aggregate", () => {
    const sentence = programFunnelSentence("military", {
      context: "client_routing",
      program: "military",
      jobFamily: "All reviewed families",
      companyName: null,
      sample: 18,
      band: "early_signal",
      match: 18,
      viable: 18,
      engagement: 10,
      interest: 4,
      interview: 3,
      placement: 1,
    }, "the last 90 days");
    expect(sentence).toMatch(/Sample size 18/);
    expect(sentence).toMatch(/does not rank people/);
    expect(sentence).not.toMatch(/exclude|performs poorly/);
  });

  it("T and U — Scout outcome answers are read-only and show the window and sample", async () => {
    expect(matchOperationalPrompt("How are Strong Matches performing?")?.id).toBe("learning.match_performance");
    expect(matchOperationalPrompt("What gaps show up most often in No Fit outcomes?")?.id).toBe("learning.nofit_gaps");
    expect(matchOperationalPrompt("Which military mappings have the most placement evidence?")?.id).toBe("learning.mapping_placements");
    expect(matchOperationalPrompt("Where is our pipeline leaking?")?.id).toBe("learning.pipeline_leak");
    expect(matchOperationalPrompt("Which employers have the slowest response time?")?.id).toBe("learning.slow_employers");
    expect(matchOperationalPrompt("What is our interview rate for Instrumentation roles?")).toMatchObject({
      id: "learning.family_interview_rate",
      subjectName: "Instrumentation",
    });
    expect(matchOperationalPrompt("Which candidates are No Fit and need another opportunity?")?.id).toBe("ops.no_fit_needs_path");
    for (const id of [
      "learning.match_performance",
      "learning.nofit_gaps",
      "learning.mapping_placements",
      "learning.pipeline_leak",
      "learning.slow_employers",
      "learning.family_interview_rate",
    ] as const) {
      expect(OPERATIONAL_COMMANDS[id].risk).toBe("read");
      expect(OPERATIONAL_COMMANDS[id].confirm).toBe(false);
      expect(OPERATIONAL_COMMANDS[id].permissions).toEqual(["scout.use", "reports.read"]);
    }
    const parsed = parseScoutIntent("How are Strong Matches performing?");
    expect(parsed.ok).toBe(true);
    let calls = 0;
    const result = await executeOperationalScoutCommand({
      principal: principal([...ROLE_PERMISSIONS.recruiter].filter((permission) => permission !== "candidate_pii.read")),
      dto: { family: "SHOW_DASHBOARD", commandId: "learning.match_performance" },
      ports: {
        learning: async () => {
          calls += 1;
          return reportFrom({
            windowLabel: "the last 90 days",
            matches: [row({ matchCategory: "strong_match", outcome: "interview", matches: 7, engagements: 7, interviews: 7 })],
            factors: [],
            capabilities: [],
            mappings: [],
            requirements: [],
            timing: [],
          });
        },
      },
    });
    expect(calls).toBe(1);
    expect(result.message).toMatch(/the last 90 days/);
    expect(result.message).toMatch(/Sample size 7/);
    expect(result.message).toMatch(/7 of 7/);
    expect(result.confirmation).toBeNull();
    expect(result.draft).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/email|phone|compensation/);
    const denied = await executeOperationalScoutCommand({
      principal: principal(["scout.use"]),
      dto: { family: "SHOW_DASHBOARD", commandId: "learning.match_performance" },
      ports: { learning: async () => { throw new Error("should not run"); } },
    });
    expect(denied.message).toMatch(/Missing permission: reports.read/);
  });

  it("Q, V, W, and X — learning does not own matcher weights, protected traits, or external sends", () => {
    expect(MATCH_WEIGHTS).toEqual({
      requiredCapability: 40,
      preferredCapability: 15,
      credential: 10,
      location: 10,
      timing: 8,
      jobFamily: 7,
      clearance: 5,
      experience: 3,
      education: 2,
    });
    expect(externalDeliveryPlan({ confirmed: false, providerConfigured: true, consentGranted: true }).action).toBe("refuse");
    const learning = readFileSync(path.join(root, "lib/outcome-learning/load.ts"), "utf8");
    const review = readFileSync(path.join(root, "lib/outcome-learning/review.ts"), "utf8");
    const matcher = readFileSync(path.join(root, "lib/recruiting/opportunity-match.ts"), "utf8");
    expect(matcher).toMatch(/coverage >= 0\.75/);
    expect(matcher).toMatch(/coverage >= 0\.4/);
    expect(learning).not.toMatch(/\b(email|phone|compensation_expectations|full_name|race|ethnicity|religion|gender|sexual_orientation|disability|political)\b/);
    expect(learning).toMatch(/military_status/);
    expect(learning).toMatch(/dimension <> 'compensation'/);
    expect(learning).toMatch(/cs\.review_status = 'approved'/);
    expect(review).not.toMatch(/candidateJobMatches|militaryOccupationSkills|jobRequirements|MATCH_WEIGHTS/);
    expect(ADVISORY_BOUNDARY).toMatch(/does not change match weights/);
  });
});
