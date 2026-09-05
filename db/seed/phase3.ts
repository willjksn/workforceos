import { and, eq, ne } from "drizzle-orm";

import type { getDb } from "../index";
import {
  bridgeTrainingRecommendations,
  candidateJobMatches,
  candidateMilitaryExperiences,
  civilianOccupations,
  interviews,
  jobSkills,
  jobs,
  militaryCivilianMappings,
  militaryInstallations,
  militaryOccupationInstallations,
  militaryOccupationSkills,
  militaryOccupations,
  offers,
  placementGuarantees,
  placements,
  searchProjects,
  submissions,
} from "../schema";
import {
  CANDIDATE_ID,
  COMPANY_ID,
  ELECTRICAL_TECH_OCCUPATION_ID,
  INTERNAL_ORG_ID,
  NAVY_EM_ID,
  USER_IDS,
} from "./constants";

const now = () => new Date();

export async function seedPhase3OperatingFixtures(
  db: ReturnType<typeof getDb>,
  skillIds: Record<string, string>,
) {
  const extraJobs = [
    ["00000000-0000-4000-8700-000000000004", "Reliability Technician", "open"],
    ["00000000-0000-4000-8700-000000000005", "Electrical Supervisor", "search_active"],
    ["00000000-0000-4000-8700-000000000006", "Industrial Electrician", "open"],
  ] as const;
  for (const [id, title, status] of extraJobs) {
    await db
      .insert(jobs)
      .values({
        id,
        organizationId: INTERNAL_ORG_ID,
        companyId: COMPANY_ID,
        title,
        status,
        locationLabel: "Norfolk, VA",
        compensationMin: "72000",
        compensationMax: "92000",
        requiredExperienceYears: 5,
        searchOwnerUserId: USER_IDS.recruiter,
        priority: "high",
        urgency: "normal",
        militaryCompatibility: "high_alignment_possible",
      })
      .onConflictDoNothing();
    await db
      .insert(searchProjects)
      .values({
        id: id.replace("8700", "8710"),
        jobId: id,
        companyId: COMPANY_ID,
        name: `Internal Talent Network: ${title}`,
        status: "active",
        guaranteeDays: 90,
        feePercent: "25.00",
        contractReference: "development-fixture-search-agreement",
      })
      .onConflictDoNothing();
  }

  await db
    .update(jobs)
    .set({
      locationLabel: "Harbor, NC",
      compensationMin: "68000",
      compensationMax: "88000",
      requiredExperienceYears: 5,
      searchOwnerUserId: USER_IDS.recruiter,
      hiringManagerContactId: "00000000-0000-4000-8300-000000000001",
      lastActivityAt: now(),
      updatedAt: now(),
    })
    .where(eq(jobs.id, "00000000-0000-4000-8700-000000000001"));

  await db
    .update(searchProjects)
    .set({
      guaranteeDays: 90,
      feePercent: "25.00",
      contractReference: "development-fixture-search-agreement",
      companyId: COMPANY_ID,
      updatedAt: now(),
    })
    .where(eq(searchProjects.jobId, "00000000-0000-4000-8700-000000000001"));

  for (const jobId of [
    "00000000-0000-4000-8700-000000000001",
    "00000000-0000-4000-8700-000000000004",
    "00000000-0000-4000-8700-000000000005",
    "00000000-0000-4000-8700-000000000006",
  ]) {
    await db
      .insert(jobSkills)
      .values({
        jobId,
        skillId: skillIds["electrical-troubleshooting"],
        requirementType: "required",
        minimumYears: 3,
        humanVerified: true,
      })
      .onConflictDoNothing();
    await db
      .insert(jobSkills)
      .values({
        jobId,
        skillId: skillIds["preventive-maintenance"],
        requirementType: "preferred",
        humanVerified: true,
      })
      .onConflictDoNothing();
  }

  await db
    .update(candidateJobMatches)
    .set({ pipelineStatus: "identified", source: "internal_talent_network", updatedAt: now() })
    .where(eq(candidateJobMatches.candidateId, CANDIDATE_ID));
  await db
    .update(candidateJobMatches)
    .set({ pipelineStatus: "placed", updatedAt: now() })
    .where(
      and(
        eq(candidateJobMatches.candidateId, CANDIDATE_ID),
        eq(candidateJobMatches.jobId, "00000000-0000-4000-8700-000000000001"),
      ),
    );
  await db
    .update(candidateJobMatches)
    .set({ pipelineStatus: "screening", updatedAt: now() })
    .where(
      and(
        eq(candidateJobMatches.candidateId, CANDIDATE_ID),
        eq(candidateJobMatches.jobId, "00000000-0000-4000-8700-000000000002"),
      ),
    );
  await db
    .update(candidateJobMatches)
    .set({ pipelineStatus: "qualified", updatedAt: now() })
    .where(
      and(
        eq(candidateJobMatches.candidateId, CANDIDATE_ID),
        eq(candidateJobMatches.jobId, "00000000-0000-4000-8700-000000000003"),
      ),
    );

  await db
    .insert(submissions)
    .values({
      id: "00000000-0000-4000-8720-000000000001",
      candidateId: CANDIDATE_ID,
      jobId: "00000000-0000-4000-8700-000000000001",
      submittedByUserId: USER_IDS.recruiter,
      status: "submitted",
      version: 1,
      candidateSummary: "Development fixture packet for Harbor plant electrician.",
      recruiterCommentary: "Human-prepared fixture submission.",
      submittedAt: now(),
      approvedByUserId: USER_IDS.recruiter,
      approvedAt: now(),
    })
    .onConflictDoNothing();

  await db
    .insert(interviews)
    .values([
      {
        id: "00000000-0000-4000-8730-000000000001",
        submissionId: "00000000-0000-4000-8720-000000000001",
        candidateId: CANDIDATE_ID,
        jobId: "00000000-0000-4000-8700-000000000001",
        stage: "hiring_manager",
        format: "video",
        status: "completed",
        scheduledFor: new Date("2026-08-20T15:00:00.000Z"),
        completedAt: new Date("2026-08-20T16:00:00.000Z"),
        clientFeedback: "Strong electrical fundamentals.",
        outcome: "advance",
      },
      {
        id: "00000000-0000-4000-8730-000000000002",
        submissionId: "00000000-0000-4000-8720-000000000001",
        candidateId: CANDIDATE_ID,
        jobId: "00000000-0000-4000-8700-000000000001",
        stage: "panel",
        format: "onsite",
        status: "completed",
        scheduledFor: new Date("2026-08-27T15:00:00.000Z"),
        completedAt: new Date("2026-08-27T17:00:00.000Z"),
        clientFeedback: "Finalist.",
        outcome: "finalist",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(offers)
    .values({
      id: "00000000-0000-4000-8740-000000000001",
      candidateId: CANDIDATE_ID,
      jobId: "00000000-0000-4000-8700-000000000001",
      searchProjectId: "00000000-0000-4000-8710-000000000001",
      status: "accepted",
      baseSalary: "82000",
      offerDate: "2026-09-01",
      expirationDate: "2026-09-08",
    })
    .onConflictDoNothing();

  await db
    .insert(placements)
    .values({
      id: "00000000-0000-4000-8750-000000000001",
      candidateId: CANDIDATE_ID,
      jobId: "00000000-0000-4000-8700-000000000001",
      companyId: COMPANY_ID,
      searchProjectId: "00000000-0000-4000-8710-000000000001",
      offerId: "00000000-0000-4000-8740-000000000001",
      startDate: new Date("2026-09-15T12:00:00.000Z"),
      startingSalary: "82000",
      feePercent: "25.00",
      placementFee: "20500.00",
      guaranteeDays: 90,
      status: "pending_start",
      billingEventQueuedAt: now(),
    })
    .onConflictDoNothing();
  await db
    .update(jobs)
    .set({ status: "filled", lastActivityAt: now(), updatedAt: now() })
    .where(eq(jobs.id, "00000000-0000-4000-8700-000000000001"));

  await db
    .insert(placementGuarantees)
    .values({
      id: "00000000-0000-4000-8760-000000000001",
      placementId: "00000000-0000-4000-8750-000000000001",
      searchProjectId: "00000000-0000-4000-8710-000000000001",
      guaranteeDays: 90,
      startsOn: "2026-09-15",
      endsOn: "2026-12-14",
      status: "active",
      sourceTerms: "development-fixture-search-agreement",
    })
    .onConflictDoNothing();

  const occupationFixtures: Array<{
    id: string;
    branch: "army" | "air_force" | "marine_corps" | "coast_guard" | "space_force";
    classificationType: "mos" | "rating" | "afsc" | "specialty";
    code: string;
    title: string;
  }> = [
    { id: "00000000-0000-4000-8000-000000000502", branch: "army", classificationType: "mos", code: "12R", title: "Interior Electrician" },
    { id: "00000000-0000-4000-8000-000000000503", branch: "air_force", classificationType: "afsc", code: "3E0X1", title: "Electrical Systems" },
    { id: "00000000-0000-4000-8000-000000000504", branch: "marine_corps", classificationType: "mos", code: "1141", title: "Electrician" },
    { id: "00000000-0000-4000-8000-000000000505", branch: "coast_guard", classificationType: "rating", code: "EM", title: "Electrician's Mate" },
    { id: "00000000-0000-4000-8000-000000000506", branch: "space_force", classificationType: "specialty", code: "5S0X1", title: "Space Systems (development fixture)" },
  ];

  for (const occupation of occupationFixtures) {
    await db
      .insert(militaryOccupations)
      .values({
        ...occupation,
        description: "Development fixture. Not an official extract.",
        mappingQuality: "development_fixture",
        source: "development_fixture",
        sourceVersion: "phase3-dev",
        careerField: "electrical",
      })
      .onConflictDoNothing();
    await db
      .insert(militaryOccupationSkills)
      .values({ militaryOccupationId: occupation.id, skillId: skillIds["electrical-troubleshooting"] })
      .onConflictDoNothing();
    await db
      .insert(militaryCivilianMappings)
      .values({
        militaryOccupationId: occupation.id,
        civilianOccupationId: ELECTRICAL_TECH_OCCUPATION_ID,
        explanation: "Development fixture mapping; not authoritative production data.",
        mappingQuality: "development_fixture",
        source: "development_fixture",
        sourceVersion: "phase3-dev",
        reviewStatus: "approved",
        origin: "reference_data",
        confidence: 60,
        compatibilityScore: 70,
      })
      .onConflictDoNothing();
  }

  await db
    .update(militaryOccupations)
    .set({
      source: "development_fixture",
      sourceVersion: "phase3-dev",
      careerField: "engineering",
      rankApplicability: "E4-E7 fixture note",
      updatedAt: now(),
    })
    .where(eq(militaryOccupations.id, NAVY_EM_ID));

  await db
    .update(militaryCivilianMappings)
    .set({
      source: "development_fixture",
      sourceVersion: "phase3-dev",
      reviewStatus: "approved",
      origin: "reference_data",
      confidence: 72,
      compatibilityScore: 82,
      updatedAt: now(),
    })
    .where(
      and(
        eq(militaryCivilianMappings.militaryOccupationId, NAVY_EM_ID),
        ne(militaryCivilianMappings.reviewStatus, "pending"),
      ),
    );

  const installationGeo = [
    ["00000000-0000-4000-8800-000000000001", "Norfolk", "36.946000", "-76.327000"],
    ["00000000-0000-4000-8800-000000000002", "San Diego", "32.684000", "-117.128000"],
    ["00000000-0000-4000-8800-000000000003", "Mayport", "30.392000", "-81.424000"],
  ] as const;
  for (const [id, city, latitude, longitude] of installationGeo) {
    await db
      .update(militaryInstallations)
      .set({
        city,
        latitude,
        longitude,
        coordinateSource: "development_fixture_public_geography",
        source: "development_fixture",
        transitionRelevance: "High volume of transitioning technical talent (fixture note)",
        skillbridgeRelevance: "SkillBridge relevance not independently verified in this fixture",
        recruitingPriority: "high",
        updatedAt: now(),
      })
      .where(eq(militaryInstallations.id, id));
  }

  await db
    .insert(militaryInstallations)
    .values({
      id: "00000000-0000-4000-8800-000000000004",
      name: "Fort Liberty",
      branch: "army",
      city: "Fayetteville",
      region: "NC",
      latitude: "35.139000",
      longitude: "-79.006000",
      coordinateSource: "development_fixture_public_geography",
      source: "development_fixture",
      recruitingPriority: "high",
    })
    .onConflictDoNothing();
  await db
    .insert(militaryOccupationInstallations)
    .values({
      militaryOccupationId: "00000000-0000-4000-8000-000000000502",
      installationId: "00000000-0000-4000-8800-000000000004",
      presenceLevel: "primary",
      whyPresent: "Development fixture: Army electrician training density is not independently verified here.",
      source: "development_fixture",
      reviewStatus: "approved",
      origin: "reference_data",
      confidence: 55,
    })
    .onConflictDoNothing();

  await db
    .insert(civilianOccupations)
    .values({
      id: "00000000-0000-4000-8000-000000000604",
      title: "Industrial Controls Technician",
      code: "DEV-IND-CTRL",
      description: "Development fixture civilian occupation for pending-review mapping",
      onetSource: "development-fixture",
    })
    .onConflictDoNothing();

  await db
    .insert(militaryCivilianMappings)
    .values({
      id: "00000000-0000-4000-8b00-000000000001",
      militaryOccupationId: NAVY_EM_ID,
      civilianOccupationId: "00000000-0000-4000-8000-000000000604",
      explanation: "AI draft fixture. Must remain pending until a human reviews it.",
      mappingQuality: "ai_draft",
      source: "agent_draft",
      aiModel: "development-unconfigured",
      modelVersion: "none",
      origin: "agent",
      reviewStatus: "pending",
      confidence: 40,
    })
    .onConflictDoNothing();

  await db
    .insert(bridgeTrainingRecommendations)
    .values({
      id: "00000000-0000-4000-8c00-000000000001",
      militaryOccupationId: NAVY_EM_ID,
      civilianOccupationId: ELECTRICAL_TECH_OCCUPATION_ID,
      transferableSkills: "Electrical troubleshooting; preventive maintenance; safety compliance",
      missingSkills: "Client-specific PLC platform; state credential where required",
      recommendedCredential: "Plant-specific LOTO and PLC orientation (fixture)",
      trainingProgram: "Development fixture bridge module",
      expectedBridgePurpose: "Close commercial equipment gaps. Does not promise employment.",
      source: "development_fixture",
      reviewStatus: "approved",
      origin: "reference_data",
    })
    .onConflictDoNothing();

  await db
    .update(candidateMilitaryExperiences)
    .set({
      rank: "Petty Officer First Class",
      payGrade: "E-6",
      yearsService: 8,
      yearsInOccupation: 8,
      leadershipLevel: "work-center supervisor",
      dutyStations: "Norfolk; San Diego",
      updatedAt: now(),
    })
    .where(eq(candidateMilitaryExperiences.candidateId, CANDIDATE_ID));
}
