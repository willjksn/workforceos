import type { getDb } from "../index";
import {
  apprenticeships,
  careerPathEdges,
  careerPathLevels,
  careerPaths,
  civilianOccupations,
  companies,
  companyLocations,
  educationPartnerClients,
  educationPartnerLocations,
  educationPartners,
  laborMarketObservations,
  laborMarketSourceMetadata,
  occupationSkills,
  skills,
  trainingProgramOccupations,
  trainingPrograms,
  workforceAssessmentAssumptions,
  workforceAssessmentDataSources,
  workforceAssessmentLocations,
  workforceAssessments,
  workforceBaselines,
  workforceForecastComponents,
  workforceForecastResults,
  workforceForecasts,
  workforceGapThresholds,
  workforceGaps,
  workforceGeographies,
  workforceRoles,
  workforceRoleSkills,
  workforceScenarioInputs,
  workforceScenarioOutputs,
  workforceScenarios,
  workforceSupplyEntries,
} from "../schema";
import {
  ELECTRICAL_TECH_OCCUPATION_ID,
  ENERGY_COMPANY_ID,
  INTERNAL_ORG_ID,
  PHASE5_ASSESSMENT_ID,
  USER_IDS,
} from "./constants";
import { SERVICE_IDS } from "./service-catalog";
import { computeDemandForecast, defaultForecastComponents } from "../../lib/workforce/forecast";
import { classifyGapSeverity, computeGap, DEFAULT_GAP_THRESHOLDS } from "../../lib/workforce/gaps";

const pad = (value: number) => String(value).padStart(12, "0");

const OCCUPATION_IDS = {
  electrical: ELECTRICAL_TECH_OCCUPATION_ID,
  maintenance: "00000000-0000-4000-8000-000000000604",
  engineering: "00000000-0000-4000-8000-000000000605",
  operations: "00000000-0000-4000-8000-000000000606",
  supervisor: "00000000-0000-4000-8000-000000000607",
} as const;

const LOCATION_IDS = [1, 2, 3].map((n) => `00000000-0000-4000-8b10-${pad(n)}`);
const ROLE_IDS = [1, 2, 3, 4, 5].map((n) => `00000000-0000-4000-8b20-${pad(n)}`);
const PARTNER_ID = "00000000-0000-4000-8b30-000000000001";
const PROGRAM_ID = "00000000-0000-4000-8b31-000000000001";
const PATH_ID = "00000000-0000-4000-8b40-000000000001";

