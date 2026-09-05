import { and, eq } from "drizzle-orm";

import type { getDb } from "../index";
import {
  candidateMilitaryExperiences,
  candidateSkills,
  candidates,
  companies,
  companyLocations,
  jobs,
  militaryInstallations,
  militaryOccupations,
  searchProjects,
  skillbridgeAlertRules,
  skillbridgeOpportunities,
  skillbridgeOpportunityStageHistory,
  skillbridgePreferredLocations,
  skillbridgeProfiles,
  skillbridgeTargetRoles,
  skills,
} from "../schema";
import { DEFAULT_SKILLBRIDGE_ALERT_RULES } from "../../lib/skillbridge/rules";
import {
  CAMP_LEJEUNE_ID,
  CHARLOTTE_ELECTRICAL_JOB_ID,
  COMPANY_ID,
  DUKE_ENERGY_COMPANY_ID,
  ELECTRICAL_TECH_OCCUPATION_ID,
  INTERNAL_ORG_ID,
  MICHAEL_CARTER_ID,
  MICHAEL_CARTER_PROFILE_ID,
  NAVY_EM_ID,
  USER_IDS,
} from "./constants";

const now = () => new Date();
const days = (n: number) => new Date(Date.now() + n * 86400000);
const ago = (n: number) => new Date(Date.now() - n * 86400000);

const ARMY_12B_ID = "00000000-0000-4000-8c00-000000000013";

export async function seedSkillBridgeAlertRules(db: ReturnType<typeof getDb>) {
  for (const rule of DEFAULT_SKILLBRIDGE_ALERT_RULES) {
    await db
      .insert(skillbridgeAlertRules)
      .values({
        organizationId: INTERNAL_ORG_ID,
        code: rule.code,
        enabled: true,
        thresholdDays: rule.thresholdDays,
      })
      .onConflictDoNothing();
  }
}

