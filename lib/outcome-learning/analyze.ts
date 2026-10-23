import { assertAdvisory } from "./guardrails";
import { evidenceBand, formatCount, type EvidenceBand } from "./thresholds";
import {
  categoryLabel,
  contextLabel,
  MATCH_CATEGORIES,
  NORMALIZED_OUTCOMES,
  outcomeLabel,
  programLabel,
  type ContextBucket,
  type LearningMatchCategory,
  type NormalizedOutcome,
  type ProgramBucket,
} from "./vocabulary";

const EMPTY_OUTCOMES = Object.fromEntries(NORMALIZED_OUTCOMES.map((outcome) => [outcome, 0])) as Record<NormalizedOutcome, number>;

export type MatchCountRow = {
  matchCategory: string;
  context: ContextBucket;
  program: ProgramBucket;
  jobFamily: string;
  companyId: string | null;
  companyName: string | null;
  outcome: NormalizedOutcome;
  matches: number;
  engagements: number;
  interviews: number;
  placements: number;
  viable: number;
  interested: number;
  responded: number;
  followUpTracked: number;
  followUpOverdue: number;
};

export type FactorCountRow = {
  label: string;
  dimension: string;
  group: "aligned" | "documented_gap";
  outcome: NormalizedOutcome;
  jobFamily: string;
  matches: number;
};

export type CapabilityCountRow = {
  skillName: string;
  matches: number;
  engagements: number;
  interviews: number;
  placements: number;
  noFit: number;
};

export type MappingCountRow = {
  mappingId: string;
  occupationCode: string;
  occupationTitle: string;
  skillName: string;
  reviewStatus: string;
  candidates: number;
  matches: number;
  interviews: number;
  placements: number;
  noFit: number;
};

export type RequirementCountRow = {
  requirementId: string;
  jobId: string;
  kind: string;
  label: string;
  reviewStatus: string;
  gapNoFit: number;
  alignedPlacements: number;
  noFitOnJob: number;
};

export type TimingRow = {
  context: ContextBucket;
  companyId: string | null;
  responseHoursSum: number;
  responseSamples: number;
  matchToEngagementHoursSum: number;
  matchToEngagementSamples: number;
  engagementToInterviewHoursSum: number;
  engagementToInterviewSamples: number;
  noFitHoursSum: number;
  noFitSamples: number;
  placementHoursSum: number;
  placementSamples: number;
};

export type WorkforceRoleSnapshot = {
  id: string;
  title: string;
  jobFamilyName: string | null;
  demandQuantity: number;
  knownSupply: number | null;
  activePipeline: number | null;
};

export type CountPair = { numerator: number; denominator: number; text: string };

export type CategoryPerformance = {
  context: ContextBucket;
  category: LearningMatchCategory;
  label: string;
  sample: number;
  band: EvidenceBand;
  engagement: CountPair;
  interest: CountPair;
  interview: CountPair;
  placement: CountPair;
  noFit: CountPair;
  noResponse: CountPair;
  candidateDeclined: CountPair;
};

export type FunnelSlice = {
  context: ContextBucket;
  program: ProgramBucket | "all";
  jobFamily: string;
  companyName: string | null;
  sample: number;
  band: EvidenceBand;
  match: number;
  viable: number;
  engagement: number;
  interest: number;
  interview: number;
  placement: number;
};

export type FactorSignal = {
  label: string;
  dimension: string;
  group: "aligned" | "documented_gap";
  jobFamily: string;
  outcome: NormalizedOutcome;
  numerator: number;
  denominator: number;
  band: EvidenceBand;
  text: string;
};

export type CapabilitySignal = {
  skillName: string;
  matches: number;
  engagements: number;
  interviews: number;
  placements: number;
  noFit: number;
  band: EvidenceBand;
  note: string;
};

export type MappingSignal = {
  mappingId: string;
  occupationCode: string;
  occupationTitle: string;
  skillName: string;
  reviewStatus: string;
  candidates: number;
  matches: number;
  interviews: number;
  placements: number;
  noFit: number;
  band: EvidenceBand;
};

