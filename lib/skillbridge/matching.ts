import { and, eq, inArray, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import {
  candidateExperiences,
  candidateSkills,
  candidates,
  companies,
  jobs,
  militaryOccupations,
  skillbridgePreferredLocations,
  skillbridgeProfiles,
  skillbridgeTargetRoles,
  skills,
} from "../../db/schema";
import { scoreCandidateJobMatch } from "../recruiting/matching";

export async function findSkillBridgeMatches(input: {
  organizationId: string;
  profileId?: string | null;
  candidateId?: string | null;
  limit?: number;
}) {
  const db = getDb();
  const [profile] = await db
    .select({
      profile: skillbridgeProfiles,
      candidate: candidates,
      occupation: militaryOccupations,
    })
    .from(skillbridgeProfiles)
    .innerJoin(candidates, eq(candidates.id, skillbridgeProfiles.candidateId))
    .leftJoin(militaryOccupations, eq(militaryOccupations.id, skillbridgeProfiles.militaryOccupationId))
    .where(
      and(
        eq(skillbridgeProfiles.organizationId, input.organizationId),
        input.profileId ? eq(skillbridgeProfiles.id, input.profileId) : undefined,
        input.candidateId ? eq(skillbridgeProfiles.candidateId, input.candidateId) : undefined,
        isNull(skillbridgeProfiles.archivedAt),
        isNull(candidates.archivedAt),
      ),
    )
    .limit(1);
  if (!profile) {
    const [candidate] = await db
      .select()
      .from(candidates)
      .where(
        and(
          eq(candidates.organizationId, input.organizationId),
          input.candidateId ? eq(candidates.id, input.candidateId) : undefined,
          isNull(candidates.archivedAt),
        ),
      )
      .limit(1);
    if (!candidate) return [];
    return matchCandidateToOpenJobs({
      organizationId: input.organizationId,
      candidate,
      occupationTitle: null,
      preferredCity: candidate.city,
      preferredRegion: candidate.region,
      targetRoles: [],
      limit: input.limit ?? 8,
    });
  }

  const locations = await db
    .select()
    .from(skillbridgePreferredLocations)
    .where(eq(skillbridgePreferredLocations.skillbridgeProfileId, profile.profile.id));
  const roles = await db
    .select()
    .from(skillbridgeTargetRoles)
    .where(eq(skillbridgeTargetRoles.skillbridgeProfileId, profile.profile.id));
  const primary = locations.find((row) => row.isPrimary) ?? locations[0];
  return matchCandidateToOpenJobs({
    organizationId: input.organizationId,
    candidate: profile.candidate,
    occupationTitle: profile.occupation?.title ?? null,
    preferredCity: primary?.city ?? profile.candidate.city,
    preferredRegion: primary?.region ?? profile.candidate.region,
    targetRoles: roles.map((row) => row.roleTitle),
    preferSkillbridgeEligible: Boolean(profile.profile.skillbridgeWindowStart || profile.profile.skillbridgeWindowEnd),
    limit: input.limit ?? 8,
  });
}

async function matchCandidateToOpenJobs(input: {
  organizationId: string;
  candidate: typeof candidates.$inferSelect;
  occupationTitle: string | null;
  preferredCity?: string | null;
  preferredRegion?: string | null;
  targetRoles: string[];
  preferSkillbridgeEligible?: boolean;
  limit: number;
}) {
  const db = getDb();
  const openJobs = await db
    .select({ job: jobs, company: companies })
    .from(jobs)
    .leftJoin(companies, eq(companies.id, jobs.companyId))
    .where(
      and(
        eq(jobs.organizationId, input.organizationId),
        inArray(jobs.status, ["open", "search_active"]),
        isNull(jobs.archivedAt),
      ),
    );
  const skillRows = await db
    .select({ name: skills.name })
    .from(candidateSkills)
    .innerJoin(skills, eq(skills.id, candidateSkills.skillId))
    .where(eq(candidateSkills.candidateId, input.candidate.id));
  const experiences = await db
    .select()
    .from(candidateExperiences)
    .where(eq(candidateExperiences.candidateId, input.candidate.id));

  return openJobs
    .map(({ job, company }) => {
      const scored = scoreCandidateJobMatch({
        jobTitle: `${job.title} ${input.targetRoles.join(" ")}`,
        jobDescription: job.description,
        jobSkillNames: [],
        locationLabel: job.locationLabel ?? [input.preferredCity, input.preferredRegion].filter(Boolean).join(", "),
        requiredExperienceYears: job.requiredExperienceYears,
        candidateName: input.candidate.fullName,
        candidateTitle: input.candidate.currentTitle,
        candidateCompany: input.candidate.currentCompany,
        candidateCity: input.preferredCity ?? input.candidate.city,
        candidateRegion: input.preferredRegion ?? input.candidate.region,
        candidateYearsExperience: input.candidate.yearsExperience,
        candidateCareerInterests: input.candidate.careerInterests,
        relocationWillingness: input.candidate.relocationWillingness,
        experienceTitles: experiences.map((row) => `${row.title} ${row.employer}`),
        candidateSkillNames: skillRows.map((row) => row.name),
        militaryOccupationTitle: input.occupationTitle,
      });
      return {
        jobId: job.id,
        companyId: job.companyId,
        companyName: company?.name ?? "Unassigned company",
        jobTitle: job.title,
        location: job.locationLabel,
        status: job.status,
        overall: scored.overall,
        skillbridgeEligible: job.skillbridgeEligible || job.jobContextType === "skillbridge",
        explanation: scored.explanation,
        strengths: scored.strengths,
        gaps: scored.gaps,
        href: `/app/jobs/${job.id}`,
      };
    })
    .sort((a, b) => {
      if (input.preferSkillbridgeEligible && a.skillbridgeEligible !== b.skillbridgeEligible) {
        return a.skillbridgeEligible ? -1 : 1;
      }
      return b.overall - a.overall;
    })
    .slice(0, input.limit);
}
