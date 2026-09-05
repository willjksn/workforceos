import { and, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";

import { getDb } from "../../db";
import {
  candidateDesignations,
  candidateExperiences,
  candidateJobMatches,
  candidateMilitaryExperiences,
  candidateScreenings,
  candidateSkills,
  candidates,
  companies,
  contacts,
  jobSkills,
  jobs,
  militaryOccupationSkills,
  searchProjects,
  services,
  skills,
  users,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { scoreCandidateJobMatch } from "../recruiting/matching";
import {
  buildInternalSearchProjectName,
} from "../recruiting/internal-search";
import { normalizePipelineStage, type PipelineStage } from "../recruiting/pipeline";
import { sanitizeSearchQuery } from "../validation/forms";

const PROFESSIONAL_SEARCH_CODE = "professional-search";

function numeric(value: number) {
  return value.toFixed(2);
}

export async function listJobs(organizationId: string, query?: string) {
  const db = getDb();
  const search = sanitizeSearchQuery(query);
  const rows = await db
    .select({
      job: jobs,
      companyName: companies.name,
      ownerName: users.fullName,
      hiringManagerName: contacts.fullName,
    })
    .from(jobs)
    .leftJoin(companies, eq(jobs.companyId, companies.id))
    .leftJoin(users, eq(jobs.searchOwnerUserId, users.id))
    .leftJoin(contacts, eq(jobs.hiringManagerContactId, contacts.id))
    .where(
      and(
        eq(jobs.organizationId, organizationId),
        isNull(jobs.archivedAt),
        search ? ilike(jobs.title, `%${search}%`) : undefined,
      ),
    )
    .orderBy(jobs.title);

  const jobIds = rows.map((row) => row.job.id);
  if (jobIds.length === 0) return [];

  const matchRows = await db
    .select({
      jobId: candidateJobMatches.jobId,
      pipelineStatus: candidateJobMatches.pipelineStatus,
    })
    .from(candidateJobMatches)
    .where(inArray(candidateJobMatches.jobId, jobIds));

  return rows.map((row) => {
    const matches = matchRows.filter((match) => match.jobId === row.job.id);
    const activePipeline = matches.filter((match) =>
      !["rejected", "declined", "withdrawn", "placed"].includes(normalizePipelineStage(match.pipelineStatus)),
    );
    const opened = row.job.createdAt.getTime();
    const daysOpen = Math.max(0, Math.floor((Date.now() - opened) / (1000 * 60 * 60 * 24)));
    return {
      ...row,
      matchedInternalCount: matches.length,
      activePipelineCount: activePipeline.length,
      daysOpen,
    };
  });
}

export async function createJobWithInternalSearch(input: {
  organizationId: string;
  actorUserId: string;
  title: string;
  companyId?: string | null;
  description?: string | null;
  status?: typeof jobs.$inferInsert.status;
  normalizedTitle?: string | null;
  locationId?: string | null;
  locationLabel?: string | null;
  hiringManagerContactId?: string | null;
  searchOwnerUserId?: string | null;
  reportingRelationship?: string | null;
  employmentType?: string | null;
  workplaceType?: string | null;
  compensationMin?: string | null;
  compensationMax?: string | null;
  bonus?: string | null;
  requiredExperienceYears?: number | null;
  education?: string | null;
  certifications?: string | null;
  travel?: string | null;
  relocation?: string | null;
  scheduleShift?: string | null;
  reasonOpen?: string | null;
  targetStartDate?: string | null;
  interviewProcess?: string | null;
  businessContext?: string | null;
  candidateValueProposition?: string | null;
  priorSearchFailureNotes?: string | null;
  successMeasures?: string | null;
  priority?: string | null;
  urgency?: string | null;
  militaryCompatibility?: string | null;
  skills?: Array<{
    skillId: string;
    requirementType: "required" | "preferred" | "nice_to_have";
    minimumYears?: number | null;
    importanceWeight?: number | null;
    humanVerified?: boolean;
  }>;
}) {
  const db = getDb();
  const status = input.status ?? "open";
  const [job] = await db
    .insert(jobs)
    .values({
      organizationId: input.organizationId,
      title: input.title,
      companyId: input.companyId,
      description: input.description,
      status,
      normalizedTitle: input.normalizedTitle,
      locationId: input.locationId,
      locationLabel: input.locationLabel,
      hiringManagerContactId: input.hiringManagerContactId,
      searchOwnerUserId: input.searchOwnerUserId ?? input.actorUserId,
      reportingRelationship: input.reportingRelationship,
      employmentType: input.employmentType,
      workplaceType: input.workplaceType,
      compensationMin: input.compensationMin,
      compensationMax: input.compensationMax,
      bonus: input.bonus,
      requiredExperienceYears: input.requiredExperienceYears,
      education: input.education,
      certifications: input.certifications,
      travel: input.travel,
      relocation: input.relocation,
      scheduleShift: input.scheduleShift,
      reasonOpen: input.reasonOpen,
      targetStartDate: input.targetStartDate,
      interviewProcess: input.interviewProcess,
      businessContext: input.businessContext,
      candidateValueProposition: input.candidateValueProposition,
      priorSearchFailureNotes: input.priorSearchFailureNotes,
      successMeasures: input.successMeasures,
      priority: input.priority ?? "normal",
      urgency: input.urgency ?? "normal",
      militaryCompatibility: input.militaryCompatibility,
      lastActivityAt: new Date(),
    })
    .returning();

  for (const skill of input.skills ?? []) {
    await db.insert(jobSkills).values({
      jobId: job.id,
      skillId: skill.skillId,
      requirementType: skill.requirementType,
      minimumYears: skill.minimumYears,
      importanceWeight: skill.importanceWeight ?? 1,
      humanVerified: skill.humanVerified ?? false,
    });
  }

  const [service] = await db.select().from(services).where(eq(services.code, PROFESSIONAL_SEARCH_CODE)).limit(1);
  const [searchProject] = await db
    .insert(searchProjects)
    .values({
      jobId: job.id,
      companyId: job.companyId,
      serviceId: service?.id,
      ownerUserId: job.searchOwnerUserId,
      name: buildInternalSearchProjectName(job.title),
      status: status === "draft" ? "draft" : "active",
    })
    .returning();

  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "job.created",
    recordType: "job",
    recordId: job.id,
    after: { id: job.id, title: job.title, status: job.status },
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "search_project.created",
    recordType: "search_project",
    recordId: searchProject.id,
    after: { id: searchProject.id, name: searchProject.name, jobId: job.id },
  });

  return { job, searchProject };
}

