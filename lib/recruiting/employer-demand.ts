import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import { careerSources, companies, jobs } from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { evaluateSourceAccess } from "../integrations/career-sources/policy";
import type { JobContextType } from "../hiring/stages";

export type CareerSourceType = (typeof careerSources.$inferInsert)["sourceType"];
export type JobDemandHorizon = (typeof jobs.$inferInsert)["demandHorizon"];

export class EmployerDemandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmployerDemandError";
  }
}

const DEMAND_CONTEXTS = new Set<JobContextType>([
  "internal",
  "client",
  "skillbridge",
  "monitored_public",
  "exploratory",
]);

export async function createCareerSource(input: {
  organizationId: string;
  actorUserId: string;
  companyId: string;
  sourceType: CareerSourceType;
  name: string;
  baseUrl?: string | null;
  careersUrl?: string | null;
  adapterKey?: string | null;
  active?: boolean;
}) {
  const db = getDb();
  const company = await companyInOrg(input.organizationId, input.companyId);
  if (!company) throw new EmployerDemandError("Company is not in this organization.");
  const access = evaluateSourceAccess({
    sourceType: input.sourceType,
    adapterKey: input.adapterKey,
    careersUrl: input.careersUrl,
    baseUrl: input.baseUrl,
  }, "test");
  if (input.sourceType === "employer_api" && access.state !== "supported_structured") {
    throw new EmployerDemandError(access.reason);
  }
  const blocked = access.state === "blocked";
  const [source] = await db
    .insert(careerSources)
    .values({
      organizationId: input.organizationId,
      companyId: input.companyId,
      sourceType: input.sourceType,
      name: input.name,
      baseUrl: input.baseUrl ?? null,
      careersUrl: input.careersUrl ?? null,
      adapterKey: input.adapterKey ?? null,
      active: input.active ?? true,
      healthStatus: blocked ? "blocked" : "not_yet_synced",
      lastError: blocked ? access.reason : null,
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "career_source.created",
    recordType: "career_source",
    recordId: source.id,
    after: { id: source.id, companyId: source.companyId, sourceType: source.sourceType, name: source.name },
  });
  return source;
}

/**
 * Insert employer demand on `jobs`.
 * Does not create a candidate, requisition, search project, or CRM opportunity.
 * Callers authorize with jobs.read / jobs.write. This does not grant opportunities.read.
 * Duplicate (career_source_id, external_key) is rejected. Manual jobs omit both.
 */
export async function createEmployerDemandJob(input: {
  organizationId: string;
  actorUserId: string;
  title: string;
  jobContextType: JobContextType;
  companyId?: string | null;
  demandHorizon?: JobDemandHorizon;
  careerSourceId?: string | null;
  externalKey?: string | null;
  sourceUrl?: string | null;
  contentHash?: string | null;
  description?: string | null;
  skillbridgeEligible?: boolean;
  status?: (typeof jobs.$inferInsert)["status"];
}) {
  if (!DEMAND_CONTEXTS.has(input.jobContextType)) {
    throw new EmployerDemandError("Job context is not a known employer-demand context.");
  }
  const careerSourceId = emptyToNull(input.careerSourceId);
  const externalKey = emptyToNull(input.externalKey);
  const sourceUrl = emptyToNull(input.sourceUrl);
  const companyId = emptyToNull(input.companyId);

  if (input.jobContextType === "monitored_public") {
    if (!companyId || !careerSourceId || !externalKey || !sourceUrl) {
      throw new EmployerDemandError(
        "A monitored public job needs an employer, career source, external key, and source URL.",
      );
    }
  }
  if (careerSourceId && !externalKey) {
    throw new EmployerDemandError("An externally sourced job needs an external key.");
  }
  if (!careerSourceId && externalKey) {
    throw new EmployerDemandError("An external key requires a career source.");
  }

  const db = getDb();
  if (companyId) {
    const company = await companyInOrg(input.organizationId, companyId);
    if (!company) throw new EmployerDemandError("Company is not in this organization.");
  }
  if (careerSourceId) {
    const [source] = await db
      .select()
      .from(careerSources)
      .where(
        and(
          eq(careerSources.id, careerSourceId),
          eq(careerSources.organizationId, input.organizationId),
          isNull(careerSources.archivedAt),
        ),
      )
      .limit(1);
    if (!source) throw new EmployerDemandError("Career source is not in this organization.");
    if (companyId && source.companyId !== companyId) {
      throw new EmployerDemandError("Career source belongs to a different employer.");
    }
  }

  const inserted = await db
    .insert(jobs)
    .values({
      organizationId: input.organizationId,
      companyId,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "open",
      jobContextType: input.jobContextType,
      demandHorizon: input.demandHorizon ?? "current",
      careerSourceId,
      externalKey,
      sourceUrl,
      contentHash: emptyToNull(input.contentHash),
      skillbridgeEligible: input.skillbridgeEligible ?? false,
      searchOwnerUserId: input.actorUserId,
      lastActivityAt: new Date(),
    })
    .onConflictDoNothing({ target: [jobs.careerSourceId, jobs.externalKey] })
    .returning();

  const job = inserted[0];
  if (!job) {
    throw new EmployerDemandError("This career source already has a job with that external key.");
  }

  await recordAuditEvent({
    organizationId: input.organizationId,
    actor: { type: "human", userId: input.actorUserId },
    action: "job.created",
    recordType: "job",
    recordId: job.id,
    after: {
      id: job.id,
      title: job.title,
      jobContextType: job.jobContextType,
      demandHorizon: job.demandHorizon,
      careerSourceId: job.careerSourceId,
      companyId: job.companyId,
    },
  });
  return job;
}

function emptyToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function companyInOrg(organizationId: string, companyId: string) {
  const db = getDb();
  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.organizationId, organizationId), isNull(companies.archivedAt)))
    .limit(1);
  return company ?? null;
}
