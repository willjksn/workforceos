import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { getDb } from "../../db";
import {
  candidateClearances,
  candidateCredentials,
  candidateEducation,
  candidateJobMatchFactors,
  candidateJobMatches,
  candidateSkills,
  candidates,
  civilianOccupationJobFamilies,
  civilianOccupations,
  companies,
  jobFamilies,
  jobRequirements,
  jobSkills,
  jobs,
  militaryOccupations,
  occupationSkills,
  skillbridgePreferredLocations,
  skillbridgeProfiles,
  skillbridgeTargetRoles,
  skills,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { completePrompt } from "../ai/provider";
import { CAPABILITY_TRANSLATION_SOURCE } from "../military/capability-translation";
import {
  CURRENT_OPPORTUNITY_STATUSES,
  OPPORTUNITY_MATCH_MODEL,
  OPPORTUNITY_MATCH_VERSION,
  type CandidateMatchProfile,
  type JobMatchProfile,
  type MatchCategory,
  capabilityCountsForMatch,
  evaluateOpportunityMatch,
  extractDeterministicJobRequirements,
  extractSkillMentions,
  isCurrentOpportunityStatus,
  keepCitedRequirements,
  matchCategoryLabel,
  matchInputHash,
  opportunityContextLabel,
} from "./opportunity-match";

const PERSIST_LIMIT = 25;
const CANDIDATE_POOL_LIMIT = 500;
const JOB_POOL_LIMIT = 2000;

export class OpportunityMatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpportunityMatchError";
  }
}

export type MatchCard = {
  matchId: string;
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  companyName: string | null;
  locationLabel: string | null;
  contextLabel: string;
  contextType: string;
  skillbridgeEligible: boolean;
  sourceUrl: string | null;
  jobStatus: string;
  category: MatchCategory;
  categoryLabel: string;
  freshness: "current" | "stale" | "queued" | "error";
  explanation: string;
  aligned: string[];
  gaps: string[];
  evidence: string[];
  lastEvaluatedAt: string | null;
  disposition: string | null;
  military: { branch: string | null; occupation: string | null; timing: string | null } | null;
};

type BuiltCandidate = {
  profile: CandidateMatchProfile;
  name: string;
  military: { branch: string | null; occupation: string | null; availableOn: string | null; windowStart: string | null; windowEnd: string | null } | null;
};

function numeric(value: number) {
  return value.toFixed(2);
}

function httpUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function money(value: string | null | undefined) {
  if (!value) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function explicitCompensation(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\$?\s?\d{2,3}(?:,\d{3})*(?:\.\d+)?$/.test(trimmed) && !/^\d{4,7}(?:\.\d+)?$/.test(trimmed)) return null;
  const amount = Number(trimmed.replace(/[$,\s]/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function dateOnly(value?: Date | null) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function countsInSql() {
  return or(
    eq(candidateSkills.reviewStatus, "approved"),
    and(
      eq(candidateSkills.capabilityBasis, "explicit"),
      ne(candidateSkills.reviewStatus, "rejected"),
      or(isNull(candidateSkills.source), ne(candidateSkills.source, CAPABILITY_TRANSLATION_SOURCE)),
    ),
  );
}

async function loadCandidateBundles(organizationId: string, candidateIds: string[]) {
  const db = getDb();
  const uniqueIds = [...new Set(candidateIds)];
  if (!uniqueIds.length) return new Map<string, BuiltCandidate>();
  const people = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.organizationId, organizationId), inArray(candidates.id, uniqueIds), isNull(candidates.archivedAt)));
  const skillRows = await db
    .select({
      candidateId: candidateSkills.candidateId,
      skillId: candidateSkills.skillId,
      name: skills.name,
      basis: candidateSkills.capabilityBasis,
      reviewStatus: candidateSkills.reviewStatus,
      source: candidateSkills.source,
      evidenceSummary: candidateSkills.evidenceSummary,
    })
    .from(candidateSkills)
    .innerJoin(skills, eq(skills.id, candidateSkills.skillId))
    .where(and(eq(candidateSkills.organizationId, organizationId), inArray(candidateSkills.candidateId, uniqueIds)));
  const credentialRows = await db
    .select()
    .from(candidateCredentials)
    .where(and(eq(candidateCredentials.organizationId, organizationId), inArray(candidateCredentials.candidateId, uniqueIds)));
  const educationRows = await db
    .select()
    .from(candidateEducation)
    .where(and(eq(candidateEducation.organizationId, organizationId), inArray(candidateEducation.candidateId, uniqueIds)));
  const clearanceRows = await db
    .select()
    .from(candidateClearances)
    .where(and(eq(candidateClearances.organizationId, organizationId), inArray(candidateClearances.candidateId, uniqueIds)));
  const profiles = await db
    .select({
      profile: skillbridgeProfiles,
      occupationTitle: militaryOccupations.title,
    })
    .from(skillbridgeProfiles)
    .leftJoin(militaryOccupations, eq(militaryOccupations.id, skillbridgeProfiles.militaryOccupationId))
    .where(and(eq(skillbridgeProfiles.organizationId, organizationId), inArray(skillbridgeProfiles.candidateId, uniqueIds)));
  const profileIds = profiles.map((row) => row.profile.id);
  const roles = profileIds.length
    ? await db.select().from(skillbridgeTargetRoles).where(inArray(skillbridgeTargetRoles.skillbridgeProfileId, profileIds))
    : [];
  const preferredLocations = profileIds.length
    ? await db
        .select()
        .from(skillbridgePreferredLocations)
        .where(inArray(skillbridgePreferredLocations.skillbridgeProfileId, profileIds))
    : [];
  const skillIds = [...new Set(skillRows.map((row) => row.skillId))];
  const familyRows = skillIds.length
    ? await db
        .select({
          skillId: occupationSkills.skillId,
          occupationTitle: civilianOccupations.title,
          familyName: jobFamilies.name,
        })
        .from(occupationSkills)
        .innerJoin(civilianOccupations, eq(civilianOccupations.id, occupationSkills.occupationId))
        .leftJoin(civilianOccupationJobFamilies, eq(civilianOccupationJobFamilies.occupationId, civilianOccupations.id))
        .leftJoin(jobFamilies, eq(jobFamilies.id, civilianOccupationJobFamilies.jobFamilyId))
        .where(inArray(occupationSkills.skillId, skillIds))
    : [];

  const bundles = new Map<string, BuiltCandidate>();
  for (const person of people) {
    const personSkills = skillRows.filter((row) => row.candidateId === person.id);
    const countingIds = new Set(
      personSkills
        .filter((row) =>
          capabilityCountsForMatch({
            basis: row.basis,
            reviewStatus: row.reviewStatus,
            source: row.source,
          }),
        )
        .map((row) => row.skillId),
    );
    const profile = profiles.find((row) => row.profile.candidateId === person.id);
    const personRoles = profile ? roles.filter((row) => row.skillbridgeProfileId === profile.profile.id) : [];
    const families = new Set<string>();
    const occupations = new Set<string>();
    for (const row of familyRows) {
      if (!countingIds.has(row.skillId)) continue;
      if (row.familyName) families.add(row.familyName);
      if (row.occupationTitle) occupations.add(row.occupationTitle);
    }
    for (const role of personRoles) {
      if (role.jobFamily) families.add(role.jobFamily);
      if (role.roleTitle) occupations.add(role.roleTitle);
    }
    const availableOn = dateOnly(profile?.profile.candidateAvailableDate ?? null) ?? dateOnly(profile?.profile.separationDate ?? null);
    bundles.set(person.id, {
      name: person.fullName,
      military: profile
        ? {
            branch: profile.profile.branch,
            occupation: profile.occupationTitle ?? profile.profile.mosRateAfscDisplay,
            availableOn,
            windowStart: dateOnly(profile.profile.skillbridgeWindowStart),
            windowEnd: dateOnly(profile.profile.skillbridgeWindowEnd),
          }
        : null,
      profile: {
        capabilities: personSkills.map((row) => ({
          skillId: row.skillId,
          name: row.name,
          basis: row.basis,
          reviewStatus: row.reviewStatus,
          source: row.source,
          evidence: row.evidenceSummary ? [row.evidenceSummary] : [],
        })),
        credentials: credentialRows.filter((row) => row.candidateId === person.id).map((row) => row.name),
        education: educationRows
          .filter((row) => row.candidateId === person.id)
          .map((row) => [row.degreeOrCredential, row.fieldOfStudy].filter(Boolean).join(" ")),
        clearanceLevel: clearanceRows.find((row) => row.candidateId === person.id)?.clearanceLevel ?? null,
        yearsExperience: person.yearsExperience,
        city: person.city,
        region: person.region,
        preferredLocations: profile
          ? preferredLocations
              .filter((row) => row.skillbridgeProfileId === profile.profile.id)
              .flatMap((row) => [row.locationLabel, row.city, row.region].filter((item): item is string => Boolean(item)))
          : [],
        relocationWillingness: profile?.profile.relocationWillingness ?? person.relocationWillingness,
        remotePreference: profile?.profile.remotePreference ?? person.remotePreference,
        availableOn,
        skillbridgeWindowStart: dateOnly(profile?.profile.skillbridgeWindowStart ?? null),
        skillbridgeWindowEnd: dateOnly(profile?.profile.skillbridgeWindowEnd ?? null),
        compensation: explicitCompensation(person.compensationExpectations),
        jobFamilies: [...families],
        occupations: [...occupations],
      },
    });
  }
  return bundles;
}