export async function updateJobRecord(input: {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  values: Partial<typeof jobs.$inferInsert>;
  reason?: string;
}) {
  const db = getDb();
  const [before] = await db.select().from(jobs).where(eq(jobs.id, input.jobId)).limit(1);
  if (!before || before.organizationId !== input.organizationId) throw new Error("Job not found");
  const [after] = await db
    .update(jobs)
    .set({ ...input.values, lastActivityAt: new Date(), updatedAt: new Date() })
    .where(eq(jobs.id, input.jobId))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "job.updated",
    recordType: "job",
    recordId: after.id,
    before: { status: before.status, title: before.title },
    after: { status: after.status, title: after.title },
    reason: input.reason,
  });
  return after;
}

export async function setJobStatus(input: {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  status: typeof jobs.$inferInsert.status;
}) {
  const after = await updateJobRecord({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    jobId: input.jobId,
    values: { status: input.status },
    reason: `status:${input.status}`,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: `job.${input.status}`,
    recordType: "job",
    recordId: after.id,
    after: { status: after.status },
  });
  return after;
}

export async function replaceJobSkills(input: {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  skills: Array<{
    skillId: string;
    requirementType: "required" | "preferred" | "nice_to_have";
    minimumYears?: number | null;
    importanceWeight?: number | null;
    humanVerified?: boolean;
  }>;
}) {
  const db = getDb();
  await db.delete(jobSkills).where(eq(jobSkills.jobId, input.jobId));
  for (const skill of input.skills) {
    await db.insert(jobSkills).values({
      jobId: input.jobId,
      skillId: skill.skillId,
      requirementType: skill.requirementType,
      minimumYears: skill.minimumYears,
      importanceWeight: skill.importanceWeight ?? 1,
      humanVerified: skill.humanVerified ?? false,
    });
  }
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "job.skills_updated",
    recordType: "job",
    recordId: input.jobId,
    after: { skillCount: input.skills.length },
  });
}