export async function seedPhase9Fixtures(db: ReturnType<typeof getDb>) {
  await seedSkillBridgeAlertRules(db);

  await db
    .insert(companies)
    .values({
      id: DUKE_ENERGY_COMPANY_ID,
      organizationId: INTERNAL_ORG_ID,
      name: "Duke Energy (development fixture)",
      industry: "energy",
      subIndustry: "utilities",
      notes: "Development fixture. Not a production employer record.",
    })
    .onConflictDoNothing();

  await db
    .insert(companyLocations)
    .values({
      id: "00000000-0000-4000-8c00-000000000018",
      companyId: DUKE_ENERGY_COMPANY_ID,
      name: "Charlotte HQ (development fixture)",
      city: "Charlotte",
      region: "NC",
      country: "US",
      isPrimary: true,
    })
    .onConflictDoNothing();

  await db
    .insert(jobs)
    .values({
      id: CHARLOTTE_ELECTRICAL_JOB_ID,
      organizationId: INTERNAL_ORG_ID,
      companyId: DUKE_ENERGY_COMPANY_ID,
      title: "Electrical Technician",
      status: "open",
      locationLabel: "Charlotte, NC",
      requiredExperienceYears: 5,
    })
    .onConflictDoNothing();
  await db
    .insert(searchProjects)
    .values({
      id: "00000000-0000-4000-8c00-000000000017",
      jobId: CHARLOTTE_ELECTRICAL_JOB_ID,
      companyId: DUKE_ENERGY_COMPANY_ID,
      name: "Internal Talent Network: Charlotte Electrical Technician",
      status: "active",
    })
    .onConflictDoNothing();

  await db
    .insert(militaryInstallations)
    .values({
      id: CAMP_LEJEUNE_ID,
      name: "Camp Lejeune",
      branch: "marine_corps",
      city: "Jacksonville",
      region: "NC",
      country: "US",
      skillbridgeRelevance: "high",
      source: "development_fixture",
    })
    .onConflictDoNothing();

  const extraOccupations = [
    [ARMY_12B_ID, "army", "mos", "12B", "Combat Engineer"] as const,
    ["00000000-0000-4000-8000-000000000503", "air_force", "afsc", "3E0X1", "Electrical Systems"] as const,
    ["00000000-0000-4000-8000-000000000504", "marine_corps", "mos", "1141", "Electrician"] as const,
    ["00000000-0000-4000-8000-000000000505", "coast_guard", "rating", "EM", "Electrician's Mate"] as const,
  ];
  for (const [id, branch, classificationType, code, title] of extraOccupations) {
    await db
      .insert(militaryOccupations)
      .values({
        id,
        branch,
        classificationType,
        code,
        title,
        description: "Development fixture occupation",
        mappingQuality: "development_fixture",
      })
      .onConflictDoNothing();
  }

  async function occupationIdFor(
    branch: "army" | "air_force" | "marine_corps" | "coast_guard",
    code: string,
    fallback: string,
  ) {
    const [row] = await db
      .select({ id: militaryOccupations.id })
      .from(militaryOccupations)
      .where(and(eq(militaryOccupations.branch, branch), eq(militaryOccupations.code, code)))
      .limit(1);
    return row?.id ?? fallback;
  }

  const army12bId = await occupationIdFor("army", "12B", ARMY_12B_ID);
  const af3e0Id = await occupationIdFor("air_force", "3E0X1", "00000000-0000-4000-8000-000000000503");
  const usmc1141Id = await occupationIdFor("marine_corps", "1141", "00000000-0000-4000-8000-000000000504");
  const uscgEmId = await occupationIdFor("coast_guard", "EM", "00000000-0000-4000-8000-000000000505");

  const people: Array<{
    id: string;
    profileId: string;
    name: string;
    title: string;
    city: string;
    region: string;
    branch: "army" | "navy" | "air_force" | "marine_corps" | "coast_guard";
    occupationId: string;
    mos: string;
    windowStart: Date;
    windowEnd: Date;
    eos: Date;
    preferred: string;
    preferredCity: string;
    preferredRegion: string;
    role: string;
    employer: string | null;
    industry: string | null;
    status: (typeof skillbridgeProfiles.$inferSelect)["candidateStatus"];
    lastContact: Date | null;
    nextFollow: Date | null;
    nextAction: string | null;
    resume: "missing" | "outdated" | "current" | "needs_review";
    installationId?: string | null;
    archived?: boolean;
  }> = [
    {
      id: MICHAEL_CARTER_ID,
      profileId: MICHAEL_CARTER_PROFILE_ID,
      name: "Michael Carter",
      title: "Navy Electrician's Mate",
      city: "Norfolk",
      region: "VA",
      branch: "navy",
      occupationId: NAVY_EM_ID,
      mos: "EM",
      windowStart: days(45),
      windowEnd: days(165),
      eos: days(180),
      preferred: "Charlotte, NC",
      preferredCity: "Charlotte",
      preferredRegion: "NC",
      role: "Electrical Technician",
      employer: "Duke Energy",
      industry: "energy",
      status: "matching",
      lastContact: ago(3),
      nextFollow: days(4),
      nextAction: "Hiring manager follow-up",
      resume: "current",
    },
    {
      id: "00000000-0000-4000-8c00-000000000102",
      profileId: "00000000-0000-4000-8c00-000000000202",
      name: "Priya Nguyen",
      title: "Electrical Technician",
      city: "Raleigh",
      region: "NC",
      branch: "army",
          occupationId: army12bId,
      mos: "12B",
      windowStart: days(20),
      windowEnd: days(140),
      eos: days(160),
      preferred: "Raleigh, NC",
      preferredCity: "Raleigh",
      preferredRegion: "NC",
      role: "Electrical Technician",
      employer: null,
      industry: "utilities",
      status: "ready_for_matching",
      lastContact: ago(2),
      nextFollow: days(5),
      nextAction: "Match opportunities",
      resume: "current",
    },
    {
      id: "00000000-0000-4000-8c00-000000000103",
      profileId: "00000000-0000-4000-8c00-000000000203",
      name: "Andre Wallace",
      title: "Air Force Electrical Systems",
      city: "Charlotte",
      region: "NC",
      branch: "air_force",
          occupationId: af3e0Id,
      mos: "3E0X1",
      windowStart: days(80),
      windowEnd: days(200),
      eos: days(220),
      preferred: "Charlotte, NC",
      preferredCity: "Charlotte",
      preferredRegion: "NC",
      role: "Electrical Technician",
      employer: "Duke Energy",
      industry: "energy",
      status: "new",
      lastContact: ago(20),
      nextFollow: ago(2),
      nextAction: "Candidate check-in",
      resume: "missing",
    },
    {
      id: "00000000-0000-4000-8c00-000000000104",
      profileId: "00000000-0000-4000-8c00-000000000204",
      name: "Sofia Delgado",
      title: "Marine Electrician",
      city: "Jacksonville",
      region: "NC",
      branch: "marine_corps",
          occupationId: usmc1141Id,
      mos: "1141",
      windowStart: days(55),
      windowEnd: days(175),
      eos: days(190),
      preferred: "Wilmington, NC",
      preferredCity: "Wilmington",
      preferredRegion: "NC",
      role: "Industrial Electrician",
      employer: null,
      industry: "manufacturing",
      status: "matching",
      lastContact: ago(1),
      nextFollow: days(10),
      nextAction: "Request updated resume",
      resume: "outdated",
      installationId: CAMP_LEJEUNE_ID,
    },
    {
      id: "00000000-0000-4000-8c00-000000000105",
      profileId: "00000000-0000-4000-8c00-000000000205",
      name: "Jonah Briggs",
      title: "Coast Guard Electrician's Mate",
      city: "Elizabeth City",
      region: "NC",
      branch: "coast_guard",
          occupationId: uscgEmId,
      mos: "EM",
      windowStart: days(12),
      windowEnd: days(100),
      eos: days(120),
      preferred: "Norfolk, VA",
      preferredCity: "Norfolk",
      preferredRegion: "VA",
      role: "Marine Electrician",
      employer: null,
      industry: "maritime",
      status: "interviewing",
      lastContact: ago(1),
      nextFollow: days(2),
      nextAction: "Interview prep",
      resume: "current",
    },
    {
      id: "00000000-0000-4000-8c00-000000000106",
      profileId: "00000000-0000-4000-8c00-000000000206",
      name: "Keisha Harmon",
      title: "Maintenance Electrician",
      city: "Fayetteville",
      region: "NC",
      branch: "army",
          occupationId: army12bId,
      mos: "12B",
      windowStart: days(100),
      windowEnd: days(220),
      eos: days(240),
      preferred: "Raleigh, NC",
      preferredCity: "Raleigh",
      preferredRegion: "NC",
      role: "Controls Technician",
      employer: null,
      industry: "energy",
      status: "profile_incomplete",
      lastContact: ago(16),
      nextFollow: ago(1),
      nextAction: "Candidate check-in",
      resume: "missing",
    },
    {
      id: "00000000-0000-4000-8c00-000000000107",
      profileId: "00000000-0000-4000-8c00-000000000207",
      name: "Marcus Hale",
      title: "Plant Electrician",
      city: "Charlotte",
      region: "NC",
      branch: "navy",
      occupationId: NAVY_EM_ID,
      mos: "EM",
      windowStart: days(33),
      windowEnd: days(150),
      eos: days(170),
      preferred: "Charlotte, NC",
      preferredCity: "Charlotte",
      preferredRegion: "NC",
      role: "Electrical Technician",
      employer: "Duke Energy",
      industry: "energy",
      status: "submitted",
      lastContact: ago(4),
      nextFollow: days(3),
      nextAction: "Employer follow-up",
      resume: "needs_review",
    },
    {
      id: "00000000-0000-4000-8c00-000000000108",
      profileId: "00000000-0000-4000-8c00-000000000208",
      name: "Elena Vasquez",
      title: "Electrical Technician",
      city: "Greensboro",
      region: "NC",
      branch: "air_force",
          occupationId: af3e0Id,
      mos: "3E0X1",
      windowStart: days(70),
      windowEnd: days(190),
      eos: days(210),
      preferred: "Charlotte, NC",
      preferredCity: "Charlotte",
      preferredRegion: "NC",
      role: "Electrical Technician",
      employer: null,
      industry: "utilities",
      status: "ready_for_matching",
      lastContact: ago(5),
      nextFollow: days(8),
      nextAction: "Find opportunities",
      resume: "current",
    },
    {
      id: "00000000-0000-4000-8c00-000000000109",
      profileId: "00000000-0000-4000-8c00-000000000209",
      name: "Tyler Brooks",
      title: "Combat Engineer",
      city: "Jacksonville",
      region: "NC",
      branch: "marine_corps",
          occupationId: usmc1141Id,
      mos: "1141",
      windowStart: days(150),
      windowEnd: days(270),
      eos: days(280),
      preferred: "Raleigh, NC",
      preferredCity: "Raleigh",
      preferredRegion: "NC",
      role: "Facilities Electrician",
      employer: null,
      industry: "construction",
      status: "new",
      lastContact: ago(8),
      nextFollow: days(6),
      nextAction: "Initial introduction",
      resume: "missing",
      installationId: CAMP_LEJEUNE_ID,
    },
    {
      id: "00000000-0000-4000-8c00-000000000110",
      profileId: "00000000-0000-4000-8c00-000000000210",
      name: "Nia Coleman",
      title: "Electrical Technician",
      city: "Durham",
      region: "NC",
      branch: "navy",
      occupationId: NAVY_EM_ID,
      mos: "EM",
      windowStart: days(5),
      windowEnd: days(90),
      eos: days(110),
      preferred: "Raleigh, NC",
      preferredCity: "Raleigh",
      preferredRegion: "NC",
      role: "Electrical Technician",
      employer: "Duke Energy",
      industry: "energy",
      status: "skillbridge_pending",
      lastContact: ago(2),
      nextFollow: days(1),
      nextAction: "Confirm SkillBridge approval",
      resume: "current",
    },
    {
      id: "00000000-0000-4000-8c00-000000000111",
      profileId: "00000000-0000-4000-8c00-000000000211",
      name: "Owen Grant",
      title: "Power Plant Operator",
      city: "Charlotte",
      region: "NC",
      branch: "coast_guard",
          occupationId: uscgEmId,
      mos: "EM",
      windowStart: ago(10),
      windowEnd: days(40),
      eos: days(60),
      preferred: "Charlotte, NC",
      preferredCity: "Charlotte",
      preferredRegion: "NC",
      role: "Power Plant Operator",
      employer: "Duke Energy",
      industry: "energy",
      status: "skillbridge_active",
      lastContact: ago(6),
      nextFollow: days(7),
      nextAction: "Conversion follow-up",
      resume: "current",
    },
    {
      id: "00000000-0000-4000-8c00-000000000112",
      profileId: "00000000-0000-4000-8c00-000000000212",
      name: "Harper Quinn",
      title: "Electrical Technician",
      city: "Asheville",
      region: "NC",
      branch: "army",
          occupationId: army12bId,
      mos: "12B",
      windowStart: days(25),
      windowEnd: days(145),
      eos: days(160),
      preferred: "Charlotte, NC",
      preferredCity: "Charlotte",
      preferredRegion: "NC",
      role: "Electrical Technician",
      employer: null,
      industry: "energy",
      status: "conversion_pending",
      lastContact: ago(1),
      nextFollow: days(3),
      nextAction: "Conversion follow-up",
      resume: "current",
    },
    {
      id: "00000000-0000-4000-8c00-000000000113",
      profileId: "00000000-0000-4000-8c00-000000000213",
      name: "Archived SkillBridge Fixture",
      title: "Electrical Technician",
      city: "Charlotte",
      region: "NC",
      branch: "navy",
      occupationId: NAVY_EM_ID,
      mos: "EM",
      windowStart: days(10),
      windowEnd: days(90),
      eos: days(100),
      preferred: "Charlotte, NC",
      preferredCity: "Charlotte",
      preferredRegion: "NC",
      role: "Electrical Technician",
      employer: null,
      industry: "energy",
      status: "matching",
      lastContact: ago(1),
      nextFollow: days(2),
      nextAction: "Do not surface",
      resume: "current",
      archived: true,
    },
  ];

  for (const person of people) {
    await db
      .insert(candidates)
      .values({
        id: person.id,
        organizationId: INTERNAL_ORG_ID,
        fullName: person.name,
        email: `${person.name.toLowerCase().replaceAll(" ", ".")}@talent.example.test`,
        phone: "555-0100",
        currentTitle: person.title,
        city: person.city,
        region: person.region,
        availability: "available_now",
        consentStatus: "granted",
        privacyClass: "restricted_pii",
        militaryStatus: "active_duty",
        careerInterests: person.industry ? `${person.industry} and utilities` : "electrical",
        source: "development_fixture",
        ownerUserId: USER_IDS.recruiter,
        lastContactedAt: person.lastContact,
        archivedAt: person.archived ? now() : null,
      })
      .onConflictDoUpdate({
        target: candidates.id,
        set: {
          fullName: person.name,
          currentTitle: person.title,
          city: person.city,
          region: person.region,
          archivedAt: person.archived ? now() : null,
          updatedAt: now(),
        },
      });

    const [existingExperience] = await db
      .select({ id: candidateMilitaryExperiences.id })
      .from(candidateMilitaryExperiences)
      .where(
        and(
          eq(candidateMilitaryExperiences.candidateId, person.id),
          eq(candidateMilitaryExperiences.militaryOccupationId, person.occupationId),
        ),
      )
      .limit(1);
    if (!existingExperience) {
      await db.insert(candidateMilitaryExperiences).values({
        candidateId: person.id,
        militaryOccupationId: person.occupationId,
        rank: "Petty Officer Second Class",
        payGrade: "E-5",
        yearsService: 8,
      });
    }

    await db
      .insert(skillbridgeProfiles)
      .values({
        id: person.profileId,
        organizationId: INTERNAL_ORG_ID,
        candidateId: person.id,
        branch: person.branch,
        militaryOccupationId: person.occupationId,
        mosRateAfscDisplay: person.mos,
        rankTitle: "E-5",
        payGrade: "E-5",
        currentInstallationId: person.installationId ?? null,
        currentDutyLocation: person.city,
        yearsOfService: 8,
        endOfServiceDate: person.eos,
        separationDate: person.eos,
        skillbridgeWindowStart: person.windowStart,
        skillbridgeWindowEnd: person.windowEnd,
        candidateAvailableDate: person.windowStart,
        preferredLocationPrimary: person.preferred,
        idealEmployerKind: person.employer ? "named_company" : "industry",
        idealEmployer: person.employer,
        idealIndustry: person.industry,
        candidateStatus: person.status,
        resumeStatus: person.resume,
        ownerUserId: USER_IDS.recruiter,
        lastContactedAt: person.lastContact,
        nextFollowUpAt: person.nextFollow,
        nextAction: person.nextAction,
        nextActionDueAt: person.nextFollow,
        developmentFixture: true,
        archivedAt: person.archived ? now() : null,
      })
      .onConflictDoUpdate({
        target: skillbridgeProfiles.id,
        set: {
          candidateStatus: person.status,
          lastContactedAt: person.lastContact,
          nextFollowUpAt: person.nextFollow,
          nextActionDueAt: person.nextFollow,
          archivedAt: person.archived ? now() : null,
          updatedAt: now(),
        },
      });

    await db
      .insert(skillbridgePreferredLocations)
      .values({
        skillbridgeProfileId: person.profileId,
        locationLabel: person.preferred,
        city: person.preferredCity,
        region: person.preferredRegion,
        isPrimary: true,
      })
      .onConflictDoNothing();
    await db
      .insert(skillbridgeTargetRoles)
      .values({
        skillbridgeProfileId: person.profileId,
        roleTitle: person.role,
        civilianOccupationId: ELECTRICAL_TECH_OCCUPATION_ID,
        isPrimary: true,
      })
      .onConflictDoNothing();
  }

  const opportunitySeeds = [
    {
      id: "00000000-0000-4000-8c00-000000000301",
      profileId: MICHAEL_CARTER_PROFILE_ID,
      candidateId: MICHAEL_CARTER_ID,
      companyId: DUKE_ENERGY_COMPANY_ID,
      jobId: CHARLOTTE_ELECTRICAL_JOB_ID,
      stage: "opportunity_matching" as const,
      lastEmployer: ago(2),
    },
    {
      id: "00000000-0000-4000-8c00-000000000302",
      profileId: MICHAEL_CARTER_PROFILE_ID,
      candidateId: MICHAEL_CARTER_ID,
      companyId: COMPANY_ID,
      jobId: null,
      stage: "candidate_identified" as const,
      lastEmployer: ago(1),
    },
    {
      id: "00000000-0000-4000-8c00-000000000303",
      profileId: "00000000-0000-4000-8c00-000000000207",
      candidateId: "00000000-0000-4000-8c00-000000000107",
      companyId: DUKE_ENERGY_COMPANY_ID,
      jobId: CHARLOTTE_ELECTRICAL_JOB_ID,
      stage: "employer_submitted" as const,
      lastEmployer: ago(12),
      submittedAt: ago(12),
    },
    {
      id: "00000000-0000-4000-8c00-000000000304",
      profileId: "00000000-0000-4000-8c00-000000000205",
      candidateId: "00000000-0000-4000-8c00-000000000105",
      companyId: COMPANY_ID,
      jobId: null,
      stage: "interview" as const,
      lastEmployer: ago(1),
    },
  ];

  for (const row of opportunitySeeds) {
    await db
      .insert(skillbridgeOpportunities)
      .values({
        id: row.id,
        organizationId: INTERNAL_ORG_ID,
        skillbridgeProfileId: row.profileId,
        candidateId: row.candidateId,
        companyId: row.companyId,
        jobId: row.jobId,
        stage: row.stage,
        source: "development_fixture",
        lastEmployerContactAt: row.lastEmployer,
        submittedAt: "submittedAt" in row ? row.submittedAt : null,
        ownerUserId: USER_IDS.recruiter,
      })
      .onConflictDoNothing();
    await db
      .insert(skillbridgeOpportunityStageHistory)
      .values({
        skillbridgeOpportunityId: row.id,
        fromStage: null,
        toStage: row.stage,
        changedByUserId: USER_IDS.recruiter,
        note: "Development fixture",
      })
      .onConflictDoNothing();
  }

  const skillRows = await db.select().from(skills);
  const electrical = skillRows.find((row) => row.slug === "electrical-troubleshooting");
  if (electrical) {
    for (const person of people) {
      await db
        .insert(candidateSkills)
        .values({ candidateId: person.id, skillId: electrical.id, yearsExperience: 5 })
        .onConflictDoNothing();
    }
  }
}