function jobProfile(input: {
  job: typeof jobs.$inferSelect;
  capabilities: JobMatchProfile["capabilities"];
  requirements: JobMatchProfile["requirements"];
}): JobMatchProfile {
  const requirements = [...input.requirements];
  if (
    input.job.requiredExperienceYears &&
    !requirements.some((row) => row.kind === "experience" && row.reviewStatus === "approved")
  ) {
    requirements.push({
      kind: "experience",
      requirementType: "required",
      label: `${input.job.requiredExperienceYears} years`,
      valueText: `${input.job.requiredExperienceYears} years`,
      reviewStatus: "approved",
    });
  }
  return {
    status: input.job.status,
    contextType: input.job.jobContextType,
    title: input.job.title,
    locationLabel: input.job.locationLabel,
    workplaceType: input.job.workplaceType,
    skillbridgeEligible: input.job.skillbridgeEligible || input.job.jobContextType === "skillbridge",
    targetStart: input.job.targetStartDate,
    compensationMin: money(input.job.compensationMin),
    compensationMax: money(input.job.compensationMax),
    contentHash: input.job.contentHash,
    capabilities: input.capabilities,
    requirements,
  };
}

async function loadJobBundles(organizationId: string, jobIds: string[]) {
  const db = getDb();
  const uniqueIds = [...new Set(jobIds)];
  if (!uniqueIds.length) return new Map<string, { job: typeof jobs.$inferSelect; companyName: string | null; profile: JobMatchProfile }>();
  const rows = await db
    .select({ job: jobs, companyName: companies.name })
    .from(jobs)
    .leftJoin(companies, eq(companies.id, jobs.companyId))
    .where(and(eq(jobs.organizationId, organizationId), inArray(jobs.id, uniqueIds), isNull(jobs.archivedAt)));
  const skillRows = await db
    .select({ link: jobSkills, name: skills.name })
    .from(jobSkills)
    .innerJoin(skills, eq(skills.id, jobSkills.skillId))
    .where(inArray(jobSkills.jobId, uniqueIds));
  const requirementRows = await db
    .select()
    .from(jobRequirements)
    .where(and(eq(jobRequirements.organizationId, organizationId), inArray(jobRequirements.jobId, uniqueIds)));
  const bundles = new Map<string, { job: typeof jobs.$inferSelect; companyName: string | null; profile: JobMatchProfile }>();
  for (const row of rows) {
    bundles.set(row.job.id, {
      job: row.job,
      companyName: row.companyName,
      profile: jobProfile({
        job: row.job,
        capabilities: skillRows
          .filter((skill) => skill.link.jobId === row.job.id)
          .map((skill) => ({
            skillId: skill.link.skillId,
            name: skill.name,
            requirementType: skill.link.requirementType,
            reviewStatus: skill.link.reviewStatus,
          })),
        requirements: requirementRows
          .filter((requirement) => requirement.jobId === row.job.id)
          .map((requirement) => ({
            kind: requirement.kind,
            requirementType: requirement.requirementType,
            label: requirement.label,
            valueText: requirement.valueText,
            reviewStatus: requirement.reviewStatus,
          })),
      }),
    });
  }
  return bundles;
}

