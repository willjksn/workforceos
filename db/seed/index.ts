import { eq } from "drizzle-orm";

import { getDb } from "../index";
import {
  activities,
  agents,
  candidateDesignations,
  candidateExperiences,
  candidateJobMatches,
  candidateMilitaryExperiences,
  candidateSkills,
  candidateTalentPools,
  candidates,
  civilianOccupations,
  companies,
  companyContacts,
  companyLocations,
  contacts,
  decisionLog,
  jobs,
  militaryCivilianMappings,
  militaryInstallations,
  militaryOccupationInstallations,
  militaryOccupationSkills,
  militaryOccupations,
  occupationSkills,
  opportunities,
  opportunityScores,
  opportunitySignals,
  organizations,
  searchProjects,
  permissions,
  requirements,
  rolePermissions,
  roles,
  serviceVersions,
  serviceWorkflows,
  services,
  skills,
  solutionPlans,
  systemSettings,
  talentPoolRules,
  talentPools,
  userRoles,
  users,
} from "../schema";
import { PERMISSIONS, ROLE_PERMISSIONS, type RoleSlug } from "../../lib/rbac/permissions";
import { LAUNCH_SERVICE_WORKFLOWS } from "./service-workflows";
import {
  CANDIDATE_ID,
  COMPANY_ID,
  ELECTRICAL_TECH_OCCUPATION_ID,
  INTERNAL_ORG_ID,
  MTOA_SERVICE_ID,
  MTOA_VERSION_ID,
  NAVY_EM_ID,
  OPPORTUNITY_ID,
  ROLE_IDS,
  SEED_VERSION,
  SOLUTION_PLAN_ID,
  USER_IDS,
} from "./constants";

const now = () => new Date();

export async function seedFoundation() {
  const db = getDb();

  await db
    .insert(organizations)
    .values({
      id: INTERNAL_ORG_ID,
      name: "WorkforceOS",
      slug: "workforceos",
    })
    .onConflictDoUpdate({
      target: organizations.id,
      set: { name: "WorkforceOS", slug: "workforceos", updatedAt: now() },
    });

  const permissionRows = PERMISSIONS.map((slug, index) => ({
    id: `00000000-0000-4000-8000-${String(1000 + index).padStart(12, "0")}`,
    slug,
    description: slug,
  }));

  for (const row of permissionRows) {
    await db
      .insert(permissions)
      .values(row)
      .onConflictDoUpdate({
        target: permissions.slug,
        set: { description: row.description, updatedAt: now() },
      });
  }

  const storedPermissions = await db.select().from(permissions);
  const permissionIdBySlug = Object.fromEntries(storedPermissions.map((row) => [row.slug, row.id]));

  const roleSeed: Array<{ id: string; slug: RoleSlug; name: string; description: string }> = [
    {
      id: ROLE_IDS["managing-partner"],
      slug: "managing-partner",
      name: "Managing Partner",
      description: "Full operational access",
    },
    {
      id: ROLE_IDS["operations-administrator"],
      slug: "operations-administrator",
      name: "Operations Administrator",
      description: "Operations and delivery administration",
    },
    {
      id: ROLE_IDS["strategy-technology-administrator"],
      slug: "strategy-technology-administrator",
      name: "Strategy & Technology Administrator",
      description: "Platform, agents, and role configuration",
    },
    {
      id: ROLE_IDS["talent-partner"],
      slug: "talent-partner",
      name: "Talent Partner",
      description: "Talent, search, and solution planning",
    },
    {
      id: ROLE_IDS.recruiter,
      slug: "recruiter",
      name: "Recruiter",
      description: "Recruiting and candidate operations",
    },
    {
      id: ROLE_IDS["workforce-consultant"],
      slug: "workforce-consultant",
      name: "Workforce Consultant",
      description: "Workforce assessments and projects",
    },
    {
      id: ROLE_IDS["military-talent-specialist"],
      slug: "military-talent-specialist",
      name: "Military Talent Specialist",
      description: "Military occupation translation",
    },
    {
      id: ROLE_IDS["read-only"],
      slug: "read-only",
      name: "Read Only",
      description: "Read access without mutation or restricted PII",
    },
  ];

  for (const role of roleSeed) {
    await db
      .insert(roles)
      .values({
        id: role.id,
        organizationId: INTERNAL_ORG_ID,
        name: role.name,
        slug: role.slug,
        description: role.description,
      })
      .onConflictDoUpdate({
        target: roles.id,
        set: { name: role.name, description: role.description, updatedAt: now() },
      });

    for (const permissionSlug of ROLE_PERMISSIONS[role.slug]) {
      await db
        .insert(rolePermissions)
        .values({
          roleId: role.id,
          permissionId: permissionIdBySlug[permissionSlug],
        })
        .onConflictDoNothing();
    }
  }

  const userSeed = [
    {
      id: USER_IDS.managingPartner,
      email: "partner@workforceos.local",
      fullName: "Morgan Partner",
      status: "active" as const,
      roleId: ROLE_IDS["managing-partner"],
    },
    {
      id: USER_IDS.recruiter,
      email: "recruiter@workforceos.local",
      fullName: "Riley Recruiter",
      status: "active" as const,
      roleId: ROLE_IDS.recruiter,
    },
    {
      id: USER_IDS.readOnly,
      email: "reader@workforceos.local",
      fullName: "Robin Reader",
      status: "active" as const,
      roleId: ROLE_IDS["read-only"],
    },
    {
      id: USER_IDS.disabled,
      email: "disabled@workforceos.local",
      fullName: "Dana Disabled",
      status: "disabled" as const,
      roleId: ROLE_IDS["read-only"],
    },
  ];

  for (const user of userSeed) {
    await db
      .insert(users)
      .values({
        id: user.id,
        organizationId: INTERNAL_ORG_ID,
        email: user.email,
        fullName: user.fullName,
        status: user.status,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email,
          fullName: user.fullName,
          status: user.status,
          updatedAt: now(),
        },
      });
    await db
      .insert(userRoles)
      .values({ userId: user.id, roleId: user.roleId })
      .onConflictDoNothing();
  }

  const agentSeed = [
    ["opportunity-scout", "Opportunity Scout"],
    ["account-intelligence-agent", "Account Intelligence Agent"],
    ["sales-agent", "Sales Agent"],
    ["recruiting-agent", "Recruiting Agent"],
    ["military-talent-agent", "Military Talent Agent"],
    ["workforce-analyst", "Workforce Analyst"],
    ["workforce-architect", "Workforce Architect"],
    ["proposal-agent", "Proposal Agent"],
    ["project-agent", "Project Agent"],
    ["knowledge-agent", "Knowledge Agent"],
  ] as const;

  for (const [slug, name] of agentSeed) {
    await db
      .insert(agents)
      .values({
        organizationId: INTERNAL_ORG_ID,
        slug,
        name,
        description: `${name} foundation registry entry`,
        status: "disabled",
      })
      .onConflictDoNothing();
  }

  await seedCatalogAndTalent(db);
  await seedRequirementsAndDecisions(db);

  await db
    .insert(systemSettings)
    .values({ key: "seed_version", value: SEED_VERSION })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: SEED_VERSION, updatedAt: now() },
    });

  return { organizationId: INTERNAL_ORG_ID, seedVersion: SEED_VERSION };
}

