import { and, countDistinct, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { getDb } from "../../db";
import {
  bridgeTrainingRecommendations,
  candidateDesignations,
  candidateMilitaryExperiences,
  candidateSkills,
  candidates,
  civilianOccupations,
  militaryCivilianMappings,
  militaryInstallations,
  militaryOccupationInstallations,
  militaryOccupations,
} from "../../db/schema";
import { workforceRoles } from "../../db/schema/workforce/planning";

export type MilitaryOverlay = {
  roleId: string;
  civilianOccupationId: string | null;
  civilianTitle: string | null;
  occupations: Array<{
    mappingId: string;
    militaryOccupationId: string;
    branch: string;
    code: string;
    title: string;
    compatibility: string | null;
    skillStrengths: string | null;
    skillGaps: string | null;
    reviewStatus: string;
    source: string | null;
    recruitingPriority: string;
  }>;
  installations: Array<{ name: string; region: string | null; presenceLevel: string | null }>;
  bridgeTraining: Array<{ title: string | null; recommendation: string | null }>;
};

export async function militaryOverlayForRole(roleId: string): Promise<MilitaryOverlay> {
  const db = getDb();
  const [role] = await db.select().from(workforceRoles).where(eq(workforceRoles.id, roleId)).limit(1);
  if (!role) {
    return {
      roleId,
      civilianOccupationId: null,
      civilianTitle: null,
      occupations: [],
      installations: [],
      bridgeTraining: [],
    };
  }
  const [occupation] = role.civilianOccupationId
    ? await db
        .select()
        .from(civilianOccupations)
        .where(eq(civilianOccupations.id, role.civilianOccupationId))
        .limit(1)
    : [undefined];
  if (!role.civilianOccupationId) {
    return {
      roleId,
      civilianOccupationId: null,
      civilianTitle: occupation?.title ?? role.title,
      occupations: [],
      installations: [],
      bridgeTraining: [],
    };
  }
  const mappings = await db
    .select({
      mapping: militaryCivilianMappings,
      military: militaryOccupations,
    })
    .from(militaryCivilianMappings)
    .innerJoin(militaryOccupations, eq(militaryCivilianMappings.militaryOccupationId, militaryOccupations.id))
    .where(eq(militaryCivilianMappings.civilianOccupationId, role.civilianOccupationId));

  const occupationIds = mappings.map((row) => row.military.id);
  const installations = occupationIds.length
    ? await db
        .select({
          name: militaryInstallations.name,
          region: militaryInstallations.region,
          presenceLevel: militaryOccupationInstallations.presenceLevel,
        })
        .from(militaryOccupationInstallations)
        .innerJoin(militaryInstallations, eq(militaryOccupationInstallations.installationId, militaryInstallations.id))
        .where(inArray(militaryOccupationInstallations.militaryOccupationId, occupationIds))
    : [];

  const training = occupationIds.length
    ? await db
        .select()
        .from(bridgeTrainingRecommendations)
        .where(
          or(
            inArray(bridgeTrainingRecommendations.militaryOccupationId, occupationIds),
            eq(bridgeTrainingRecommendations.civilianOccupationId, role.civilianOccupationId),
          ),
        )
    : [];

  return {
    roleId,
    civilianOccupationId: role.civilianOccupationId,
    civilianTitle: occupation?.title ?? role.title,
    occupations: mappings.map((row) => ({
      mappingId: row.mapping.id,
      militaryOccupationId: row.military.id,
      branch: row.military.branch,
      code: row.military.code,
      title: row.military.title,
      compatibility: row.mapping.explanation,
      skillStrengths: row.mapping.skillsSummary,
      skillGaps: row.mapping.gaps,
      reviewStatus: row.mapping.reviewStatus,
      source: row.mapping.source,
      recruitingPriority: row.mapping.reviewStatus === "approved" ? "eligible" : "pending_review",
    })),
    installations: installations.map((row) => ({
      name: row.name,
      region: row.region,
      presenceLevel: row.presenceLevel,
    })),
    bridgeTraining: training.map((row) => ({
      title: row.trainingProgram,
      recommendation: row.recommendedCredential ?? row.expectedBridgePurpose,
    })),
  };
}

export type TalentNetworkOverlay = {
  matchingCandidates: number;
  silverMedalists: number;
  militaryCandidates: number;
  geographicAvailability: number;
  readinessAvailableNow: number;
  notes: string;
};

export async function talentNetworkOverlayForRole(input: {
  organizationId: string;
  roleId: string;
  skillIds: string[];
  region?: string | null;
}): Promise<TalentNetworkOverlay> {
  const db = getDb();
  const candidateScope = and(eq(candidates.organizationId, input.organizationId), isNull(candidates.archivedAt));
  const skillFilter = input.skillIds.length
    ? inArray(candidateSkills.skillId, input.skillIds)
    : sql`true`;

  const [matching] = await db
    .select({ value: countDistinct(candidates.id) })
    .from(candidates)
    .leftJoin(candidateSkills, eq(candidateSkills.candidateId, candidates.id))
    .where(and(candidateScope, skillFilter));

  const [silver] = await db
    .select({ value: countDistinct(candidates.id) })
    .from(candidateDesignations)
    .innerJoin(candidates, eq(candidateDesignations.candidateId, candidates.id))
    .where(
      and(
        candidateScope,
        eq(candidateDesignations.designationType, "silver_medalist"),
        eq(candidateDesignations.active, true),
      ),
    );

  const [military] = await db
    .select({ value: countDistinct(candidates.id) })
    .from(candidates)
    .leftJoin(candidateMilitaryExperiences, eq(candidateMilitaryExperiences.candidateId, candidates.id))
    .where(
      and(
        candidateScope,
        or(
          inArray(candidates.militaryStatus, ["veteran", "active_duty", "reserve", "national_guard"]),
          sql`${candidateMilitaryExperiences.id} is not null`,
        ),
      ),
    );

  const [geo] = await db
    .select({ value: countDistinct(candidates.id) })
    .from(candidates)
    .where(and(candidateScope, input.region ? eq(candidates.region, input.region) : sql`true`));

  const [ready] = await db
    .select({ value: countDistinct(candidates.id) })
    .from(candidates)
    .where(and(candidateScope, eq(candidates.availability, "available_now")));

  return {
    matchingCandidates: Number(matching?.value ?? 0),
    silverMedalists: Number(silver?.value ?? 0),
    militaryCandidates: Number(military?.value ?? 0),
    geographicAvailability: Number(geo?.value ?? 0),
    readinessAvailableNow: Number(ready?.value ?? 0),
    notes: "Aggregate Talent Network counts only. Candidate PII is not included in workforce executive views.",
  };
}