export async function getJobWorkspace(jobId: string, organizationId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      job: jobs,
      companyName: companies.name,
      ownerName: users.fullName,
      hiringManagerName: contacts.fullName,
    })
    .from(jobs)
    .leftJoin(companies, eq(jobs.companyId, companies.id))
    .leftJoin(users, eq(jobs.searchOwnerUserId, users.id))
    .leftJoin(contacts, eq(jobs.hiringManagerContactId, contacts.id))
    .where(and(eq(jobs.id, jobId), eq(jobs.organizationId, organizationId), isNull(jobs.archivedAt)))
    .limit(1);
  if (!row) return null;

  const projects = await db
    .select()
    .from(searchProjects)
    .where(eq(searchProjects.jobId, jobId))
    .orderBy(desc(searchProjects.createdAt));
  const matches = await db
    .select({ match: candidateJobMatches, candidate: candidates })
    .from(candidateJobMatches)
    .innerJoin(candidates, eq(candidateJobMatches.candidateId, candidates.id))
    .where(eq(candidateJobMatches.jobId, jobId))
    .orderBy(desc(candidateJobMatches.score));
  const requiredSkills = await db
    .select({ skill: skills, link: jobSkills })
    .from(jobSkills)
    .innerJoin(skills, eq(jobSkills.skillId, skills.id))
    .where(eq(jobSkills.jobId, jobId));

  return { ...row, searchProjects: projects, matches, skills: requiredSkills };
}

export async function listCanonicalSkills() {
  const db = getDb();
  return db.select().from(skills).where(isNull(skills.archivedAt)).orderBy(skills.name);
}

export async function ensureInternalSearchProject(input: {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  jobTitle: string;
  companyId?: string | null;
}) {
  const db = getDb();
  const existing = await db.select().from(searchProjects).where(eq(searchProjects.jobId, input.jobId)).limit(1);
  if (existing[0]) return existing[0];
  const [service] = await db.select().from(services).where(eq(services.code, PROFESSIONAL_SEARCH_CODE)).limit(1);
  const [searchProject] = await db
    .insert(searchProjects)
    .values({
      jobId: input.jobId,
      companyId: input.companyId,
      serviceId: service?.id,
      name: buildInternalSearchProjectName(input.jobTitle),
      status: "active",
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "search_project.created",
    recordType: "search_project",
    recordId: searchProject.id,
    after: { id: searchProject.id, name: searchProject.name },
  });
  return searchProject;
}

