import { CAPABILITY_TRANSLATION_SOURCE } from "../military/capability-translation";
import { clearanceSharingWording } from "../recruiting/engagement-policy";

/**
 * M7 reads stored WorkforceOS facts. It does not score candidates.
 * Aggregates are computed when requested.
 * calculatedAt is that read. Nothing is materialized, so the next read sees current rows.
 *
 * Supply qualification:
 * - A capability counts when skillCountsForSupply is true. That is the M5 rule:
 *   an approved translation counts; a pending or rejected inferred translation does not;
 *   an explicit skill counts unless its review is rejected.
 * - A person counts once per capability and once in a role's known supply.
 * - Archived candidates and privacy-deleted candidates are excluded.
 * - do_not_contact, including availability do_not_contact, is excluded from known supply
 *   because operational availability matters. The excluded count is reported separately.
 * - Role supply requires at least one required skill that counts. Preferred skills
 *   and unmapped free text do not add a person. A role with no required skill has
 *   known supply 0 until a person links a skill.
 * - Military supply is the subset of known supply with a military status or a stored
 *   military profile. Everyone else in known supply is other Talent Network supply.
 *   The two subsets add up to known supply.
 * - Occupation channels are approved reference rows. They are not people and they
 *   are not added to known supply.
 */

export const OPEN_JOB_STATUSES = ["open", "search_active"] as const;

export const PLANNING_HORIZON_DAYS = {
  "0_90_days": 90,
  "3_6_months": 183,
  "6_12_months": 365,
  "12_24_months": 730,
} as const;

export const PLANNING_HORIZON_LABELS: Record<PlanningHorizon, string> = {
  "0_90_days": "0–3 months",
  "3_6_months": "3–6 months",
  "6_12_months": "6–12 months",
  "12_24_months": "12–24 months",
};

/** Under this share of demand, with nobody in the active pipeline, health is critical. */
export const CRITICAL_SUPPLY_FRACTION = 0.25;

const MILITARY_STATUSES = new Set(["veteran", "active_duty", "reserve", "national_guard"]);
const CLEARANCE_RANK: Record<string, number> = {
  none: 0,
  confidential: 1,
  secret: 2,
  top_secret: 3,
  ts_sci: 4,
};
const MATCH_CATEGORIES = new Set(["strong_match", "possible_match", "developmental_match"]);
const EMPLOYER_REVIEW = new Set([
  "routed",
  "contacted",
  "acknowledged",
  "reviewing",
  "interested",
  "referred",
  "needs_follow_up",
  "needs_information",
]);
const CLOSED_ENGAGEMENT = new Set(["no_fit", "withdrawn", "placed", "closed"]);

export type PlanningHorizon = keyof typeof PLANNING_HORIZON_DAYS;
export type AvailabilityClass =
  | "available_now"
  | "available_soon"
  | "future_transition"
  | "not_available"
  | "unknown";
export type PipelineHealth = "healthy" | "watch" | "gap" | "critical";
export type StrategyChannel =
  | "military_talent_network"
  | "talent_network"
  | "targeted_campaign"
  | "skillbridge_pathway"
  | "education_partner"
  | "training_pathway"
  | "evergreen_pool"
  | "increase_sourcing"
  | "review_requirements";

export type SkillFact = {
  candidateId: string;
  skillId: string;
  basis: string;
  reviewStatus: string;
  source: string | null;
};

export type PersonFact = {
  id: string;
  archived?: boolean;
  privacyDeleted?: boolean;
  doNotContact?: boolean;
  availability?: string | null;
  militaryStatus?: string | null;
  hasMilitaryProfile?: boolean;
  city?: string | null;
  region?: string | null;
  remotePreference?: string | null;
  relocationWillingness?: string | null;
  preferredLocations?: string[];
  transitionDates?: Array<string | Date | null>;
  credentials?: Array<{ name: string; status: string }>;
  clearance?: { level: string; status: string; humanVerified: boolean } | null;
};

export type JobLinkFact = {
  jobId: string;
  title?: string | null;
  status: string;
  demandHorizon?: string | null;
};

