import { and, count, desc, eq, ilike, inArray, isNull, lt, or } from "drizzle-orm";

import { getDb } from "../../db";
import {
  activities,
  applications,
  candidateEngagements,
  candidateExperiences,
  candidateJobMatches,
  candidateMilitaryExperiences,
  candidateSkills,
  candidateTalentPools,
  candidateDesignations,
  candidates,
  files,
  jobs,
  militaryOccupations,
  skills,
  talentPools,
  transactionalEmailEvents,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { sanitizeSearchQuery } from "../validation/forms";

export async function getCandidateWithRelationships(candidateId: string, organizationId?: string) {
  const db = getDb();
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.id, candidateId),
        organizationId ? eq(candidates.organizationId, organizationId) : undefined,
        isNull(candidates.archivedAt),
        isNull(candidates.privacyDeletedAt),
      ),
    )
    .limit(1);
  if (!candidate) return null;

  const experiences = await db
    .select()
    .from(candidateExperiences)
    .where(eq(candidateExperiences.candidateId, candidateId));
  const skillRows = await db
    .select({ link: candidateSkills, skill: skills })
    .from(candidateSkills)
    .innerJoin(skills, eq(candidateSkills.skillId, skills.id))
    .where(eq(candidateSkills.candidateId, candidateId));
  const pools = await db
    .select({ pool: talentPools, membership: candidateTalentPools })
    .from(candidateTalentPools)
    .innerJoin(talentPools, eq(candidateTalentPools.talentPoolId, talentPools.id))
    .where(eq(candidateTalentPools.candidateId, candidateId));
  const matches = await db
    .select({ match: candidateJobMatches, job: jobs })
    .from(candidateJobMatches)
    .innerJoin(jobs, eq(candidateJobMatches.jobId, jobs.id))
    .where(eq(candidateJobMatches.candidateId, candidateId));
  const military = await db
    .select({ experience: candidateMilitaryExperiences, occupation: militaryOccupations })
    .from(candidateMilitaryExperiences)
    .innerJoin(
      militaryOccupations,
      eq(candidateMilitaryExperiences.militaryOccupationId, militaryOccupations.id),
    )
    .where(eq(candidateMilitaryExperiences.candidateId, candidateId));

  let resumeFile: {
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
  } | null = null;
  if (candidate.currentResumeFileId) {
    const [file] = await db
      .select({
        id: files.id,
        filename: files.filename,
        mimeType: files.mimeType,
        sizeBytes: files.sizeBytes,
        createdAt: files.createdAt,
      })
      .from(files)
      .where(eq(files.id, candidate.currentResumeFileId))
      .limit(1);
    resumeFile = file ?? null;
  }

  return { candidate, experiences, skills: skillRows, pools, matches, military, resumeFile };
}

export async function listCandidateEngagementHistory(candidateId: string, organizationId: string) {
  const db = getDb();
  const [engagementRows, activityRows, applicationRows] = await Promise.all([
    db
      .select()
      .from(candidateEngagements)
      .where(eq(candidateEngagements.candidateId, candidateId))
      .orderBy(desc(candidateEngagements.occurredAt)),
    db
      .select()
      .from(activities)
      .where(and(eq(activities.candidateId, candidateId), eq(activities.organizationId, organizationId)))
      .orderBy(desc(activities.occurredAt)),
    db
      .select({ application: applications, job: jobs })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(
        and(
          eq(applications.candidateId, candidateId),
          eq(applications.organizationId, organizationId),
          isNull(applications.archivedAt),
        ),
      )
      .orderBy(desc(applications.appliedAt)),
  ]);
  const applicationIds = applicationRows.map((row) => row.application.id);
  const emailRows = await db
    .select({
      id: transactionalEmailEvents.id,
      template: transactionalEmailEvents.template,
      status: transactionalEmailEvents.status,
      sentAt: transactionalEmailEvents.sentAt,
      createdAt: transactionalEmailEvents.createdAt,
      entityType: transactionalEmailEvents.entityType,
    })
    .from(transactionalEmailEvents)
    .where(
      and(
        eq(transactionalEmailEvents.organizationId, organizationId),
        applicationIds.length
          ? or(
              and(
                eq(transactionalEmailEvents.entityType, "candidate"),
                eq(transactionalEmailEvents.entityId, candidateId),
              ),
              inArray(transactionalEmailEvents.entityId, applicationIds),
            )
          : and(
              eq(transactionalEmailEvents.entityType, "candidate"),
              eq(transactionalEmailEvents.entityId, candidateId),
            ),
      ),
    )
    .orderBy(desc(transactionalEmailEvents.createdAt))
    .limit(50);
  return {
    engagements: engagementRows,
    activities: activityRows,
    applications: applicationRows,
    emails: emailRows,
  };
}

