import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm";

import { getDb } from "../../db";
import {
  candidateExperiences,
  candidateJobMatches,
  candidateSkills,
  candidates,
  companies,
  jobSkills,
  jobs,
  searchProjects,
  skills,
} from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import {
  buildInternalSearchProjectName,
  scoreInternalCandidate,
} from "../recruiting/internal-search";
import { sanitizeSearchQuery } from "../validation/forms";

export async function listJobs(organizationId: string, query?: string) {
  const db = getDb();
  const search = sanitizeSearchQuery(query);
  return db
    .select({
      job: jobs,
      companyName: companies.name,
    })
    .from(jobs)
    .leftJoin(companies, eq(jobs.companyId, companies.id))
    .where(
      and(
        eq(jobs.organizationId, organizationId),
        isNull(jobs.archivedAt),
        search ? ilike(jobs.title, `%${search}%`) : undefined,
      ),
    )
    .orderBy(jobs.title);
}

export async function createJobWithInternalSearch(input: {
  organizationId: string;
  actorUserId: string;
  title: string;
  companyId?: string | null;
  description?: string | null;
  status?: typeof jobs.$inferInsert.status;
}) {
  const db = getDb();
  const [job] = await db
    .insert(jobs)
    .values({
      organizationId: input.organizationId,
      title: input.title,
      companyId: input.companyId,
      description: input.description,
      status: input.status ?? "open",
    })
    .returning();

  const [searchProject] = await db
    .insert(searchProjects)
    .values({
      jobId: job.id,
      name: buildInternalSearchProjectName(job.title),
    })
    .returning();

  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "job.created",
    recordType: "job",
    recordId: job.id,
    after: job,
  });
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "search_project.created",
    recordType: "search_project",
    recordId: searchProject.id,
    after: searchProject,
  });

  return { job, searchProject };
}

export async function getJobWorkspace(jobId: string, organizationId: string) {
  const db = getDb();
  const [row] = await db
    .select({ job: jobs, companyName: companies.name })
    .from(jobs)
    .leftJoin(companies, eq(jobs.companyId, companies.id))
    .where(
      and(eq(jobs.id, jobId), eq(jobs.organizationId, organizationId), isNull(jobs.archivedAt)),
    )
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
    .select({ skill: skills })
    .from(jobSkills)
    .innerJoin(skills, eq(jobSkills.skillId, skills.id))
    .where(eq(jobSkills.jobId, jobId));

  return { ...row, searchProjects: projects, matches, skills: requiredSkills };
}

export async function ensureInternalSearchProject(input: {
  organizationId: string;
  actorUserId: string;
  jobId: string;
  jobTitle: string;
}) {
  const db = getDb();
  const existing = await db
    .select()
    .from(searchProjects)
    .where(eq(searchProjects.jobId, input.jobId))
    .limit(1);
  if (existing[0]) return existing[0];

  const [searchProject] = await db
    .insert(searchProjects)
    .values({
      jobId: input.jobId,
      name: buildInternalSearchProjectName(input.jobTitle),
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "search_project.created",
    recordType: "search_project",
    recordId: searchProject.id,
    after: searchProject,
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
  await ensureInternalSearchProject({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    jobId: workspace.job.id,
    jobTitle: workspace.job.title,
  });

  const activeCandidates = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.organizationId, input.organizationId), isNull(candidates.archivedAt)));

  const scored = [];
  for (const candidate of activeCandidates) {
    const experiences = await db
      .select()
      .from(candidateExperiences)
      .where(eq(candidateExperiences.candidateId, candidate.id));
    const skillRows = await db
      .select({ name: skills.name })
      .from(candidateSkills)
      .innerJoin(skills, eq(candidateSkills.skillId, skills.id))
      .where(eq(candidateSkills.candidateId, candidate.id));
    const result = scoreInternalCandidate({
      jobTitle: workspace.job.title,
      jobDescription: workspace.job.description,
      jobSkillNames: workspace.skills.map((row) => row.skill.name),
      candidateName: candidate.fullName,
      candidateTitle: candidate.currentTitle,
      experienceTitles: experiences.map((experience) => `${experience.title} ${experience.employer}`),
      candidateSkillNames: skillRows.map((row) => row.name),
    });
    if (result.score < 1) continue;
    scored.push({ candidate, ...result });
  }

  for (const row of scored) {
    await db
      .insert(candidateJobMatches)
      .values({
        candidateId: row.candidate.id,
        jobId: input.jobId,
        score: row.score.toFixed(2),
        explanation: row.explanation,
        pipelineStatus: "sourced",
      })
      .onConflictDoUpdate({
        target: [candidateJobMatches.candidateId, candidateJobMatches.jobId],
        set: {
          score: sql`excluded.score`,
          explanation: sql`excluded.explanation`,
          updatedAt: new Date(),
        },
      });
  }

  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "internal_search.ran",
    recordType: "job",
    recordId: input.jobId,
    after: { matchCount: scored.length },
  });

  return { matchCount: scored.length };
}

export async function completeInternalSearch(input: {
  organizationId: string;
  actorUserId: string;
  searchProjectId: string;
  jobId: string;
}) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(searchProjects)
    .where(eq(searchProjects.id, input.searchProjectId))
    .limit(1);
  if (!before || before.jobId !== input.jobId) {
    throw new Error("Internal search project not found");
  }
  const [after] = await db
    .update(searchProjects)
    .set({ internalSearchCompletedAt: new Date(), updatedAt: new Date() })
    .where(eq(searchProjects.id, input.searchProjectId))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "internal_search.completed",
    recordType: "search_project",
    recordId: after.id,
    before,
    after,
  });
  return after;
}

export async function updateMatchPipelineStatus(input: {
  organizationId: string;
  actorUserId: string;
  matchId: string;
  jobId: string;
  pipelineStatus: typeof candidateJobMatches.$inferInsert.pipelineStatus;
}) {
  const db = getDb();
  const [before] = await db
    .select()
    .from(candidateJobMatches)
    .where(and(eq(candidateJobMatches.id, input.matchId), eq(candidateJobMatches.jobId, input.jobId)))
    .limit(1);
  if (!before) throw new Error("Match not found");
  const [after] = await db
    .update(candidateJobMatches)
    .set({ pipelineStatus: input.pipelineStatus, updatedAt: new Date() })
    .where(eq(candidateJobMatches.id, input.matchId))
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "candidate_job_match.updated",
    recordType: "candidate_job_match",
    recordId: after.id,
    before,
    after,
  });
  return after;
}