async function persistEvaluations(input: {
  organizationId: string;
  source?: string;
  pairs: Array<{ candidateId: string; jobId: string; result: ReturnType<typeof evaluateOpportunityMatch> }>;
}) {
  const db = getDb();
  const saved: string[] = [];
  for (const pair of input.pairs) {
    const [row] = await db
      .insert(candidateJobMatches)
      .values({
        organizationId: input.organizationId,
        candidateId: pair.candidateId,
        jobId: pair.jobId,
        score: numeric(pair.result.score),
        skillsScore: numeric(pair.result.score),
        explanation: pair.result.explanation,
        strengths: pair.result.strengths.join("; "),
        gaps: pair.result.gaps.join("; "),
        modelName: OPPORTUNITY_MATCH_MODEL,
        modelVersion: OPPORTUNITY_MATCH_VERSION,
        source: input.source ?? "opportunity_match",
        lastCalculatedAt: new Date(),
        matchCategory: pair.result.category,
        freshness: "current",
        inputHash: pair.result.inputHash,
        pipelineStatus: "identified",
      })
      .onConflictDoUpdate({
        target: [candidateJobMatches.candidateId, candidateJobMatches.jobId],
        set: {
          organizationId: input.organizationId,
          score: numeric(pair.result.score),
          skillsScore: numeric(pair.result.score),
          explanation: pair.result.explanation,
          strengths: pair.result.strengths.join("; "),
          gaps: pair.result.gaps.join("; "),
          modelName: OPPORTUNITY_MATCH_MODEL,
          modelVersion: OPPORTUNITY_MATCH_VERSION,
          source: input.source ?? "opportunity_match",
          lastCalculatedAt: new Date(),
          matchCategory: pair.result.category,
          freshness: "current",
          inputHash: pair.result.inputHash,
          updatedAt: new Date(),
        },
      })
      .returning({ id: candidateJobMatches.id });
    saved.push(row.id);
    await db.delete(candidateJobMatchFactors).where(eq(candidateJobMatchFactors.matchId, row.id));
    if (pair.result.factors.length) {
      await db.insert(candidateJobMatchFactors).values(
        pair.result.factors.map((factor, index) => ({
          organizationId: input.organizationId,
          matchId: row.id,
          factorGroup: factor.factorGroup,
          dimension: factor.dimension,
          label: factor.label,
          detail: factor.detail ?? null,
          sortOrder: index,
        })),
      );
    }
  }
  return saved;
}

function choosePairs(input: {
  evaluated: Array<{ candidateId: string; jobId: string; result: ReturnType<typeof evaluateOpportunityMatch> }>;
  existingKeys: Set<string>;
}) {
  const ranked = [...input.evaluated].sort((left, right) => {
    const order = ["strong_match", "possible_match", "developmental_match", "no_current_match"];
    const category = order.indexOf(left.result.category) - order.indexOf(right.result.category);
    return category || right.result.score - left.result.score;
  });
  const positive = ranked.filter((row) => row.result.category !== "no_current_match").slice(0, PERSIST_LIMIT);
  const chosen = new Map<string, (typeof ranked)[number]>();
  for (const row of positive) chosen.set(`${row.candidateId}:${row.jobId}`, row);
  for (const row of ranked) {
    const key = `${row.candidateId}:${row.jobId}`;
    if (input.existingKeys.has(key)) chosen.set(key, row);
  }
  return [...chosen.values()];
}

export async function recalculateCandidateOpportunities(input: {
  organizationId: string;
  actorUserId: string;
  candidateId: string;
  source?: string;
}) {
  const db = getDb();
  const candidatesById = await loadCandidateBundles(input.organizationId, [input.candidateId]);
  const candidate = candidatesById.get(input.candidateId);
  if (!candidate) throw new OpportunityMatchError("Candidate was not found in this organization.");
  const openJobs = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.organizationId, input.organizationId),
        inArray(jobs.status, [...CURRENT_OPPORTUNITY_STATUSES]),
        isNull(jobs.archivedAt),
      ),
    )
    .orderBy(desc(jobs.updatedAt))
    .limit(JOB_POOL_LIMIT);
  const jobBundles = await loadJobBundles(input.organizationId, openJobs.map((row) => row.id));
  const existing = await db
    .select({ id: candidateJobMatches.id, jobId: candidateJobMatches.jobId, candidateId: candidateJobMatches.candidateId })
    .from(candidateJobMatches)
    .where(and(eq(candidateJobMatches.organizationId, input.organizationId), eq(candidateJobMatches.candidateId, input.candidateId)));
  const evaluated = [...jobBundles.values()].map((bundle) => ({
    candidateId: input.candidateId,
    jobId: bundle.job.id,
    result: evaluateOpportunityMatch(candidate.profile, bundle.profile),
  }));
  const pairs = choosePairs({
    evaluated,
    existingKeys: new Set(existing.map((row) => `${row.candidateId}:${row.jobId}`)),
  });
  const saved = await persistEvaluations({
    organizationId: input.organizationId,
    source: input.source,
    pairs,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "match.recalculated",
    recordType: "candidate",
    recordId: input.candidateId,
    after: { evaluated: evaluated.length, persisted: saved.length, model: OPPORTUNITY_MATCH_VERSION },
  });
  return { evaluated: evaluated.length, persisted: saved.length };
}

