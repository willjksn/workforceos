import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { getDb } from "../../db";
import { careerSourceSyncRuns, careerSources, companies, jobDescriptionVersions, jobs } from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { canonicalHttpUrl, descriptionSnapshot } from "../integrations/career-sources/content-hash";
import { parseJobCsv } from "../integrations/career-sources/csv";
import { extractPublicJobPage, greenhouseAdapter } from "../integrations/career-sources/greenhouse";
import { careerSourceHealth } from "../integrations/career-sources/health";
import { evaluateSourceAccess } from "../integrations/career-sources/policy";
import { planSourceSync, type SyncPlanItem } from "../integrations/career-sources/plan";
import { originAllowsFetch, safeFetch } from "../integrations/career-sources/safe-fetch";
import type { CareerSourceHealthState, DiscoveryDeps, NormalizedEmployerJob } from "../integrations/career-sources/types";

export class OpportunityDiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpportunityDiscoveryError";
  }
}

export type DiscoveryRunResult = {
  outcome: "succeeded" | "failed" | "refused";
  health: CareerSourceHealthState;
  newCount: number;
  changedCount: number;
  unchangedCount: number;
  closedCount: number;
  errorCount: number;
  discoveredCount: number;
  message: string;
};

const ZERO = {
  newCount: 0,
  changedCount: 0,
  unchangedCount: 0,
  closedCount: 0,
  errorCount: 0,
  discoveredCount: 0,
};

/**
 * Callers authorize with jobs.write. This does not read talent records or match scores.
 * A failed or refused run does not close jobs.
 */
export async function syncCareerSource(input: {
  organizationId: string;
  actorUserId: string | null;
  careerSourceId: string;
  trigger: "manual" | "schedule";
  deps?: DiscoveryDeps;
}): Promise<DiscoveryRunResult> {
  const source = await loadSource(input.organizationId, input.careerSourceId);
  if (!source.active) throw new OpportunityDiscoveryError("Career source is inactive.");
  const access = evaluateSourceAccess(source, "sync");
  if (!access.allowed) {
    const blocked = access.state === "blocked";
    if (blocked) {
      await markSource(source, { blocked: true, failed: false, lastError: access.reason, success: false });
    }
    await insertRun(source, input, "refused", { ...ZERO, error: access.reason, listingComplete: false });
    return result("refused", blocked ? "blocked" : source.healthStatus, ZERO, access.reason);
  }

  let discovered;
  try {
    discovered = await greenhouseAdapter.discover(source, input.deps);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Career source sync failed.";
    await markSource(source, { failed: true, blocked: false, lastError: message, success: false });
    await insertRun(source, input, "failed", { ...ZERO, error: message, listingComplete: false });
    await auditSync(source, input.actorUserId, "career_source.sync_failed", { message });
    return result("failed", "error", ZERO, message);
  }
  if (!discovered.ok) {
    const blocked = discovered.blocked;
    const message = discovered.error ?? "Career source sync failed. Existing jobs were not closed.";
    await markSource(source, { failed: !blocked, blocked, lastError: message, success: false });
    await insertRun(source, input, "failed", { ...ZERO, error: message, listingComplete: false });
    await auditSync(source, input.actorUserId, "career_source.sync_failed", { message });
    return result("failed", blocked ? "blocked" : "error", ZERO, message);
  }

  const counts = await applyDiscoveredJobs({
    source,
    actorUserId: input.actorUserId,
    jobs: discovered.jobs,
    listingComplete: discovered.complete,
    closeMissing: discovered.complete,
    extraErrors: discovered.errors.length,
  });
  const truncated = !discovered.complete;
  const message = truncated
    ? discovered.error ?? "The listing was truncated. Missing jobs were not closed."
    : `Sync stored ${counts.newCount} new, ${counts.changedCount} changed, ${counts.unchangedCount} unchanged, ${counts.closedCount} closed.`;
  const health = careerSourceHealth({
    sourceType: source.sourceType,
    adapterKey: source.adapterKey,
    lastSuccessfulSyncAt: truncated ? null : new Date(),
    failed: truncated,
    blocked: false,
  });
  await markSource(source, {
    failed: truncated,
    blocked: false,
    lastError: truncated ? message : null,
    success: !truncated,
    discoveredCount: discovered.discoveredCount,
  });
  await insertRun(source, input, truncated ? "failed" : "succeeded", {
    ...counts,
    discoveredCount: discovered.discoveredCount,
    error: truncated ? message : null,
    listingComplete: discovered.complete,
  });
  await auditSync(source, input.actorUserId, truncated ? "career_source.sync_failed" : "career_source.sync_completed", {
    ...counts,
    discoveredCount: discovered.discoveredCount,
  });
  return result(truncated ? "failed" : "succeeded", health, { ...counts, discoveredCount: discovered.discoveredCount }, message);
}

