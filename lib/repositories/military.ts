import { and, eq, ilike, isNull, or } from "drizzle-orm";

import { getDb } from "../../db";
import {
  bridgeTrainingRecommendations,
  candidateMilitaryExperiences,
  candidateMilitaryTranslations,
  candidates,
  civilianOccupations,
  militaryCivilianMappings,
  militaryInstallations,
  militaryOccupationInstallations,
  militaryOccupationSkills,
  militaryOccupations,
  occupationDataImports,
  skills,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { fixtureOccupationImporter, summarizeImport } from "../military/importers";
import { assertHumanMappingReview, initialReviewStatus } from "../military/review";
import { hiringManagerTranslation, rankClientNeedTargets } from "../military/translator";
import { sanitizeSearchQuery } from "../validation/forms";

export async function getMilitaryOccupationBundle(code: string, branch: "navy" = "navy") {
  const db = getDb();
  const [occupation] = await db
    .select()
    .from(militaryOccupations)
    .where(and(eq(militaryOccupations.code, code), eq(militaryOccupations.branch, branch)))
    .limit(1);
  if (!occupation) return null;
  return loadOccupationBundle(occupation.id);
}

export async function getMilitaryOccupationById(occupationId: string) {
  return loadOccupationBundle(occupationId);
}

async function loadOccupationBundle(occupationId: string) {
  const db = getDb();
  const [occupation] = await db
    .select()
    .from(militaryOccupations)
    .where(and(eq(militaryOccupations.id, occupationId), isNull(militaryOccupations.archivedAt)))
    .limit(1);
  if (!occupation) return null;

  const linkedSkills = await db
    .select({ skill: skills })
    .from(militaryOccupationSkills)
    .innerJoin(skills, eq(militaryOccupationSkills.skillId, skills.id))
    .where(eq(militaryOccupationSkills.militaryOccupationId, occupation.id));

  const civilianRoles = await db
    .select({
      mapping: militaryCivilianMappings,
      occupation: civilianOccupations,
    })
    .from(militaryCivilianMappings)
    .innerJoin(
      civilianOccupations,
      eq(militaryCivilianMappings.civilianOccupationId, civilianOccupations.id),
    )
    .where(eq(militaryCivilianMappings.militaryOccupationId, occupation.id));

  const installations = await db
    .select({
      installation: militaryInstallations,
      link: militaryOccupationInstallations,
    })
    .from(militaryOccupationInstallations)
    .innerJoin(
      militaryInstallations,
      eq(militaryOccupationInstallations.installationId, militaryInstallations.id),
    )
    .where(eq(militaryOccupationInstallations.militaryOccupationId, occupation.id));

  const talentRows = await db
    .select({ candidate: candidates, experience: candidateMilitaryExperiences })
    .from(candidateMilitaryExperiences)
    .innerJoin(candidates, eq(candidateMilitaryExperiences.candidateId, candidates.id))
    .where(
      and(
        eq(candidateMilitaryExperiences.militaryOccupationId, occupation.id),
        isNull(candidates.archivedAt),
      ),
    );
  const talent = [];
  const seenCandidates = new Set<string>();
  for (const row of talentRows) {
    if (seenCandidates.has(row.candidate.id)) continue;
    seenCandidates.add(row.candidate.id);
    talent.push(row);
  }

  return {
    occupation,
    skills: linkedSkills.map((row) => row.skill),
    civilianRoles,
    installations,
    talent,
  };
}

export async function listMilitaryOccupations(query?: string, branch?: string) {
  const db = getDb();
  const search = sanitizeSearchQuery(query);
  const branchFilter =
    branch &&
    ["army", "navy", "air_force", "marine_corps", "coast_guard", "space_force"].includes(branch)
      ? eq(
          militaryOccupations.branch,
          branch as typeof militaryOccupations.$inferSelect.branch,
        )
      : undefined;
  return db
    .select()
    .from(militaryOccupations)
    .where(
      and(
        isNull(militaryOccupations.archivedAt),
        branchFilter,
        search
          ? or(
              ilike(militaryOccupations.title, `%${search}%`),
              ilike(militaryOccupations.code, `%${search}%`),
            )
          : undefined,
      ),
    )
    .orderBy(militaryOccupations.branch, militaryOccupations.code);
}

export async function reverseSearchCivilianToMilitary(query: string) {
  const db = getDb();
  const search = sanitizeSearchQuery(query);
  if (!search) return [];
  return db
    .select({
      civilian: civilianOccupations,
      mapping: militaryCivilianMappings,
      military: militaryOccupations,
    })
    .from(civilianOccupations)
    .innerJoin(
      militaryCivilianMappings,
      eq(militaryCivilianMappings.civilianOccupationId, civilianOccupations.id),
    )
    .innerJoin(
      militaryOccupations,
      eq(militaryCivilianMappings.militaryOccupationId, militaryOccupations.id),
    )
    .where(
      and(
        isNull(militaryOccupations.archivedAt),
        or(
          ilike(civilianOccupations.title, `%${search}%`),
          ilike(civilianOccupations.code, `%${search}%`),
        ),
      ),
    )
    .orderBy(civilianOccupations.title, militaryOccupations.code);
}

export async function listMilitaryInstallations(query?: string) {
  const db = getDb();
  const search = sanitizeSearchQuery(query);
  return db
    .select()
    .from(militaryInstallations)
    .where(
      and(
        isNull(militaryInstallations.archivedAt),
        search
          ? or(
              ilike(militaryInstallations.name, `%${search}%`),
              ilike(militaryInstallations.city, `%${search}%`),
              ilike(militaryInstallations.region, `%${search}%`),
            )
          : undefined,
      ),
    )
    .orderBy(militaryInstallations.name);
}

export async function getMilitaryInstallation(id: string) {
  const db = getDb();
  const [installation] = await db
    .select()
    .from(militaryInstallations)
    .where(and(eq(militaryInstallations.id, id), isNull(militaryInstallations.archivedAt)))
    .limit(1);
  if (!installation) return null;
  const occupations = await db
    .select({ occupation: militaryOccupations, link: militaryOccupationInstallations })
    .from(militaryOccupationInstallations)
    .innerJoin(
      militaryOccupations,
      eq(militaryOccupationInstallations.militaryOccupationId, militaryOccupations.id),
    )
    .where(eq(militaryOccupationInstallations.installationId, id));
  return { installation, occupations };
}

export async function occupationInstallationMap(occupationId: string) {
  const bundle = await loadOccupationBundle(occupationId);
  if (!bundle) return null;
  return {
    occupation: bundle.occupation,
    installations: bundle.installations.map(({ installation, link }) => ({
      installation,
      link,
      relevance: link.presenceLevel,
      confidence: link.confidence,
      why: link.whyPresent,
      transitionOpportunity: link.transitionOpportunity,
      skillbridgeOpportunity: link.skillbridgeOpportunity,
      recruitingPriority: link.recruitingPriority,
      source: link.source,
      reviewStatus: link.reviewStatus,
    })),
  };
}

export async function clientNeedInstallationTargets(civilianQuery: string) {
  const reverse = await reverseSearchCivilianToMilitary(civilianQuery);
  const db = getDb();
  const results = [];
  for (const row of reverse) {
    const installations = await db
      .select({
        installation: militaryInstallations,
        link: militaryOccupationInstallations,
      })
      .from(militaryOccupationInstallations)
      .innerJoin(
        militaryInstallations,
        eq(militaryOccupationInstallations.installationId, militaryInstallations.id),
      )
      .where(eq(militaryOccupationInstallations.militaryOccupationId, row.military.id));
    const talent = await db
      .select({ id: candidates.id })
      .from(candidateMilitaryExperiences)
      .innerJoin(candidates, eq(candidateMilitaryExperiences.candidateId, candidates.id))
      .where(
        and(
          eq(candidateMilitaryExperiences.militaryOccupationId, row.military.id),
          isNull(candidates.archivedAt),
        ),
      );
    for (const item of installations) {
      results.push({
        civilian: row.civilian,
        military: row.military,
        mapping: row.mapping,
        installation: item.installation,
        link: item.link,
        occupationCompatibility: row.mapping.compatibilityScore ?? 50,
        installationRelevance:
          item.link.presenceLevel === "primary" ? 90 : item.link.presenceLevel === "significant" ? 70 : 40,
        transitionOpportunity: item.link.transitionOpportunity ? 70 : 40,
        candidateSupply: Math.min(100, talent.length * 20),
      });
    }
  }
  return rankClientNeedTargets(results);
}

export async function listBridgeTraining() {
  const db = getDb();
  return db
    .select({
      recommendation: bridgeTrainingRecommendations,
      military: militaryOccupations,
      civilian: civilianOccupations,
    })
    .from(bridgeTrainingRecommendations)
    .innerJoin(
      militaryOccupations,
      eq(bridgeTrainingRecommendations.militaryOccupationId, militaryOccupations.id),
    )
    .leftJoin(
      civilianOccupations,
      eq(bridgeTrainingRecommendations.civilianOccupationId, civilianOccupations.id),
    )
    .where(isNull(bridgeTrainingRecommendations.archivedAt));
}

export async function listMilitaryCandidates(organizationId: string) {
  const db = getDb();
  const rows = await db
    .select({
      candidate: candidates,
      experience: candidateMilitaryExperiences,
      occupation: militaryOccupations,
    })
    .from(candidateMilitaryExperiences)
    .innerJoin(candidates, eq(candidateMilitaryExperiences.candidateId, candidates.id))
    .innerJoin(
      militaryOccupations,
      eq(candidateMilitaryExperiences.militaryOccupationId, militaryOccupations.id),
    )
    .where(and(eq(candidates.organizationId, organizationId), isNull(candidates.archivedAt)));
  const unique = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!unique.has(row.candidate.id)) unique.set(row.candidate.id, row);
  }
  return [...unique.values()];
}