export async function recalculateJobTalent(input: {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  source?: string;
}) {
  const db = getDb();
  const jobBundles = await loadJobBundles(input.organizationId, [input.jobId]);
  const bundle = jobBundles.get(input.jobId);
  if (!bundle) throw new OpportunityMatchError("Job was not found in this organization.");
  const approvedSkillIds = bundle.profile.capabilities
    .filter((row) => row.reviewStatus === "approved")
    .map((row) => row.skillId);
  const familyLabels = bundle.profile.requirements
    .filter((row) => row.reviewStatus === "approved" && (row.kind === "job_family" || row.kind === "occupation"))
    .map((row) => row.label);
  if (!approvedSkillIds.length && !bundle.profile.requirements.some((row) => row.reviewStatus === "approved")) {
    return { evaluated: 0, persisted: 0 };
  }
  const overlap = approvedSkillIds.length
    ? await db
        .select({
          candidateId: candidateSkills.candidateId,
          updatedAt: candidates.updatedAt,
        })
        .from(candidateSkills)
        .innerJoin(candidates, eq(candidates.id, candidateSkills.candidateId))
        .where(
          and(
            eq(candidateSkills.organizationId, input.organizationId),
            eq(candidates.organizationId, input.organizationId),
            inArray(candidateSkills.skillId, approvedSkillIds),
            countsInSql(),
            isNull(candidates.archivedAt),
            isNull(candidates.privacyDeletedAt),
          ),
        )
        .orderBy(desc(candidates.updatedAt))
        .limit(CANDIDATE_POOL_LIMIT)
    : [];
  const familyCandidates = familyLabels.length
    ? await db
        .select({ candidateId: skillbridgeProfiles.candidateId })
        .from(skillbridgeTargetRoles)
        .innerJoin(skillbridgeProfiles, eq(skillbridgeProfiles.id, skillbridgeTargetRoles.skillbridgeProfileId))
        .where(
          and(
            eq(skillbridgeProfiles.organizationId, input.organizationId),
            or(
              ...familyLabels.map((label) => sql`lower(${skillbridgeTargetRoles.jobFamily}) = lower(${label})`),
              ...familyLabels.map((label) => sql`lower(${skillbridgeTargetRoles.roleTitle}) = lower(${label})`),
            ),
          ),
        )
        .limit(100)
    : [];
  const candidateIds = [...new Set([...overlap.map((row) => row.candidateId), ...familyCandidates.map((row) => row.candidateId)])].slice(0, CANDIDATE_POOL_LIMIT);
  const people = await loadCandidateBundles(input.organizationId, candidateIds);
  const existing = await db
    .select({ candidateId: candidateJobMatches.candidateId, jobId: candidateJobMatches.jobId })
    .from(candidateJobMatches)
    .where(and(eq(candidateJobMatches.organizationId, input.organizationId), eq(candidateJobMatches.jobId, input.jobId)));
  const evaluated = [...people.entries()].map(([candidateId, person]) => ({
    candidateId,
    jobId: input.jobId,
    result: evaluateOpportunityMatch(person.profile, bundle.profile),
  }));
  const pairs = choosePairs({
    evaluated,
    existingKeys: new Set(existing.map((row) => `${row.candidateId}:${row.jobId}`)),
  });
  const saved = await persistEvaluations({
    organizationId: input.organizationId,
    source: input.source,
    pairs,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "match.recalculated",
    recordType: "job",
    recordId: input.jobId,
    after: { evaluated: evaluated.length, persisted: saved.length, model: OPPORTUNITY_MATCH_VERSION },
  });
  return { evaluated: evaluated.length, persisted: saved.length };
}

function factorLabels(factors: Array<{ factorGroup: string; label: string }>, group: string) {
  return factors.filter((row) => row.factorGroup === group).map((row) => row.label);
}