export type MatchFact = {
  candidateId: string;
  jobId: string;
  matchCategory: string | null;
  recruiterDisposition?: string | null;
};

export type EngagementFact = {
  candidateId: string;
  jobId: string;
  status: string;
  employerResponse?: string | null;
};

export type MilitaryChannelFact = {
  branch: string;
  code: string;
  title: string;
  reviewStatus: string;
};

export type EducationPartnerFact = {
  id: string;
  name: string;
  skillIds: string[];
};

export type RoleAnalysisInput = {
  calculatedAt: Date;
  demandQuantity: number;
  demandHorizon: "current" | "evergreen" | "future";
  planningHorizon?: PlanningHorizon | null;
  demandSource?: string | null;
  requiredSkills: Array<{ skillId: string; name: string; requirementType?: string | null }>;
  requiredCredentialText?: string | null;
  requiredClearance?: string | null;
  siteCity?: string | null;
  siteRegion?: string | null;
  jobFamilyId?: string | null;
  jobFamilyName?: string | null;
  freeTextJobFamily?: string | null;
  jobs?: JobLinkFact[];
  skills?: SkillFact[];
  people?: PersonFact[];
  matches?: MatchFact[];
  engagements?: EngagementFact[];
  interviewCandidateIds?: string[];
  placementCandidateIds?: string[];
  militaryChannels?: MilitaryChannelFact[];
  educationPartners?: EducationPartnerFact[];
};

export type StrategyOption = {
  channel: StrategyChannel;
  reason: string;
};

export type RoleAnalysis = {
  calculatedAt: string;
  source: "workforceos_stored_records";
  planningDemandIsNotAJob: true;
  demandQuantity: number;
  demandHorizon: "current" | "evergreen" | "future";
  demandSource: string | null;
  planningHorizon: PlanningHorizon | null;
  planningHorizonLabel: string;
  horizonDays: number;
  jobFamilyId: string | null;
  jobFamilyName: string | null;
  freeTextJobFamily: string | null;
  knownSupply: number;
  militarySupply: number;
  nonMilitarySupply: number;
  excludedDoNotContact: number;
  excludedArchived: number;
  quantityGap: number;
  availability: Record<AvailabilityClass, number>;
  availableByHorizon: number;
  timingGap: number;
  locationConstrained: number;
  locationFit: number;
  credentialRequired: boolean;
  credentialFit: number;
  credentialGap: number;
  clearanceRequired: boolean;
  clearanceFit: number;
  clearanceGap: number;
  clearanceLabel: string | null;
  capabilities: Array<{
    skillId: string;
    name: string;
    knownSupply: number;
    missingAmongRelevant: number;
    quantityGap: number;
  }>;
  currentOpenings: number;
  linkedJobs: Array<{ jobId: string; title: string | null; status: string; currentOpening: boolean }>;
  funnel: {
    knownTalent: number;
    relevantCapability: number;
    opportunityMatch: number;
    recruiterViable: number;
    engagementStarted: number;
    employerReviewing: number;
    interview: number;
    placement: number;
    noFit: number;
  };
  activePipeline: number;
  activePipelineCandidateIds: string[];
  placedCandidateIds: string[];
  militaryChannels: MilitaryChannelFact[];
  referenceTalentPool: string;
  health: PipelineHealth;
  healthReason: string;
  bottleneck: string;
  strategyOptions: StrategyOption[];
  planningOnlyChannels: string[];
  narrative: string;
  relevantCandidateIds: string[];
};

export function skillCountsForSupply(row: {
  basis: string;
  reviewStatus: string;
  source: string | null;
}) {
  const translation = row.basis !== "explicit" || row.source === CAPABILITY_TRANSLATION_SOURCE;
  if (translation) return row.reviewStatus === "approved";
  return row.reviewStatus !== "rejected";
}

export function isCurrentOpening(status: string) {
  return (OPEN_JOB_STATUSES as readonly string[]).includes(status);
}

function clean(value: string | null | undefined) {
  const text = value?.trim().toLowerCase();
  return text || null;
}

