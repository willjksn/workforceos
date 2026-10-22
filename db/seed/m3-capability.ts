import { and, eq } from "drizzle-orm";

import type { getDb } from "../index";
import {
  civilianOccupationJobFamilies,
  civilianOccupations,
  competencyClusters,
  jobFamilies,
  militaryOccupationSkills,
  militaryOccupations,
  occupationSkills,
  skillAliases,
  skills,
} from "../schema";

type Database = ReturnType<typeof getDb>;

const FIXTURE = "development_fixture";
const VERSION = "m3-dev";

const clusterBySlug: Record<string, string> = {
  "inventory-control": "supply-chain-logistics",
  "procurement-support": "supply-chain-logistics",
  "warehouse-operations": "supply-chain-logistics",
  "hazardous-material-controls": "safety-compliance",
  "logistics-systems": "supply-chain-logistics",
  "demand-supply-planning": "supply-chain-logistics",
  "team-leadership": "leadership-supervision",
  "electronic-troubleshooting": "electrical-electronics",
  "radar-systems": "electrical-electronics",
  instrumentation: "electrical-electronics",
  "cyber-defense": "cyber-it",
  "it-operations": "cyber-it",
  "supply-operations": "supply-chain-logistics",
};

const skillSeed = [
  ["inventory-control", "Inventory Control", "business"],
  ["procurement-support", "Procurement Support", "business"],
  ["warehouse-operations", "Warehouse Operations", "business"],
  ["hazardous-material-controls", "Hazardous-Material Controls", "safety_compliance"],
  ["logistics-systems", "Logistics Systems", "digital"],
  ["demand-supply-planning", "Demand and Supply Planning", "business"],
  ["team-leadership", "Team Leadership", "leadership"],
  ["electronic-troubleshooting", "Electronic Troubleshooting", "technical"],
  ["radar-systems", "Radar Systems", "technical"],
  ["instrumentation", "Instrumentation", "technical"],
  ["cyber-defense", "Cyber Defense", "digital"],
  ["it-operations", "IT Operations", "digital"],
  ["supply-operations", "Supply Operations", "business"],
  ["strategic-sourcing", "Strategic Sourcing", "business"],
] as const;

const occupations = [
  { id: "00000000-0000-4000-8000-000000000510", branch: "navy", classificationType: "rating", code: "LS", title: "Logistics Specialist" },
  { id: "00000000-0000-4000-8000-000000000511", branch: "navy", classificationType: "rating", code: "ET", title: "Electronics Technician" },
  { id: "00000000-0000-4000-8000-000000000512", branch: "army", classificationType: "mos", code: "92Y", title: "Unit Supply Specialist" },
  { id: "00000000-0000-4000-8000-000000000513", branch: "air_force", classificationType: "afsc", code: "1D7X1", title: "Cyber Defense Operations" },
] as const;

const civilians = [
  { id: "00000000-0000-4000-8200-000000000510", title: "Materials Management", code: "DEV-MAT-MGMT", family: "supply-chain", skills: ["inventory-control", "warehouse-operations", "logistics-systems", "team-leadership", "strategic-sourcing"] },
  { id: "00000000-0000-4000-8200-000000000511", title: "Electronics Technician", code: "DEV-ELEC-TECH", family: "instrumentation-controls", skills: ["electronic-troubleshooting", "radar-systems", "instrumentation"] },
  { id: "00000000-0000-4000-8200-000000000512", title: "Supply Specialist", code: "DEV-SUP-SPEC", family: "logistics", skills: ["supply-operations", "inventory-control", "warehouse-operations"] },
  { id: "00000000-0000-4000-8200-000000000513", title: "Cybersecurity Analyst", code: "DEV-CYBER-AN", family: "cybersecurity", skills: ["cyber-defense", "it-operations"] },
] as const;