async function cardsFromRows(organizationId: string, matchIds: string[]) {
  const db = getDb();
  if (!matchIds.length) return [] as MatchCard[];
  const rows = await db
    .select({
      match: candidateJobMatches,
      candidate: candidates,
      job: jobs,
      companyName: companies.name,
    })
    .from(candidateJobMatches)
    .innerJoin(candidates, eq(candidates.id, candidateJobMatches.candidateId))
    .innerJoin(jobs, eq(jobs.id, candidateJobMatches.jobId))
    .leftJoin(companies, eq(companies.id, jobs.companyId))
    .where(and(eq(candidateJobMatches.organizationId, organizationId), inArray(candidateJobMatches.id, matchIds)));
  const factors = await db
    .select()
    .from(candidateJobMatchFactors)
    .where(inArray(candidateJobMatchFactors.matchId, matchIds));
  const people = await loadCandidateBundles(organizationId, rows.map((row) => row.candidate.id));
  const jobBundles = await loadJobBundles(organizationId, rows.map((row) => row.job.id));
  const staleIds: string[] = [];
  const cards: MatchCard[] = [];
  for (const row of rows) {
    const person = people.get(row.candidate.id);
    const jobBundle = jobBundles.get(row.job.id);
    const currentHash = person && jobBundle ? matchInputHash(person.profile, jobBundle.profile) : null;
    const storedFreshness = row.match.freshness;
    const freshness: MatchCard["freshness"] =
      currentHash &&
      row.match.inputHash === currentHash &&
      (storedFreshness === "current" || storedFreshness === "queued" || storedFreshness === "error")
        ? storedFreshness
        : "stale";
    if (freshness === "stale" && row.match.freshness !== "stale") staleIds.push(row.match.id);
    const rowFactors = factors
      .filter((factor) => factor.matchId === row.match.id)
      .sort((left, right) => left.sortOrder - right.sortOrder);
    const category = (row.match.matchCategory ?? "no_current_match") as MatchCategory;
    const timing = person?.military
      ? row.job.skillbridgeEligible || row.job.jobContextType === "skillbridge"
        ? person.military.windowStart
          ? `SkillBridge window ${person.military.windowStart}`
          : person.military.availableOn
        : person.military.availableOn
      : null;
    cards.push({
      matchId: row.match.id,
      candidateId: row.candidate.id,
      candidateName: row.candidate.fullName,
      jobId: row.job.id,
      jobTitle: row.job.title,
      companyName: row.companyName,
      locationLabel: row.job.locationLabel,
      contextType: row.job.jobContextType,
      skillbridgeEligible: row.job.skillbridgeEligible || row.job.jobContextType === "skillbridge",
      contextLabel: opportunityContextLabel(row.job.jobContextType),
      sourceUrl: httpUrl(row.job.sourceUrl),
      jobStatus: row.job.status,
      category,
      categoryLabel: row.match.matchCategory ? matchCategoryLabel(category) : "Not calculated",
      freshness: row.match.matchCategory ? freshness : "stale",
      explanation: row.match.explanation ?? "",
      aligned: factorLabels(rowFactors, "aligned"),
      gaps: [
        ...factorLabels(rowFactors, "documented_gap"),
        ...factorLabels(rowFactors, "preferred_gap"),
        ...factorLabels(rowFactors, "unknown"),
      ],
      evidence: factorLabels(rowFactors, "evidence"),
      lastEvaluatedAt: row.match.lastCalculatedAt?.toISOString() ?? null,
      disposition: row.match.recruiterDisposition,
      military: person?.military
        ? { branch: person.military.branch, occupation: person.military.occupation, timing }
        : null,
    });
  }
  if (staleIds.length) {
    await db
      .update(candidateJobMatches)
      .set({ freshness: "stale", updatedAt: new Date() })
      .where(inArray(candidateJobMatches.id, staleIds));
  }
  const order = ["strong_match", "possible_match", "developmental_match", "no_current_match"];
  return cards.sort((left, right) => order.indexOf(left.category) - order.indexOf(right.category));
}

export async function listCandidateOpportunityMatches(organizationId: string, candidateId: string) {
  const db = getDb();
  const rows = await db
    .select({ id: candidateJobMatches.id, status: jobs.status })
    .from(candidateJobMatches)
    .innerJoin(jobs, and(eq(jobs.id, candidateJobMatches.jobId), eq(jobs.organizationId, organizationId)))
    .where(
      and(
        eq(candidateJobMatches.organizationId, organizationId),
        eq(candidateJobMatches.candidateId, candidateId),
        inArray(jobs.status, [...CURRENT_OPPORTUNITY_STATUSES]),
        isNull(jobs.archivedAt),
      ),
    );
  const cards = await cardsFromRows(organizationId, rows.map((row) => row.id));
  return cards.filter((card) => card.category !== "no_current_match" && isCurrentOpportunityStatus(card.jobStatus));
}