export async function runInternalTalentSearch(input: {
  organizationId: string;
  actorUserId: string;
  jobId: string;
}) {
  const db = getDb();
  const workspace = await getJobWorkspace(input.jobId, input.organizationId);
  if (!workspace) throw new Error("Job not found");
  const startedAt = new Date();
  await ensureInternalSearchProject({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    jobId: workspace.job.id,
    jobTitle: workspace.job.title,
    companyId: workspace.job.companyId,
  });
  await db
    .update(jobs)
    .set({
      internalTalentSearchStartedAt: workspace.job.internalTalentSearchStartedAt ?? startedAt,
      lastActivityAt: startedAt,
      updatedAt: startedAt,
    })
    .where(eq(jobs.id, input.jobId));
  await db
    .update(searchProjects)
    .set({ internalSearchStartedAt: startedAt, updatedAt: startedAt })
    .where(eq(searchProjects.jobId, input.jobId));

  const activeCandidates = await db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.organizationId, input.organizationId),
        isNull(candidates.archivedAt),
        eq(candidates.doNotContact, false),
      ),
    );

  const candidateIds = activeCandidates.map((candidate) => candidate.id);
  const experiences = candidateIds.length
    ? await db.select().from(candidateExperiences).where(inArray(candidateExperiences.candidateId, candidateIds))
    : [];
  const skillRows = candidateIds.length
    ? await db
        .select({ candidateId: candidateSkills.candidateId, name: skills.name })
        .from(candidateSkills)
        .innerJoin(skills, eq(candidateSkills.skillId, skills.id))
        .where(inArray(candidateSkills.candidateId, candidateIds))
    : [];
  const designations = candidateIds.length
    ? await db
        .select()
        .from(candidateDesignations)
        .where(and(inArray(candidateDesignations.candidateId, candidateIds), eq(candidateDesignations.active, true)))
    : [];
  const military = candidateIds.length
    ? await db
        .select({
          candidateId: candidateMilitaryExperiences.candidateId,
          occupationTitle: sql<string>`''`,
          skillId: militaryOccupationSkills.skillId,
        })
        .from(candidateMilitaryExperiences)
        .leftJoin(
          militaryOccupationSkills,
          eq(militaryOccupationSkills.militaryOccupationId, candidateMilitaryExperiences.militaryOccupationId),
        )
        .where(inArray(candidateMilitaryExperiences.candidateId, candidateIds))
    : [];
  const militarySkillNames = military.length
    ? await db
        .select({ id: skills.id, name: skills.name })
        .from(skills)
        .where(
          inArray(
            skills.id,
            military.map((row) => row.skillId).filter((id): id is string => Boolean(id)),
          ),
        )
    : [];
  const skillNameById = Object.fromEntries(militarySkillNames.map((skill) => [skill.id, skill.name]));

  const required = workspace.skills.filter((row) => row.link.requirementType === "required").map((row) => row.skill.name);
  const preferred = workspace.skills.filter((row) => row.link.requirementType !== "required").map((row) => row.skill.name);
  const scored = [];
  for (const candidate of activeCandidates) {
    const result = scoreCandidateJobMatch({
      jobTitle: workspace.job.title,
      jobDescription: workspace.job.description,
      jobSkillNames: required,
      preferredSkillNames: preferred,
      requiredExperienceYears: workspace.job.requiredExperienceYears,
      locationLabel: workspace.job.locationLabel,
      compensationMin: workspace.job.compensationMin ? Number(workspace.job.compensationMin) : null,
      compensationMax: workspace.job.compensationMax ? Number(workspace.job.compensationMax) : null,
      certifications: workspace.job.certifications,
      candidateName: candidate.fullName,
      candidateTitle: candidate.currentTitle,
      candidateCompany: candidate.currentCompany,
      candidateCity: candidate.city,
      candidateRegion: candidate.region,
      candidateYearsExperience: candidate.yearsExperience,
      candidateCompensation: candidate.compensationExpectations,
      candidateCareerInterests: candidate.careerInterests,
      relocationWillingness: candidate.relocationWillingness,
      experienceTitles: experiences
        .filter((experience) => experience.candidateId === candidate.id)
        .map((experience) => `${experience.title} ${experience.employer}`),
      candidateSkillNames: skillRows.filter((row) => row.candidateId === candidate.id).map((row) => row.name),
      militarySkillNames: military
        .filter((row) => row.candidateId === candidate.id)
        .map((row) => skillNameById[row.skillId ?? ""])
        .filter(Boolean),
      silverMedalist: designations.some(
        (row) => row.candidateId === candidate.id && row.designationType === "silver_medalist",
      ),
    });
    if (result.overall < 1) continue;
    scored.push({ candidate, ...result });
  }

  for (const row of scored) {
    await db
      .insert(candidateJobMatches)
      .values({
        candidateId: row.candidate.id,
        jobId: input.jobId,
        score: numeric(row.overall),
        skillsScore: numeric(row.skills),
        experienceScore: numeric(row.experience),
        industryScore: numeric(row.industry),
        locationScore: numeric(row.location),
        compensationScore: numeric(row.compensation),
        certificationScore: numeric(row.certification),
        militaryScore: numeric(row.military),
        careerAlignmentScore: numeric(row.careerAlignment),
        priorFeedbackScore: numeric(row.priorFeedback),
        explanation: row.explanation,
        strengths: row.strengths.join("; "),
        gaps: row.gaps.join("; "),
        modelName: "workforceos-deterministic-match",
        modelVersion: "phase3-v1",
        source: "internal_talent_network",
        lastCalculatedAt: startedAt,
        pipelineStatus: "identified",
      })
      .onConflictDoUpdate({
        target: [candidateJobMatches.candidateId, candidateJobMatches.jobId],
        set: {
          score: sql`excluded.score`,
          skillsScore: sql`excluded.skills_score`,
          experienceScore: sql`excluded.experience_score`,
          industryScore: sql`excluded.industry_score`,
          locationScore: sql`excluded.location_score`,
          compensationScore: sql`excluded.compensation_score`,
          certificationScore: sql`excluded.certification_score`,
          militaryScore: sql`excluded.military_score`,
          careerAlignmentScore: sql`excluded.career_alignment_score`,
          priorFeedbackScore: sql`excluded.prior_feedback_score`,
          explanation: sql`excluded.explanation`,
          strengths: sql`excluded.strengths`,
          gaps: sql`excluded.gaps`,
          modelName: sql`excluded.model_name`,
          modelVersion: sql`excluded.model_version`,
          source: sql`excluded.source`,
          lastCalculatedAt: sql`excluded.last_calculated_at`,
          updatedAt: new Date(),
        },
      });
  }

  const recommended = scored.filter((row) => row.overall >= 50).length;
  await db
    .update(jobs)
    .set({
      internalCandidatesReviewedCount: activeCandidates.length,
      internalCandidatesRecommendedCount: recommended,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, input.jobId));

  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "internal_search.ran",
    recordType: "job",
    recordId: input.jobId,
    after: { matchCount: scored.length, reviewedCount: activeCandidates.length, recommendedCount: recommended },
  });

  return { matchCount: scored.length, reviewedCount: activeCandidates.length, recommendedCount: recommended };
}

