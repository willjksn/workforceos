import { and, count, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { getDb } from "../../db";
import {
  candidateJobMatches,
  candidateSkills,
  candidates,
  careerSources,
  jobRequirements,
  jobSkills,
  jobs,
  militaryCivilianMappings,
  skillbridgeProfiles,
} from "../../db/schema";
import { listEngagementQueue } from "../recruiting/opportunity-engagement";
import { can, type Principal } from "../rbac/permissions";
import { loadWorkforcePortfolio } from "../workforce/pipeline-supply";
import { composeOperationalBoard, type CommandCenterFacts, type SystemFact } from "./compose";

const OPEN_JOBS = ["open", "search_active"] as const;
const PENDING = ["pending", "needs_review"] as const;

function daysAgo(now: Date, days: number) {
  return new Date(now.getTime() - days * 86_400_000);
}

function onTransitionList() {
  return sql`exists (
    select 1 from candidate_military_experiences ex
    inner join candidates c on c.id = ex.candidate_id
    inner join military_occupations occ on occ.id = ex.military_occupation_id
    where ex.candidate_id = ${skillbridgeProfiles.candidateId}
      and c.organization_id = ${skillbridgeProfiles.organizationId}
      and c.archived_at is null
      and c.privacy_deleted_at is null
  )`;
}

async function settle<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Query failed" };
  }
}

async function loadTalentFacts(organizationId: string, now: Date) {
  const db = getDb();
  const week = daysAgo(now, 7);
  const [created] = await db
    .select({ value: count() })
    .from(candidates)
    .where(and(
      eq(candidates.organizationId, organizationId),
      isNull(candidates.archivedAt),
      isNull(candidates.privacyDeletedAt),
      gte(candidates.createdAt, week),
    ));
  const [incomplete] = await db
    .select({ value: sql<number>`count(distinct ${skillbridgeProfiles.candidateId})::int` })
    .from(skillbridgeProfiles)
    .where(and(
      eq(skillbridgeProfiles.organizationId, organizationId),
      isNull(skillbridgeProfiles.archivedAt),
      onTransitionList(),
      isNull(skillbridgeProfiles.separationDate),
      isNull(skillbridgeProfiles.endOfServiceDate),
      isNull(skillbridgeProfiles.etsDate),
      isNull(skillbridgeProfiles.eaosDate),
      or(isNull(skillbridgeProfiles.preferredLocationPrimary), eq(skillbridgeProfiles.preferredLocationPrimary, "")),
    ));
  const [withoutWorkflow] = await db
    .select({ value: sql<number>`count(distinct ${skillbridgeProfiles.candidateId})::int` })
    .from(skillbridgeProfiles)
    .where(and(
      eq(skillbridgeProfiles.organizationId, organizationId),
      isNull(skillbridgeProfiles.archivedAt),
      onTransitionList(),
      sql`not exists (
        select 1 from opportunity_engagements e
        where e.organization_id = ${skillbridgeProfiles.organizationId}
          and e.candidate_id = ${skillbridgeProfiles.candidateId}
          and e.archived_at is null
          and e.status not in ('withdrawn', 'placed', 'closed')
      )`,
    ));
  return {
    newMembers: Number(created?.value ?? 0),
    profilesNeedingInformation: Number(incomplete?.value ?? 0),
    waitingBeyondDays: null as number | null,
    withoutWorkflow: Number(withoutWorkflow?.value ?? 0),
  };
}

async function loadDemandFacts(organizationId: string, now: Date) {
  const db = getDb();
  const week = daysAgo(now, 7);
  const base = and(eq(jobs.organizationId, organizationId), isNull(jobs.archivedAt), eq(jobs.jobContextType, "monitored_public"));
  const [created] = await db.select({ value: count() }).from(jobs).where(and(base, gte(jobs.createdAt, week)));
  const [changed] = await db.select({ value: count() }).from(jobs).where(and(base, gte(jobs.updatedAt, week), lt(jobs.createdAt, week)));
  const [requirements] = await db
    .select({ value: count() })
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
    ));
  const [noStrong] = await db
    .select({ value: count() })
    .from(jobs)
    .where(and(
      eq(jobs.organizationId, organizationId),
      isNull(jobs.archivedAt),
      inArray(jobs.status, [...OPEN_JOBS]),
      sql`not exists (
        select 1 from candidate_job_matches m
        where m.job_id = ${jobs.id}
          and m.organization_id = ${jobs.organizationId}
          and m.match_category = 'strong_match'
      )`,
    ));
  const [stale] = await db
    .select({ value: count() })
    .from(candidateJobMatches)
    .where(and(eq(candidateJobMatches.organizationId, organizationId), eq(candidateJobMatches.freshness, "stale")));
  return {
    newPublicJobs: Number(created?.value ?? 0),
    changedPublicJobs: Number(changed?.value ?? 0),
    requirementReview: Number(requirements?.value ?? 0),
    openWithoutStrongMatch: Number(noStrong?.value ?? 0),
    staleMatches: Number(stale?.value ?? 0),
  };
}

export async function loadReviewSummary(organizationId: string) {
  return loadReviews(organizationId);
}