export async function importManualJob(input: {
  organizationId: string;
  actorUserId: string;
  careerSourceId: string;
  job: NormalizedEmployerJob;
}) {
  const source = await loadSource(input.organizationId, input.careerSourceId);
  if (source.sourceType !== "manual_url" && source.sourceType !== "public_careers_page") {
    throw new OpportunityDiscoveryError("Manual URL import is only for a manual URL or public careers page source.");
  }
  const job = { ...input.job, sourceUrl: canonicalHttpUrl(input.job.sourceUrl), explicitlyClosed: false };
  if (!job.title.trim() || !job.externalKey.trim()) {
    throw new OpportunityDiscoveryError("Title and external key are required.");
  }
  const counts = await applyDiscoveredJobs({
    source,
    actorUserId: input.actorUserId,
    jobs: [job],
    listingComplete: false,
    closeMissing: false,
    extraErrors: 0,
  });
  if (counts.errorCount && !counts.newCount && !counts.changedCount && !counts.unchangedCount) {
    await markSource(source, { failed: true, blocked: false, lastError: "Manual import failed.", success: false });
    return result("failed", "error", counts, "Manual import failed.");
  }
  await markSource(source, { failed: false, blocked: false, lastError: null, success: true, discoveredCount: 1 });
  await insertRun(source, { ...input, trigger: "manual" }, "succeeded", { ...counts, listingComplete: false, error: null });
  await auditSync(source, input.actorUserId, "career_source.sync_completed", counts);
  const health = careerSourceHealth({
    sourceType: source.sourceType,
    adapterKey: source.adapterKey,
    lastSuccessfulSyncAt: new Date(),
    failed: false,
  });
  return result("succeeded", health, counts, "Job saved on this career source. Matching is available after M5.");
}

export async function importCsvJobs(input: {
  organizationId: string;
  actorUserId: string;
  careerSourceId: string;
  csvText: string;
}) {
  const source = await loadSource(input.organizationId, input.careerSourceId);
  const access = evaluateSourceAccess(source, "csv");
  if (!access.allowed) throw new OpportunityDiscoveryError(access.reason);
  const company = await companyName(input.organizationId, source.companyId);
  const parsed = parseJobCsv(input.csvText, company);
  if (!parsed.jobs.length) {
    const message = parsed.errors[0]?.message ?? "CSV had no valid rows.";
    await markSource(source, { failed: true, blocked: false, lastError: message, success: false });
    await insertRun(source, { ...input, trigger: "manual" }, "failed", { ...ZERO, errorCount: parsed.errors.length, error: message, listingComplete: false });
    return result("failed", "error", { ...ZERO, errorCount: parsed.errors.length }, message);
  }
  const counts = await applyDiscoveredJobs({
    source,
    actorUserId: input.actorUserId,
    jobs: parsed.jobs,
    listingComplete: false,
    closeMissing: false,
    extraErrors: parsed.errors.length,
  });
  const message = parsed.errors.length
    ? `Imported ${counts.newCount + counts.changedCount + counts.unchangedCount} rows. ${parsed.errors.length} rows need a fix.`
    : `CSV stored ${counts.newCount} new, ${counts.changedCount} changed, ${counts.unchangedCount} unchanged, ${counts.closedCount} closed.`;
  await markSource(source, {
    failed: false,
    blocked: false,
    lastError: parsed.errors.length ? message : null,
    success: true,
    discoveredCount: parsed.jobs.length,
  });
  await insertRun(source, { ...input, trigger: "manual" }, "succeeded", {
    ...counts,
    error: parsed.errors.length ? message : null,
    listingComplete: false,
  });
  await auditSync(source, input.actorUserId, "career_source.sync_completed", counts);
  return result("succeeded", "manual", counts, message);
}

