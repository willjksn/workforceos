import { and, eq, ilike, isNull, or } from "drizzle-orm";

import { getDb } from "../../db";
import {
  candidateMilitaryExperiences,
  candidates,
  civilianOccupations,
  militaryCivilianMappings,
  militaryInstallations,
  militaryOccupationInstallations,
  militaryOccupationSkills,
  militaryOccupations,
  skills,
} from "../../db/schema";
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