export type RequirementSignal = {
  requirementId: string;
  jobId: string;
  kind: string;
  label: string;
  reviewStatus: string;
  gapNoFit: number;
  alignedPlacements: number;
  noFitOnJob: number;
  band: EvidenceBand;
};

export type EmployerMetric = {
  companyId: string;
  companyName: string;
  context: ContextBucket;
  engagements: number;
  band: EvidenceBand;
  response: CountPair;
  interview: CountPair;
  noFit: CountPair;
  referral: CountPair;
  placement: CountPair;
  responseHours: number | null;
  responseSamples: number;
};

export type TimingSummary = {
  context: ContextBucket;
  label: string;
  hours: number | null;
  samples: number;
  band: EvidenceBand;
};

export type WorkforceFeedback = {
  roleId: string;
  title: string;
  jobFamilyName: string;
  demandQuantity: number;
  knownSupply: number | null;
  activePipeline: number | null;
  strongMatches: number;
  strongInterviews: number;
  strongPlacements: number;
  strongNoFit: number;
  band: EvidenceBand;
  gapNote: string | null;
};

export const RECOMMENDATION_TYPES = [
  "REVIEW_MATCH_ASSUMPTION",
  "REVIEW_MILITARY_MAPPING",
  "REVIEW_JOB_REQUIREMENT",
  "REVIEW_PIPELINE_STRATEGY",
  "REVIEW_EMPLOYER_WORKFLOW",
  "REVIEW_FOLLOW_UP_PROCESS",
  "INSUFFICIENT_DATA",
] as const;

export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export type RecommendationDraft = {
  recommendationType: RecommendationType;
  subjectKey: string;
  sampleCount: number;
  evidenceBand: EvidenceBand;
  observedPattern: string;
  whyItMatters: string;
  humanReviewPrompt: string;
  sourceRecords: string;
  sourceFilter: string;
  supportingSummary: string;
};

export type OutcomeAnalysis = {
  matchPerformance: CategoryPerformance[];
  funnels: FunnelSlice[];
  factorSignals: FactorSignal[];
  withheldFactorLabels: number;
  capabilitySignals: CapabilitySignal[];
  mappingSignals: MappingSignal[];
  requirementSignals: RequirementSignal[];
  employerMetrics: EmployerMetric[];
  withheldEmployers: number;
  timing: TimingSummary[];
  workforceFeedback: WorkforceFeedback[];
  recommendations: RecommendationDraft[];
};

function pair(numerator: number, denominator: number): CountPair {
  return { numerator, denominator, text: formatCount(numerator, denominator) };
}

function sum(rows: MatchCountRow[]) {
  const byOutcome = { ...EMPTY_OUTCOMES };
  const totals = {
    matches: 0,
    engagements: 0,
    interviews: 0,
    placements: 0,
    viable: 0,
    interested: 0,
    responded: 0,
    followUpTracked: 0,
    followUpOverdue: 0,
    byOutcome,
  };
  for (const row of rows) {
    totals.matches += row.matches;
    totals.engagements += row.engagements;
    totals.interviews += row.interviews;
    totals.placements += row.placements;
    totals.viable += row.viable;
    totals.interested += row.interested;
    totals.responded += row.responded;
    totals.followUpTracked += row.followUpTracked;
    totals.followUpOverdue += row.followUpOverdue;
    totals.byOutcome[row.outcome] += row.matches;
  }
  return totals;
}

function subjectKey(parts: string[]) {
  return parts.join(":").toLowerCase().replace(/[^a-z0-9:_-]+/g, "-").replace(/-+/g, "-").slice(0, 160);
}

function draft(input: RecommendationDraft): RecommendationDraft {
  const text = [input.observedPattern, input.whyItMatters, input.humanReviewPrompt, input.supportingSummary].join(" ");
  assertAdvisory(text);
  return input;
}