export async function completeInternalSearch(input: {
  organizationId: string;
  actorUserId: string;
  searchProjectId: string;
  jobId: string;
}) {
  const db = getDb();
  const completedAt = new Date();
  const [before] = await db.select().from(searchProjects).where(eq(searchProjects.id, input.searchProjectId)).limit(1);
  if (!before || before.jobId !== input.jobId) {
    throw new Error("Internal search project not found");
  }
  const [after] = await db
    .update(searchProjects)
    .set({ internalSearchCompletedAt: completedAt, updatedAt: completedAt })
    .where(eq(searchProjects.id, input.searchProjectId))
    .returning();
  await db
    .update(jobs)
    .set({ internalTalentSearchCompletedAt: completedAt, lastActivityAt: completedAt, updatedAt: completedAt })
    .where(eq(jobs.id, input.jobId));
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "internal_search.completed",
    recordType: "search_project",
    recordId: after.id,
    before: { internalSearchCompletedAt: before.internalSearchCompletedAt },
    after: { internalSearchCompletedAt: after.internalSearchCompletedAt },
  });
  return after;
}

export async function updateMatchPipelineStatus(input: {
  organizationId: string;
  actorUserId: string;
  matchId: string;
  jobId: string;
  pipelineStatus: typeof candidateJobMatches.$inferInsert.pipelineStatus;
  actorType?: "human" | "agent" | "system";
}) {
  const stage = normalizePipelineStage(input.pipelineStatus);
  if (stage === "rejected" && (input.actorType ?? "human") !== "human") {
    throw new Error("Material AI-based rejection requires a human decision");
  }
  const db = getDb();
  const [before] = await db
    .select()
    .from(candidateJobMatches)
    .where(and(eq(candidateJobMatches.id, input.matchId), eq(candidateJobMatches.jobId, input.jobId)))
    .limit(1);
  if (!before) throw new Error("Match not found");
  const [after] = await db
    .update(candidateJobMatches)
    .set({ pipelineStatus: stage, updatedAt: new Date() })
    .where(eq(candidateJobMatches.id, input.matchId))
    .returning();
  await db.update(jobs).set({ lastActivityAt: new Date(), updatedAt: new Date() }).where(eq(jobs.id, input.jobId));
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "candidate_pipeline.moved",
    recordType: "candidate_job_match",
    recordId: after.id,
    before: { pipelineStatus: before.pipelineStatus },
    after: { pipelineStatus: after.pipelineStatus },
  });
  return after;
}

