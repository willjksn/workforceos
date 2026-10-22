import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";

import { getDb } from "../../db";
import {
  candidateClearances,
  candidateCredentials,
  candidateJobMatches,
  candidateMilitaryExperiences,
  candidateSkills,
  candidates,
  civilianOccupationJobFamilies,
  companyLocations,
  educationPartners,
  interviews,
  jobFamilies,
  jobs,
  militaryCivilianMappings,
  militaryOccupationSkills,
  militaryOccupations,
  opportunityEngagements,
  placements,
  skillbridgePreferredLocations,
  skillbridgeProfiles,
  skills,
  trainingProgramSkills,
  trainingPrograms,
  workforceRoleCapabilityTexts,
  workforceRoleJobs,
  workforceRoleSkills,
  workforceRoles,
  workforceStrategyNotes,
} from "../../db/schema";
import { CAPABILITY_TRANSLATION_SOURCE } from "../military/capability-translation";
import { WorkforceError } from "./errors";
import {
  analyzeWorkforceRole,
  presentSupplyCandidate,
  summarizeJobFamilies,
  type EngagementFact,
  type JobLinkFact,
  type MatchFact,
  type MilitaryChannelFact,
  type PersonFact,
  type SkillFact,
} from "./pipeline-analysis";

/**
 * Reads stored rows and hands them to analyzeWorkforceRole.
 * It does not score matches, send outreach, or store a second supply count.
 * The SQL filter matches skillCountsForSupply: approved translation counts,
 * pending inferred translation does not, and explicit skills count unless rejected.
 */

function countableSkillSql() {
  return or(
    eq(candidateSkills.reviewStatus, "approved"),
    and(
      eq(candidateSkills.capabilityBasis, "explicit"),
      ne(candidateSkills.reviewStatus, "rejected"),
      or(isNull(candidateSkills.source), ne(candidateSkills.source, CAPABILITY_TRANSLATION_SOURCE)),
    ),
  );
}

type LoadedPerson = PersonFact & {
  name: string;
  email: string | null;
  phone: string | null;
  compensationExpectations: string | null;
};