export async function listJobTalentMatches(organizationId: string, jobId: string) {
  const db = getDb();
  const rows = await db
    .select({ id: candidateJobMatches.id })
    .from(candidateJobMatches)
    .innerJoin(candidates, and(eq(candidates.id, candidateJobMatches.candidateId), eq(candidates.organizationId, organizationId)))
    .where(and(eq(candidateJobMatches.organizationId, organizationId), eq(candidateJobMatches.jobId, jobId)));
  const cards = await cardsFromRows(organizationId, rows.map((row) => row.id));
  return cards.filter((card) => card.category !== "no_current_match");
}

export async function setMatchDisposition(input: {
  organizationId: string;
  actorUserId: string;
  matchId: string;
  disposition: "viable" | "not_viable" | "needs_information";
  note?: string | null;
}) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(candidateJobMatches)
    .where(and(eq(candidateJobMatches.id, input.matchId), eq(candidateJobMatches.organizationId, input.organizationId)))
    .limit(1);
  if (!before) throw new OpportunityMatchError("Match was not found in this organization.");
  const [after] = await db
    .update(candidateJobMatches)
    .set({
      recruiterDisposition: input.disposition,
      dispositionNote: input.note ?? null,
      dispositionByUserId: input.actorUserId,
      dispositionAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(candidateJobMatches.id, before.id))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "match.disposition_set",
    recordType: "candidate_job_match",
    recordId: after.id,
    before: { disposition: before.recruiterDisposition, category: before.matchCategory },
    after: { disposition: after.recruiterDisposition, category: after.matchCategory },
  });
  return after;
}

export async function reviewJobRequirement(input: {
  organizationId: string;
  actorUserId: string;
  requirementId: string;
  reviewStatus: "approved" | "rejected" | "needs_review";
}) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(jobRequirements)
    .where(and(eq(jobRequirements.id, input.requirementId), eq(jobRequirements.organizationId, input.organizationId)))
    .limit(1);
  if (!before) throw new OpportunityMatchError("Job requirement was not found in this organization.");
  const [after] = await db
    .update(jobRequirements)
    .set({
      reviewStatus: input.reviewStatus,
      reviewedByUserId: input.actorUserId,
      reviewedAt: new Date(),
      requirementSource: before.requirementSource === "ai_extraction" && input.reviewStatus === "approved"
        ? "reviewed_ai_extraction"
        : before.requirementSource,
      updatedAt: new Date(),
    })
    .where(eq(jobRequirements.id, before.id))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "job_requirement.reviewed",
    recordType: "job_requirement",
    recordId: after.id,
    before: { reviewStatus: before.reviewStatus },
    after: { reviewStatus: after.reviewStatus },
  });
  return after;
}

export async function reviewJobSkillRequirement(input: {
  organizationId: string;
  actorUserId: string;
  jobSkillId: string;
  reviewStatus: "approved" | "rejected" | "needs_review";
}) {
  const db = getDb();
  const [link] = await db
    .select({ skill: jobSkills, organizationId: jobs.organizationId })
    .from(jobSkills)
    .innerJoin(jobs, eq(jobs.id, jobSkills.jobId))
    .where(and(eq(jobSkills.id, input.jobSkillId), eq(jobs.organizationId, input.organizationId)))
    .limit(1);
  if (!link) throw new OpportunityMatchError("Job capability was not found in this organization.");
  const [after] = await db
    .update(jobSkills)
    .set({
      reviewStatus: input.reviewStatus,
      reviewedByUserId: input.actorUserId,
      reviewedAt: new Date(),
      humanVerified: input.reviewStatus === "approved",
      requirementSource: link.skill.requirementSource === "ai_extraction" && input.reviewStatus === "approved"
        ? "reviewed_ai_extraction"
        : link.skill.requirementSource,
      updatedAt: new Date(),
    })
    .where(eq(jobSkills.id, link.skill.id))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "job_requirement.reviewed",
    recordType: "job_skill",
    recordId: after.id,
    before: { reviewStatus: link.skill.reviewStatus },
    after: { reviewStatus: after.reviewStatus },
  });
  return after;
}

