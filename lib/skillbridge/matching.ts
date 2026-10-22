import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import { candidates, skillbridgeProfiles } from "../../db/schema";
import { listCandidateOpportunityMatches } from "../recruiting/opportunity-matching";

export async function findSkillBridgeMatches(input: {
  organizationId: string;
  profileId?: string | null;
  candidateId?: string | null;
  limit?: number;
}) {
  const db = getDb();
  let candidateId = input.candidateId ?? null;
  if (!candidateId && input.profileId) {
    const [profile] = await db
      .select({ candidateId: skillbridgeProfiles.candidateId })
      .from(skillbridgeProfiles)
      .where(
        and(
          eq(skillbridgeProfiles.organizationId, input.organizationId),
          eq(skillbridgeProfiles.id, input.profileId),
          isNull(skillbridgeProfiles.archivedAt),
        ),
      )
      .limit(1);
    candidateId = profile?.candidateId ?? null;
  }
  if (!candidateId) {
    const [candidate] = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(
        and(
          eq(candidates.organizationId, input.organizationId),
          input.candidateId ? eq(candidates.id, input.candidateId) : undefined,
          isNull(candidates.archivedAt),
        ),
      )
      .limit(1);
    candidateId = candidate?.id ?? null;
  }
  if (!candidateId) return [];
  const cards = await listCandidateOpportunityMatches(input.organizationId, candidateId);
  return cards.slice(0, input.limit ?? 8).map((card) => ({
    jobId: card.jobId,
    companyId: null as string | null,
    companyName: card.companyName ?? "Unassigned company",
    jobTitle: card.jobTitle,
    location: card.locationLabel,
    status: card.jobStatus,
    overall: card.categoryLabel,
    skillbridgeEligible: card.skillbridgeEligible,
    explanation: card.explanation,
    strengths: card.aligned,
    gaps: card.gaps,
    href: `/app/jobs/${card.jobId}`,
  }));
}
