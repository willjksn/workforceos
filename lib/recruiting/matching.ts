import { tokenize } from "./internal-search";

export type MatchScoreInput = {
  jobTitle: string;
  jobDescription?: string | null;
  jobSkillNames: string[];
  preferredSkillNames?: string[];
  requiredExperienceYears?: number | null;
  locationLabel?: string | null;
  compensationMin?: number | null;
  compensationMax?: number | null;
  certifications?: string | null;
  candidateName: string;
  candidateTitle?: string | null;
  candidateCompany?: string | null;
  candidateCity?: string | null;
  candidateRegion?: string | null;
  candidateYearsExperience?: number | null;
  candidateCompensation?: string | null;
  candidateCareerInterests?: string | null;
  relocationWillingness?: string | null;
  experienceTitles: string[];
  candidateSkillNames: string[];
  militaryOccupationTitle?: string | null;
  militarySkillNames?: string[];
  silverMedalist?: boolean;
  priorInterviewOutcome?: string | null;
};

export type MatchComponentScores = {
  overall: number;
  skills: number;
  experience: number;
  industry: number;
  location: number;
  compensation: number;
  certification: number;
  military: number;
  careerAlignment: number;
  priorFeedback: number;
  strengths: string[];
  gaps: string[];
  explanation: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseCompensation(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isFinite(amount) ? amount : null;
}

export function scoreCandidateJobMatch(input: MatchScoreInput): MatchComponentScores {
  const required = input.jobSkillNames.map((name) => name.toLowerCase());
  const preferred = (input.preferredSkillNames ?? []).map((name) => name.toLowerCase());
  const candidateSkills = new Set(input.candidateSkillNames.map((name) => name.toLowerCase()));
  const sharedRequired = required.filter((name) => candidateSkills.has(name));
  const sharedPreferred = preferred.filter((name) => candidateSkills.has(name));
  const missingRequired = required.filter((name) => !candidateSkills.has(name));

  const skills = required.length
    ? clamp((sharedRequired.length / required.length) * 80 + (preferred.length ? (sharedPreferred.length / preferred.length) * 20 : 20))
    : sharedPreferred.length
      ? clamp(sharedPreferred.length * 20)
      : 0;

  const years = input.candidateYearsExperience ?? 0;
  const needed = input.requiredExperienceYears ?? 0;
  const experience = needed <= 0 ? (years > 0 ? 70 : 40) : clamp((years / needed) * 100);

  const industryTokens = tokenize(`${input.jobTitle} ${input.jobDescription ?? ""}`);
  const candidateIndustry = tokenize(
    `${input.candidateTitle ?? ""} ${input.candidateCompany ?? ""} ${input.experienceTitles.join(" ")}`,
  );
  const industryOverlap = industryTokens.filter((token) => candidateIndustry.includes(token));
  const industry = industryTokens.length
    ? clamp((industryOverlap.length / industryTokens.length) * 100)
    : 40;

  const jobLocation = (input.locationLabel ?? "").toLowerCase();
  const candidateLocation = `${input.candidateCity ?? ""} ${input.candidateRegion ?? ""}`.toLowerCase();
  let location = 40;
  if (jobLocation && candidateLocation.trim()) {
    location = jobLocation.split(/[,\s]+/).some((part) => part && candidateLocation.includes(part))
      ? 90
      : input.relocationWillingness && /yes|open|willing/i.test(input.relocationWillingness)
        ? 65
        : 25;
  }

  const candidateComp = parseCompensation(input.candidateCompensation);
  let compensation = 50;
  if (candidateComp && (input.compensationMin || input.compensationMax)) {
    const min = input.compensationMin ?? 0;
    const max = input.compensationMax ?? candidateComp;
    compensation = candidateComp >= min && candidateComp <= max ? 90 : candidateComp < min ? 45 : 60;
  }

  const certNeed = tokenize(input.certifications ?? "");
  const certHave = tokenize(input.candidateSkillNames.join(" "));
  const certification = certNeed.length
    ? clamp((certNeed.filter((token) => certHave.includes(token)).length / certNeed.length) * 100)
    : 50;

  const militarySkills = new Set((input.militarySkillNames ?? []).map((name) => name.toLowerCase()));
  const militaryOverlap = required.filter((name) => militarySkills.has(name));
  const military = input.militaryOccupationTitle
    ? clamp(40 + militaryOverlap.length * 12 + (input.silverMedalist ? 8 : 0))
    : 0;

  const interest = tokenize(input.candidateCareerInterests ?? "");
  const titleTokens = tokenize(input.jobTitle);
  const careerAlignment = interest.length
    ? clamp((interest.filter((token) => titleTokens.includes(token)).length / Math.max(titleTokens.length, 1)) * 100)
    : 50;

  let priorFeedback = 50;
  if (input.silverMedalist) priorFeedback = 80;
  if (input.priorInterviewOutcome && /reject|no hire|declin/i.test(input.priorInterviewOutcome)) {
    priorFeedback = 20;
  }

  const overall = clamp(
    skills * 0.3 +
      experience * 0.15 +
      industry * 0.08 +
      location * 0.12 +
      compensation * 0.08 +
      certification * 0.07 +
      military * 0.1 +
      careerAlignment * 0.05 +
      priorFeedback * 0.05,
  );

  const strengths: string[] = [];
  const gaps: string[] = [];
  if (sharedRequired.length) strengths.push(`Required skills: ${sharedRequired.join(", ")}`);
  if (input.militaryOccupationTitle) {
    strengths.push(`Military occupation: ${input.militaryOccupationTitle}`);
  }
  if (input.silverMedalist) strengths.push("Silver medalist on a prior related search");
  if (missingRequired.length) gaps.push(`Missing required skills: ${missingRequired.join(", ")}`);
  if (needed > 0 && years < needed) gaps.push(`Recorded experience ${years} years vs ${needed} required`);
  if (!strengths.length) strengths.push("Limited recorded overlap with this job");

  const explanation = [...strengths, ...gaps].join(". ") + ".";

  return {
    overall,
    skills,
    experience,
    industry,
    location,
    compensation,
    certification,
    military,
    careerAlignment,
    priorFeedback,
    strengths,
    gaps,
    explanation,
  };
}

export function applyHumanOverallOverride(components: MatchComponentScores, override: number, reason: string) {
  return {
    ...components,
    overall: clamp(override),
    explanation: `${components.explanation} Human overall override to ${clamp(override)}: ${reason}.`,
  };
}
