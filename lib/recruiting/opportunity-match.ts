import { createHash } from "node:crypto";

import { CAPABILITY_TRANSLATION_SOURCE } from "../military/capability-translation";

/**
 * Canonical opportunity match, model m5-v1.
 *
 * The internal score is a deterministic ordering aid. Screens show the category
 * and the factors, not a precise percentage.
 *
 * Maximum contribution when a dimension has comparable evidence:
 * - required capabilities 40
 * - preferred capabilities 15
 * - credentials and licenses 10
 * - location 10
 * - transition or start timing 8
 * - job family or occupation 7
 * - clearance 5
 * - documented experience 3
 * - education 2
 * Compensation is compared only when both sides already have a number. It does
 * not add points and it does not change the category.
 *
 * Strong: at least 75% of approved required capabilities align, and no
 * unresolved hard constraint.
 * Possible: at least 40% of required capabilities align, or at least two
 * required capabilities align, or job-family overlap plus one aligned capability.
 * Developmental: some capability or job-family overlap below that bar.
 * No Current Match: no overlap, or not enough reviewed evidence to compare.
 *
 * Hard constraints prevent Strong. They do not drop the person from the list
 * and they do not set a rejection. They are only: a required license or
 * credential the record does not show, an explicit clearance the record does
 * not meet, or an on-site location with no remote path and no recorded
 * willingness to relocate.
 */

export const OPPORTUNITY_MATCH_MODEL = "workforceos-opportunity-match";
export const OPPORTUNITY_MATCH_VERSION = "m5-v1";

export const MATCH_WEIGHTS = {
  requiredCapability: 40,
  preferredCapability: 15,
  credential: 10,
  location: 10,
  timing: 8,
  jobFamily: 7,
  clearance: 5,
  experience: 3,
  education: 2,
} as const;

export const CURRENT_OPPORTUNITY_STATUSES = ["open", "search_active"] as const;

export type MatchCategory =
  | "strong_match"
  | "possible_match"
  | "developmental_match"
  | "no_current_match";

export type ReviewStatus = "pending" | "approved" | "rejected" | "needs_review";
export type CapabilityBasis = "explicit" | "reference_supported" | "inferred";
export type RequirementType = "required" | "preferred" | "nice_to_have";
export type FactorGroup = "aligned" | "documented_gap" | "unknown" | "preferred_gap" | "evidence";
export type MatchDimension =
  | "capability"
  | "credential"
  | "education"
  | "clearance"
  | "experience"
  | "location"
  | "timing"
  | "job_family"
  | "compensation"
  | "workplace";

export type MatchFactor = {
  factorGroup: FactorGroup;
  dimension: MatchDimension;
  label: string;
  detail?: string | null;
};

export type CandidateCapabilityInput = {
  skillId: string;
  name: string;
  basis: CapabilityBasis;
  reviewStatus: ReviewStatus;
  source?: string | null;
  evidence?: string[];
};

export type CandidateMatchProfile = {
  capabilities: CandidateCapabilityInput[];
  credentials: string[];
  education: string[];
  clearanceLevel?: string | null;
  yearsExperience?: number | null;
  city?: string | null;
  region?: string | null;
  preferredLocations?: string[];
  relocationWillingness?: string | null;
  remotePreference?: string | null;
  availableOn?: string | null;
  skillbridgeWindowStart?: string | null;
  skillbridgeWindowEnd?: string | null;
  compensation?: number | null;
  jobFamilies: string[];
  occupations: string[];
};

export type JobCapabilityInput = {
  skillId: string;
  name: string;
  requirementType: RequirementType;
  reviewStatus: ReviewStatus;
};

export type JobRequirementInput = {
  kind: string;
  requirementType: RequirementType;
  label: string;
  valueText?: string | null;
  reviewStatus: ReviewStatus;
};

export type JobMatchProfile = {
  status: string;
  contextType: string;
  title: string;
  locationLabel?: string | null;
  workplaceType?: string | null;
  skillbridgeEligible: boolean;
  targetStart?: string | null;
  compensationMin?: number | null;
  compensationMax?: number | null;
  contentHash?: string | null;
  capabilities: JobCapabilityInput[];
  requirements: JobRequirementInput[];
};