function affirms(value: string | null | undefined) {
  const text = clean(value);
  if (!text || /^(no|not|unwilling|false)\b/.test(text)) return false;
  return /^(yes|willing|open|relocate)\b/.test(text) || text.includes("willing to relocate");
}

function asDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function classifyAvailability(person: PersonFact, asOf: Date): AvailabilityClass {
  if (person.doNotContact || person.availability === "do_not_contact" || person.availability === "not_looking") {
    return "not_available";
  }
  const future = (person.transitionDates ?? [])
    .map((value) => asDate(value))
    .filter((value): value is Date => Boolean(value && value.getTime() > asOf.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());
  if (future.length) return "future_transition";
  if (person.availability === "available_now") return "available_now";
  if (person.availability === "passive") return "available_soon";
  return "unknown";
}

export function earliestTransition(person: PersonFact, asOf: Date) {
  return (person.transitionDates ?? [])
    .map((value) => asDate(value))
    .filter((value): value is Date => Boolean(value && value.getTime() > asOf.getTime()))
    .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
}

export function locationFits(person: PersonFact, siteCity: string | null, siteRegion: string | null) {
  const city = clean(siteCity);
  const region = clean(siteRegion);
  if (!city && !region) return true;
  const places = [clean(person.city), clean(person.region), ...(person.preferredLocations ?? []).map((value) => clean(value))]
    .filter((value): value is string => Boolean(value));
  const target = [city, region].filter((value): value is string => Boolean(value));
  if (target.some((site) => places.some((place) => place === site || (site.length >= 3 && place.includes(site))))) {
    return true;
  }
  if (affirms(person.relocationWillingness)) return true;
  if (!city && !region && affirms(person.remotePreference)) return true;
  return false;
}

function credentialFits(person: PersonFact, required: string | null) {
  const needle = clean(required);
  if (!needle) return true;
  return (person.credentials ?? []).some((row) => {
    if (row.status !== "active") return false;
    const name = clean(row.name);
    return Boolean(name && (name === needle || name.includes(needle) || needle.includes(name)));
  });
}

function clearanceFits(person: PersonFact, required: string | null) {
  if (!required || required === "unknown" || required === "none") return true;
  const needed = CLEARANCE_RANK[required];
  if (needed == null) return true;
  const row = person.clearance;
  if (!row || row.status !== "reported_active") return false;
  const have = CLEARANCE_RANK[row.level];
  return have != null && have >= needed;
}

function isMilitary(person: PersonFact) {
  return Boolean(person.hasMilitaryProfile || (person.militaryStatus && MILITARY_STATUSES.has(person.militaryStatus)));
}

export function classifyPipelineHealth(input: {
  demandQuantity: number;
  knownSupply: number;
  activePipeline: number;
  timingGap: number;
  locationConstrained: number;
  credentialGap: number;
  clearanceGap: number;
}): { health: PipelineHealth; reason: string } {
  const gap = Math.max(0, input.demandQuantity - input.knownSupply);
  if (
    input.demandQuantity > 0
    && input.knownSupply < input.demandQuantity * CRITICAL_SUPPLY_FRACTION
    && input.activePipeline === 0
  ) {
    return {
      health: "critical",
      reason: `Known supply ${input.knownSupply} is under ${CRITICAL_SUPPLY_FRACTION * 100}% of modeled demand ${input.demandQuantity}, and the active pipeline is empty.`,
    };
  }
  if (gap > 0) {
    return {
      health: "gap",
      reason: `Modeled demand ${input.demandQuantity} exceeds known supply ${input.knownSupply} by ${gap}.`,
    };
  }
  if (input.timingGap > 0 || input.locationConstrained > 0 || input.credentialGap > 0 || input.clearanceGap > 0) {
    return {
      health: "watch",
      reason: "Quantity is covered. Timing, location, credential, or clearance still constrains part of the known supply.",
    };
  }
  return {
    health: "healthy",
    reason: input.demandQuantity === 0
      ? "No modeled quantity is set on this role."
      : "Known supply covers the modeled quantity without a stored timing, location, credential, or clearance constraint.",
  };
}

export function analyzeWorkforceRole(input: RoleAnalysisInput): RoleAnalysis {
  const asOf = input.calculatedAt;
  const required = input.requiredSkills.filter((row) => (row.requirementType ?? "required") === "required");
  const requiredIds = new Set(required.map((row) => row.skillId));
  const skillsByCandidate = new Map<string, Set<string>>();
  for (const row of input.skills ?? []) {
    if (!skillCountsForSupply(row)) continue;
    const current = skillsByCandidate.get(row.candidateId) ?? new Set<string>();
    current.add(row.skillId);
    skillsByCandidate.set(row.candidateId, current);
  }
  const people = new Map((input.people ?? []).map((person) => [person.id, person]));
  const relevant: PersonFact[] = [];
  let excludedDoNotContact = 0;
  let excludedArchived = 0;
  const seen = new Set<string>();
  for (const [candidateId, skillIds] of skillsByCandidate) {
    if (![...skillIds].some((skillId) => requiredIds.has(skillId))) continue;
    if (seen.has(candidateId)) continue;
    seen.add(candidateId);
    const person = people.get(candidateId);
    if (!person || person.archived || person.privacyDeleted) {
      excludedArchived += 1;
      continue;
    }
    if (person.doNotContact || person.availability === "do_not_contact") {
      excludedDoNotContact += 1;
      continue;
    }
    relevant.push(person);
  }

  const availability: Record<AvailabilityClass, number> = {
    available_now: 0,
    available_soon: 0,
    future_transition: 0,
    not_available: 0,
    unknown: 0,
  };
  const horizon = input.planningHorizon ?? null;
  const horizonDays = horizon ? PLANNING_HORIZON_DAYS[horizon] : PLANNING_HORIZON_DAYS["6_12_months"];
  const horizonEnd = asOf.getTime() + horizonDays * 24 * 60 * 60 * 1000;
  let availableByHorizon = 0;
  let locationFit = 0;
  let credentialFit = 0;
  let clearanceFit = 0;
  let militarySupply = 0;
  const credentialRequired = Boolean(clean(input.requiredCredentialText));
  const clearanceRequired = Boolean(input.requiredClearance && !["unknown", "none"].includes(input.requiredClearance));
  for (const person of relevant) {
    const timing = classifyAvailability(person, asOf);
    availability[timing] += 1;
    const transition = earliestTransition(person, asOf);
    const inHorizon = timing === "available_now"
      || timing === "available_soon"
      || (timing === "future_transition" && Boolean(transition && transition.getTime() <= horizonEnd));
    if (inHorizon) availableByHorizon += 1;
    if (locationFits(person, input.siteCity ?? null, input.siteRegion ?? null)) locationFit += 1;
    if (credentialFits(person, input.requiredCredentialText ?? null)) credentialFit += 1;
    if (clearanceFits(person, input.requiredClearance ?? null)) clearanceFit += 1;
    if (isMilitary(person)) militarySupply += 1;
  }

  const knownSupply = relevant.length;
  const siteConstrained = Boolean(clean(input.siteCity) || clean(input.siteRegion));
  const locationConstrained = siteConstrained ? knownSupply - locationFit : 0;
  const credentialGap = credentialRequired ? knownSupply - credentialFit : 0;
  const clearanceGap = clearanceRequired ? knownSupply - clearanceFit : 0;
  const timingGap = knownSupply - availableByHorizon;
  const quantityGap = Math.max(0, input.demandQuantity - knownSupply);
  const linkedJobIds = new Set((input.jobs ?? []).map((job) => job.jobId));
  const relevantIds = new Set(relevant.map((person) => person.id));

  const matched = new Set<string>();
  const viable = new Set<string>();
  for (const row of input.matches ?? []) {
    if (!relevantIds.has(row.candidateId) || !linkedJobIds.has(row.jobId)) continue;
    if (!row.matchCategory || !MATCH_CATEGORIES.has(row.matchCategory)) continue;
    matched.add(row.candidateId);
    if (row.recruiterDisposition === "viable") viable.add(row.candidateId);
  }
  const started = new Set<string>();
  const reviewing = new Set<string>();
  const interviewing = new Set<string>();
  const placed = new Set<string>();
  const noFit = new Set<string>();
  for (const row of input.engagements ?? []) {
    if (!relevantIds.has(row.candidateId) || !linkedJobIds.has(row.jobId)) continue;
    started.add(row.candidateId);
    if (row.status === "interview") interviewing.add(row.candidateId);
    if (row.status === "placed") placed.add(row.candidateId);
    if (row.status === "no_fit" || row.employerResponse === "not_a_fit") noFit.add(row.candidateId);
    if (EMPLOYER_REVIEW.has(row.status)) reviewing.add(row.candidateId);
  }
  for (const candidateId of input.interviewCandidateIds ?? []) {
    if (relevantIds.has(candidateId)) interviewing.add(candidateId);
  }
  for (const candidateId of input.placementCandidateIds ?? []) {
    if (relevantIds.has(candidateId)) placed.add(candidateId);
  }
  const activePipelineIds = new Set<string>();
  for (const row of input.engagements ?? []) {
    if (!relevantIds.has(row.candidateId) || !linkedJobIds.has(row.jobId)) continue;
    if (CLOSED_ENGAGEMENT.has(row.status) || row.employerResponse === "not_a_fit") continue;
    activePipelineIds.add(row.candidateId);
  }
  for (const candidateId of interviewing) {
    if (!noFit.has(candidateId) && !placed.has(candidateId)) activePipelineIds.add(candidateId);
  }

  const skillSupply = (skillId: string) => {
    const ids = new Set<string>();
    for (const person of relevant) {
      if (skillsByCandidate.get(person.id)?.has(skillId)) ids.add(person.id);
    }
    return ids.size;
  };
  const capabilities = required.map((skill) => {
    const supply = skillSupply(skill.skillId);
    return {
      skillId: skill.skillId,
      name: skill.name,
      knownSupply: supply,
      missingAmongRelevant: knownSupply - supply,
      quantityGap: Math.max(0, input.demandQuantity - supply),
    };
  });
  const channels = (input.militaryChannels ?? []).filter((row) => row.reviewStatus === "approved");
  const scarce = capabilities.filter((row) => row.quantityGap > 0);
  const partners = (input.educationPartners ?? []).filter((partner) =>
    partner.skillIds.some((skillId) => scarce.some((row) => row.skillId === skillId)),
  );
  const strategyOptions: StrategyOption[] = [];
  if (channels.length || militarySupply > 0) {
    const names = channels.map((row) => `${row.branch} ${row.code}`).join(", ");
    strategyOptions.push({
      channel: "military_talent_network",
      reason: `Known military talent is ${militarySupply}. Approved occupation channels: ${names || "none stored"}. Channels are not qualified people.`,
    });
  }
  if (knownSupply - militarySupply > 0 || quantityGap > 0) {
    strategyOptions.push({
      channel: "talent_network",
      reason: `Other Talent Network supply is ${knownSupply - militarySupply}.`,
    });
  }
  if (matched.size > started.size) {
    strategyOptions.push({
      channel: "increase_sourcing",
      reason: `${matched.size} stored matches and ${started.size} engagements on the linked jobs.`,
    });
  }
  if (quantityGap > 0 && started.size === 0) {
    strategyOptions.push({
      channel: "targeted_campaign",
      reason: `Quantity gap is ${quantityGap} and no engagement is started. A campaign is a planning option only.`,
    });
  }
  if (scarce.length) {
    strategyOptions.push({
      channel: "training_pathway",
      reason: `${scarce.map((row) => row.name).join(", ")} ${scarce.length === 1 ? "is" : "are"} short of modeled demand.`,
    });
  }
  if (partners.length) {
    strategyOptions.push({
      channel: "education_partner",
      reason: `Stored partner ${partners.map((row) => row.name).join(", ")} teaches a scarce capability. This does not enroll anyone.`,
    });
  }
  if (input.demandHorizon === "evergreen" || input.demandHorizon === "future") {
    strategyOptions.push({
      channel: "evergreen_pool",
      reason: `Demand horizon is ${input.demandHorizon}, which is planning demand rather than an open job.`,
    });
  }
  if (channels.length) {
    strategyOptions.push({
      channel: "skillbridge_pathway",
      reason: "A SkillBridge pathway is a planning option. Saving this note does not create a program.",
    });
  }
  if (required.length >= 4 && quantityGap > 0) {
    strategyOptions.push({
      channel: "review_requirements",
      reason: "Several required capabilities are short of the modeled quantity.",
    });
  }

  const health = classifyPipelineHealth({
    demandQuantity: input.demandQuantity,
    knownSupply,
    activePipeline: activePipelineIds.size,
    timingGap,
    locationConstrained,
    credentialGap,
    clearanceGap,
  });
  const bottleneck = credentialGap >= locationConstrained && credentialGap >= timingGap && credentialGap > 0
    ? "credential"
    : clearanceGap > 0 && clearanceGap >= locationConstrained && clearanceGap >= timingGap
      ? "clearance"
      : locationConstrained >= timingGap && locationConstrained > 0
        ? "location"
        : timingGap > 0
          ? "timing"
          : scarce.length
            ? "capability"
            : quantityGap > 0
              ? "quantity"
              : "none";
  const clearanceSample = relevant.find((person) => person.clearance)?.clearance ?? null;
  const analysis: RoleAnalysis = {
    calculatedAt: asOf.toISOString(),
    source: "workforceos_stored_records",
    planningDemandIsNotAJob: true,
    demandQuantity: input.demandQuantity,
    demandHorizon: input.demandHorizon,
    demandSource: input.demandSource ?? null,
    planningHorizon: horizon,
    planningHorizonLabel: horizon ? PLANNING_HORIZON_LABELS[horizon] : "Not set; timing uses 12 months",
    horizonDays,
    jobFamilyId: input.jobFamilyId ?? null,
    jobFamilyName: input.jobFamilyName ?? null,
    freeTextJobFamily: input.freeTextJobFamily ?? null,
    knownSupply,
    militarySupply,
    nonMilitarySupply: knownSupply - militarySupply,
    excludedDoNotContact,
    excludedArchived,
    quantityGap,
    availability,
    availableByHorizon,
    timingGap,
    locationConstrained,
    locationFit,
    credentialRequired,
    credentialFit: credentialRequired ? credentialFit : knownSupply,
    credentialGap,
    clearanceRequired,
    clearanceFit: clearanceRequired ? clearanceFit : knownSupply,
    clearanceGap,
    clearanceLabel: clearanceSample
      ? clearanceSharingWording({
        level: clearanceSample.level,
        status: clearanceSample.status,
        humanVerified: clearanceSample.humanVerified,
      })
      : clearanceRequired
        ? "No candidate-reported clearance is stored for the known supply. Candidate-reported clearance is not independently verified."
        : null,
    capabilities,
    currentOpenings: (input.jobs ?? []).filter((job) => isCurrentOpening(job.status)).length,
    linkedJobs: (input.jobs ?? []).map((job) => ({
      jobId: job.jobId,
      title: job.title ?? null,
      status: job.status,
      currentOpening: isCurrentOpening(job.status),
    })),
    funnel: {
      knownTalent: knownSupply,
      relevantCapability: knownSupply,
      opportunityMatch: matched.size,
      recruiterViable: viable.size,
      engagementStarted: started.size,
      employerReviewing: reviewing.size,
      interview: interviewing.size,
      placement: placed.size,
      noFit: noFit.size,
    },
    activePipeline: activePipelineIds.size,
    activePipelineCandidateIds: [...activePipelineIds],
    placedCandidateIds: [...placed],
    militaryChannels: channels,
    referenceTalentPool: channels.length
      ? channels.map((row) => `${row.branch} ${row.code} ${row.title}`).join("; ")
      : "No approved military occupation channel is stored for this role.",
    health: health.health,
    healthReason: health.reason,
    bottleneck,
    strategyOptions,
    planningOnlyChannels: [
      "Internal talent is not calculated. No authorized employee supply is stored on candidates.",
      "External sourcing is a planning option. M7 does not start an external search.",
    ],
    narrative: "",
    relevantCandidateIds: relevant.map((person) => person.id),
  };
  analysis.narrative = draftSupplyNarrative(analysis);
  return analysis;
}

export function draftSupplyNarrative(analysis: Pick<
  RoleAnalysis,
  | "calculatedAt"
  | "quantityGap"
  | "demandQuantity"
  | "knownSupply"
  | "militarySupply"
  | "nonMilitarySupply"
  | "militaryChannels"
  | "bottleneck"
>) {
  const channels = analysis.militaryChannels.map((row) => `${row.branch} ${row.code}`).join(", ");
  return [
    `As of ${analysis.calculatedAt}, current WorkforceOS data shows a quantity gap of ${analysis.quantityGap} relative to modeled demand of ${analysis.demandQuantity}.`,
    `Known supply is ${analysis.knownSupply} (${analysis.militarySupply} military talent, ${analysis.nonMilitarySupply} other Talent Network).`,
    channels
      ? `Potential military occupation channels: ${channels}. These channels are not a count of qualified people.`
      : "No approved military occupation channel is stored.",
    analysis.bottleneck === "none"
      ? "No stored timing, location, credential, clearance, or capability bottleneck is larger than the quantity comparison."
      : `The sharpest stored constraint in this read is ${analysis.bottleneck}.`,
    "A person interprets this. It is not an instruction to hire.",
  ].join(" ");
}

export type FamilyRollupInput = {
  roleId: string;
  title: string;
  jobFamilyId: string | null;
  jobFamilyName: string | null;
  freeTextJobFamily: string | null;
  demandQuantity: number;
  candidateIds: string[];
  activePipelineCandidateIds: string[];
  placedCandidateIds: string[];
  health: PipelineHealth;
};

const HEALTH_RANK: Record<PipelineHealth, number> = { healthy: 0, watch: 1, gap: 2, critical: 3 };

export function presentSupplyCandidate(candidate: {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  compensationExpectations?: string | null;
}, includeDetail: boolean, includePii: boolean) {
  if (!includeDetail) return null;
  return {
    id: candidate.id,
    name: candidate.name,
    email: includePii ? candidate.email ?? null : null,
    phone: includePii ? candidate.phone ?? null : null,
    compensationExpectations: includePii ? candidate.compensationExpectations ?? null : null,
  };
}

export function summarizeJobFamilies(rows: FamilyRollupInput[]) {
  const groups = new Map<string, FamilyRollupInput[]>();
  const unlinked: FamilyRollupInput[] = [];
  for (const row of rows) {
    if (!row.jobFamilyId) {
      unlinked.push(row);
      continue;
    }
    const current = groups.get(row.jobFamilyId) ?? [];
    current.push(row);
    groups.set(row.jobFamilyId, current);
  }
  const families = [...groups.entries()].map(([jobFamilyId, members]) => {
    const supply = new Set(members.flatMap((row) => row.candidateIds));
    const active = new Set(members.flatMap((row) => row.activePipelineCandidateIds));
    const placed = new Set(members.flatMap((row) => row.placedCandidateIds));
    const demand = members.reduce((sum, row) => sum + row.demandQuantity, 0);
    const health = members.reduce<PipelineHealth>((worst, row) => (
      HEALTH_RANK[row.health] > HEALTH_RANK[worst] ? row.health : worst
    ), "healthy");
    return {
      jobFamilyId,
      jobFamilyName: members[0]?.jobFamilyName ?? jobFamilyId,
      demand,
      knownSupply: supply.size,
      quantityGap: Math.max(0, demand - supply.size),
      activePipeline: active.size,
      placements: placed.size,
      health,
      roleCount: members.length,
    };
  });
  return {
    families,
    unlinkedRoles: unlinked.map((row) => ({
      roleId: row.roleId,
      title: row.title,
      freeTextJobFamily: row.freeTextJobFamily,
      demandQuantity: row.demandQuantity,
      knownSupply: new Set(row.candidateIds).size,
      health: row.health,
    })),
  };
}
