import { and, eq } from "drizzle-orm";

import { getDb } from "../../db";
import {
  civilianOccupations,
  militaryCivilianMappings,
  militaryInstallations,
  militaryOccupationInstallations,
  militaryOccupationSkills,
  militaryOccupations,
  skills,
} from "../../db/schema";

export async function getMilitaryOccupationBundle(code: string, branch: "navy" = "navy") {
  const db = getDb();
  const [occupation] = await db
    .select()
    .from(militaryOccupations)
    .where(and(eq(militaryOccupations.code, code), eq(militaryOccupations.branch, branch)))
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

  return {
    occupation,
    skills: linkedSkills.map((row) => row.skill),
    civilianRoles,
    installations,
  };
}