export async function previewPublicJob(input: {
  organizationId: string;
  careerSourceId: string;
  url: string;
  deps?: DiscoveryDeps;
}) {
  const source = await loadSource(input.organizationId, input.careerSourceId);
  const access = evaluateSourceAccess(source, "fetch_one", input.url);
  if (!access.allowed) return { fetched: false, reason: access.reason, job: null as NormalizedEmployerJob | null };
  let pageUrl: URL;
  try {
    pageUrl = new URL(canonicalHttpUrl(input.url));
  } catch (error) {
    return { fetched: false, reason: error instanceof Error ? error.message : "URL is invalid.", job: null };
  }
  const robots = await originAllowsFetch(pageUrl, input.deps ?? {});
  if (!robots.allowed) return { fetched: false, reason: robots.reason ?? "Automated fetch stopped.", job: null };
  try {
    const response = await safeFetch(pageUrl.href, input.deps);
    if (response.status >= 400) {
      return { fetched: false, reason: `The page returned HTTP ${response.status}. Enter the fields manually.`, job: null };
    }
    return { fetched: true, reason: null as string | null, job: extractPublicJobPage(response.body, response.url) };
  } catch (error) {
    return {
      fetched: false,
      reason: error instanceof Error ? `${error.message} Enter the fields manually.` : "Enter the fields manually.",
      job: null,
    };
  }
}

export async function testCareerSource(input: {
  organizationId: string;
  actorUserId: string;
  careerSourceId: string;
  deps?: DiscoveryDeps;
}) {
  const source = await loadSource(input.organizationId, input.careerSourceId);
  if (!source.active) throw new OpportunityDiscoveryError("Career source is inactive.");
  const access = evaluateSourceAccess(source, "test");
  if (access.state === "blocked" || access.state === "error") {
    await markSource(source, {
      blocked: access.state === "blocked",
      failed: access.state === "error",
      lastError: access.reason,
      success: false,
    });
    return { health: access.state === "blocked" ? "blocked" as const : "error" as const, message: access.reason };
  }
  if (access.state !== "supported_structured") {
    const health = careerSourceHealth({
      sourceType: source.sourceType,
      adapterKey: source.adapterKey,
      lastSuccessfulSyncAt: source.lastSuccessfulSyncAt,
      failed: false,
    });
    await markSource(source, { failed: false, blocked: false, lastError: null, success: false });
    return { health, message: access.reason };
  }
  const checked = await greenhouseAdapter.healthCheck(source, input.deps);
  if (!checked.ok) {
    await markSource(source, { failed: !checked.blocked, blocked: checked.blocked, lastError: checked.message, success: false });
    return { health: checked.blocked ? "blocked" as const : "error" as const, message: checked.message };
  }
  const health = careerSourceHealth({
    sourceType: source.sourceType,
    adapterKey: source.adapterKey,
    lastSuccessfulSyncAt: source.lastSuccessfulSyncAt,
    failed: false,
  });
  await markSource(source, { failed: false, blocked: false, lastError: null, success: false });
  return { health, message: checked.message };
}

export async function listCompanyCareerSources(organizationId: string, companyId: string) {
  const db = getDb();
  const sources = await db
    .select()
    .from(careerSources)
    .where(and(eq(careerSources.organizationId, organizationId), eq(careerSources.companyId, companyId), isNull(careerSources.archivedAt)))
    .orderBy(desc(careerSources.createdAt));
  if (!sources.length) return [];
  const runs = await db
    .select()
    .from(careerSourceSyncRuns)
    .where(and(
      eq(careerSourceSyncRuns.organizationId, organizationId),
      inArray(careerSourceSyncRuns.careerSourceId, sources.map((source) => source.id)),
      isNull(careerSourceSyncRuns.archivedAt),
    ))
    .orderBy(desc(careerSourceSyncRuns.startedAt));
  return sources.map((source) => ({
    source,
    latestRun: runs.find((run) => run.careerSourceId === source.id) ?? null,
  }));
}

