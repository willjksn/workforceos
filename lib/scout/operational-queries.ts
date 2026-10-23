import { and, desc, eq, gte, ilike, inArray, isNull, sql } from "drizzle-orm";

import { getDb } from "../../db";
import {
  candidateJobMatches,
  candidateSkills,
  candidates,
  companies,
  jobs,
  opportunities,
  skills,
  skillbridgeProfiles,
  workforceRoles,
} from "../../db/schema";
import { SCOUT_RESULT_LIMIT } from "./operational-commands";

const OPEN_JOBS = ["open", "search_active"] as const;

function weekAgo(now: Date) {
  return new Date(now.getTime() - 7 * 86_400_000);
}

export async function searchCandidatesByCapability(organizationId: string, skill: string) {
  const db = getDb();
  const term = skill.trim();
  if (!term) return [];
  return db
    .select({
      id: candidates.id,
      name: candidates.fullName,
      skill: skills.name,
    })
    .from(candidateSkills)
    .innerJoin(candidates, and(eq(candidates.id, candidateSkills.candidateId), eq(candidates.organizationId, organizationId)))
    .innerJoin(skills, eq(skills.id, candidateSkills.skillId))
    .where(and(
      eq(candidateSkills.organizationId, organizationId),
      isNull(candidates.archivedAt),
      isNull(candidates.privacyDeletedAt),
      ilike(skills.name, `%${term}%`),
      sql`(
        ${candidateSkills.reviewStatus} = 'approved'
        or (
          ${candidateSkills.capabilityBasis} = 'explicit'
          and ${candidateSkills.reviewStatus} <> 'rejected'
          and (${candidateSkills.source} is null or ${candidateSkills.source} <> 'capability_translation')
        )
      )`,
    ))
    .limit(SCOUT_RESULT_LIMIT);
}

export async function transitioningWithoutWorkflow(organizationId: string) {
  const db = getDb();
  return db
    .select({ id: candidates.id, name: candidates.fullName })
    .from(skillbridgeProfiles)
    .innerJoin(candidates, and(eq(candidates.id, skillbridgeProfiles.candidateId), eq(candidates.organizationId, organizationId)))
    .where(and(
      eq(skillbridgeProfiles.organizationId, organizationId),
      isNull(candidates.archivedAt),
      isNull(candidates.privacyDeletedAt),
      sql`not exists (
        select 1 from opportunity_engagements e
        where e.organization_id = ${skillbridgeProfiles.organizationId}
          and e.candidate_id = ${skillbridgeProfiles.candidateId}
          and e.archived_at is null
          and e.status not in ('withdrawn', 'placed', 'closed')
      )`,
    ))
    .limit(SCOUT_RESULT_LIMIT);
}

export async function resolveByName(
  organizationId: string,
  kind: "candidate" | "job" | "company" | "workforce_role" | "skill",
  name: string,
) {
  const db = getDb();
  const term = `%${name.trim()}%`;
  if (kind === "candidate") {
    const rows = await db
      .select({ id: candidates.id, label: candidates.fullName })
      .from(candidates)
      .where(and(
        eq(candidates.organizationId, organizationId),
        isNull(candidates.archivedAt),
        isNull(candidates.privacyDeletedAt),
        ilike(candidates.fullName, term),
      ))
      .limit(5);
    return rows.map((row) => ({ ...row, href: `/app/talent/${row.id}` }));
  }
  if (kind === "job") {
    const rows = await db
      .select({ id: jobs.id, label: jobs.title, contextType: jobs.jobContextType })
      .from(jobs)
      .where(and(eq(jobs.organizationId, organizationId), isNull(jobs.archivedAt), ilike(jobs.title, term)))
      .limit(5);
    return rows.map((row) => ({ id: row.id, label: row.label, href: `/app/jobs/${row.id}`, contextType: row.contextType }));
  }
  if (kind === "company") {
    const rows = await db
      .select({ id: companies.id, label: companies.name })
      .from(companies)
      .where(and(eq(companies.organizationId, organizationId), isNull(companies.archivedAt), ilike(companies.name, term)))
      .limit(5);
    return rows.map((row) => ({ ...row, href: `/app/companies/${row.id}` }));
  }
  if (kind === "skill") {
    const rows = await db
      .select({ id: skills.id, label: skills.name })
      .from(skills)
      .where(and(isNull(skills.archivedAt), ilike(skills.name, term)))
      .limit(5);
    return rows.map((row) => ({ ...row, href: "/app/workforce/skills" }));
  }
  const rows = await db
    .select({ id: workforceRoles.id, label: workforceRoles.title })
    .from(workforceRoles)
    .where(and(eq(workforceRoles.organizationId, organizationId), ilike(workforceRoles.title, term)))
    .limit(5);
  return rows.map((row) => ({ ...row, href: `/app/workforce/roles/${row.id}` }));
}