export async function listMappingReviewQueue() {
  const db = getDb();
  const mappings = await db
    .select({
      mapping: militaryCivilianMappings,
      military: militaryOccupations,
      civilian: civilianOccupations,
    })
    .from(militaryCivilianMappings)
    .innerJoin(militaryOccupations, eq(militaryCivilianMappings.militaryOccupationId, militaryOccupations.id))
    .innerJoin(civilianOccupations, eq(militaryCivilianMappings.civilianOccupationId, civilianOccupations.id))
    .where(or(eq(militaryCivilianMappings.reviewStatus, "pending"), eq(militaryCivilianMappings.reviewStatus, "needs_review")));
  const installations = await db
    .select({
      link: militaryOccupationInstallations,
      occupation: militaryOccupations,
      installation: militaryInstallations,
    })
    .from(militaryOccupationInstallations)
    .innerJoin(militaryOccupations, eq(militaryOccupationInstallations.militaryOccupationId, militaryOccupations.id))
    .innerJoin(militaryInstallations, eq(militaryOccupationInstallations.installationId, militaryInstallations.id))
    .where(or(eq(militaryOccupationInstallations.reviewStatus, "pending"), eq(militaryOccupationInstallations.reviewStatus, "needs_review")));
  const bridge = await db
    .select()
    .from(bridgeTrainingRecommendations)
    .where(or(eq(bridgeTrainingRecommendations.reviewStatus, "pending"), eq(bridgeTrainingRecommendations.reviewStatus, "needs_review")));
  const translations = await db
    .select()
    .from(candidateMilitaryTranslations)
    .where(or(eq(candidateMilitaryTranslations.reviewStatus, "pending"), eq(candidateMilitaryTranslations.reviewStatus, "needs_review")));
  return { mappings, installations, bridge, translations };
}

