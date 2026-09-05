import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import {
  candidateExperiences,
  candidateJobMatches,
  candidateSkills,
  candidateTalentPools,
  candidates,
  jobs,
  talentPools,
} from "../../db/schema";

export async function getCandidateWithRelationships(candidateId: string) {
  const db = getDb();
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.id, candidateId), isNull(candidates.archivedAt)))
    .limit(1);
  if (!candidate) return null;

  const experiences = await db
    .select()
    .from(candidateExperiences)
    .where(eq(candidateExperiences.candidateId, candidateId));
  const skills = await db
    .select()
    .from(candidateSkills)
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

  return { candidate, experiences, skills, pools, matches };
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

export async function searchActiveCandidates(organizationId: string) {
  const db = getDb();
  return db
    .select()
    .from(candidates)
    .where(and(eq(candidates.organizationId, organizationId), isNull(candidates.archivedAt)));
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