async function seedCatalogAndTalent(db: ReturnType<typeof getDb>) {
  const skillSeed = [
    ["electrical-troubleshooting", "Electrical Troubleshooting"],
    ["preventive-maintenance", "Preventive Maintenance"],
    ["plc-programming", "PLC Programming"],
    ["workforce-planning", "Workforce Planning"],
    ["candidate-sourcing", "Candidate Sourcing"],
    ["electrical-safety", "Electrical Safety"],
    ["motor-controls", "Motor Controls"],
    ["blueprint-reading", "Blueprint Reading"],
    ["ac-dc-theory", "AC/DC Theory"],
    ["circuit-analysis", "Circuit Analysis"],
    ["switchboard-operations", "Switchboard Operations"],
    ["power-distribution", "Power Distribution"],
    ["electrical-testing", "Electrical Testing"],
    ["tagout-lockout", "Tagout/Lockout"],
    ["shipboard-electrical-systems", "Shipboard Electrical Systems"],
  ] as const;

  const skillIds: Record<string, string> = {};
  for (const [index, [slug, name]] of skillSeed.entries()) {
    const id = `00000000-0000-4000-8100-${String(index + 1).padStart(12, "0")}`;
    skillIds[slug] = id;
    await db
      .insert(skills)
      .values({ id, slug, name, onetSource: "development-fixture", onetVersion: "dev" })
      .onConflictDoUpdate({
        target: skills.id,
        set: { name, slug, updatedAt: now() },
      });
  }

  await db
    .insert(civilianOccupations)
    .values({
      id: ELECTRICAL_TECH_OCCUPATION_ID,
      title: "Electrical Technician",
      code: "DEV-ELC-TECH",
      description: "Development fixture civilian occupation",
      onetSource: "development-fixture",
      onetVersion: "dev",
    })
    .onConflictDoUpdate({
      target: civilianOccupations.id,
      set: { title: "Electrical Technician", updatedAt: now() },
    });

  for (const slug of [
    "electrical-troubleshooting",
    "preventive-maintenance",
    "plc-programming",
    "electrical-safety",
    "motor-controls",
  ]) {
    await db
      .insert(occupationSkills)
      .values({
        occupationId: ELECTRICAL_TECH_OCCUPATION_ID,
        skillId: skillIds[slug],
      })
      .onConflictDoNothing();
  }

  const extraCivilian = [
    {
      id: "00000000-0000-4000-8000-000000000602",
      title: "Maintenance Electrician",
      code: "DEV-MAINT-ELC",
    },
    {
      id: "00000000-0000-4000-8000-000000000603",
      title: "Power Plant Operator",
      code: "DEV-POWER-OP",
    },
  ];
  for (const occupation of extraCivilian) {
    await db
      .insert(civilianOccupations)
      .values({
        ...occupation,
        onetSource: "development-fixture",
        onetVersion: "dev",
      })
      .onConflictDoNothing();
  }

  await db
    .insert(companies)
    .values({
      id: COMPANY_ID,
      organizationId: INTERNAL_ORG_ID,
      name: "Harbor Manufacturing",
      companyType: "prospect",
      clientStatus: "prospect",
      relationshipStrength: "moderate",
      website: "https://harbor.example.test",
      industry: "advanced manufacturing",
      subIndustry: "industrial electrical",
      employeeCount: 420,
      annualRevenue: "85000000.00",
      accountOwnerUserId: USER_IDS.managingPartner,
      militaryFitScore: 82,
      workforceOpportunityScore: 74,
      nextAction: "Schedule discovery with plant manager",
      nextActionAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    })
    .onConflictDoUpdate({
      target: companies.id,
      set: {
        name: "Harbor Manufacturing",
        industry: "advanced manufacturing",
        employeeCount: 420,
        annualRevenue: "85000000.00",
        accountOwnerUserId: USER_IDS.managingPartner,
        militaryFitScore: 82,
        workforceOpportunityScore: 74,
        nextAction: "Schedule discovery with plant manager",
        nextActionAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        updatedAt: now(),
      },
    });

  const locationNames = ["Norfolk HQ", "Hampton Shop", "Virginia Beach Field Office"];
  for (const [index, name] of locationNames.entries()) {
    await db
      .insert(companyLocations)
      .values({
        id: `00000000-0000-4000-8200-${String(index + 1).padStart(12, "0")}`,
        companyId: COMPANY_ID,
        name,
        city: name.split(" ")[0],
        region: "VA",
        country: "US",
        isPrimary: index === 0,
      })
      .onConflictDoNothing();
  }

  const contactSeed = [
    ["Alex Rivera", "Plant Manager"],
    ["Jordan Lee", "HR Director"],
    ["Sam Patel", "Maintenance Lead"],
    ["Chris Nguyen", "Talent Lead"],
  ] as const;
  for (const [index, [fullName, title]] of contactSeed.entries()) {
    const contactId = `00000000-0000-4000-8300-${String(index + 1).padStart(12, "0")}`;
    await db
      .insert(contacts)
      .values({
        id: contactId,
        organizationId: INTERNAL_ORG_ID,
        fullName,
        title,
        email: `${fullName.toLowerCase().replace(" ", ".")}@harbor.example.test`,
        department: index === 1 ? "Human Resources" : "Operations",
        buyerPersona: index === 0 ? "economic_buyer" : "influencer",
        ownerUserId: USER_IDS.managingPartner,
      })
      .onConflictDoNothing();
    await db
      .insert(companyContacts)
      .values({ companyId: COMPANY_ID, contactId, isPrimary: index === 0 })
      .onConflictDoNothing();
  }

  await db
    .insert(opportunitySignals)
    .values([
      {
        id: "00000000-0000-4000-8400-000000000001",
        companyId: COMPANY_ID,
        signalType: "hiring",
        title: "Electrician hiring surge",
        details: "Plant is posting multiple electrician requisitions.",
        evidence: "Public job postings and plant-manager conversation notes.",
        source: "seed",
        reviewStatus: "pending_review",
        confidence: 80,
      },
      {
        id: "00000000-0000-4000-8400-000000000002",
        companyId: COMPANY_ID,
        signalType: "workforce_need",
        title: "Military talent exploration",
        details: "Leadership asked about Navy electrician pipelines.",
        evidence: "Discovery notes from Harbor HR.",
        source: "seed",
        reviewStatus: "approved",
        confidence: 70,
      },
    ])
    .onConflictDoNothing();

  await db
    .update(opportunitySignals)
    .set({
      details: "Plant is posting multiple electrician requisitions.",
      evidence: "Public job postings and plant-manager conversation notes.",
      source: "seed",
      reviewStatus: "pending_review",
      confidence: 80,
      updatedAt: now(),
    })
    .where(eq(opportunitySignals.id, "00000000-0000-4000-8400-000000000001"));

  await db
    .insert(opportunities)
    .values({
      id: OPPORTUNITY_ID,
      organizationId: INTERNAL_ORG_ID,
      companyId: COMPANY_ID,
      name: "Military electrician pipeline",
      stage: "qualified",
      serviceCode: "military-talent-opportunity-assessment",
      opportunityScore: 78,
      scoreBand: "active_qualified",
      ownerUserId: USER_IDS.managingPartner,
      primaryContactId: "00000000-0000-4000-8300-000000000001",
      problemStatement: "Harbor cannot fill electrician roles from local civilian supply.",
    })
    .onConflictDoUpdate({
      target: opportunities.id,
      set: {
        serviceCode: "military-talent-opportunity-assessment",
        opportunityScore: 78,
        scoreBand: "active_qualified",
        ownerUserId: USER_IDS.managingPartner,
        primaryContactId: "00000000-0000-4000-8300-000000000001",
        problemStatement: "Harbor cannot fill electrician roles from local civilian supply.",
        updatedAt: now(),
      },
    });

  await db
    .insert(opportunityScores)
    .values({
      id: "00000000-0000-4000-8000-000000000811",
      opportunityId: OPPORTUNITY_ID,
      icpFit: 16,
      triggerScore: 20,
      demonstratedPain: 16,
      serviceFit: 12,
      buyerAccess: 8,
      timingBudget: 6,
      total: 78,
    })
    .onConflictDoNothing();

  const poolSeed = [
    ["silver-medalists", "Silver Medalists"],
    ["military-talent", "Military Talent"],
    ["electrical-talent", "Electrical Talent"],
    ["engineering-talent", "Engineering Talent"],
    ["operations-leadership", "Operations Leadership"],
    ["maintenance-reliability", "Maintenance & Reliability"],
    ["open-to-relocation", "Open to Relocation"],
    ["available-now", "Available Now"],
    ["nurture", "Nurture"],
  ] as const;
  const poolIds: Record<string, string> = {};
  for (const [index, [slug, name]] of poolSeed.entries()) {
    const id = `00000000-0000-4000-8500-${String(index + 1).padStart(12, "0")}`;
    poolIds[slug] = id;
    await db
      .insert(talentPools)
      .values({
        id,
        organizationId: INTERNAL_ORG_ID,
        slug,
        name,
        poolType: slug === "available-now" ? "dynamic" : "static",
        scope: "organization",
      })
      .onConflictDoNothing();
  }

  await db
    .insert(talentPoolRules)
    .values({
      talentPoolId: poolIds["available-now"],
      ruleType: "availability",
      ruleValue: "available_now",
    })
    .onConflictDoNothing();

  await db
    .insert(candidates)
    .values({
      id: CANDIDATE_ID,
      organizationId: INTERNAL_ORG_ID,
      fullName: "Taylor Ellis",
      email: "taylor.ellis@talent.example.test",
      currentTitle: "Navy Electrician's Mate",
      currentCompany: "U.S. Navy",
      city: "Norfolk",
      region: "VA",
      yearsExperience: 8,
      availability: "available_now",
      consentStatus: "granted",
      privacyClass: "restricted_pii",
      militaryStatus: "veteran",
      source: "seed",
      ownerUserId: USER_IDS.recruiter,
    })
    .onConflictDoUpdate({
      target: candidates.id,
      set: {
        fullName: "Taylor Ellis",
        currentCompany: "U.S. Navy",
        city: "Norfolk",
        region: "VA",
        militaryStatus: "veteran",
        archivedAt: null,
        updatedAt: now(),
      },
    });

  await db
    .insert(candidateExperiences)
    .values([
      {
        id: "00000000-0000-4000-8600-000000000001",
        candidateId: CANDIDATE_ID,
        employer: "U.S. Navy",
        title: "Electrician's Mate",
        summary: "Shipboard electrical systems",
      },
      {
        id: "00000000-0000-4000-8600-000000000002",
        candidateId: CANDIDATE_ID,
        employer: "Harbor Manufacturing",
        title: "Maintenance Technician intern",
        summary: "Plant electrical support",
      },
    ])
    .onConflictDoNothing();

  const candidateSkillSlugs = [
    "electrical-troubleshooting",
    "preventive-maintenance",
    "plc-programming",
    "electrical-safety",
    "motor-controls",
    "blueprint-reading",
    "ac-dc-theory",
    "circuit-analysis",
  ];
  for (const slug of candidateSkillSlugs) {
    await db
      .insert(candidateSkills)
      .values({ candidateId: CANDIDATE_ID, skillId: skillIds[slug] })
      .onConflictDoNothing();
  }

  for (const slug of ["silver-medalists", "military-talent", "electrical-talent", "available-now"]) {
    await db
      .insert(candidateTalentPools)
      .values({
        candidateId: CANDIDATE_ID,
        talentPoolId: poolIds[slug],
        source: "system",
      })
      .onConflictDoNothing();
  }

  await db
    .insert(candidateDesignations)
    .values({
      id: "00000000-0000-4000-8000-000000000421",
      candidateId: CANDIDATE_ID,
      designationType: "silver_medalist",
      reason: "Finalist on a prior electrician search",
      createdByUserId: USER_IDS.recruiter,
      active: true,
    })
    .onConflictDoNothing();

  await seedAdditionalOperatingFixtures(db, poolIds, skillIds);

  const jobTitles = ["Plant Electrician", "Maintenance Electrician", "Controls Technician"];
  const jobIds: string[] = [];
  for (const [index, title] of jobTitles.entries()) {
    const id = `00000000-0000-4000-8700-${String(index + 1).padStart(12, "0")}`;
    jobIds.push(id);
    await db
      .insert(jobs)
      .values({
        id,
        organizationId: INTERNAL_ORG_ID,
        companyId: COMPANY_ID,
        title,
        status: "open",
      })
      .onConflictDoNothing();
    await db
      .insert(candidateJobMatches)
      .values({
        candidateId: CANDIDATE_ID,
        jobId: id,
        score: String(80 + index),
        explanation: `Independent score for ${title}`,
        pipelineStatus: "sourced",
      })
      .onConflictDoNothing();
    await db
      .insert(searchProjects)
      .values({
        id: `00000000-0000-4000-8710-${String(index + 1).padStart(12, "0")}`,
        jobId: id,
        name: `Internal Talent Network: ${title}`,
      })
      .onConflictDoNothing();
  }

  await db
    .insert(militaryOccupations)
    .values({
      id: NAVY_EM_ID,
      branch: "navy",
      classificationType: "rating",
      code: "EM",
      title: "Electrician's Mate",
      description: "Development fixture for Navy EM",
      mappingQuality: "development_fixture",
    })
    .onConflictDoNothing();

  for (const slug of skillSeed.map(([item]) => item).slice(0, 12)) {
    await db
      .insert(militaryOccupationSkills)
      .values({ militaryOccupationId: NAVY_EM_ID, skillId: skillIds[slug] })
      .onConflictDoNothing();
  }

  const installationSeed = [
    ["Naval Station Norfolk", "VA"],
    ["Naval Base San Diego", "CA"],
    ["Naval Station Mayport", "FL"],
  ] as const;
  for (const [index, [name, region]] of installationSeed.entries()) {
    const id = `00000000-0000-4000-8800-${String(index + 1).padStart(12, "0")}`;
    await db
      .insert(militaryInstallations)
      .values({ id, name, branch: "navy", region, country: "US" })
      .onConflictDoNothing();
    await db
      .insert(militaryOccupationInstallations)
      .values({
        militaryOccupationId: NAVY_EM_ID,
        installationId: id,
        presenceLevel: index === 0 ? "primary" : "significant",
      })
      .onConflictDoNothing();
  }

  for (const civilianId of [
    ELECTRICAL_TECH_OCCUPATION_ID,
    "00000000-0000-4000-8000-000000000602",
    "00000000-0000-4000-8000-000000000603",
  ]) {
    await db
      .insert(militaryCivilianMappings)
      .values({
        militaryOccupationId: NAVY_EM_ID,
        civilianOccupationId: civilianId,
        skillsSummary: "Electrical troubleshooting, maintenance, and power systems",
        certifications: "Development fixture: not an official credential list",
        gaps: "PLC familiarity varies by tour",
        bridgeTraining: "Plant-specific lockout and PLC orientation",
        explanation: "Development fixture mapping; not an authoritative production translation",
        mappingQuality: "development_fixture",
      })
      .onConflictDoNothing();
  }

  await db
    .insert(candidateMilitaryExperiences)
    .values({
      candidateId: CANDIDATE_ID,
      militaryOccupationId: NAVY_EM_ID,
      notes: "Honorably discharged Electrician's Mate",
    })
    .onConflictDoNothing();

  const launchServices = [
    {
      id: "00000000-0000-4000-8900-000000000001",
      code: "professional-search",
      name: "Professional Search",
      definition: "Internal-first retained/project search.",
    },
    {
      id: MTOA_SERVICE_ID,
      code: "military-talent-opportunity-assessment",
      name: "Military Talent Opportunity Assessment",
      definition:
        "Translate civilian demand to military occupations, skills, gaps, training, and likely installations.",
    },
    {
      id: "00000000-0000-4000-8900-000000000003",
      code: "ta-performance-assessment",
      name: "TA Performance Assessment",
      definition: "Assess talent acquisition operating performance.",
    },
    {
      id: "00000000-0000-4000-8900-000000000004",
      code: "fractional-talent-partner",
      name: "Fractional Talent Partner",
      definition: "Fractional talent leadership engagement. Not temp staffing or payroll.",
    },
    {
      id: "00000000-0000-4000-8900-000000000005",
      code: "workforce-pipeline-assessment",
      name: "Workforce Pipeline Assessment",
      definition: "Assess workforce supply/demand and pipeline actions.",
    },
  ];

  for (const service of launchServices) {
    await db
      .insert(services)
      .values({
        id: service.id,
        code: service.code,
        name: service.name,
        status: "active",
        description: service.definition,
      })
      .onConflictDoNothing();
    const versionId =
      service.code === "military-talent-opportunity-assessment"
        ? MTOA_VERSION_ID
        : service.id.replace("8900", "8910");
    await db
      .insert(serviceVersions)
      .values({
        id: versionId,
        serviceId: service.id,
        version: "v1",
        definition: service.definition,
        reviewStatus: "approved",
      })
      .onConflictDoNothing();

    const steps = LAUNCH_SERVICE_WORKFLOWS[service.code] ?? [];
    for (const [index, step] of steps.entries()) {
      await db
        .insert(serviceWorkflows)
        .values({
          serviceVersionId: versionId,
          stepNumber: index + 1,
          name: step.name,
          instructions: step.instructions,
          requiresHumanApproval: step.requiresHumanApproval,
        })
        .onConflictDoNothing();
    }
  }

  await db
    .insert(solutionPlans)
    .values({
      id: SOLUTION_PLAN_ID,
      organizationId: INTERNAL_ORG_ID,
      opportunityId: OPPORTUNITY_ID,
      serviceVersionId: MTOA_VERSION_ID,
      title: "Harbor Manufacturing military electrician assessment",
      status: "approved",
      summary: "Approved development fixture solution plan",
    })
    .onConflictDoNothing();
}