export async function discoveryMetrics(organizationId: string) {
  const db = getDb();
  const sources = await db
    .select()
    .from(careerSources)
    .where(and(eq(careerSources.organizationId, organizationId), isNull(careerSources.archivedAt)));
  const active = sources.filter((source) => source.active);
  const [jobCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(eq(jobs.organizationId, organizationId), isNotNull(jobs.careerSourceId), isNull(jobs.archivedAt)));
  const runs = await db
    .select()
    .from(careerSourceSyncRuns)
    .where(and(eq(careerSourceSyncRuns.organizationId, organizationId), eq(careerSourceSyncRuns.status, "succeeded"), isNull(careerSourceSyncRuns.archivedAt)))
    .orderBy(desc(careerSourceSyncRuns.startedAt));
  const latest = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (!latest.has(run.careerSourceId)) latest.set(run.careerSourceId, run);
  }
  let newCount = 0;
  let changedCount = 0;
  let closedCount = 0;
  for (const run of latest.values()) {
    newCount += run.newCount;
    changedCount += run.changedCount;
    closedCount += run.closedCount;
  }
  return {
    employersMonitored: new Set(active.map((source) => source.companyId)).size,
    activeSources: active.length,
    jobsDiscovered: Number(jobCount?.count ?? 0),
    newCount,
    changedCount,
    closedCount,
    sourceErrors: sources.filter((source) => source.healthStatus === "error" || source.healthStatus === "blocked").length,
  };
}