export async function reviewMilitaryMapping(input: {
  organizationId: string;
  actorUserId: string;
  mappingId: string;
  status: "approved" | "rejected" | "needs_review";
  actorType?: "human" | "agent" | "system";
}) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(militaryCivilianMappings)
    .where(eq(militaryCivilianMappings.id, input.mappingId))
    .limit(1);
  if (!before) throw new Error("Mapping not found");
  assertHumanMappingReview({
    actorType: input.actorType ?? "human",
    originatingAgentId: before.originatingAgentId,
    reviewerUserId: input.actorUserId,
    nextStatus: input.status,
  });
  const [after] = await db
    .update(militaryCivilianMappings)
    .set({
      reviewStatus: input.status,
      reviewedByUserId: input.actorUserId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(militaryCivilianMappings.id, input.mappingId))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "military_mapping.reviewed",
    recordType: "military_civilian_mapping",
    recordId: after.id,
    before: { reviewStatus: before.reviewStatus },
    after: { reviewStatus: after.reviewStatus },
  });
  return after;
}

export async function createDraftAgentMapping(input: {
  organizationId: string;
  originatingAgentId: string;
  militaryOccupationId: string;
  civilianOccupationId: string;
  explanation: string;
}) {
  const db = getDb();
  const [row] = await db
    .insert(militaryCivilianMappings)
    .values({
      militaryOccupationId: input.militaryOccupationId,
      civilianOccupationId: input.civilianOccupationId,
      explanation: input.explanation,
      mappingQuality: "ai_draft",
      origin: "agent",
      originatingAgentId: input.originatingAgentId,
      reviewStatus: initialReviewStatus({ origin: "agent" }),
      aiModel: "development-unconfigured",
      modelVersion: "none",
      source: "agent_draft",
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "agent", agentId: input.originatingAgentId },
    action: "military_mapping.created",
    recordType: "military_civilian_mapping",
    recordId: row.id,
    after: { reviewStatus: row.reviewStatus, origin: row.origin },
  });
  return row;
}