async function loadSupplyFacts(organizationId: string, skillIds: string[]) {
  if (!skillIds.length) return { skills: [] as SkillFact[], people: [] as LoadedPerson[] };
  const db = getDb();
  const rows = await db
    .select({
      candidateId: candidateSkills.candidateId,
      skillId: candidateSkills.skillId,
      basis: candidateSkills.capabilityBasis,
      reviewStatus: candidateSkills.reviewStatus,
      source: candidateSkills.source,
      archivedAt: candidates.archivedAt,
      privacyDeletedAt: candidates.privacyDeletedAt,
      doNotContact: candidates.doNotContact,
      availability: candidates.availability,
      militaryStatus: candidates.militaryStatus,
      city: candidates.city,
      region: candidates.region,
      remotePreference: candidates.remotePreference,
      relocationWillingness: candidates.relocationWillingness,
      fullName: candidates.fullName,
      email: candidates.email,
      phone: candidates.phone,
      compensationExpectations: candidates.compensationExpectations,
    })
    .from(candidateSkills)
    .innerJoin(candidates, and(
      eq(candidates.id, candidateSkills.candidateId),
      eq(candidates.organizationId, organizationId),
    ))
    .where(and(
      eq(candidateSkills.organizationId, organizationId),
      inArray(candidateSkills.skillId, skillIds),
      countableSkillSql(),
    ));
  const ids = [...new Set(rows.map((row) => row.candidateId))];
  if (!ids.length) return { skills: [] as SkillFact[], people: [] as LoadedPerson[] };
  const [profiles, experiences, credentials, clearances] = await Promise.all([
    db.select().from(skillbridgeProfiles).where(and(
      eq(skillbridgeProfiles.organizationId, organizationId),
      inArray(skillbridgeProfiles.candidateId, ids),
    )),
    db.select({ candidateId: candidateMilitaryExperiences.candidateId }).from(candidateMilitaryExperiences).where(and(
      eq(candidateMilitaryExperiences.organizationId, organizationId),
      inArray(candidateMilitaryExperiences.candidateId, ids),
    )),
    db.select().from(candidateCredentials).where(and(
      eq(candidateCredentials.organizationId, organizationId),
      inArray(candidateCredentials.candidateId, ids),
    )),
    db.select().from(candidateClearances).where(and(
      eq(candidateClearances.organizationId, organizationId),
      inArray(candidateClearances.candidateId, ids),
    )),
  ]);
  const profileIds = profiles.map((row) => row.id);
  const preferred = profileIds.length
    ? await db.select().from(skillbridgePreferredLocations).where(
      inArray(skillbridgePreferredLocations.skillbridgeProfileId, profileIds),
    )
    : [];
  const militaryIds = new Set([
    ...profiles.map((row) => row.candidateId),
    ...experiences.map((row) => row.candidateId),
  ]);
  const people = new Map<string, LoadedPerson>();
  for (const row of rows) {
    if (people.has(row.candidateId)) continue;
    const profile = profiles.find((item) => item.candidateId === row.candidateId);
    const places = [
      profile?.preferredLocationPrimary,
      ...preferred
        .filter((item) => item.skillbridgeProfileId === profile?.id)
        .flatMap((item) => [item.locationLabel, item.city, item.region]),
    ].filter((value): value is string => Boolean(value));
    const clearance = clearances.find((item) => item.candidateId === row.candidateId);
    people.set(row.candidateId, {
      id: row.candidateId,
      name: row.fullName,
      email: row.email,
      phone: row.phone,
      compensationExpectations: row.compensationExpectations,
      archived: Boolean(row.archivedAt),
      privacyDeleted: Boolean(row.privacyDeletedAt),
      doNotContact: row.doNotContact,
      availability: row.availability,
      militaryStatus: row.militaryStatus,
      hasMilitaryProfile: militaryIds.has(row.candidateId),
      city: row.city,
      region: row.region,
      remotePreference: row.remotePreference ?? profile?.remotePreference ?? null,
      relocationWillingness: row.relocationWillingness ?? profile?.relocationWillingness ?? null,
      preferredLocations: places,
      transitionDates: profile
        ? [profile.separationDate, profile.etsDate, profile.eaosDate, profile.endOfServiceDate, profile.candidateAvailableDate]
        : [],
      credentials: credentials
        .filter((item) => item.candidateId === row.candidateId)
        .map((item) => ({ name: item.name, status: item.status })),
      clearance: clearance
        ? {
          level: clearance.clearanceLevel,
          status: clearance.clearanceStatus,
          humanVerified: clearance.humanVerified,
        }
        : null,
    });
  }
  return {
    skills: rows.map((row) => ({
      candidateId: row.candidateId,
      skillId: row.skillId,
      basis: row.basis,
      reviewStatus: row.reviewStatus,
      source: row.source,
    })),
    people: [...people.values()],
  };
}