export type OpportunityMatchResult = {
  category: MatchCategory;
  score: number;
  factors: MatchFactor[];
  explanation: string;
  strengths: string[];
  gaps: string[];
  blocksStrong: boolean;
  inputHash: string;
};

const CLEARANCE_RANK: Record<string, number> = {
  none: 0,
  unknown: 0,
  confidential: 1,
  secret: 2,
  top_secret: 3,
  ts_sci: 4,
};

export function matchCategoryLabel(category: MatchCategory) {
  switch (category) {
    case "strong_match":
      return "Strong Match";
    case "possible_match":
      return "Possible Match";
    case "developmental_match":
      return "Developmental Match";
    default:
      return "No Current Match";
  }
}

export function opportunityContextLabel(contextType: string) {
  switch (contextType) {
    case "monitored_public":
      return "Public opportunity";
    case "exploratory":
      return "Exploratory demand";
    case "client":
      return "Client job";
    case "skillbridge":
      return "SkillBridge pathway";
    case "internal":
      return "Internal role";
    default:
      return "Employer job";
  }
}

export function isCurrentOpportunityStatus(status: string) {
  return (CURRENT_OPPORTUNITY_STATUSES as readonly string[]).includes(status);
}

export function capabilityCountsForMatch(row: {
  basis: CapabilityBasis;
  reviewStatus: ReviewStatus;
  source?: string | null;
}) {
  if (row.reviewStatus === "rejected") return false;
  const translation =
    row.source === CAPABILITY_TRANSLATION_SOURCE || row.basis !== "explicit";
  if (translation) return row.reviewStatus === "approved";
  return true;
}

function norm(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9+#]+/g, " ").replace(/\s+/g, " ").trim();
}

function sameLabel(left: string, right: string) {
  const a = norm(left);
  const b = norm(right);
  return a.length > 0 && a === b;
}

function containsLabel(haystack: string[], needle: string) {
  return haystack.some((item) => sameLabel(item, needle));
}

function approved<T extends { reviewStatus: ReviewStatus }>(rows: T[]) {
  return rows.filter((row) => row.reviewStatus === "approved");
}

function willing(value?: string | null) {
  return Boolean(value && /yes|open|willing/i.test(value));
}

function clearanceRank(value?: string | null) {
  if (!value) return 0;
  const key = norm(value).replace(/ /g, "_");
  if (key in CLEARANCE_RANK) return CLEARANCE_RANK[key];
  if (key.includes("ts") && key.includes("sci")) return 4;
  if (key.includes("top") && key.includes("secret")) return 3;
  if (key.includes("secret")) return 2;
  if (key.includes("confidential")) return 1;
  return 0;
}

function parseYears(value?: string | null) {
  if (!value) return null;
  const match = /(\d+)\s*\+?\s*years?/i.exec(value);
  return match ? Number(match[1]) : null;
}

function day(value?: string | null) {
  if (!value) return null;
  const parsed = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(parsed) ? parsed : null;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => stable(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stable(nested)]),
    );
  }
  return value;
}