export async function recentPublicJobs(organizationId: string, now = new Date()) {
  const db = getDb();
  return db
    .select({
      id: jobs.id,
      title: jobs.title,
      contextType: jobs.jobContextType,
      createdAt: jobs.createdAt,
      sourceUrl: jobs.sourceUrl,
    })
    .from(jobs)
    .where(and(
      eq(jobs.organizationId, organizationId),
      isNull(jobs.archivedAt),
      eq(jobs.jobContextType, "monitored_public"),
      gte(jobs.createdAt, weekAgo(now)),
    ))
    .orderBy(desc(jobs.createdAt))
    .limit(SCOUT_RESULT_LIMIT);
}

export async function strongMatchesWithoutEngagement(organizationId: string) {
  const db = getDb();
  return db
    .select({
      matchId: candidateJobMatches.id,
      candidateId: candidates.id,
      candidateName: candidates.fullName,
      jobId: jobs.id,
      jobTitle: jobs.title,
      contextType: jobs.jobContextType,
    })
    .from(candidateJobMatches)
    .innerJoin(jobs, and(eq(jobs.id, candidateJobMatches.jobId), eq(jobs.organizationId, organizationId)))
    .innerJoin(candidates, and(eq(candidates.id, candidateJobMatches.candidateId), eq(candidates.organizationId, organizationId)))
    .where(and(
      eq(candidateJobMatches.organizationId, organizationId),
      eq(candidateJobMatches.matchCategory, "strong_match"),
      inArray(jobs.status, [...OPEN_JOBS]),
      isNull(jobs.archivedAt),
      isNull(candidates.archivedAt),
      sql`not exists (
        select 1 from opportunity_engagements e
        where e.match_id = ${candidateJobMatches.id}
          and e.organization_id = ${candidateJobMatches.organizationId}
          and e.archived_at is null
          and e.status not in ('withdrawn', 'closed')
      )`,
    ))
    .limit(SCOUT_RESULT_LIMIT);
}

export async function jobsNeedingRequirementReview(organizationId: string) {
  const db = getDb();
  return db
    .select({ id: jobs.id, title: jobs.title, contextType: jobs.jobContextType })
    .from(jobs)
    .where(and(
      eq(jobs.organizationId, organizationId),
      isNull(jobs.archivedAt),
      sql`(
        exists (
          select 1 from job_requirements jr
          where jr.job_id = ${jobs.id}
            and jr.organization_id = ${jobs.organizationId}
            and jr.review_status in ('pending', 'needs_review')
        )
        or exists (
          select 1 from job_skills js
          where js.job_id = ${jobs.id}
            and js.review_status in ('pending', 'needs_review')
        )
      )`,
    ))
    .limit(SCOUT_RESULT_LIMIT);
}

export async function listCrmPursuits(organizationId: string) {
  const db = getDb();
  return db
    .select({ id: opportunities.id, name: opportunities.name })
    .from(opportunities)
    .where(and(eq(opportunities.organizationId, organizationId), isNull(opportunities.archivedAt)))
    .orderBy(desc(opportunities.updatedAt))
    .limit(SCOUT_RESULT_LIMIT);
}