export async function listCompanyTalentCandidates(organizationId: string, companyId: string) {
  const db = getDb();
  const companyJobs = await db
    .select({ id: jobs.id, title: jobs.title })
    .from(jobs)
    .where(and(eq(jobs.organizationId, organizationId), eq(jobs.companyId, companyId), isNull(jobs.archivedAt)));
  if (companyJobs.length === 0) return [];
  const jobIds = companyJobs.map((job) => job.id);
  const [applied, matched] = await Promise.all([
    db
      .select({
        candidateId: candidates.id,
        fullName: candidates.fullName,
        jobTitle: jobs.title,
        kind: applications.status,
      })
      .from(applications)
      .innerJoin(candidates, eq(applications.candidateId, candidates.id))
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(
        and(
          eq(applications.organizationId, organizationId),
          inArray(applications.jobId, jobIds),
          isNull(applications.archivedAt),
          isNull(candidates.archivedAt),
          isNull(candidates.privacyDeletedAt),
        ),
      )
      .orderBy(desc(applications.appliedAt)),
    db
      .select({
        candidateId: candidates.id,
        fullName: candidates.fullName,
        jobTitle: jobs.title,
        kind: candidateJobMatches.pipelineStatus,
      })
      .from(candidateJobMatches)
      .innerJoin(candidates, eq(candidateJobMatches.candidateId, candidates.id))
      .innerJoin(jobs, eq(candidateJobMatches.jobId, jobs.id))
      .where(
        and(
          inArray(candidateJobMatches.jobId, jobIds),
          isNull(candidates.archivedAt),
          isNull(candidates.privacyDeletedAt),
        ),
      ),
  ]);
  const byCandidate = new Map<string, { id: string; fullName: string; links: string[] }>();
  for (const row of [...applied, ...matched]) {
    const current = byCandidate.get(row.candidateId) ?? { id: row.candidateId, fullName: row.fullName, links: [] };
    const label = `${row.jobTitle} · ${row.kind}`;
    if (!current.links.includes(label)) current.links.push(label);
    byCandidate.set(row.candidateId, current);
  }
  return [...byCandidate.values()];
}

export async function archiveCandidate(candidateId: string, organizationId?: string) {
  const db = getDb();
  const [archived] = await db
    .update(candidates)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(candidates.id, candidateId),
        organizationId ? eq(candidates.organizationId, organizationId) : undefined,
      ),
    )
    .returning();
  return archived;
}

export async function searchActiveCandidates(
  organizationId: string,
  query?: string,
  availability?: typeof candidates.$inferSelect.availability,
) {
  const db = getDb();
  const search = sanitizeSearchQuery(query);
  return db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.organizationId, organizationId),
        isNull(candidates.archivedAt),
        isNull(candidates.privacyDeletedAt),
        availability ? eq(candidates.availability, availability) : undefined,
        search
          ? or(
              ilike(candidates.fullName, `%${search}%`),
              ilike(candidates.currentTitle, `%${search}%`),
            )
          : undefined,
      ),
    )
    .orderBy(candidates.fullName);
}

export async function createCandidate(input: {
  organizationId: string;
  actorUserId: string;
  fullName: string;
  email?: string | null;
  currentTitle?: string | null;
  availability: typeof candidates.$inferInsert.availability;
  consentStatus: typeof candidates.$inferInsert.consentStatus;
}) {
  const db = getDb();
  const [candidate] = await db
    .insert(candidates)
    .values({
      organizationId: input.organizationId,
      fullName: input.fullName,
      email: input.email,
      currentTitle: input.currentTitle,
      availability: input.availability,
      consentStatus: input.consentStatus,
      privacyClass: "restricted_pii",
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "candidate.created",
    recordType: "candidate",
    recordId: candidate.id,
    after: { ...candidate, email: candidate.email ? "[restricted_pii]" : null },
  });
  return candidate;
}

export async function addCandidateExperience(input: {
  organizationId: string;
  actorUserId: string;
  candidateId: string;
  employer: string;
  title: string;
  summary?: string | null;
}) {
  const db = getDb();
  const [experience] = await db
    .insert(candidateExperiences)
    .values({
      candidateId: input.candidateId,
      employer: input.employer,
      title: input.title,
      summary: input.summary,
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "candidate_experience.created",
    recordType: "candidate_experience",
    recordId: experience.id,
    after: experience,
  });
  return experience;
}

export async function listTalentPools(organizationId: string) {
  const db = getDb();
  return db
    .select()
    .from(talentPools)
    .where(and(eq(talentPools.organizationId, organizationId), isNull(talentPools.archivedAt)))
    .orderBy(talentPools.name);
}

export async function listTalentPoolSummaries(organizationId: string) {
  const pools = await listTalentPools(organizationId);
  const db = getDb();
  const counts = await db
    .select({
      poolId: candidateTalentPools.talentPoolId,
      value: count(),
    })
    .from(candidateTalentPools)
    .innerJoin(candidates, eq(candidateTalentPools.candidateId, candidates.id))
    .where(
      and(
        eq(candidates.organizationId, organizationId),
        isNull(candidates.archivedAt),
        isNull(candidateTalentPools.removedAt),
      ),
    )
    .groupBy(candidateTalentPools.talentPoolId);
  const countByPool = new Map(counts.map((row) => [row.poolId, Number(row.value)]));
  return pools.map((pool) => ({ pool, memberCount: countByPool.get(pool.id) ?? 0 }));
}