export function matchInputHash(candidate: CandidateMatchProfile, job: JobMatchProfile) {
  const payload = {
    candidate: {
      capabilities: candidate.capabilities
        .map((row) => ({
          skillId: row.skillId,
          basis: row.basis,
          reviewStatus: row.reviewStatus,
          source: row.source ?? null,
        }))
        .sort((left, right) => left.skillId.localeCompare(right.skillId)),
      credentials: [...candidate.credentials].map(norm).sort(),
      education: [...candidate.education].map(norm).sort(),
      clearanceLevel: candidate.clearanceLevel ?? null,
      yearsExperience: candidate.yearsExperience ?? null,
      city: candidate.city ?? null,
      region: candidate.region ?? null,
      preferredLocations: [...(candidate.preferredLocations ?? [])].map(norm).sort(),
      relocationWillingness: candidate.relocationWillingness ?? null,
      remotePreference: candidate.remotePreference ?? null,
      availableOn: candidate.availableOn ?? null,
      skillbridgeWindowStart: candidate.skillbridgeWindowStart ?? null,
      skillbridgeWindowEnd: candidate.skillbridgeWindowEnd ?? null,
      compensation: candidate.compensation ?? null,
      jobFamilies: [...candidate.jobFamilies].map(norm).sort(),
      occupations: [...candidate.occupations].map(norm).sort(),
    },
    job: {
      status: job.status,
      contextType: job.contextType,
      skillbridgeEligible: job.skillbridgeEligible,
      locationLabel: job.locationLabel ?? null,
      workplaceType: job.workplaceType ?? null,
      targetStart: job.targetStart ?? null,
      compensationMin: job.compensationMin ?? null,
      compensationMax: job.compensationMax ?? null,
      contentHash: job.contentHash ?? null,
      capabilities: job.capabilities
        .map((row) => ({
          skillId: row.skillId,
          requirementType: row.requirementType,
          reviewStatus: row.reviewStatus,
        }))
        .sort((left, right) => left.skillId.localeCompare(right.skillId)),
      requirements: job.requirements
        .map((row) => ({
          kind: row.kind,
          requirementType: row.requirementType,
          label: norm(row.label),
          valueText: row.valueText ?? null,
          reviewStatus: row.reviewStatus,
        }))
        .sort((left, right) => `${left.kind}:${left.label}`.localeCompare(`${right.kind}:${right.label}`)),
    },
    version: OPPORTUNITY_MATCH_VERSION,
  };
  return createHash("sha256").update(JSON.stringify(stable(payload))).digest("hex");
}

function push(factors: MatchFactor[], factor: MatchFactor) {
  factors.push(factor);
}