async function seedAdditionalOperatingFixtures(
  db: ReturnType<typeof getDb>,
  poolIds: Record<string, string>,
  skillIds: Record<string, string>,
) {
  const extraCompanies = [
    {
      id: "00000000-0000-4000-8000-000000000302",
      name: "Tidewater Logistics",
      companyType: "client" as const,
      clientStatus: "active" as const,
      relationshipStrength: "strong" as const,
      industry: "logistics",
      employeeCount: 900,
      nextAction: "Quarterly talent review",
      nextActionAt: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
    },
    {
      id: "00000000-0000-4000-8000-000000000303",
      name: "Piedmont Health Systems",
      companyType: "prospect" as const,
      clientStatus: "prospect" as const,
      relationshipStrength: "weak" as const,
      industry: "healthcare",
      employeeCount: 2100,
    },
    {
      id: "00000000-0000-4000-8000-000000000304",
      name: "Blue Ridge Energy",
      companyType: "prospect" as const,
      clientStatus: "prospect" as const,
      relationshipStrength: "unknown" as const,
      industry: "utilities",
      employeeCount: 650,
    },
  ];

  for (const company of extraCompanies) {
    await db
      .insert(companies)
      .values({
        ...company,
        organizationId: INTERNAL_ORG_ID,
        website: `https://${company.name.toLowerCase().replaceAll(" ", "")}.example.test`,
        accountOwnerUserId: USER_IDS.managingPartner,
      })
      .onConflictDoUpdate({
        target: companies.id,
        set: { name: company.name, industry: company.industry, updatedAt: now() },
      });
  }

  const extraContacts = [
    ["00000000-0000-4000-8300-000000000005", "Morgan Blake", "VP Operations", extraCompanies[0].id],
    ["00000000-0000-4000-8300-000000000006", "Casey Wright", "CHRO", extraCompanies[1].id],
    ["00000000-0000-4000-8300-000000000007", "Riley Brooks", "Workforce Director", extraCompanies[2].id],
  ] as const;
  for (const [id, fullName, title, companyId] of extraContacts) {
    await db
      .insert(contacts)
      .values({
        id,
        organizationId: INTERNAL_ORG_ID,
        fullName,
        title,
        email: `${fullName.toLowerCase().replace(" ", ".")}@example.test`,
        ownerUserId: USER_IDS.managingPartner,
      })
      .onConflictDoNothing();
    await db
      .insert(companyContacts)
      .values({ companyId, contactId: id, isPrimary: true })
      .onConflictDoNothing();
  }

  await db
    .insert(opportunitySignals)
    .values([
      {
        id: "00000000-0000-4000-8400-000000000003",
        companyId: extraCompanies[0].id,
        signalType: "expansion",
        title: "New distribution hub hiring",
        reviewStatus: "pending_review",
        source: "seed",
      },
      {
        id: "00000000-0000-4000-8400-000000000004",
        companyId: extraCompanies[1].id,
        signalType: "leadership_change",
        title: "New CHRO evaluating TA model",
        reviewStatus: "draft",
        source: "seed",
      },
    ])
    .onConflictDoNothing();

  const extraOpportunities = [
    {
      id: "00000000-0000-4000-8000-000000000803",
      companyId: extraCompanies[0].id,
      name: "Maintenance technician retained search",
      stage: "proposal" as const,
      serviceCode: "professional-search",
      opportunityScore: 84,
      scoreBand: "priority" as const,
      updatedAt: now(),
    },
    {
      id: "00000000-0000-4000-8000-000000000804",
      companyId: extraCompanies[1].id,
      name: "TA performance diagnostic",
      stage: "target" as const,
      serviceCode: "ta-performance-assessment",
      opportunityScore: 61,
      scoreBand: "nurture" as const,
      updatedAt: now(),
    },
    {
      id: "00000000-0000-4000-8000-000000000805",
      companyId: extraCompanies[2].id,
      name: "Lineworker pipeline assessment",
      stage: "identified" as const,
      serviceCode: "workforce-pipeline-assessment",
      opportunityScore: 44,
      scoreBand: "monitor" as const,
      updatedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
    },
  ];
  for (const opportunity of extraOpportunities) {
    await db.insert(opportunities).values({
      ...opportunity,
      organizationId: INTERNAL_ORG_ID,
      ownerUserId: USER_IDS.managingPartner,
    }).onConflictDoNothing();
  }

  await db
    .insert(opportunityScores)
    .values({
      id: "00000000-0000-4000-8000-000000000812",
      opportunityId: extraOpportunities[0].id,
      icpFit: 18,
      triggerScore: 22,
      demonstratedPain: 16,
      serviceFit: 13,
      buyerAccess: 8,
      timingBudget: 7,
      total: 84,
    })
    .onConflictDoNothing();

  await db
    .insert(activities)
    .values({
      id: "00000000-0000-4000-8a00-000000000001",
      organizationId: INTERNAL_ORG_ID,
      activityType: "meeting",
      subject: "Harbor discovery prep",
      companyId: COMPANY_ID,
      opportunityId: OPPORTUNITY_ID,
      createdByUserId: USER_IDS.managingPartner,
      nextAction: "Send agenda to Alex Rivera",
      followUpAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    })
    .onConflictDoNothing();

  await db
    .insert(talentPools)
    .values({
      id: "00000000-0000-4000-8500-000000000010",
      organizationId: INTERNAL_ORG_ID,
      slug: "partner-watchlist",
      name: "Partner watchlist",
      poolType: "static",
      scope: "user",
      ownerUserId: USER_IDS.managingPartner,
    })
    .onConflictDoNothing();

  const extraCandidates = [
    ["Casey Nguyen", "Controls Technician", "available_now", "none"],
    ["Jordan Hale", "Maintenance Supervisor", "passive", "veteran"],
    ["Avery Cole", "Power Plant Operator", "available_now", "veteran"],
    ["Sam Ortiz", "HRBP", "passive", "none"],
    ["Quinn Patel", "Electrical Engineer", "not_looking", "none"],
    ["Reese Dalton", "Reliability Tech", "available_now", "reserve"],
    ["Morgan Singh", "Plant Electrician", "passive", "veteran"],
    ["Jamie Cross", "Talent Acquisition Lead", "passive", "none"],
    ["Drew Fontaine", "Facilities Electrician", "available_now", "none"],
    ["Harper Solis", "Operations Manager", "not_looking", "none"],
    ["Logan Brooks", "Maintenance Electrician", "available_now", "national_guard"],
  ] as const;

  for (const [index, [fullName, title, availability, militaryStatus]] of extraCandidates.entries()) {
    const id = `00000000-0000-4000-8000-${String(402 + index).padStart(12, "0")}`;
    await db
      .insert(candidates)
      .values({
        id,
        organizationId: INTERNAL_ORG_ID,
        fullName,
        email: `${fullName.toLowerCase().replace(" ", ".")}@talent.example.test`,
        currentTitle: title,
        availability,
        militaryStatus,
        privacyClass: "restricted_pii",
        consentStatus: "granted",
        city: "Norfolk",
        region: "VA",
        source: "seed",
        ownerUserId: USER_IDS.recruiter,
      })
      .onConflictDoNothing();
    await db
      .insert(candidateSkills)
      .values({ candidateId: id, skillId: skillIds["electrical-troubleshooting"] })
      .onConflictDoNothing();
    if (index === 0) {
      await db
        .insert(candidateTalentPools)
        .values({ candidateId: id, talentPoolId: poolIds.nurture, source: "system" })
        .onConflictDoNothing();
    }
    if (militaryStatus !== "none") {
      await db
        .insert(candidateTalentPools)
        .values({ candidateId: id, talentPoolId: poolIds["military-talent"], source: "system" })
        .onConflictDoNothing();
    }
  }
}