export async function draftJobRequirements(input: {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  citedDrafts?: Array<{ kind: string; requirementType: "required" | "preferred" | "nice_to_have"; label: string; valueText?: string | null; sourceText: string }>;
}) {
  const db = getDb();
  const bundles = await loadJobBundles(input.organizationId, [input.jobId]);
  const bundle = bundles.get(input.jobId);
  if (!bundle) throw new OpportunityMatchError("Job was not found in this organization.");
  const description = bundle.job.description ?? "";
  let modelDrafts = input.citedDrafts ?? [];
  if (!input.citedDrafts && description.trim()) {
    try {
      const result = await completePrompt({
        taskType: "job_requirement_extraction",
        messages: [
          {
            role: "system",
            content:
              "Extract job requirements as JSON {\"requirements\":[{\"kind\":\"credential|education|clearance|experience|workplace|license\",\"requirementType\":\"required|preferred\",\"label\":\"\",\"valueText\":\"\",\"sourceText\":\"\"}]}. sourceText must be an exact excerpt from the job description. Do not invent requirements.",
          },
          { role: "user", content: description.slice(0, 6000) },
        ],
        maxTokens: 700,
      });
      const json = /\{[\s\S]*\}/.exec(result.text)?.[0];
      const parsed = json ? JSON.parse(json) as { requirements?: typeof modelDrafts } : null;
      if (Array.isArray(parsed?.requirements)) modelDrafts = parsed.requirements;
    } catch {
      modelDrafts = [];
    }
  }
  const deterministic = extractDeterministicJobRequirements(description).map((row) => ({
    ...row,
    source: "public_job_description" as const,
  }));
  const cited = keepCitedRequirements(description, modelDrafts).map((row) => ({
    ...row,
    source: "ai_extraction" as const,
  }));
  const catalog = await db
    .select({ id: skills.id, name: skills.name })
    .from(skills)
    .where(isNull(skills.archivedAt));
  const mentions = extractSkillMentions(description, catalog);
  let stored = 0;
  for (const draft of [...deterministic, ...cited]) {
    if (!["credential", "education", "clearance", "experience", "location", "workplace", "travel", "license", "job_family", "occupation"].includes(draft.kind)) {
      continue;
    }
    await db
      .insert(jobRequirements)
      .values({
        organizationId: input.organizationId,
        jobId: input.jobId,
        kind: draft.kind,
        requirementType: draft.requirementType,
        label: draft.label,
        valueText: draft.valueText ?? null,
        requirementSource: draft.source,
        sourceText: draft.sourceText,
        reviewStatus: "pending",
      })
      .onConflictDoNothing();
    stored += 1;
  }
  for (const mention of mentions) {
    await db
      .insert(jobSkills)
      .values({
        jobId: input.jobId,
        skillId: mention.skillId,
        requirementType: mention.requirementType,
        requirementSource: bundle.job.careerSourceId ? "public_job_description" : "recruiter_entry",
        sourceText: mention.sourceText,
        reviewStatus: "pending",
        humanVerified: false,
      })
      .onConflictDoNothing();
    stored += 1;
  }
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "job_requirement.drafted",
    recordType: "job",
    recordId: input.jobId,
    after: { drafted: stored },
  });
  return { drafted: stored };
}

export async function listJobRequirementProfile(organizationId: string, jobId: string) {
  const db = getDb();
  const bundle = await loadJobBundles(organizationId, [jobId]);
  const job = bundle.get(jobId);
  if (!job) return null;
  const skillRows = await db
    .select({ link: jobSkills, name: skills.name })
    .from(jobSkills)
    .innerJoin(skills, eq(skills.id, jobSkills.skillId))
    .where(eq(jobSkills.jobId, jobId));
  const requirements = await db
    .select()
    .from(jobRequirements)
    .where(and(eq(jobRequirements.organizationId, organizationId), eq(jobRequirements.jobId, jobId), isNull(jobRequirements.archivedAt)));
  return {
    skills: skillRows.map((row) => ({
      id: row.link.id,
      name: row.name,
      requirementType: row.link.requirementType,
      reviewStatus: row.link.reviewStatus,
      source: row.link.requirementSource,
      sourceText: row.link.sourceText,
    })),
    requirements: requirements.map((row) => ({
      id: row.id,
      kind: row.kind,
      label: row.label,
      requirementType: row.requirementType,
      reviewStatus: row.reviewStatus,
      source: row.requirementSource,
      sourceText: row.sourceText,
    })),
  };
}