export function evaluateOpportunityMatch(
  candidate: CandidateMatchProfile,
  job: JobMatchProfile,
): OpportunityMatchResult {
  const factors: MatchFactor[] = [];
  const eligible = candidate.capabilities.filter(capabilityCountsForMatch);
  const eligibleNames = new Set(eligible.map((row) => norm(row.name)));
  const eligibleIds = new Set(eligible.map((row) => row.skillId));
  const jobCapabilities = approved(job.capabilities);
  const requirements = approved(job.requirements);
  const requiredSkills = jobCapabilities.filter((row) => row.requirementType === "required");
  const preferredSkills = jobCapabilities.filter((row) => row.requirementType !== "required");

  const skillAligned = (row: JobCapabilityInput) =>
    eligibleIds.has(row.skillId) || eligibleNames.has(norm(row.name));

  const matchedRequired = requiredSkills.filter(skillAligned);
  const matchedPreferred = preferredSkills.filter(skillAligned);
  const missingRequired = requiredSkills.filter((row) => !skillAligned(row));
  const missingPreferred = preferredSkills.filter((row) => !skillAligned(row));

  for (const row of matchedRequired) {
    push(factors, { factorGroup: "aligned", dimension: "capability", label: row.name });
  }
  for (const row of matchedPreferred) {
    push(factors, { factorGroup: "aligned", dimension: "capability", label: row.name, detail: "Preferred" });
  }
  for (const row of missingRequired) {
    push(factors, {
      factorGroup: "documented_gap",
      dimension: "capability",
      label: row.name,
      detail: "Not documented",
    });
  }
  for (const row of missingPreferred) {
    push(factors, {
      factorGroup: "preferred_gap",
      dimension: "capability",
      label: row.name,
      detail: "Preferred capability is not currently shown in the profile",
    });
  }

  const evidenceSeen = new Set<string>();
  for (const row of eligible) {
    if (!matchedRequired.some((skill) => skill.skillId === row.skillId || sameLabel(skill.name, row.name)) &&
      !matchedPreferred.some((skill) => skill.skillId === row.skillId || sameLabel(skill.name, row.name))) {
      continue;
    }
    for (const item of row.evidence ?? []) {
      const label = item.trim();
      if (!label || evidenceSeen.has(norm(label))) continue;
      evidenceSeen.add(norm(label));
      push(factors, { factorGroup: "evidence", dimension: "capability", label });
    }
  }

  let credentialPoints = 0;
  let blocksStrong = false;
  const credentialNeeds = requirements.filter((row) => row.kind === "credential" || row.kind === "license");
  const requiredCredentials = credentialNeeds.filter((row) => row.requirementType === "required");
  const preferredCredentials = credentialNeeds.filter((row) => row.requirementType !== "required");
  const matchedCredentials = requiredCredentials.filter((row) => containsLabel(candidate.credentials, row.label));
  if (requiredCredentials.length) {
    credentialPoints = Math.round((matchedCredentials.length / requiredCredentials.length) * MATCH_WEIGHTS.credential);
  }
  for (const row of requiredCredentials) {
    if (containsLabel(candidate.credentials, row.label)) {
      push(factors, { factorGroup: "aligned", dimension: row.kind === "license" ? "credential" : "credential", label: row.label });
    } else {
      blocksStrong = true;
      push(factors, {
        factorGroup: "documented_gap",
        dimension: "credential",
        label: row.label,
        detail: "Not documented. This does not reject the candidate.",
      });
    }
  }
  for (const row of preferredCredentials) {
    if (!containsLabel(candidate.credentials, row.label)) {
      push(factors, {
        factorGroup: "preferred_gap",
        dimension: "credential",
        label: row.label,
        detail: "Preferred credential is not currently shown in the profile",
      });
    }
  }
  if (!credentialNeeds.length) {
    push(factors, { factorGroup: "aligned", dimension: "credential", label: "No credential requirement recorded" });
  }

  let clearancePoints = 0;
  const clearanceNeed = requirements.find((row) => row.kind === "clearance" && row.requirementType === "required");
  if (clearanceNeed) {
    const needed = clearanceRank(clearanceNeed.valueText || clearanceNeed.label);
    const held = clearanceRank(candidate.clearanceLevel);
    if (needed > 0 && held >= needed) {
      clearancePoints = MATCH_WEIGHTS.clearance;
      push(factors, {
        factorGroup: "aligned",
        dimension: "clearance",
        label: clearanceNeed.label,
        detail: "Candidate-reported. Not independently verified.",
      });
    } else if (!candidate.clearanceLevel || clearanceRank(candidate.clearanceLevel) === 0) {
      blocksStrong = true;
      push(factors, {
        factorGroup: "unknown",
        dimension: "clearance",
        label: clearanceNeed.label,
        detail: "Not documented. Candidate-reported clearance is not independently verified.",
      });
    } else {
      blocksStrong = true;
      push(factors, {
        factorGroup: "documented_gap",
        dimension: "clearance",
        label: clearanceNeed.label,
        detail: "Candidate-reported clearance does not meet the stated requirement. Not independently verified.",
      });
    }
  } else {
    push(factors, { factorGroup: "aligned", dimension: "clearance", label: "Clearance not required" });
  }

  let educationPoints = 0;
  const educationNeeds = requirements.filter((row) => row.kind === "education");
  for (const row of educationNeeds) {
    const met = candidate.education.some((item) => norm(item).includes(norm(row.label)) || norm(row.label).includes(norm(item)));
    if (met) {
      educationPoints = MATCH_WEIGHTS.education;
      push(factors, { factorGroup: "aligned", dimension: "education", label: row.label });
    } else if (row.requirementType === "required") {
      push(factors, {
        factorGroup: "documented_gap",
        dimension: "education",
        label: row.label,
        detail: "Not documented. Missing education does not reject the candidate.",
      });
    } else {
      push(factors, {
        factorGroup: "preferred_gap",
        dimension: "education",
        label: row.label,
        detail: "Preferred education is not currently shown in the profile",
      });
    }
  }

  let experiencePoints = 0;
  const experienceNeed = requirements.find((row) => row.kind === "experience" && row.requirementType === "required");
  const neededYears = experienceNeed ? parseYears(experienceNeed.valueText || experienceNeed.label) : null;
  if (neededYears && neededYears > 0) {
    if (candidate.yearsExperience == null) {
      push(factors, {
        factorGroup: "unknown",
        dimension: "experience",
        label: `${neededYears} years`,
        detail: "Years of experience are not documented. Military service time is not converted into civilian years.",
      });
    } else if (candidate.yearsExperience >= neededYears) {
      experiencePoints = MATCH_WEIGHTS.experience;
      push(factors, {
        factorGroup: "aligned",
        dimension: "experience",
        label: `${candidate.yearsExperience} years documented`,
      });
    } else {
      push(factors, {
        factorGroup: "documented_gap",
        dimension: "experience",
        label: `${neededYears} years`,
        detail: `${candidate.yearsExperience} years are documented. Not a rejection.`,
      });
    }
  }

  let locationPoints = 0;
  const workplace = `${job.workplaceType ?? ""} ${requirements.find((row) => row.kind === "workplace")?.label ?? ""}`.toLowerCase();
  const locationLabel = job.locationLabel ?? requirements.find((row) => row.kind === "location")?.label ?? "";
  const remoteJob = /\bremote\b/.test(workplace) || /\bremote\b/.test(locationLabel.toLowerCase());
  const places = [candidate.city, candidate.region, ...(candidate.preferredLocations ?? [])]
    .filter((item): item is string => Boolean(item))
    .join(" ")
    .toLowerCase();
  const jobTokens = locationLabel.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  const placeOverlap = jobTokens.some((token) => places.includes(token));
  const remoteFit = willing(candidate.remotePreference) || /remote|hybrid/i.test(candidate.remotePreference ?? "");
  if (remoteJob && (remoteFit || !candidate.remotePreference)) {
    locationPoints = MATCH_WEIGHTS.location;
    push(factors, { factorGroup: "aligned", dimension: "workplace", label: "Remote work fits the recorded preference" });
  } else if (placeOverlap) {
    locationPoints = MATCH_WEIGHTS.location;
    push(factors, { factorGroup: "aligned", dimension: "location", label: locationLabel });
  } else if (locationLabel && willing(candidate.relocationWillingness)) {
    locationPoints = 6;
    push(factors, {
      factorGroup: "aligned",
      dimension: "location",
      label: locationLabel,
      detail: "Candidate is willing to relocate",
    });
  } else if (!locationLabel.trim() && !workplace.trim()) {
    push(factors, { factorGroup: "unknown", dimension: "location", label: "Job location is not documented" });
  } else if (!places.trim() && !remoteFit) {
    push(factors, { factorGroup: "unknown", dimension: "location", label: "Candidate location is not documented" });
  } else if (locationLabel && !remoteJob) {
    blocksStrong = true;
    push(factors, {
      factorGroup: "documented_gap",
      dimension: "location",
      label: locationLabel,
      detail: "No recorded location overlap, remote path, or willingness to relocate",
    });
  }

  let timingPoints = 0;
  const start = day(job.targetStart);
  if (job.skillbridgeEligible) {
    const windowStart = day(candidate.skillbridgeWindowStart);
    const windowEnd = day(candidate.skillbridgeWindowEnd);
    const covers = Boolean(windowStart && windowEnd && (!start || (windowStart <= start && start <= windowEnd)));
    if (covers) {
      timingPoints = MATCH_WEIGHTS.timing;
      push(factors, {
        factorGroup: "aligned",
        dimension: "timing",
        label: "SkillBridge window covers the opportunity timing",
      });
    } else if (windowStart || windowEnd) {
      push(factors, {
        factorGroup: "documented_gap",
        dimension: "timing",
        label: "SkillBridge window",
        detail: "The recorded window does not cover the planned timing",
      });
    } else {
      push(factors, {
        factorGroup: "unknown",
        dimension: "timing",
        label: "SkillBridge window",
        detail: "Not documented",
      });
    }
  } else {
    const available = day(candidate.availableOn);
    if (available && start) {
      if (available <= start) {
        timingPoints = MATCH_WEIGHTS.timing;
        push(factors, { factorGroup: "aligned", dimension: "timing", label: "Available before the planned start" });
      } else {
        push(factors, {
          factorGroup: "documented_gap",
          dimension: "timing",
          label: "Availability",
          detail: "Recorded availability is after the planned start",
        });
      }
    }
  }

  const familyNeed = requirements.filter((row) => row.kind === "job_family" || row.kind === "occupation");
  const familyLabels = [
    ...candidate.jobFamilies,
    ...candidate.occupations,
  ];
  const familyHits = familyNeed.filter((row) => containsLabel(familyLabels, row.label));
  const familyOverlap = familyHits.length > 0 || familyNeed.length === 0
    ? familyLabels.some((label) => familyNeed.some((row) => sameLabel(row.label, label)))
    : false;
  let familyPoints = 0;
  if (familyHits.length) {
    familyPoints = MATCH_WEIGHTS.jobFamily;
    for (const row of familyHits) {
      push(factors, { factorGroup: "aligned", dimension: "job_family", label: row.label });
    }
  }

  if (candidate.compensation != null && (job.compensationMin != null || job.compensationMax != null)) {
    const min = job.compensationMin ?? 0;
    const max = job.compensationMax ?? candidate.compensation;
    const inside = candidate.compensation >= min && candidate.compensation <= max;
    push(factors, {
      factorGroup: inside ? "aligned" : "preferred_gap",
      dimension: "compensation",
      label: inside ? "Compensation overlap" : "Compensation expectations differ from the posted range",
      detail: "Compared only because both sides already had a number. Salary was not inferred.",
    });
  }

  const jobHasComparableRequirements = requiredSkills.length + preferredSkills.length + requirements.length > 0;
  const candidateHasEvidence = eligible.length > 0;
  if (!jobHasComparableRequirements) {
    push(factors, {
      factorGroup: "unknown",
      dimension: "capability",
      label: "Job requirements are not reviewed",
    });
  }
  if (!candidateHasEvidence) {
    push(factors, {
      factorGroup: "unknown",
      dimension: "capability",
      label: "Needs more profile information",
    });
  }

  const coverage = requiredSkills.length ? matchedRequired.length / requiredSkills.length : 0;
  const requiredPoints = requiredSkills.length
    ? Math.round(coverage * MATCH_WEIGHTS.requiredCapability)
    : 0;
  const preferredPoints = preferredSkills.length
    ? Math.round((matchedPreferred.length / preferredSkills.length) * MATCH_WEIGHTS.preferredCapability)
    : 0;
  const score = Math.min(
    100,
    requiredPoints +
      preferredPoints +
      credentialPoints +
      locationPoints +
      timingPoints +
      familyPoints +
      clearancePoints +
      experiencePoints +
      educationPoints,
  );

  let category: MatchCategory = "no_current_match";
  const overlap = matchedRequired.length + matchedPreferred.length > 0 || familyOverlap;
  if (candidateHasEvidence && jobHasComparableRequirements) {
    const strong =
      requiredSkills.length > 0 &&
      coverage >= 0.75 &&
      matchedRequired.length >= 1 &&
      !blocksStrong;
    const possible =
      !strong &&
      ((requiredSkills.length > 0 && coverage >= 0.4) ||
        matchedRequired.length >= 2 ||
        (familyOverlap && (matchedRequired.length >= 1 || matchedPreferred.length >= 1)));
    const developmental = !strong && !possible && overlap;
    category = strong
      ? "strong_match"
      : possible
        ? "possible_match"
        : developmental
          ? "developmental_match"
          : "no_current_match";
  }

  const explanation = explainMatch(category, factors);
  return {
    category,
    score,
    factors,
    explanation,
    strengths: factors.filter((row) => row.factorGroup === "aligned").map((row) => row.label),
    gaps: factors
      .filter((row) => row.factorGroup === "documented_gap" || row.factorGroup === "preferred_gap" || row.factorGroup === "unknown")
      .map((row) => row.detail ? `${row.label}: ${row.detail}` : row.label),
    blocksStrong,
    inputHash: matchInputHash(candidate, job),
  };
}

