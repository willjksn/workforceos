import { and, eq, ilike, isNull, or } from "drizzle-orm";

import { getDb } from "../../db";
import {
  candidateExperiences,
  candidateJobMatches,
  candidateSkills,
  candidateTalentPools,
  candidates,
  jobs,
  skills,
  talentPools,
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

  return { candidate, experiences, skills: skillRows, pools, matches };
}

export async function archiveCandidate(candidateId: string) {
  const db = getDb();
  const [archived] = await db
    .update(candidates)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(candidates.id, candidateId))
    .returning();
  return archived;
}

export async function searchActiveCandidates(organizationId: string, query?: string) {
  const db = getDb();
  const search = sanitizeSearchQuery(query);
  return db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.organizationId, organizationId),
        isNull(candidates.archivedAt),
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