export async function overrideMatchScore(input: {
  organizationId: string;
  actorUserId: string;
  matchId: string;
  overall: number;
  reason: string;
}) {
  const db = getDb();
  const [before] = await db.select().from(candidateJobMatches).where(eq(candidateJobMatches.id, input.matchId)).limit(1);
  if (!before) throw new Error("Match not found");
  const [after] = await db
    .update(candidateJobMatches)
    .set({
      score: numeric(input.overall),
      humanRating: input.overall,
      humanReviewStatus: "approved",
      humanReviewedByUserId: input.actorUserId,
      updatedAt: new Date(),
    })
    .where(eq(candidateJobMatches.id, input.matchId))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "candidate_job_match.override",
    recordType: "candidate_job_match",
    recordId: after.id,
    before: { score: before.score },
    after: { score: after.score },
    reason: input.reason,
  });
  return after;
}

export async function saveCandidateScreening(input: {
  organizationId: string;
  actorUserId: string;
  matchId: string;
  values: Omit<typeof candidateScreenings.$inferInsert, "id" | "matchId" | "createdByUserId">;
}) {
  const db = getDb();
  const [match] = await db.select().from(candidateJobMatches).where(eq(candidateJobMatches.id, input.matchId)).limit(1);
  if (!match) throw new Error("Match not found");
  const [row] = await db
    .insert(candidateScreenings)
    .values({
      ...input.values,
      matchId: input.matchId,
      createdByUserId: input.actorUserId,
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "candidate_screening.created",
    recordType: "candidate_screening",
    recordId: row.id,
    after: { matchId: input.matchId },
  });
  return row;
}

export async function listSearchProjects(organizationId: string) {
  const db = getDb();
  return db
    .select({
      project: searchProjects,
      job: jobs,
      companyName: companies.name,
    })
    .from(searchProjects)
    .innerJoin(jobs, eq(searchProjects.jobId, jobs.id))
    .leftJoin(companies, eq(searchProjects.companyId, companies.id))
    .where(and(eq(jobs.organizationId, organizationId), isNull(jobs.archivedAt)))
    .orderBy(desc(searchProjects.createdAt));
}

export async function getSearchProject(id: string, organizationId: string) {
  const db = getDb();
  const [row] = await db
    .select({ project: searchProjects, job: jobs, companyName: companies.name })
    .from(searchProjects)
    .innerJoin(jobs, eq(searchProjects.jobId, jobs.id))
    .leftJoin(companies, eq(searchProjects.companyId, companies.id))
    .where(and(eq(searchProjects.id, id), eq(jobs.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

export async function updateSearchProject(input: {
  organizationId: string;
  actorUserId: string;
  searchProjectId: string;
  values: Partial<typeof searchProjects.$inferInsert>;
}) {
  const existing = await getSearchProject(input.searchProjectId, input.organizationId);
  if (!existing) throw new Error("Search project not found");
  const db = getDb();
  const [after] = await db
    .update(searchProjects)
    .set({ ...input.values, updatedAt: new Date() })
    .where(eq(searchProjects.id, input.searchProjectId))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "search_project.updated",
    recordType: "search_project",
    recordId: after.id,
    after: { status: after.status },
  });
  return after;
}

export async function approveSearchStrategy(input: {
  organizationId: string;
  actorUserId: string;
  searchProjectId: string;
}) {
  return updateSearchProject({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    searchProjectId: input.searchProjectId,
    values: { strategyApprovedAt: new Date(), strategyApprovedByUserId: input.actorUserId },
  });
}

export { type PipelineStage };