export async function translatorView(occupationId: string) {
  const bundle = await loadOccupationBundle(occupationId);
  if (!bundle) return null;
  return {
    bundle,
    hiringManager: hiringManagerTranslation({
      branch: bundle.occupation.branch,
      occupationCode: bundle.occupation.code,
      occupationTitle: bundle.occupation.title,
      transferableSkillNames: bundle.skills.map((skill) => skill.name),
      civilianRoles: bundle.civilianRoles.map(({ mapping, occupation }) => ({
        title: occupation.title,
        explanation: mapping.explanation,
        gaps: mapping.gaps,
        bridgeTraining: mapping.bridgeTraining,
        compatibilityScore: mapping.compatibilityScore,
        reviewStatus: mapping.reviewStatus,
        source: mapping.source,
        confidence: mapping.confidence,
      })),
    }),
  };
}

export async function runFixtureOccupationImport(importedByUserId?: string | null) {
  const records = await fixtureOccupationImporter.load();
  const db = getDb();
  let upserted = 0;
  for (const record of records) {
    await db
      .insert(militaryOccupations)
      .values({
        branch: record.branch,
        classificationType: record.classificationType,
        code: record.code,
        title: record.title,
        description: record.description,
        careerField: record.careerField,
        source: record.source,
        sourceVersion: record.sourceVersion,
        sourceUrl: record.sourceUrl,
        mappingQuality: "development_fixture",
      })
      .onConflictDoUpdate({
        target: [militaryOccupations.branch, militaryOccupations.code],
        set: {
          title: record.title,
          description: record.description,
          source: record.source,
          sourceVersion: record.sourceVersion,
          updatedAt: new Date(),
        },
      });
    upserted += 1;
  }
  const summary = summarizeImport({
    source: fixtureOccupationImporter.source,
    sourceVersion: records[0]?.sourceVersion ?? "dev",
    upserted,
    skipped: 0,
  });
  await db.insert(occupationDataImports).values({
    source: summary.source,
    sourceVersion: summary.sourceVersion,
    summary: `Upserted ${summary.upserted}; skipped ${summary.skipped}; approved mappings preserved`,
    recordsUpserted: summary.upserted,
    recordsSkipped: summary.skipped,
    importedByUserId,
  });
  return summary;
}