export async function getTalentPool(poolId: string, organizationId: string) {
  const db = getDb();
  const [pool] = await db
    .select()
    .from(talentPools)
    .where(
      and(
        eq(talentPools.id, poolId),
        eq(talentPools.organizationId, organizationId),
        isNull(talentPools.archivedAt),
      ),
    )
    .limit(1);
  if (!pool) return null;
  const members = await db
    .select({ candidate: candidates, membership: candidateTalentPools })
    .from(candidateTalentPools)
    .innerJoin(candidates, eq(candidateTalentPools.candidateId, candidates.id))
    .where(eq(candidateTalentPools.talentPoolId, poolId));
  return { pool, members };
}

export async function createTalentPool(input: {
  organizationId: string;
  actorUserId: string;
  name: string;
  slug: string;
  description?: string | null;
}) {
  const db = getDb();
  const [pool] = await db
    .insert(talentPools)
    .values({
      organizationId: input.organizationId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      poolType: "static",
      scope: "organization",
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "talent_pool.created",
    recordType: "talent_pool",
    recordId: pool.id,
    after: pool,
  });
  return pool;
}

export async function addCandidateToPool(input: {
  organizationId: string;
  actorUserId: string;
  candidateId: string;
  talentPoolId: string;
}) {
  const db = getDb();
  const [membership] = await db
    .insert(candidateTalentPools)
    .values({
      candidateId: input.candidateId,
      talentPoolId: input.talentPoolId,
      source: "manual",
    })
    .onConflictDoNothing()
    .returning();
  if (membership) {
    await recordAuditEvent({
      organizationId: input.organizationId,
      actor: { type: "human", userId: input.actorUserId },
      action: "candidate_talent_pool.created",
      recordType: "candidate_talent_pool",
      recordId: membership.id,
      after: membership,
    });
  }
  return membership ?? null;
}

export async function anonymizeCandidateForPrivacyTest(candidateId: string) {
  const db = getDb();
  const [updated] = await db
    .update(candidates)
    .set({
      fullName: "REDACTED CANDIDATE",
      email: `redacted-${candidateId}@privacy.local`,
      currentTitle: null,
      updatedAt: new Date(),
    })
    .where(eq(candidates.id, candidateId))
    .returning();
  return updated;
}

export async function listSilverMedalists(organizationId: string) {
  const db = getDb();
  const designated = await db
    .select({ candidate: candidates })
    .from(candidateDesignations)
    .innerJoin(candidates, eq(candidateDesignations.candidateId, candidates.id))
    .where(
      and(
        eq(candidates.organizationId, organizationId),
        isNull(candidates.archivedAt),
        eq(candidateDesignations.designationType, "silver_medalist"),
        eq(candidateDesignations.active, true),
      ),
    );
  const poolMembers = await db
    .select({ candidate: candidates })
    .from(candidateTalentPools)
    .innerJoin(talentPools, eq(candidateTalentPools.talentPoolId, talentPools.id))
    .innerJoin(candidates, eq(candidateTalentPools.candidateId, candidates.id))
    .where(
      and(
        eq(candidates.organizationId, organizationId),
        isNull(candidates.archivedAt),
        eq(talentPools.slug, "silver-medalists"),
        isNull(candidateTalentPools.removedAt),
      ),
    );
  const byId = new Map<string, typeof candidates.$inferSelect>();
  for (const row of [...designated, ...poolMembers]) {
    byId.set(row.candidate.id, row.candidate);
  }
  return [...byId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function listWatchlists(organizationId: string, userId: string) {
  const db = getDb();
  return db
    .select()
    .from(talentPools)
    .where(
      and(
        eq(talentPools.organizationId, organizationId),
        eq(talentPools.scope, "user"),
        eq(talentPools.ownerUserId, userId),
        isNull(talentPools.archivedAt),
      ),
    )
    .orderBy(talentPools.name);
}

export async function listNurtureCandidates(organizationId: string) {
  const db = getDb();
  return db
    .select({ candidate: candidates, pool: talentPools })
    .from(candidateTalentPools)
    .innerJoin(talentPools, eq(candidateTalentPools.talentPoolId, talentPools.id))
    .innerJoin(candidates, eq(candidateTalentPools.candidateId, candidates.id))
    .where(
      and(
        eq(candidates.organizationId, organizationId),
        isNull(candidates.archivedAt),
        eq(talentPools.slug, "nurture"),
        isNull(candidateTalentPools.removedAt),
      ),
    )
    .orderBy(candidates.fullName);
}

export async function listRediscoveryCandidates(organizationId: string) {
  const db = getDb();
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.organizationId, organizationId),
        isNull(candidates.archivedAt),
        eq(candidates.doNotContact, false),
        or(isNull(candidates.lastContactedAt), lt(candidates.lastContactedAt, cutoff)),
      ),
    )
    .orderBy(candidates.fullName);
}