function explainMatch(category: MatchCategory, factors: MatchFactor[]) {
  const lines = [matchCategoryLabel(category)];
  const groups: Array<[FactorGroup, string]> = [
    ["aligned", "Aligned"],
    ["documented_gap", "Documented gaps"],
    ["preferred_gap", "Preferred gaps"],
    ["unknown", "Not documented"],
    ["evidence", "Evidence"],
  ];
  for (const [group, title] of groups) {
    const rows = factors.filter((row) => row.factorGroup === group);
    if (!rows.length) continue;
    lines.push(`${title}:`);
    for (const row of rows) {
      lines.push(`- ${row.detail ? `${row.label} — ${row.detail}` : row.label}`);
    }
  }
  return lines.join("\n");
}

export type DraftJobRequirement = {
  kind: JobRequirementInput["kind"];
  requirementType: RequirementType;
  label: string;
  valueText?: string | null;
  sourceText: string;
};

const CLEARANCE_PATTERNS: Array<[RegExp, string, string]> = [
  [/\bTS\/SCI\b|\bTS-SCI\b/i, "TS/SCI", "ts_sci"],
  [/\bTop Secret\b/i, "Top Secret", "top_secret"],
  [/\bSecret clearance\b|\bactive Secret\b/i, "Secret clearance", "secret"],
  [/\bConfidential clearance\b/i, "Confidential clearance", "confidential"],
];