async function seedRequirementsAndDecisions(db: ReturnType<typeof getDb>) {
  const requirementSeed = [
    ["WFOS-TAL-001", "talent", "Candidate may belong to multiple talent pools."],
    ["WFOS-TAL-002", "recruiting", "Every new job must search the internal Talent Network before external sourcing."],
    ["WFOS-TAL-003", "recruiting", "Candidate-job match scores are job-specific, not universal candidate scores."],
    ["WFOS-TAL-004", "talent", "Prior applicants and silver medalists must remain rediscoverable subject to privacy/retention rules."],
    ["WFOS-MIL-001", "military", "Support Army MOS, Navy Rating, Air Force AFSC, Marine MOS, Coast Guard Rating, and applicable Space Force classifications."],
    ["WFOS-MIL-002", "military", "Military occupations must map to civilian occupations."],
    ["WFOS-MIL-003", "military", "Military occupations must map to likely installations/bases."],
    ["WFOS-MIL-004", "military", "Military matching must support reverse civilian-role-to-military search."],
    ["WFOS-MIL-005", "military", "Military mappings must support skills, certifications, gaps, bridge training, and explanations."],
    ["WFOS-SVC-001", "services", "WorkforceOS must support the five launch service workflows."],
    ["WFOS-LEGAL-001", "legal", "Legal document packages must be linked to services and engagements."],
    ["WFOS-AI-001", "ai", "Material AI recommendations require provenance."],
    ["WFOS-AI-002", "ai", "Material client-facing AI outputs require human approval."],
    ["WFOS-AUD-001", "platform", "Important business changes require audit events."],
    ["WFOS-SEC-001", "security", "Database authorization must be server-side."],
    ["WFOS-SEC-002", "security", "Candidate data is Restricted PII."],
    ["WFOS-INT-001", "integrations", "External providers must connect through an Integration Hub abstraction."],
    ["WFOS-CRM-001", "crm", "Command Center cards must use live PostgreSQL aggregates, not hardcoded metrics."],
    ["WFOS-CRM-002", "crm", "Opportunity scores use the stored 100-point model and may be human-overridden with a reason."],
  ] as const;

  for (const [code, module, description] of requirementSeed) {
    await db
      .insert(requirements)
      .values({
        code,
        title: description,
        description,
        module,
        priority: "locked",
        status: "approved",
        version: "1.0",
        acceptanceCriteria: description,
      })
      .onConflictDoNothing();
  }

  const decisions = [
    ["DEC-DB-001", "PostgreSQL over Firebase", "PostgreSQL is the system of record."],
    ["DEC-APP-001", "Next.js and Vercel retained", "Keep Next.js App Router on Vercel."],
    ["DEC-DB-002", "Neon as primary database", "Neon PostgreSQL is the primary database."],
    ["DEC-DB-003", "Drizzle as ORM", "Drizzle ORM with SQL migrations."],
    ["DEC-SEC-001", "WorkforceOS is internal-first", "Invite-controlled internal users."],
    ["DEC-AI-001", "AI is an internal operating engine", "AI is not a client-facing marketing claim."],
    ["DEC-BIZ-001", "No temp staffing or payroll in V1", "Out of launch scope."],
    ["DEC-SEC-002", "No ownership or cap-table data", "Not stored in normal WorkforceOS."],
    ["DEC-SEM-001", "Temporary embedding dimension", "1536-dimension vectors until a production model is selected."],
    ["DEC-AUTH-001", "Clerk authenticates; PostgreSQL authorizes", "Local roles remain authoritative."],
    ["DEC-CRM-001", "Phase 2 CRM scoring and first-class records", "Opportunities use a stored 100-point score. Contacts, opportunities, and signals are first-class records. Company annual revenue is operating size, not ownership."],
  ] as const;

  for (const [code, title, decision] of decisions) {
    await db
      .insert(decisionLog)
      .values({
        code,
        title,
        decision,
        reason: decision,
        owner: "Product Build",
        status: "accepted",
        decidedOn: new Date("2026-09-04T00:00:00.000Z"),
        affectedModules: "foundation",
        reconsiderationCondition: "Documented proposed change required",
      })
      .onConflictDoNothing();
  }
}