function categoryPerformance(rows: MatchCountRow[]): CategoryPerformance[] {
  const contexts = ["client_routing", "public_outreach", "unspecified"] as const;
  const results: CategoryPerformance[] = [];
  for (const context of contexts) {
    for (const category of MATCH_CATEGORIES) {
      const totals = sum(rows.filter((row) => row.context === context && row.matchCategory === category));
      if (totals.matches === 0) continue;
      const sample = totals.matches;
      results.push({
        context,
        category,
        label: categoryLabel(category),
        sample,
        band: evidenceBand(sample),
        engagement: pair(totals.engagements, sample),
        interest: pair(totals.interested, sample),
        interview: pair(totals.interviews, sample),
        placement: pair(totals.placements, sample),
        noFit: pair(totals.byOutcome.employer_not_a_fit, sample),
        noResponse: pair(totals.byOutcome.no_response, sample),
        candidateDeclined: pair(totals.byOutcome.candidate_declined, sample),
      });
    }
  }
  return results;
}

function funnel(rows: MatchCountRow[], extra: Omit<FunnelSlice, "sample" | "band" | "match" | "viable" | "engagement" | "interest" | "interview" | "placement">): FunnelSlice {
  const totals = sum(rows);
  return {
    ...extra,
    sample: totals.matches,
    band: evidenceBand(totals.matches),
    match: totals.matches,
    viable: totals.viable,
    engagement: totals.engagements,
    interest: totals.interested,
    interview: totals.interviews,
    placement: totals.placements,
  };
}

function buildFunnels(rows: MatchCountRow[]): FunnelSlice[] {
  const slices: FunnelSlice[] = [];
  for (const context of ["client_routing", "public_outreach"] as const) {
    const inContext = rows.filter((row) => row.context === context);
    if (inContext.length === 0) continue;
    slices.push(funnel(inContext, { context, program: "all", jobFamily: "All reviewed families", companyName: null }));
    for (const program of ["military", "other", "not_recorded"] as const) {
      const subset = inContext.filter((row) => row.program === program);
      if (sum(subset).matches === 0) continue;
      slices.push(funnel(subset, { context, program, jobFamily: "All reviewed families", companyName: null }));
    }
    const families = [...new Set(inContext.map((row) => row.jobFamily))];
    for (const jobFamily of families) {
      const subset = inContext.filter((row) => row.jobFamily === jobFamily);
      slices.push(funnel(subset, { context, program: "all", jobFamily, companyName: null }));
    }
  }
  return slices;
}