async function loadReviews(organizationId: string) {
  const db = getDb();
  const [mappings] = await db
    .select({ value: count() })
    .from(militaryCivilianMappings)
    .where(inArray(militaryCivilianMappings.reviewStatus, [...PENDING]));
  const [capabilities] = await db
    .select({ value: count() })
    .from(candidateSkills)
    .where(and(
      eq(candidateSkills.organizationId, organizationId),
      inArray(candidateSkills.reviewStatus, [...PENDING]),
    ));
  const [requirements] = await db
    .select({ value: count() })
    .from(jobRequirements)
    .innerJoin(jobs, and(eq(jobs.id, jobRequirements.jobId), eq(jobs.organizationId, organizationId)))
    .where(and(
      eq(jobRequirements.organizationId, organizationId),
      inArray(jobRequirements.reviewStatus, [...PENDING]),
      isNull(jobs.archivedAt),
    ));
  const [skillRequirements] = await db
    .select({ value: count() })
    .from(jobSkills)
    .innerJoin(jobs, eq(jobs.id, jobSkills.jobId))
    .where(and(
      eq(jobs.organizationId, organizationId),
      inArray(jobSkills.reviewStatus, [...PENDING]),
      isNull(jobs.archivedAt),
    ));
  return {
    militaryMappings: Number(mappings?.value ?? 0),
    candidateCapabilities: Number(capabilities?.value ?? 0),
    jobRequirements: Number(requirements?.value ?? 0) + Number(skillRequirements?.value ?? 0),
  };
}

async function loadSystem(organizationId: string): Promise<SystemFact[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: careerSources.id,
      name: careerSources.name,
      status: careerSources.healthStatus,
      lastSuccessfulSyncAt: careerSources.lastSuccessfulSyncAt,
      companyId: careerSources.companyId,
    })
    .from(careerSources)
    .where(and(eq(careerSources.organizationId, organizationId), eq(careerSources.active, true)))
    .limit(25);
  return rows.map((row) => ({
    status: row.status,
    name: row.name,
    lastSuccessfulSyncAt: row.lastSuccessfulSyncAt,
    href: `/app/companies/${row.companyId}?tab=career-sources`,
  }));
}

export async function getOperationalCommandCenter(principal: Principal, now = new Date()) {
  const organizationId = principal.organizationId;
  const jobsOk = can(principal, "jobs.read");
  const talentOk = can(principal, "candidates.read") || can(principal, "military.read");
  const workforceOk = can(principal, "workforce.read");
  const reviewOk = can(principal, "military.read") || can(principal, "candidates.read") || can(principal, "jobs.read");
  const systemOk = jobsOk || can(principal, "integrations.read");

  const [engagements, talent, demand, workforce, reviews, system] = await Promise.all([
    jobsOk ? settle(() => listEngagementQueue(organizationId, null, now)) : Promise.resolve(null),
    talentOk ? settle(() => loadTalentFacts(organizationId, now)) : Promise.resolve(null),
    jobsOk ? settle(() => loadDemandFacts(organizationId, now)) : Promise.resolve(null),
    workforceOk
      ? settle(async () => {
          const portfolio = await loadWorkforcePortfolio(organizationId, now);
          return portfolio.roles.map((role) => ({
            id: role.id,
            title: role.title,
            health: role.health,
            quantityGap: role.quantityGap,
            knownSupply: role.knownSupply,
            demandQuantity: role.demandQuantity,
            activePipeline: role.activePipeline,
          }));
        })
      : Promise.resolve(null),
    reviewOk ? settle(() => loadReviews(organizationId)) : Promise.resolve(null),
    systemOk ? settle(() => loadSystem(organizationId)) : Promise.resolve(null),
  ]);

  if (talent?.ok && engagements?.ok && can(principal, "candidates.read")) {
    const waiting = new Set(
      engagements.value.filter((row) => row.agingDays > 5).map((row) => row.candidateId),
    );
    talent.value.waitingBeyondDays = waiting.size;
  }

  const facts: CommandCenterFacts = {
    now,
    engagements: engagements
      ? engagements.ok
        ? {
            ok: true,
            value: engagements.value.map((row) => ({
              id: row.id,
              status: row.status,
              buckets: row.buckets,
              agingDays: row.agingDays,
            })),
          }
        : engagements
      : null,
    talent,
    demand,
    workforce,
    reviews,
    system,
  };
  return composeOperationalBoard(principal, facts);
}

export async function militaryCandidateFocusIds(organizationId: string, focus: string | undefined) {
  if (focus !== "none" && focus !== "incomplete") return null;
  const db = getDb();
  if (focus === "incomplete") {
    const rows = await db
      .select({ candidateId: skillbridgeProfiles.candidateId })
      .from(skillbridgeProfiles)
      .where(and(
        eq(skillbridgeProfiles.organizationId, organizationId),
        isNull(skillbridgeProfiles.archivedAt),
        onTransitionList(),
        isNull(skillbridgeProfiles.separationDate),
        isNull(skillbridgeProfiles.endOfServiceDate),
        isNull(skillbridgeProfiles.etsDate),
        isNull(skillbridgeProfiles.eaosDate),
        or(isNull(skillbridgeProfiles.preferredLocationPrimary), eq(skillbridgeProfiles.preferredLocationPrimary, "")),
      ));
    return new Set(rows.map((row) => row.candidateId));
  }
  const rows = await db
    .select({ candidateId: skillbridgeProfiles.candidateId })
    .from(skillbridgeProfiles)
    .where(and(
      eq(skillbridgeProfiles.organizationId, organizationId),
      isNull(skillbridgeProfiles.archivedAt),
      onTransitionList(),
      sql`not exists (
        select 1 from opportunity_engagements e
        where e.organization_id = ${skillbridgeProfiles.organizationId}
          and e.candidate_id = ${skillbridgeProfiles.candidateId}
          and e.archived_at is null
          and e.status not in ('withdrawn', 'placed', 'closed')
      )`,
    ));
  return new Set(rows.map((row) => row.candidateId));
}