export async function seedPhase5Fixtures(db: ReturnType<typeof getDb>) {
  const now = new Date();
  await db
    .insert(companies)
    .values({
      id: ENERGY_COMPANY_ID,
      organizationId: INTERNAL_ORG_ID,
      name: "Cedar Ridge Energy",
      companyType: "client",
      clientStatus: "active",
      relationshipStrength: "strong",
      industry: "energy",
      subIndustry: "industrial generation",
      employeeCount: 780,
      notes: "Phase 5 development fixture. Industrial/energy workforce planning client. Not live production data.",
      accountOwnerUserId: USER_IDS.managingPartner,
      workforceOpportunityScore: 81,
    })
    .onConflictDoUpdate({
      target: companies.id,
      set: { name: "Cedar Ridge Energy", notes: "Phase 5 development fixture. Not live production data.", updatedAt: now },
    });

  const locations = [
    { id: LOCATION_IDS[0], name: "River Plant", city: "Charleston", region: "WV" },
    { id: LOCATION_IDS[1], name: "Ridge Field Station", city: "Beckley", region: "WV" },
    { id: LOCATION_IDS[2], name: "Valley Operations Center", city: "Huntington", region: "WV" },
  ];
  for (const [index, location] of locations.entries()) {
    await db
      .insert(companyLocations)
      .values({
        id: location.id,
        companyId: ENERGY_COMPANY_ID,
        name: location.name,
        city: location.city,
        region: location.region,
        country: "US",
        isPrimary: index === 0,
      })
      .onConflictDoNothing();
    await db
      .insert(workforceGeographies)
      .values({
        id: `00000000-0000-4000-8b11-${pad(index + 1)}`,
        organizationId: INTERNAL_ORG_ID,
        geographyType: "client_location",
        name: location.name,
        city: location.city,
        region: location.region,
        country: "US",
        referenceTable: "company_locations",
        referenceId: location.id,
      })
      .onConflictDoNothing();
  }

  const extraOccupations = [
    { id: OCCUPATION_IDS.maintenance, title: "Maintenance Technician", code: "DEV-MAINT-TECH" },
    { id: OCCUPATION_IDS.engineering, title: "Engineering Technician", code: "DEV-ENG-TECH" },
    { id: OCCUPATION_IDS.operations, title: "Operations Technician", code: "DEV-OPS-TECH" },
    { id: OCCUPATION_IDS.supervisor, title: "Maintenance Supervisor", code: "DEV-MAINT-SUP" },
  ];
  for (const occupation of extraOccupations) {
    await db
      .insert(civilianOccupations)
      .values({
        ...occupation,
        description: "Phase 5 development fixture occupation. Not an official O*NET extract.",
        onetSource: "development-fixture",
        onetVersion: "dev",
      })
      .onConflictDoNothing();
  }

  const skillRows = await db.select().from(skills);
  const skillId = (slug: string) => skillRows.find((row) => row.slug === slug)?.id;
  const electricalSkill = skillId("electrical-troubleshooting");
  const safetySkill = skillId("electrical-safety");
  const maintenanceSkill = skillId("preventive-maintenance");
  for (const occupationId of Object.values(OCCUPATION_IDS)) {
    if (electricalSkill) {
      await db.insert(occupationSkills).values({ occupationId, skillId: electricalSkill }).onConflictDoNothing();
    }
    if (safetySkill) {
      await db.insert(occupationSkills).values({ occupationId, skillId: safetySkill }).onConflictDoNothing();
    }
  }

  await db
    .insert(workforceAssessments)
    .values({
      id: PHASE5_ASSESSMENT_ID,
      organizationId: INTERNAL_ORG_ID,
      companyId: ENERGY_COMPANY_ID,
      serviceId: SERVICE_IDS["workforce-pipeline-assessment"],
      title: "Cedar Ridge Energy workforce pipeline assessment (development fixture)",
      status: "analysis",
      versionNumber: 1,
      notes: "Development fixture. Harbor/Taylor Ellis/Navy EM remain separate fixtures.",
      createdByUserId: USER_IDS.managingPartner,
    })
    .onConflictDoNothing();

  for (const locationId of LOCATION_IDS) {
    await db
      .insert(workforceAssessmentLocations)
      .values({ assessmentId: PHASE5_ASSESSMENT_ID, companyLocationId: locationId })
      .onConflictDoNothing();
  }
  await db
    .insert(workforceAssessmentDataSources)
    .values({
      assessmentId: PHASE5_ASSESSMENT_ID,
      sourceType: "manual",
      sourceName: "development-fixture",
      sourceVersion: "phase5-v1",
      notes: "Labeled fixture. Not live BLS/Census/O*NET.",
      isFixture: true,
    })
    .onConflictDoNothing();

  const roles = [
    { id: ROLE_IDS[0], title: "Electrical Technician", occupationId: OCCUPATION_IDS.electrical, locationId: LOCATION_IDS[0], headcount: 42, vacancies: 8, attrition: 12, retirement: 6, criticality: "critical" as const },
    { id: ROLE_IDS[1], title: "Maintenance Technician", occupationId: OCCUPATION_IDS.maintenance, locationId: LOCATION_IDS[0], headcount: 36, vacancies: 6, attrition: 10, retirement: 8, criticality: "high" as const },
    { id: ROLE_IDS[2], title: "Engineering Technician", occupationId: OCCUPATION_IDS.engineering, locationId: LOCATION_IDS[2], headcount: 18, vacancies: 3, attrition: 8, retirement: 4, criticality: "high" as const },
    { id: ROLE_IDS[3], title: "Operations Technician", occupationId: OCCUPATION_IDS.operations, locationId: LOCATION_IDS[1], headcount: 28, vacancies: 4, attrition: 9, retirement: 5, criticality: "moderate" as const },
    { id: ROLE_IDS[4], title: "Maintenance Supervisor", occupationId: OCCUPATION_IDS.supervisor, locationId: LOCATION_IDS[0], headcount: 8, vacancies: 1, attrition: 6, retirement: 15, criticality: "critical" as const },
  ];

  for (const role of roles) {
    await db
      .insert(workforceRoles)
      .values({
        id: role.id,
        organizationId: INTERNAL_ORG_ID,
        companyId: ENERGY_COMPANY_ID,
        assessmentId: PHASE5_ASSESSMENT_ID,
        title: role.title,
        civilianOccupationId: role.occupationId,
        jobFamily: "technician",
        companyLocationId: role.locationId,
        currentHeadcount: role.headcount,
        criticality: role.criticality,
        businessFunction: "operations",
        shiftSchedule: "rotating 12-hour",
        minimumCredentials: role.title.includes("Electrical") ? "Electrical safety credential if client-supplied" : null,
        targetProficiency: "journey",
        futureDemandCategory: "growth",
        militaryCompatibility: role.title.includes("Electrical") ? "high" : "moderate",
        talentScarcity: "internal_only",
        replacementDifficulty: role.criticality,
        notes: "Phase 5 development fixture role. Planning-level, not a recruiting job.",
        isFixture: true,
      })
      .onConflictDoNothing();
    if (electricalSkill) {
      await db.insert(workforceRoleSkills).values({ roleId: role.id, skillId: electricalSkill }).onConflictDoNothing();
    }
    if (safetySkill) {
      await db.insert(workforceRoleSkills).values({ roleId: role.id, skillId: safetySkill }).onConflictDoNothing();
    }
    if (maintenanceSkill && role.title.includes("Maintenance")) {
      await db.insert(workforceRoleSkills).values({ roleId: role.id, skillId: maintenanceSkill }).onConflictDoNothing();
    }
    await db
      .insert(workforceBaselines)
      .values({
        assessmentId: PHASE5_ASSESSMENT_ID,
        roleId: role.id,
        companyLocationId: role.locationId,
        currentHeadcount: role.headcount,
        vacancies: role.vacancies,
        attritionRatePercent: String(role.attrition),
        retirementEligibilityRatePercent: String(role.retirement),
        turnoverRatePercent: String(role.attrition),
        averageTenureMonths: "84",
        internalMobilityRatePercent: "4",
        currentPipelineCount: 3,
        knownHiringPlan: role.vacancies,
        trainingCapacity: 6,
        asOfDate: now,
        source: "development-fixture",
        sourceVersion: "phase5-v1",
        internalAssumption: "Fixture rates are labeled estimates, not measured client HRIS extracts.",
        dataQuality: "internal_only",
        isFixture: true,
        generatedAt: now,
        reviewerUserId: USER_IDS.managingPartner,
        confidence: "0.5500",
      })
      .onConflictDoNothing();
    await db
      .insert(workforceAssessmentAssumptions)
      .values({
        assessmentId: PHASE5_ASSESSMENT_ID,
        code: `growth:${role.id}`,
        label: "Base growth",
        included: true,
        ratePercent: "3",
        explanation: "Fixture growth assumption.",
        createdByUserId: USER_IDS.managingPartner,
      })
      .onConflictDoNothing();
  }

  for (const threshold of DEFAULT_GAP_THRESHOLDS) {
    await db
      .insert(workforceGapThresholds)
      .values({
        organizationId: INTERNAL_ORG_ID,
        severity: threshold.severity,
        minGap: threshold.minGap,
        minGapPercent: String(threshold.minGapPercent),
      })
      .onConflictDoNothing();
  }

  for (const [index, horizon] of [12, 24, 36].entries()) {
    const forecastId = `00000000-0000-4000-8b50-${pad(index + 1)}`;
    await db
      .insert(workforceForecasts)
      .values({
        id: forecastId,
        assessmentId: PHASE5_ASSESSMENT_ID,
        versionNumber: 1,
        name: `Base demand ${horizon} months (fixture)`,
        horizonMonths: horizon,
        status: "draft",
        calculationMethod:
          "Configurable planning model: future demand = current required + growth + replacement + backlog - expected internal supply. Estimate only.",
        createdByUserId: USER_IDS.managingPartner,
        source: "development-fixture",
        sourceVersion: "phase5-v1",
        dataQuality: "estimated",
        isFixture: true,
        confidence: "0.5500",
        generatedAt: now,
        reviewerUserId: USER_IDS.managingPartner,
        internalAssumption: "Fixture forecast. Not a guaranteed outcome.",
      })
      .onConflictDoNothing();
    const components = defaultForecastComponents({
      attritionRatePercent: 12,
      retirementRatePercent: 6,
      growthRatePercent: 3,
      backlog: 8,
      internalMobilityRatePercent: 4,
    });
    for (const [sequence, component] of components.entries()) {
      await db
        .insert(workforceForecastComponents)
        .values({
          forecastId,
          code: component.code,
          label: component.label,
          included: component.included,
          ratePercent: component.ratePercent != null ? String(component.ratePercent) : null,
          quantity: component.quantity ?? null,
          explanation: component.explanation,
          sequence: sequence + 1,
        })
        .onConflictDoNothing();
    }
    for (const role of roles) {
      const computed = computeDemandForecast({
        currentHeadcount: role.headcount,
        vacancies: role.vacancies,
        horizonMonths: horizon,
        components: defaultForecastComponents({
          attritionRatePercent: role.attrition,
          retirementRatePercent: role.retirement,
          growthRatePercent: 3,
          backlog: role.vacancies,
          internalMobilityRatePercent: 4,
        }),
      });
      await db
        .insert(workforceForecastResults)
        .values({
          forecastId,
          roleId: role.id,
          companyLocationId: role.locationId,
          horizonMonths: horizon,
          currentRequired: computed.currentRequired,
          growthDemand: computed.growthDemand,
          replacementDemand: computed.replacementDemand,
          backlogDemand: computed.backlogDemand,
          expectedInternalSupply: computed.expectedInternalSupply,
          futureDemand: computed.futureDemand,
          assumptionsSummary: computed.calculationMethod,
          source: "development-fixture",
          dataQuality: "estimated",
          isFixture: true,
          confidence: "0.5500",
          generatedAt: now,
        })
        .onConflictDoNothing();
      const supply = Math.round(role.headcount * 0.08);
      await db
        .insert(workforceSupplyEntries)
        .values({
          id: `00000000-0000-4000-8b70-${pad(index * 10 + roles.indexOf(role) + 1)}`,
          assessmentId: PHASE5_ASSESSMENT_ID,
          roleId: role.id,
          companyLocationId: role.locationId,
          sourceType: "internal_mobility",
          estimatedSupply: supply,
          readiness: "partial",
          timeToReadinessDays: 180,
          capacity: supply,
          source: "development-fixture",
          dataQuality: "internal_only",
          isFixture: true,
          lastUpdated: now,
        })
        .onConflictDoNothing();
      await db
        .insert(workforceSupplyEntries)
        .values({
          id: `00000000-0000-4000-8b71-${pad(index * 10 + roles.indexOf(role) + 1)}`,
          assessmentId: PHASE5_ASSESSMENT_ID,
          roleId: role.id,
          sourceType: "talent_network",
          estimatedSupply: 4,
          readiness: "aggregate_only",
          source: "development-fixture",
          dataQuality: "internal_only",
          isFixture: true,
          lastUpdated: now,
        })
        .onConflictDoNothing();
      const gap = computeGap(computed.futureDemand, supply + 4);
      await db
        .insert(workforceGaps)
        .values({
          id: `00000000-0000-4000-8b80-${pad(index * 10 + roles.indexOf(role) + 1)}`,
          assessmentId: PHASE5_ASSESSMENT_ID,
          roleId: role.id,
          companyLocationId: role.locationId,
          horizonMonths: horizon,
          demand: computed.futureDemand,
          supply: supply + 4,
          gap,
          severity: classifyGapSeverity(gap, computed.futureDemand),
          risk: "capacity",
          timeHorizon: `${horizon} months`,
          source: "development-fixture",
          dataQuality: "estimated",
          isFixture: true,
          generatedAt: now,
        })
        .onConflictDoNothing();
    }
  }

  await db
    .insert(educationPartners)
    .values({
      id: PARTNER_ID,
      organizationId: INTERNAL_ORG_ID,
      companyId: ENERGY_COMPANY_ID,
      name: "New River Community College (fixture)",
      partnerType: "community_college",
      partnershipStatus: "active",
      occupationsSupported: "Electrical Technician, Maintenance Technician",
      credentials: "Fixture credential list — not official",
      annualCapacity: 40,
      notes: "Phase 5 development fixture partner.",
      isFixture: true,
    })
    .onConflictDoNothing();
  await db
    .insert(educationPartnerLocations)
    .values({
      id: "00000000-0000-4000-8b32-000000000001",
      partnerId: PARTNER_ID,
      name: "Beckley campus",
      city: "Beckley",
      region: "WV",
      country: "US",
    })
    .onConflictDoNothing();
  await db
    .insert(educationPartnerClients)
    .values({
      id: "00000000-0000-4000-8b33-000000000001",
      partnerId: PARTNER_ID,
      companyId: ENERGY_COMPANY_ID,
    })
    .onConflictDoNothing();
  await db
    .insert(trainingPrograms)
    .values({
      id: PROGRAM_ID,
      organizationId: INTERNAL_ORG_ID,
      partnerId: PARTNER_ID,
      name: "Industrial electrical bridge (fixture)",
      durationDays: 90,
      capacity: 24,
      deliveryMethod: "classroom",
      location: "Beckley, WV",
      credentials: null,
      completionRatePercent: null,
      placementRatePercent: null,
      isFixture: true,
    })
    .onConflictDoNothing();
  await db
    .insert(trainingProgramOccupations)
    .values({ programId: PROGRAM_ID, occupationId: OCCUPATION_IDS.electrical })
    .onConflictDoNothing();
  await db
    .insert(apprenticeships)
    .values({
      id: "00000000-0000-4000-8b34-000000000001",
      organizationId: INTERNAL_ORG_ID,
      companyId: ENERGY_COMPANY_ID,
      partnerId: PARTNER_ID,
      occupationId: OCCUPATION_IDS.maintenance,
      sponsorName: "Cedar Ridge Energy (fixture)",
      durationMonths: 24,
      trainingHours: 2000,
      classroomHours: 288,
      targetEnrollment: 12,
      annualCapacity: 12,
      status: "planned",
      notes: "Planning record only. Not a registered apprenticeship system of record.",
      isFixture: true,
    })
    .onConflictDoNothing();

  await db
    .insert(careerPaths)
    .values({
      id: PATH_ID,
      organizationId: INTERNAL_ORG_ID,
      companyId: ENERGY_COMPANY_ID,
      name: "Technician pathway (fixture)",
      description: "Technician I → Supervisor. Lateral path to operations is allowed.",
      isFixture: true,
    })
    .onConflictDoNothing();
  const levelIds = [1, 2, 3, 4, 5].map((n) => `00000000-0000-4000-8b41-${pad(n)}`);
  const levelTitles = [
    "Technician I",
    "Technician II",
    "Senior Technician",
    "Lead Technician",
    "Supervisor",
  ];
  for (const [index, title] of levelTitles.entries()) {
    await db
      .insert(careerPathLevels)
      .values({
        id: levelIds[index],
        pathId: PATH_ID,
        sequence: index + 1,
        title,
        civilianOccupationId: index === 4 ? OCCUPATION_IDS.supervisor : OCCUPATION_IDS.electrical,
        expectedTimeMonths: 24,
        experience: `${index + 1}+ years`,
      })
      .onConflictDoNothing();
  }
  for (const index of [0, 1, 2, 3]) {
    await db
      .insert(careerPathEdges)
      .values({
        id: `00000000-0000-4000-8b42-${pad(index + 1)}`,
        pathId: PATH_ID,
        fromLevelId: levelIds[index],
        toLevelId: levelIds[index + 1],
        edgeType: "sequential",
      })
      .onConflictDoNothing();
  }
  await db
    .insert(careerPathEdges)
    .values({
      id: "00000000-0000-4000-8b42-000000000005",
      pathId: PATH_ID,
      fromLevelId: levelIds[2],
      toLevelId: levelIds[3],
      edgeType: "lateral",
    })
    .onConflictDoNothing();

  const scenarios = [
    { id: "00000000-0000-4000-8b60-000000000001", name: "Base growth", growth: 0, retirement: 0 },
    { id: "00000000-0000-4000-8b60-000000000002", name: "High growth", growth: 8, retirement: 0 },
    { id: "00000000-0000-4000-8b60-000000000003", name: "Accelerated retirement", growth: 0, retirement: 10 },
  ];
  for (const scenario of scenarios) {
    await db
      .insert(workforceScenarios)
      .values({
        id: scenario.id,
        assessmentId: PHASE5_ASSESSMENT_ID,
        name: `${scenario.name} (fixture)`,
        description: "Phase 5 development fixture scenario. Estimate only.",
        createdByUserId: USER_IDS.managingPartner,
        source: "development-fixture",
        dataQuality: "estimated",
        isFixture: true,
        internalAssumption: "Not a guaranteed forecast.",
      })
      .onConflictDoNothing();
    await db
      .insert(workforceScenarioInputs)
      .values({
        scenarioId: scenario.id,
        growthDeltaPercent: String(scenario.growth),
        retirementDeltaPercent: String(scenario.retirement),
      })
      .onConflictDoNothing();
    const role = roles[0];
    const computed = computeDemandForecast({
      currentHeadcount: role.headcount,
      vacancies: role.vacancies,
      horizonMonths: 24,
      components: defaultForecastComponents({
        attritionRatePercent: role.attrition,
        retirementRatePercent: role.retirement + scenario.retirement,
        growthRatePercent: 3 + scenario.growth,
        backlog: role.vacancies,
        internalMobilityRatePercent: 4,
      }),
    });
    await db
      .insert(workforceScenarioOutputs)
      .values({
        id: `00000000-0000-4000-8b61-${pad(scenarios.indexOf(scenario) + 1)}`,
        scenarioId: scenario.id,
        roleId: role.id,
        horizonMonths: 24,
        projectedDemand: computed.futureDemand,
        projectedSupply: 10,
        resultingGap: computeGap(computed.futureDemand, 10),
        requiredPipelineCapacity: Math.max(0, computeGap(computed.futureDemand, 10)),
        keyAssumptions: "Fixture scenario. Not guaranteed.",
        majorRisks: "Capacity and conversion assumptions.",
        dataQuality: "estimated",
        isFixture: true,
      })
      .onConflictDoNothing();
  }

  for (const provider of ["bls", "census", "onet"] as const) {
    await db
      .insert(laborMarketSourceMetadata)
      .values({
        organizationId: INTERNAL_ORG_ID,
        provider,
        configured: false,
        notes: `${provider.toUpperCase()} is not configured. Fixture/adapter only.`,
      })
      .onConflictDoNothing();
    await db
      .insert(laborMarketObservations)
      .values({
        id: `00000000-0000-4000-8b90-${pad(["bls", "census", "onet"].indexOf(provider) + 1)}`,
        organizationId: INTERNAL_ORG_ID,
        provider,
        geography: "WV",
        occupationCode: "DEV-ELC-TECH",
        metric: "employment_count",
        valueNumeric: null,
        isFixture: true,
        notes: "Labeled fixture. Not live labor-market intelligence. Value intentionally omitted.",
      })
      .onConflictDoNothing();
  }
}