const occupationSkillSlugs: Record<string, string[]> = {
  LS: ["inventory-control", "procurement-support", "warehouse-operations", "hazardous-material-controls", "logistics-systems", "demand-supply-planning", "team-leadership"],
  ET: ["electronic-troubleshooting", "radar-systems", "instrumentation"],
  "92Y": ["supply-operations", "inventory-control", "warehouse-operations"],
  "1D7X1": ["cyber-defense", "it-operations"],
};

export async function seedM3CapabilityFixtures(db: Database) {
  const clusters = await db.select().from(competencyClusters);
  const families = await db.select().from(jobFamilies);
  const clusterId = Object.fromEntries(clusters.map((row) => [row.slug, row.id]));
  const familyId = Object.fromEntries(families.map((row) => [row.slug, row.id]));
  const skillIds: Record<string, string> = {};

  for (const [index, [slug, name, family]] of skillSeed.entries()) {
    const id = `00000000-0000-4000-8100-${String(20 + index).padStart(12, "0")}`;
    skillIds[slug] = id;
    await db
      .insert(skills)
      .values({
        id,
        slug,
        name,
        skillFamily: family,
        competencyClusterId: clusterId[clusterBySlug[slug]] ?? null,
        description: "Development fixture capability. Not an authoritative production skill definition.",
        source: FIXTURE,
        sourceVersion: VERSION,
      })
      .onConflictDoNothing();
  }

  const storedSkills = await db.select({ id: skills.id, slug: skills.slug }).from(skills);
  for (const row of storedSkills) {
    if (skillIds[row.slug]) skillIds[row.slug] = row.id;
  }
  for (const [, name] of skillSeed) {
    const slug = skillSeed.find((row) => row[1] === name)?.[0];
    const skillId = slug ? skillIds[slug] : undefined;
    if (!skillId) continue;
    await db.insert(skillAliases).values({ skillId, alias: `${name} (fixture)` }).onConflictDoNothing();
  }

  for (const occupation of occupations) {
    await db
      .insert(militaryOccupations)
      .values({
        ...occupation,
        description: "Development fixture. Not an official service extract and not the full U.S. military taxonomy.",
        source: FIXTURE,
        sourceVersion: VERSION,
        mappingQuality: FIXTURE,
      })
      .onConflictDoNothing();
    const [stored] = await db
      .select({ id: militaryOccupations.id })
      .from(militaryOccupations)
      .where(and(eq(militaryOccupations.code, occupation.code), eq(militaryOccupations.branch, occupation.branch)))
      .limit(1);
    const occupationId = stored?.id ?? occupation.id;
    for (const slug of occupationSkillSlugs[occupation.code] ?? []) {
      const skillId = skillIds[slug];
      if (!skillId) continue;
      await db
        .insert(militaryOccupationSkills)
        .values({
          militaryOccupationId: occupationId,
          skillId,
          evidenceReference: `Development fixture reference for ${occupation.code} → ${slug}. Not an authoritative production mapping.`,
          source: FIXTURE,
          sourceVersion: VERSION,
          confidence: 60,
          reviewStatus: "approved",
          origin: "reference_data",
          mappingQuality: FIXTURE,
        })
        .onConflictDoNothing();
    }
  }

  for (const occupation of civilians) {
    await db
      .insert(civilianOccupations)
      .values({
        id: occupation.id,
        title: occupation.title,
        code: occupation.code,
        description: "Development fixture civilian occupation for capability translation. Not an O*NET extract.",
        onetSource: FIXTURE,
        onetVersion: VERSION,
      })
      .onConflictDoNothing();
    for (const slug of occupation.skills) {
      const skillId = skillIds[slug];
      if (!skillId) continue;
      await db
        .insert(occupationSkills)
        .values({ occupationId: occupation.id, skillId })
        .onConflictDoNothing();
    }
    const family = familyId[occupation.family];
    if (!family) continue;
    await db
      .insert(civilianOccupationJobFamilies)
      .values({ occupationId: occupation.id, jobFamilyId: family })
      .onConflictDoNothing();
  }
}