function factorSignals(factors: FactorCountRow[], matches: MatchCountRow[]): { signals: FactorSignal[]; withheld: number } {
  const grouped = new Map<string, FactorCountRow[]>();
  for (const row of factors) {
    if (row.group !== "documented_gap" && row.group !== "aligned") continue;
    const key = [row.group, row.dimension, row.label, row.jobFamily, row.outcome].join("|");
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const signals: FactorSignal[] = [];
  let withheld = 0;
  for (const group of grouped.values()) {
    const first = group[0]!;
    const numerator = group.reduce((total, row) => total + row.matches, 0);
    const denominator = sum(matches.filter((row) => row.jobFamily === first.jobFamily && row.outcome === first.outcome)).matches;
    if (denominator < 5) {
      withheld += 1;
      continue;
    }
    signals.push({
      label: first.label,
      dimension: first.dimension,
      group: first.group,
      jobFamily: first.jobFamily,
      outcome: first.outcome,
      numerator,
      denominator,
      band: evidenceBand(denominator),
      text: `${first.label} is a ${first.group === "documented_gap" ? "documented gap" : "aligned factor"} on ${formatCount(numerator, denominator)} ${outcomeLabel(first.outcome)} outcomes in ${first.jobFamily}.`,
    });
  }
  signals.sort((left, right) => right.numerator - left.numerator || right.denominator - left.denominator);
  return { signals, withheld };
}

function average(sumHours: number, samples: number) {
  if (samples < 5) return null;
  return Math.round((sumHours / samples) * 10) / 10;
}

export function analyzeOutcomes(input: {
  matches: MatchCountRow[];
  factors: FactorCountRow[];
  capabilities: CapabilityCountRow[];
  mappings: MappingCountRow[];
  requirements: RequirementCountRow[];
  timing: TimingRow[];
  roles?: WorkforceRoleSnapshot[];
  windowLabel: string;
}): OutcomeAnalysis {
  const matchPerformance = categoryPerformance(input.matches);
  const funnels = buildFunnels(input.matches);
  const factors = factorSignals(input.factors, input.matches);
  const capabilitySignals: CapabilitySignal[] = input.capabilities
    .map((row) => ({
      skillName: row.skillName,
      matches: row.matches,
      engagements: row.engagements,
      interviews: row.interviews,
      placements: row.placements,
      noFit: row.noFit,
      band: evidenceBand(row.matches),
      note: "Approved capability co-occurrence. Absence of a placement is not evidence the capability is wrong.",
    }))
    .sort((left, right) => right.matches - left.matches);
  const mappingSignals: MappingSignal[] = input.mappings
    .map((row) => ({
      ...row,
      band: evidenceBand(Math.max(row.matches, row.candidates)),
    }))
    .sort((left, right) => right.placements - left.placements || right.matches - left.matches);
  const requirementSignals: RequirementSignal[] = input.requirements.map((row) => ({
    ...row,
    band: evidenceBand(Math.max(row.noFitOnJob, row.alignedPlacements, row.gapNoFit)),
  }));
  const employerMetrics = employerRollup(input.matches, input.timing);
  const timing = timingRollup(input.timing);
  const workforceFeedback = workforceNotes(input.roles ?? [], input.matches, factors.signals);
  const recommendations = buildRecommendations({
    windowLabel: input.windowLabel,
    matchPerformance,
    funnels,
    factorSignals: factors.signals,
    mappingSignals,
    requirementSignals,
    employerMetrics: employerMetrics.shown,
    matches: input.matches,
  });
  return {
    matchPerformance,
    funnels,
    factorSignals: factors.signals,
    withheldFactorLabels: factors.withheld,
    capabilitySignals,
    mappingSignals,
    requirementSignals,
    employerMetrics: employerMetrics.shown,
    withheldEmployers: employerMetrics.withheld,
    timing,
    workforceFeedback,
    recommendations,
  };
}

function employerRollup(matches: MatchCountRow[], timing: TimingRow[]) {
  const groups = new Map<string, MatchCountRow[]>();
  for (const row of matches) {
    if (!row.companyId || !row.companyName) continue;
    if (row.context === "unspecified") continue;
    const key = `${row.context}|${row.companyId}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const shown: EmployerMetric[] = [];
  let withheld = 0;
  for (const [key, rows] of groups) {
    const [context, companyId] = key.split("|") as [ContextBucket, string];
    const totals = sum(rows);
    if (totals.engagements < 5) {
      withheld += 1;
      continue;
    }
    const timingRows = timing.filter((row) => row.context === context && row.companyId === companyId);
    const responseSamples = timingRows.reduce((total, row) => total + row.responseSamples, 0);
    const responseHoursSum = timingRows.reduce((total, row) => total + row.responseHoursSum, 0);
    shown.push({
      companyId,
      companyName: rows[0]?.companyName ?? companyId,
      context,
      engagements: totals.engagements,
      band: evidenceBand(totals.engagements),
      response: pair(totals.responded, totals.engagements),
      interview: pair(totals.interviews, totals.engagements),
      noFit: pair(totals.byOutcome.employer_not_a_fit, totals.engagements),
      referral: pair(totals.byOutcome.referred, totals.engagements),
      placement: pair(totals.placements, totals.engagements),
      responseHours: average(responseHoursSum, responseSamples),
      responseSamples,
    });
  }
  shown.sort((left, right) => right.engagements - left.engagements);
  return { shown, withheld };
}

function timingRollup(rows: TimingRow[]): TimingSummary[] {
  const contexts = ["client_routing", "public_outreach"] as const;
  const definitions = [
    { key: "response", label: "Employer response", sum: "responseHoursSum", samples: "responseSamples" },
    { key: "match", label: "Match to engagement", sum: "matchToEngagementHoursSum", samples: "matchToEngagementSamples" },
    { key: "interview", label: "Engagement to interview", sum: "engagementToInterviewHoursSum", samples: "engagementToInterviewSamples" },
    { key: "nofit", label: "Aging before Not a Fit", sum: "noFitHoursSum", samples: "noFitSamples" },
    { key: "placement", label: "Aging before placement", sum: "placementHoursSum", samples: "placementSamples" },
  ] as const;
  const summaries: TimingSummary[] = [];
  for (const context of contexts) {
    const subset = rows.filter((row) => row.context === context);
    if (subset.length === 0) continue;
    for (const definition of definitions) {
      const samples = subset.reduce((total, row) => total + row[definition.samples], 0);
      const hoursSum = subset.reduce((total, row) => total + row[definition.sum], 0);
      summaries.push({
        context,
        label: definition.label,
        hours: average(hoursSum, samples),
        samples,
        band: evidenceBand(samples),
      });
    }
  }
  return summaries;
}

function workforceNotes(roles: WorkforceRoleSnapshot[], matches: MatchCountRow[], factors: FactorSignal[]): WorkforceFeedback[] {
  return roles.flatMap((role) => {
    if (!role.jobFamilyName) return [];
    const totals = sum(matches.filter((row) => (
      row.context === "client_routing"
      && row.matchCategory === "strong_match"
      && row.jobFamily === role.jobFamilyName
    )));
    const gap = factors.find((row) => row.group === "documented_gap" && row.jobFamily === role.jobFamilyName && row.outcome === "employer_not_a_fit");
    return [{
      roleId: role.id,
      title: role.title,
      jobFamilyName: role.jobFamilyName,
      demandQuantity: role.demandQuantity,
      knownSupply: role.knownSupply,
      activePipeline: role.activePipeline,
      strongMatches: totals.matches,
      strongInterviews: totals.interviews,
      strongPlacements: totals.placements,
      strongNoFit: totals.byOutcome.employer_not_a_fit,
      band: evidenceBand(totals.matches),
      gapNote: gap ? gap.text : null,
    }];
  });
}

function buildRecommendations(input: {
  windowLabel: string;
  matchPerformance: CategoryPerformance[];
  funnels: FunnelSlice[];
  factorSignals: FactorSignal[];
  mappingSignals: MappingSignal[];
  requirementSignals: RequirementSignal[];
  employerMetrics: EmployerMetric[];
  matches: MatchCountRow[];
}): RecommendationDraft[] {
  const items: RecommendationDraft[] = [];
  const window = input.windowLabel;

  for (const row of input.matchPerformance) {
    if (row.sample < 5) {
      items.push(draft({
        recommendationType: "INSUFFICIENT_DATA",
        subjectKey: subjectKey(["insufficient", row.context, row.category]),
        sampleCount: row.sample,
        evidenceBand: "insufficient",
        observedPattern: `In ${window}, ${contextLabel(row.context)} has ${row.sample} ${row.label} outcomes.`,
        whyItMatters: "A pattern from fewer than 5 outcomes is not enough to review as a trend.",
        humanReviewPrompt: "Wait for more stored outcomes before treating this category as a pattern.",
        sourceRecords: "candidate_job_matches and opportunity_engagements",
        sourceFilter: `${row.context}; ${row.category}`,
        supportingSummary: `${row.sample} matches. Band: insufficient evidence.`,
      }));
      continue;
    }
  }

  for (const signal of input.factorSignals) {
    if (signal.group !== "documented_gap" || signal.outcome !== "employer_not_a_fit" || signal.denominator < 5) continue;
    if (signal.numerator < 5 && signal.numerator / signal.denominator < 0.5) continue;
    const type = ["credential", "clearance", "education", "license"].includes(signal.dimension)
      ? "REVIEW_JOB_REQUIREMENT"
      : "REVIEW_MATCH_ASSUMPTION";
    items.push(draft({
      recommendationType: type,
      subjectKey: subjectKey(["gap", signal.dimension, signal.label, signal.jobFamily]),
      sampleCount: signal.denominator,
      evidenceBand: signal.band,
      observedPattern: `In ${window}, ${signal.text} Sample size ${signal.denominator}.`,
      whyItMatters: "The same documented gap keeps appearing on employer Not a Fit outcomes. That can be a requirement, a match explanation, or a sourcing limit.",
      humanReviewPrompt: "A person should review the job requirement and the match explanation. Do not change weights or candidate eligibility from this note.",
      sourceRecords: "candidate_job_match_factors joined to opportunity_engagements",
      sourceFilter: `documented_gap; ${signal.dimension}; ${signal.jobFamily}; employer_not_a_fit`,
      supportingSummary: formatCount(signal.numerator, signal.denominator),
    }));
  }

  for (const mapping of input.mappingSignals) {
    const sample = Math.max(mapping.noFit, mapping.placements, mapping.interviews);
    if (sample < 5) continue;
    items.push(draft({
      recommendationType: "REVIEW_MILITARY_MAPPING",
      subjectKey: subjectKey(["mapping", mapping.mappingId]),
      sampleCount: sample,
      evidenceBand: evidenceBand(sample),
      observedPattern: `In ${window}, ${mapping.occupationCode} → ${mapping.skillName} is cited by ${mapping.candidates} approved candidate capabilities, ${mapping.matches} matches, ${mapping.interviews} interviews, ${mapping.placements} placements, and ${mapping.noFit} employer Not a Fit outcomes.`,
      whyItMatters: "Downstream counts can help a reviewer decide whether the reference mapping still matches the work. They do not approve or reject it.",
      humanReviewPrompt: "Review the military occupation mapping in Mapping Review. Leave its status unchanged unless you use the existing review action.",
      sourceRecords: "military_occupation_skills, candidate_skill_evidence, candidate_job_matches, opportunity_engagements",
      sourceFilter: `mapping ${mapping.mappingId}; approved candidate capabilities only`,
      supportingSummary: `Usage ${mapping.candidates}. Matches ${mapping.matches}. Interviews ${mapping.interviews}. Placements ${mapping.placements}. Not a Fit ${mapping.noFit}.`,
    }));
  }

  for (const requirement of input.requirementSignals) {
    if (requirement.reviewStatus !== "approved" || requirement.gapNoFit < 5) continue;
    items.push(draft({
      recommendationType: "REVIEW_JOB_REQUIREMENT",
      subjectKey: subjectKey(["requirement", requirement.requirementId]),
      sampleCount: requirement.noFitOnJob || requirement.gapNoFit,
      evidenceBand: evidenceBand(requirement.noFitOnJob || requirement.gapNoFit),
      observedPattern: `In ${window}, reviewed requirement “${requirement.label}” (${requirement.kind}) was a documented gap in ${requirement.gapNoFit} employer Not a Fit outcomes. It also appears with ${requirement.alignedPlacements} placements.`,
      whyItMatters: "A repeated blocking gap is a client conversation, not an automatic relaxation of the requirement.",
      humanReviewPrompt: "Discuss the requirement with the recruiter or client. Do not approve, reject, or edit it from this queue.",
      sourceRecords: "job_requirements and candidate_job_match_factors",
      sourceFilter: `approved requirement ${requirement.requirementId}`,
      supportingSummary: `Gap ${requirement.gapNoFit}. Placements where it aligned ${requirement.alignedPlacements}.`,
    }));
  }

  for (const employer of input.employerMetrics) {
    const noFitHeavy = employer.noFit.denominator >= 5 && employer.noFit.numerator / employer.noFit.denominator >= 0.5;
    const slow = employer.responseSamples >= 5 && (employer.responseHours ?? 0) >= 240;
    if (!noFitHeavy && !slow) continue;
    const observed = noFitHeavy
      ? `In ${window}, ${employer.companyName} (${contextLabel(employer.context)}) recorded employer Not a Fit on ${employer.noFit.text}.`
      : `In ${window}, ${employer.companyName} (${contextLabel(employer.context)}) has an average employer response of ${employer.responseHours} hours across ${employer.responseSamples} responses.`;
    items.push(draft({
      recommendationType: "REVIEW_EMPLOYER_WORKFLOW",
      subjectKey: subjectKey(["employer", employer.context, employer.companyId, noFitHeavy ? "nofit" : "response"]),
      sampleCount: noFitHeavy ? employer.engagements : employer.responseSamples,
      evidenceBand: evidenceBand(noFitHeavy ? employer.engagements : employer.responseSamples),
      observedPattern: observed,
      whyItMatters: "This is an operational count for follow-up and client conversation. It is not an employer quality score.",
      humanReviewPrompt: "Review the route, the requirements, and the response time with the owner of the relationship.",
      sourceRecords: "opportunity_engagements, opportunity_engagement_routes, companies",
      sourceFilter: `${employer.context}; company ${employer.companyId}`,
      supportingSummary: `Engagements ${employer.engagements}. Response ${employer.response.text}. Interview ${employer.interview.text}. Placement ${employer.placement.text}.`,
    }));
  }

  for (const context of ["client_routing", "public_outreach"] as const) {
    const totals = sum(input.matches.filter((row) => row.context === context));
    if (totals.byOutcome.no_response < 5 || totals.followUpTracked < 5) continue;
    if (totals.followUpOverdue / totals.followUpTracked < 0.5) continue;
    items.push(draft({
      recommendationType: "REVIEW_FOLLOW_UP_PROCESS",
      subjectKey: subjectKey(["follow-up", context]),
      sampleCount: totals.followUpTracked,
      evidenceBand: evidenceBand(totals.followUpTracked),
      observedPattern: `In ${window}, ${contextLabel(context)} has ${totals.followUpOverdue} overdue follow-ups out of ${totals.followUpTracked} tracked follow-ups, alongside ${totals.byOutcome.no_response} explicit no-response outcomes.`,
      whyItMatters: "A missed follow-up can look like a lack of interest. Timing alone does not say a candidate should be passed over.",
      humanReviewPrompt: "Review the follow-up queue for this context. Do not close candidates because the timer elapsed.",
      sourceRecords: "opportunity_engagements.next_follow_up_at and employer_response",
      sourceFilter: context,
      supportingSummary: formatCount(totals.followUpOverdue, totals.followUpTracked),
    }));
  }

  for (const slice of input.funnels) {
    if (slice.program !== "all" || slice.companyName) continue;
    if (slice.jobFamily === "All reviewed families") {
      const drop = largestDrop(slice);
      if (!drop || slice.sample < 5) continue;
      items.push(draft({
        recommendationType: drop.type,
        subjectKey: subjectKey(["funnel", slice.context, drop.from, drop.to]),
        sampleCount: drop.sample,
        evidenceBand: evidenceBand(drop.sample),
        observedPattern: `In ${window}, ${contextLabel(slice.context)} moves ${slice.match} matches → ${slice.viable} viable → ${slice.engagement} engagements → ${slice.interest} employer interest → ${slice.interview} interviews → ${slice.placement} placements. The largest drop is ${drop.from} → ${drop.to} (${drop.lost}).`,
        whyItMatters: "The drop shows where stored work is stopping. It does not say who should be removed.",
        humanReviewPrompt: drop.prompt,
        sourceRecords: "candidate_job_matches and opportunity_engagements",
        sourceFilter: slice.context,
        supportingSummary: `Sample ${slice.sample}.`,
      }));
      continue;
    }
    if (slice.sample < 5 || slice.context !== "client_routing") continue;
    if (slice.interview / slice.match >= 0.25) continue;
    items.push(draft({
      recommendationType: "REVIEW_PIPELINE_STRATEGY",
      subjectKey: subjectKey(["family", slice.jobFamily]),
      sampleCount: slice.sample,
      evidenceBand: evidenceBand(slice.sample),
      observedPattern: `In ${window}, client routing for ${slice.jobFamily} reached interview on ${formatCount(slice.interview, slice.match)}.`,
      whyItMatters: "Workforce planning can use this as a note beside known supply. It does not change the workforce role.",
      humanReviewPrompt: "Review the workforce role strategy note and the repeated gaps for this job family. Do not edit role requirements from this queue.",
      sourceRecords: "job_requirements kind job_family, candidate_job_matches, opportunity_engagements, workforce_roles",
      sourceFilter: `client_routing; job family ${slice.jobFamily}`,
      supportingSummary: formatCount(slice.interview, slice.match),
    }));
  }

  const unique = new Map<string, RecommendationDraft>();
  for (const item of items) {
    const key = `${item.recommendationType}|${item.subjectKey}`;
    const current = unique.get(key);
    if (!current || item.sampleCount > current.sampleCount) unique.set(key, item);
  }
  return [...unique.values()].sort((left, right) => right.sampleCount - left.sampleCount).slice(0, 12);
}

function largestDrop(slice: FunnelSlice): { from: string; to: string; lost: number; sample: number; type: RecommendationType; prompt: string } | null {
  const stages = [
    ["Match", slice.match],
    ["Viable", slice.viable],
    ["Engagement", slice.engagement],
    ["Employer interest", slice.interest],
    ["Interview", slice.interview],
    ["Placement", slice.placement],
  ] as const;
  let best: { from: string; to: string; lost: number; sample: number } | null = null;
  for (let index = 0; index < stages.length - 1; index += 1) {
    const from = stages[index]!;
    const to = stages[index + 1]!;
    const lost = from[1] - to[1];
    if (from[1] < 5 || lost <= 0) continue;
    if (!best || lost > best.lost) best = { from: from[0], to: to[0], lost, sample: from[1] };
  }
  if (!best) return null;
  const type: RecommendationType = best.to === "Engagement" || best.from === "Engagement"
    ? "REVIEW_FOLLOW_UP_PROCESS"
    : best.to === "Placement"
      ? "REVIEW_PIPELINE_STRATEGY"
      : "REVIEW_EMPLOYER_WORKFLOW";
  const prompt = type === "REVIEW_FOLLOW_UP_PROCESS"
    ? "Review whether matches are being started and followed up. Do not drop candidates because a stage is slow."
    : type === "REVIEW_PIPELINE_STRATEGY"
      ? "Review the pipeline note for this context. Do not change workforce role requirements from this queue."
      : "Review employer response handling for this context. Do not treat the drop as an employer score.";
  return { ...best, type, prompt };
}

export function scoutMatchSentence(input: { windowLabel: string; rows: CategoryPerformance[]; category: LearningMatchCategory }) {
  const rows = input.rows.filter((row) => row.category === input.category);
  if (rows.length === 0) {
    return `In ${input.windowLabel}, there are 0 ${categoryLabel(input.category)} outcomes. Sample size 0. Source: current candidate_job_matches.`;
  }
  const parts = rows.map((row) => `${contextLabel(row.context)}: ${row.interview.text} reached interview (sample size ${row.sample}, ${row.band.replaceAll("_", " ")})`);
  return `In ${input.windowLabel}, ${parts.join(". ")}. Source: candidate_job_matches joined to opportunity_engagements. Client routing and public outreach stay separate.`;
}

export function programFunnelSentence(program: ProgramBucket, slice: FunnelSlice | undefined, windowLabel: string) {
  if (!slice) {
    return `In ${windowLabel}, ${programLabel(program)} has no stored matches in this context. Sample size 0.`;
  }
  return `In ${windowLabel}, ${programLabel(program)} ${contextLabel(slice.context)}: ${slice.match} matches, ${slice.engagement} engagements, ${slice.interview} interviews, ${slice.placement} placements. Sample size ${slice.sample}. Aggregate only. This does not rank people.`;
}