async function channelsFor(input: {
  skillIds: string[];
  civilianOccupationId: string | null;
  jobFamilyId: string | null;
}): Promise<MilitaryChannelFact[]> {
  const db = getDb();
  const channels: MilitaryChannelFact[] = [];
  if (input.skillIds.length) {
    channels.push(...await db
      .select({
        branch: militaryOccupations.branch,
        code: militaryOccupations.code,
        title: militaryOccupations.title,
        reviewStatus: militaryOccupationSkills.reviewStatus,
      })
      .from(militaryOccupationSkills)
      .innerJoin(militaryOccupations, eq(militaryOccupationSkills.militaryOccupationId, militaryOccupations.id))
      .where(and(
        inArray(militaryOccupationSkills.skillId, input.skillIds),
        eq(militaryOccupationSkills.reviewStatus, "approved"),
      )));
  }
  const occupationIds = new Set<string>();
  if (input.civilianOccupationId) occupationIds.add(input.civilianOccupationId);
  if (input.jobFamilyId) {
    const linked = await db
      .select({ occupationId: civilianOccupationJobFamilies.occupationId })
      .from(civilianOccupationJobFamilies)
      .where(eq(civilianOccupationJobFamilies.jobFamilyId, input.jobFamilyId));
    for (const row of linked) occupationIds.add(row.occupationId);
  }
  if (occupationIds.size) {
    channels.push(...await db
      .select({
        branch: militaryOccupations.branch,
        code: militaryOccupations.code,
        title: militaryOccupations.title,
        reviewStatus: militaryCivilianMappings.reviewStatus,
      })
      .from(militaryCivilianMappings)
      .innerJoin(militaryOccupations, eq(militaryCivilianMappings.militaryOccupationId, militaryOccupations.id))
      .where(and(
        inArray(militaryCivilianMappings.civilianOccupationId, [...occupationIds]),
        eq(militaryCivilianMappings.reviewStatus, "approved"),
      )));
  }
  const seen = new Set<string>();
  return channels.filter((row) => {
    const key = `${row.branch}:${row.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function partnersFor(organizationId: string, skillIds: string[]) {
  if (!skillIds.length) return [];
  const db = getDb();
  const rows = await db
    .select({
      id: educationPartners.id,
      name: educationPartners.name,
      skillId: trainingProgramSkills.skillId,
    })
    .from(trainingProgramSkills)
    .innerJoin(trainingPrograms, eq(trainingProgramSkills.programId, trainingPrograms.id))
    .innerJoin(educationPartners, eq(trainingPrograms.partnerId, educationPartners.id))
    .where(and(
      eq(trainingPrograms.organizationId, organizationId),
      eq(educationPartners.organizationId, organizationId),
      inArray(trainingProgramSkills.skillId, skillIds),
    ));
  const grouped = new Map<string, { id: string; name: string; skillIds: string[] }>();
  for (const row of rows) {
    const current = grouped.get(row.id) ?? { id: row.id, name: row.name, skillIds: [] };
    current.skillIds.push(row.skillId);
    grouped.set(row.id, current);
  }
  return [...grouped.values()];
}

function presentPeople(people: LoadedPerson[], analysisIds: string[], includeDetail: boolean, includePii: boolean) {
  if (!includeDetail) return [];
  const wanted = new Set(analysisIds);
  return people
    .filter((person) => wanted.has(person.id))
    .map((person) => presentSupplyCandidate(person, true, includePii))
    .filter((person): person is NonNullable<typeof person> => Boolean(person));
}

export async function loadWorkforceRolePipeline(input: {
  organizationId: string;
  roleId: string;
  calculatedAt?: Date;
  includeCandidateDetail?: boolean;
  includePii?: boolean;
}) {
  const db = getDb();
  const [role] = await db.select().from(workforceRoles).where(and(
    eq(workforceRoles.id, input.roleId),
    eq(workforceRoles.organizationId, input.organizationId),
  )).limit(1);
  if (!role) throw new WorkforceError("Workforce role not found");
  const [family] = role.jobFamilyId
    ? await db.select().from(jobFamilies).where(eq(jobFamilies.id, role.jobFamilyId)).limit(1)
    : [undefined];
  const [location] = role.companyLocationId
    ? await db.select().from(companyLocations).where(eq(companyLocations.id, role.companyLocationId)).limit(1)
    : [undefined];
  const roleSkills = await db
    .select({
      skillId: workforceRoleSkills.skillId,
      name: skills.name,
      requirementType: workforceRoleSkills.requirementType,
    })
    .from(workforceRoleSkills)
    .innerJoin(skills, eq(skills.id, workforceRoleSkills.skillId))
    .where(eq(workforceRoleSkills.roleId, role.id));
  const requiredIds = roleSkills.filter((row) => row.requirementType === "required").map((row) => row.skillId);
  const facts = await loadSupplyFacts(input.organizationId, requiredIds);
  const linked = await db
    .select({
      jobId: jobs.id,
      title: jobs.title,
      status: jobs.status,
      demandHorizon: jobs.demandHorizon,
    })
    .from(workforceRoleJobs)
    .innerJoin(jobs, and(eq(jobs.id, workforceRoleJobs.jobId), eq(jobs.organizationId, input.organizationId)))
    .where(and(
      eq(workforceRoleJobs.roleId, role.id),
      eq(workforceRoleJobs.organizationId, input.organizationId),
    ));
  const jobIds = linked.map((row) => row.jobId);
  const candidateIds = facts.people.map((person) => person.id);
  const [matchRows, engagementRows, interviewRows, placementRows, channels, partners, texts, notes, companyJobs] = await Promise.all([
    jobIds.length && candidateIds.length
      ? db.select({
        candidateId: candidateJobMatches.candidateId,
        jobId: candidateJobMatches.jobId,
        matchCategory: candidateJobMatches.matchCategory,
        recruiterDisposition: candidateJobMatches.recruiterDisposition,
      }).from(candidateJobMatches).where(and(
        eq(candidateJobMatches.organizationId, input.organizationId),
        inArray(candidateJobMatches.jobId, jobIds),
        inArray(candidateJobMatches.candidateId, candidateIds),
      ))
      : Promise.resolve([] as MatchFact[]),
    jobIds.length && candidateIds.length
      ? db.select({
        candidateId: opportunityEngagements.candidateId,
        jobId: opportunityEngagements.jobId,
        status: opportunityEngagements.status,
        employerResponse: opportunityEngagements.employerResponse,
      }).from(opportunityEngagements).where(and(
        eq(opportunityEngagements.organizationId, input.organizationId),
        inArray(opportunityEngagements.jobId, jobIds),
        inArray(opportunityEngagements.candidateId, candidateIds),
      ))
      : Promise.resolve([] as EngagementFact[]),
    jobIds.length && candidateIds.length
      ? db.select({ candidateId: interviews.candidateId }).from(interviews).where(and(
        inArray(interviews.jobId, jobIds),
        inArray(interviews.candidateId, candidateIds),
      ))
      : Promise.resolve([] as Array<{ candidateId: string }>),
    jobIds.length && candidateIds.length
      ? db.select({ candidateId: placements.candidateId }).from(placements).where(and(
        inArray(placements.jobId, jobIds),
        inArray(placements.candidateId, candidateIds),
      ))
      : Promise.resolve([] as Array<{ candidateId: string }>),
    channelsFor({
      skillIds: requiredIds,
      civilianOccupationId: role.civilianOccupationId,
      jobFamilyId: role.jobFamilyId,
    }),
    partnersFor(input.organizationId, requiredIds),
    db.select().from(workforceRoleCapabilityTexts).where(eq(workforceRoleCapabilityTexts.roleId, role.id)),
    db.select().from(workforceStrategyNotes).where(and(
      eq(workforceStrategyNotes.roleId, role.id),
      eq(workforceStrategyNotes.organizationId, input.organizationId),
    )),
    db.select({ id: jobs.id, title: jobs.title, status: jobs.status, demandHorizon: jobs.demandHorizon }).from(jobs).where(and(
      eq(jobs.organizationId, input.organizationId),
      eq(jobs.companyId, role.companyId),
      isNull(jobs.archivedAt),
    )),
  ]);
  const analysis = analyzeWorkforceRole({
    calculatedAt: input.calculatedAt ?? new Date(),
    demandQuantity: role.demandQuantity,
    demandHorizon: role.demandHorizon,
    planningHorizon: role.planningHorizon,
    demandSource: role.demandSource,
    requiredSkills: roleSkills,
    requiredCredentialText: role.minimumCredentials,
    requiredClearance: role.requiredClearanceLevel,
    siteCity: location?.city ?? null,
    siteRegion: location?.region ?? null,
    jobFamilyId: role.jobFamilyId,
    jobFamilyName: family?.name ?? null,
    freeTextJobFamily: role.jobFamily,
    jobs: linked satisfies JobLinkFact[],
    skills: facts.skills,
    people: facts.people,
    matches: matchRows,
    engagements: engagementRows,
    interviewCandidateIds: interviewRows.map((row) => row.candidateId),
    placementCandidateIds: placementRows.map((row) => row.candidateId),
    militaryChannels: channels,
    educationPartners: partners,
  });
  return {
    role,
    jobFamilyName: family?.name ?? null,
    location,
    analysis,
    candidates: presentPeople(
      facts.people,
      analysis.relevantCandidateIds,
      input.includeCandidateDetail ?? false,
      input.includePii ?? false,
    ),
    capabilityTexts: texts,
    strategyNotes: notes,
    companyJobs,
  };
}

export async function loadWorkforcePortfolio(organizationId: string, calculatedAt = new Date()) {
  const db = getDb();
  const roles = await db.select().from(workforceRoles).where(eq(workforceRoles.organizationId, organizationId));
  if (!roles.length) return { calculatedAt: calculatedAt.toISOString(), families: [], unlinkedRoles: [], roles: [] };
  const roleIds = roles.map((role) => role.id);
  const locationIds = roles.map((role) => role.companyLocationId).filter((id): id is string => Boolean(id));
  const locations = locationIds.length
    ? await db.select().from(companyLocations).where(inArray(companyLocations.id, locationIds))
    : [];
  const locationById = new Map(locations.map((row) => [row.id, row]));
  const families = await db.select().from(jobFamilies);
  const familyName = new Map(families.map((row) => [row.id, row.name]));
  const roleSkills = await db
    .select({
      roleId: workforceRoleSkills.roleId,
      skillId: workforceRoleSkills.skillId,
      name: skills.name,
      requirementType: workforceRoleSkills.requirementType,
    })
    .from(workforceRoleSkills)
    .innerJoin(skills, eq(skills.id, workforceRoleSkills.skillId))
    .where(inArray(workforceRoleSkills.roleId, roleIds));
  const requiredIds = [...new Set(roleSkills.filter((row) => row.requirementType === "required").map((row) => row.skillId))];
  const facts = await loadSupplyFacts(organizationId, requiredIds);
  const links = await db
    .select({
      roleId: workforceRoleJobs.roleId,
      jobId: jobs.id,
      title: jobs.title,
      status: jobs.status,
      demandHorizon: jobs.demandHorizon,
    })
    .from(workforceRoleJobs)
    .innerJoin(jobs, and(eq(jobs.id, workforceRoleJobs.jobId), eq(jobs.organizationId, organizationId)))
    .where(and(eq(workforceRoleJobs.organizationId, organizationId), inArray(workforceRoleJobs.roleId, roleIds)));
  const jobIds = [...new Set(links.map((row) => row.jobId))];
  const candidateIds = facts.people.map((person) => person.id);
  const [matchRows, engagementRows, placementRows] = await Promise.all([
    jobIds.length && candidateIds.length
      ? db.select({
        candidateId: candidateJobMatches.candidateId,
        jobId: candidateJobMatches.jobId,
        matchCategory: candidateJobMatches.matchCategory,
        recruiterDisposition: candidateJobMatches.recruiterDisposition,
      }).from(candidateJobMatches).where(and(
        eq(candidateJobMatches.organizationId, organizationId),
        inArray(candidateJobMatches.jobId, jobIds),
      ))
      : Promise.resolve([] as MatchFact[]),
    jobIds.length && candidateIds.length
      ? db.select({
        candidateId: opportunityEngagements.candidateId,
        jobId: opportunityEngagements.jobId,
        status: opportunityEngagements.status,
        employerResponse: opportunityEngagements.employerResponse,
      }).from(opportunityEngagements).where(and(
        eq(opportunityEngagements.organizationId, organizationId),
        inArray(opportunityEngagements.jobId, jobIds),
      ))
      : Promise.resolve([] as EngagementFact[]),
    jobIds.length && candidateIds.length
      ? db.select({ candidateId: placements.candidateId, jobId: placements.jobId }).from(placements).where(inArray(placements.jobId, jobIds))
      : Promise.resolve([] as Array<{ candidateId: string; jobId: string }>),
  ]);
  const analyses = roles.map((role) => {
    const skillsForRole = roleSkills.filter((row) => row.roleId === role.id);
    const jobsForRole = links.filter((row) => row.roleId === role.id);
    const jobIdSet = new Set(jobsForRole.map((row) => row.jobId));
    const analysis = analyzeWorkforceRole({
      calculatedAt,
      demandQuantity: role.demandQuantity,
      demandHorizon: role.demandHorizon,
      planningHorizon: role.planningHorizon,
      demandSource: role.demandSource,
      requiredSkills: skillsForRole,
      requiredCredentialText: role.minimumCredentials,
      requiredClearance: role.requiredClearanceLevel,
      siteCity: role.companyLocationId ? locationById.get(role.companyLocationId)?.city ?? null : null,
      siteRegion: role.companyLocationId ? locationById.get(role.companyLocationId)?.region ?? null : null,
      jobFamilyId: role.jobFamilyId,
      jobFamilyName: role.jobFamilyId ? familyName.get(role.jobFamilyId) ?? null : null,
      freeTextJobFamily: role.jobFamily,
      jobs: jobsForRole,
      skills: facts.skills,
      people: facts.people,
      matches: matchRows.filter((row) => jobIdSet.has(row.jobId)),
      engagements: engagementRows.filter((row) => jobIdSet.has(row.jobId)),
      placementCandidateIds: placementRows.filter((row) => jobIdSet.has(row.jobId)).map((row) => row.candidateId),
    });
    return { role, analysis };
  });
  const summary = summarizeJobFamilies(analyses.map(({ role, analysis }) => ({
    roleId: role.id,
    title: role.title,
    jobFamilyId: role.jobFamilyId,
    jobFamilyName: role.jobFamilyId ? familyName.get(role.jobFamilyId) ?? null : null,
    freeTextJobFamily: role.jobFamily,
    demandQuantity: role.demandQuantity,
    candidateIds: analysis.relevantCandidateIds,
    activePipelineCandidateIds: analysis.activePipelineCandidateIds,
    placedCandidateIds: analysis.placedCandidateIds,
    health: analysis.health,
  })));
  return {
    calculatedAt: calculatedAt.toISOString(),
    ...summary,
    roles: analyses.map(({ role, analysis }) => ({
      id: role.id,
      title: role.title,
      demandQuantity: role.demandQuantity,
      demandHorizon: role.demandHorizon,
      knownSupply: analysis.knownSupply,
      militarySupply: analysis.militarySupply,
      nonMilitarySupply: analysis.nonMilitarySupply,
      quantityGap: analysis.quantityGap,
      activePipeline: analysis.activePipeline,
      placements: analysis.funnel.placement,
      health: analysis.health,
      currentOpenings: analysis.currentOpenings,
      jobFamilyName: role.jobFamilyId ? familyName.get(role.jobFamilyId) ?? null : null,
    })),
  };
}

export async function listJobFamilies() {
  const db = getDb();
  return db.select({ id: jobFamilies.id, name: jobFamilies.name }).from(jobFamilies).orderBy(jobFamilies.name);
}

export async function workforceRolesForJob(organizationId: string, jobId: string) {
  const db = getDb();
  return db
    .select({
      roleId: workforceRoles.id,
      title: workforceRoles.title,
      demandQuantity: workforceRoles.demandQuantity,
      demandHorizon: workforceRoles.demandHorizon,
    })
    .from(workforceRoleJobs)
    .innerJoin(workforceRoles, and(
      eq(workforceRoles.id, workforceRoleJobs.roleId),
      eq(workforceRoles.organizationId, organizationId),
    ))
    .where(and(
      eq(workforceRoleJobs.organizationId, organizationId),
      eq(workforceRoleJobs.jobId, jobId),
    ));
}