export async function runScheduledCareerSourceSyncs(deps?: DiscoveryDeps & { limit?: number; delayMs?: number }) {
  const db = getDb();
  const sources = await db
    .select({ id: careerSources.id, organizationId: careerSources.organizationId })
    .from(careerSources)
    .where(and(
      eq(careerSources.active, true),
      eq(careerSources.sourceType, "employer_api"),
      eq(careerSources.adapterKey, "greenhouse_public_board"),
      sql`${careerSources.healthStatus} <> 'blocked'`,
      isNull(careerSources.archivedAt),
    ))
    .limit(deps?.limit ?? 25);
  const results: DiscoveryRunResult[] = [];
  for (const source of sources) {
    results.push(await syncCareerSource({
      organizationId: source.organizationId,
      actorUserId: null,
      careerSourceId: source.id,
      trigger: "schedule",
      deps,
    }));
    const delay = deps?.delayMs ?? 1000;
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return results;
}

async function applyDiscoveredJobs(input: {
  source: Awaited<ReturnType<typeof loadSource>>;
  actorUserId: string | null;
  jobs: NormalizedEmployerJob[];
  listingComplete: boolean;
  closeMissing: boolean;
  extraErrors: number;
}) {
  const db = getDb();
  const existing = await db
    .select({
      id: jobs.id,
      externalKey: jobs.externalKey,
      contentHash: jobs.contentHash,
      status: jobs.status,
    })
    .from(jobs)
    .where(and(eq(jobs.organizationId, input.source.organizationId), eq(jobs.careerSourceId, input.source.id), isNull(jobs.archivedAt)));
  const stored = existing.flatMap((row) => row.externalKey ? [{ ...row, externalKey: row.externalKey }] : []);
  const plan = planSourceSync({
    existing: stored,
    discovered: input.jobs,
    syncSucceeded: true,
    listingComplete: input.listingComplete,
    closeMissing: input.closeMissing,
  });
  const byKey = new Map(stored.map((row) => [row.externalKey, row]));
  const counts = { ...ZERO, errorCount: input.extraErrors + plan.filter((item) => item.action === "error").length };
  for (const item of plan) {
    if (item.action === "error") continue;
    if (item.action === "create") {
      const id = await insertJob(input.source, input.actorUserId, item);
      if (!id) {
        counts.errorCount += 1;
        continue;
      }
      counts.newCount += 1;
      await auditJob(input.source, input.actorUserId, id, "job.discovered", item.job.externalKey);
      continue;
    }
    const current = item.action === "close" ? byKey.get(item.externalKey) : byKey.get(item.job.externalKey);
    if (!current) {
      counts.errorCount += 1;
      continue;
    }
    if (item.action === "unchanged") {
      await db.update(jobs).set({ lastObservedAt: new Date(), updatedAt: new Date() }).where(and(eq(jobs.id, current.id), eq(jobs.organizationId, input.source.organizationId)));
      counts.unchangedCount += 1;
      continue;
    }
    if (item.action === "close") {
      await db.update(jobs).set({
        status: "closed",
        closedAt: new Date(),
        lastObservedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(jobs.id, current.id), eq(jobs.organizationId, input.source.organizationId)));
      counts.closedCount += 1;
      await auditJob(input.source, input.actorUserId, current.id, "job.source_closed", item.externalKey);
      continue;
    }
    if (item.action === "reopen") {
      await db.update(jobs).set({
        status: "open",
        closedAt: null,
        lastObservedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(jobs.id, current.id), eq(jobs.organizationId, input.source.organizationId)));
      counts.changedCount += 1;
      await auditJob(input.source, input.actorUserId, current.id, "job.source_updated", item.job.externalKey);
      continue;
    }
    await updateChangedJob(input.source.organizationId, input.actorUserId, current, item);
    counts.changedCount += 1;
    await auditJob(input.source, input.actorUserId, current.id, "job.source_updated", item.job.externalKey);
  }
  counts.discoveredCount = input.jobs.length;
  return counts;
}

async function insertJob(
  source: Awaited<ReturnType<typeof loadSource>>,
  actorUserId: string | null,
  item: Extract<SyncPlanItem, { action: "create" }>,
) {
  const db = getDb();
  const now = new Date();
  const closed = Boolean(item.job.explicitlyClosed);
  const inserted = await db.insert(jobs).values({
    organizationId: source.organizationId,
    companyId: source.companyId,
    title: item.job.title,
    description: item.job.description,
    locationLabel: item.job.location,
    department: item.job.department,
    employmentType: item.job.employmentType,
    workplaceType: item.job.workplaceType,
    publicCompensationText: item.job.publicSalaryText,
    compensationMin: item.job.compensationMin,
    compensationMax: item.job.compensationMax,
    certifications: item.job.certifications,
    education: item.job.education,
    status: closed ? "closed" : "open",
    closedAt: closed ? now : null,
    jobContextType: "monitored_public",
    demandHorizon: "current",
    careerSourceId: source.id,
    externalKey: item.job.externalKey,
    sourceUrl: item.job.sourceUrl,
    contentHash: item.contentHash,
    lastObservedAt: now,
    lastActivityAt: now,
    skillbridgeEligible: false,
    searchOwnerUserId: actorUserId,
  }).onConflictDoNothing({ target: [jobs.careerSourceId, jobs.externalKey] }).returning({ id: jobs.id });
  const id = inserted[0]?.id;
  if (!id) return null;
  await insertVersion(id, actorUserId, item.job, item.contentHash, 1);
  return id;
}

async function updateChangedJob(
  organizationId: string,
  actorUserId: string | null,
  current: { id: string; status: string },
  item: Extract<SyncPlanItem, { action: "change" }>,
) {
  const db = getDb();
  const now = new Date();
  const protectedStatus = current.status === "filled" || current.status === "cancelled" || current.status === "on_hold" || current.status === "draft";
  const statusPatch = item.job.explicitlyClosed
    ? { status: "closed" as const, closedAt: now }
    : !protectedStatus && current.status === "closed"
      ? { status: "open" as const, closedAt: null }
      : {};
  await db.update(jobs).set({
    title: item.job.title,
    description: item.job.description,
    locationLabel: item.job.location,
    department: item.job.department,
    employmentType: item.job.employmentType,
    workplaceType: item.job.workplaceType,
    publicCompensationText: item.job.publicSalaryText,
    compensationMin: item.job.compensationMin,
    compensationMax: item.job.compensationMax,
    certifications: item.job.certifications,
    education: item.job.education,
    sourceUrl: item.job.sourceUrl,
    contentHash: item.contentHash,
    lastObservedAt: now,
    lastActivityAt: now,
    updatedAt: now,
    ...statusPatch,
  }).where(and(eq(jobs.id, current.id), eq(jobs.organizationId, organizationId)));
  const [latest] = await db
    .select({ version: jobDescriptionVersions.version })
    .from(jobDescriptionVersions)
    .where(eq(jobDescriptionVersions.jobId, current.id))
    .orderBy(desc(jobDescriptionVersions.version))
    .limit(1);
  await insertVersion(current.id, actorUserId, item.job, item.contentHash, (latest?.version ?? 0) + 1);
}

async function insertVersion(jobId: string, actorUserId: string | null, job: NormalizedEmployerJob, contentHash: string, version: number) {
  const db = getDb();
  await db.insert(jobDescriptionVersions).values({
    jobId,
    version,
    content: descriptionSnapshot(job),
    contentHash,
    sourceUrl: job.sourceUrl,
    externalKey: job.externalKey,
    createdByUserId: actorUserId,
    aiGenerated: false,
    status: "source_recorded",
  });
}

async function loadSource(organizationId: string, careerSourceId: string) {
  const db = getDb();
  const [source] = await db
    .select()
    .from(careerSources)
    .where(and(eq(careerSources.id, careerSourceId), eq(careerSources.organizationId, organizationId), isNull(careerSources.archivedAt)))
    .limit(1);
  if (!source) throw new OpportunityDiscoveryError("Career source is not in this organization.");
  return source;
}

async function companyName(organizationId: string, companyId: string) {
  const db = getDb();
  const [company] = await db
    .select({ name: companies.name })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.organizationId, organizationId), isNull(companies.archivedAt)))
    .limit(1);
  if (!company) throw new OpportunityDiscoveryError("Company is not in this organization.");
  return company.name;
}