const CREDENTIAL_PATTERNS = [
  /\bSecurity\+\b/i,
  /\bNetwork\+\b/i,
  /\bCISSP\b/,
  /\bNERC\b[^.\n]{0,24}/i,
  /\bPMP\b/,
  /\bCDL\b/,
  /\bOSHA\s?\d*/i,
];

export function extractDeterministicJobRequirements(description: string): DraftJobRequirement[] {
  const drafts: DraftJobRequirement[] = [];
  const preferredSplit = description.split(/\b(?:preferred|nice to have)\b/i);
  const requiredText = preferredSplit[0] ?? description;
  const preferredText = preferredSplit.slice(1).join(" ");

  for (const [pattern, label, value] of CLEARANCE_PATTERNS) {
    const match = pattern.exec(description);
    if (!match) continue;
    drafts.push({
      kind: "clearance",
      requirementType: "required",
      label,
      valueText: value,
      sourceText: match[0],
    });
    break;
  }

  const years = /(\d+)\s*\+?\s*years(?:\s+of)?(?:\s+[a-z]+){0,3}/i.exec(requiredText);
  if (years) {
    drafts.push({
      kind: "experience",
      requirementType: "required",
      label: `${years[1]} years`,
      valueText: `${years[1]} years`,
      sourceText: years[0],
    });
  }

  const degree = /\b(?:bachelor(?:'s)?|associate(?:'s)?|master(?:'s)?|high school diploma|ged)\b(?:\s+degree)?/i.exec(description);
  if (degree) {
    const inPreferred = preferredText.toLowerCase().includes(degree[0].toLowerCase()) &&
      !requiredText.toLowerCase().includes(degree[0].toLowerCase());
    drafts.push({
      kind: "education",
      requirementType: inPreferred ? "preferred" : "required",
      label: degree[0],
      valueText: degree[0],
      sourceText: degree[0],
    });
  }

  for (const pattern of CREDENTIAL_PATTERNS) {
    const match = pattern.exec(description);
    if (!match) continue;
    drafts.push({
      kind: /\blicen[sc]e\b/i.test(match[0]) || /\bCDL\b/.test(match[0]) ? "license" : "credential",
      requirementType: "required",
      label: match[0].trim(),
      valueText: match[0].trim(),
      sourceText: match[0],
    });
  }

  const workplace = /\b(?:fully remote|remote|hybrid|on-?site)\b/i.exec(description);
  if (workplace) {
    drafts.push({
      kind: "workplace",
      requirementType: "required",
      label: workplace[0],
      valueText: workplace[0],
      sourceText: workplace[0],
    });
  }

  return drafts;
}

export function keepCitedRequirements<T extends { sourceText?: string | null }>(description: string, rows: T[]) {
  const haystack = description.toLowerCase();
  return rows.filter((row) => {
    const source = row.sourceText?.trim();
    return Boolean(source && source.length >= 3 && haystack.includes(source.toLowerCase()));
  });
}

export function extractSkillMentions(
  description: string,
  catalog: Array<{ id: string; name: string; aliases?: string[] }>,
) {
  const preferredAt = description.search(/\b(?:preferred|nice to have)\b/i);
  const hits: Array<{ skillId: string; name: string; requirementType: RequirementType; sourceText: string }> = [];
  const seen = new Set<string>();
  for (const skill of catalog) {
    const phrases = [skill.name, ...(skill.aliases ?? [])].filter((phrase) => phrase.trim().length >= 3);
    for (const phrase of phrases) {
      const index = description.toLowerCase().indexOf(phrase.toLowerCase());
      if (index < 0 || seen.has(skill.id)) continue;
      seen.add(skill.id);
      hits.push({
        skillId: skill.id,
        name: skill.name,
        requirementType: preferredAt >= 0 && index > preferredAt ? "preferred" : "required",
        sourceText: description.slice(index, index + phrase.length),
      });
      break;
    }
  }
  return hits;
}