async function markSource(
  source: Awaited<ReturnType<typeof loadSource>>,
  input: { failed: boolean; blocked: boolean; lastError: string | null; success: boolean; discoveredCount?: number },
) {
  const db = getDb();
  const successAt = input.success ? new Date() : source.lastSuccessfulSyncAt;
  const health = careerSourceHealth({
    sourceType: source.sourceType,
    adapterKey: source.adapterKey,
    lastSuccessfulSyncAt: input.success ? new Date() : input.failed || input.blocked ? null : source.lastSuccessfulSyncAt,
    failed: input.failed,
    blocked: input.blocked,
  });
  await db.update(careerSources).set({
    healthStatus: health,
    lastAttemptAt: new Date(),
    lastError: input.lastError,
    lastSuccessfulSyncAt: successAt,
    lastDiscoveredCount: input.discoveredCount ?? source.lastDiscoveredCount,
    updatedAt: new Date(),
  }).where(and(eq(careerSources.id, source.id), eq(careerSources.organizationId, source.organizationId)));
}

async function insertRun(
  source: Awaited<ReturnType<typeof loadSource>>,
  input: { actorUserId: string | null; trigger: "manual" | "schedule" },
  status: "succeeded" | "failed" | "refused",
  counts: typeof ZERO & { error?: string | null; listingComplete: boolean },
) {
  const db = getDb();
  const now = new Date();
  await db.insert(careerSourceSyncRuns).values({
    organizationId: source.organizationId,
    careerSourceId: source.id,
    status,
    trigger: input.trigger,
    listingComplete: counts.listingComplete,
    discoveredCount: counts.discoveredCount,
    newCount: counts.newCount,
    changedCount: counts.changedCount,
    unchangedCount: counts.unchangedCount,
    closedCount: counts.closedCount,
    errorCount: counts.errorCount,
    error: counts.error ?? null,
    actorUserId: input.actorUserId,
    startedAt: now,
    finishedAt: now,
  });
}

function result(
  outcome: DiscoveryRunResult["outcome"],
  health: CareerSourceHealthState,
  counts: Omit<typeof ZERO, never>,
  message: string,
): DiscoveryRunResult {
  return { outcome, health, message, ...counts };
}

async function auditSync(
  source: Awaited<ReturnType<typeof loadSource>>,
  actorUserId: string | null,
  action: string,
  after: unknown,
) {
  await recordAuditEvent({
    organizationId: source.organizationId,
    actor: actorUserId ? { type: "human", userId: actorUserId } : { type: "system" },
    action,
    recordType: "career_source",
    recordId: source.id,
    after,
  });
}

async function auditJob(
  source: Awaited<ReturnType<typeof loadSource>>,
  actorUserId: string | null,
  jobId: string,
  action: string,
  externalKey: string,
) {
  await recordAuditEvent({
    organizationId: source.organizationId,
    actor: actorUserId ? { type: "human", userId: actorUserId } : { type: "system" },
    action,
    recordType: "job",
    recordId: jobId,
    after: { careerSourceId: source.id, externalKey },
  });
}
