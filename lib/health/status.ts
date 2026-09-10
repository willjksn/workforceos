import { and, count, eq, gte, sql } from "drizzle-orm";

import { createDb, getDb } from "../../db";
import { agentRuns, integrationEvents, transactionalEmailEvents } from "../../db/schema";
import {
  areBusinessCapabilityModelsConfigured,
  describeAiRuntime,
} from "../ai/capabilities";
import { formatAiEvidence, loadLastAiFallbackEvidence, loadLastLiveAiEvidence } from "../ai/health-probe";
import { SEED_VERSION } from "../../db/seed/constants";
import { getServerEnv, isClerkConfigured, isInngestConfigured } from "../env";
import { getIntegrationHubStatus } from "../integrations/hub";
import { calendarProviderStatus } from "../calendar";
import {
  apolloWiringStatus,
  calendarWiringStatus,
  checkrWiringStatus,
  docusignWiringStatus,
  isBlsConfigured,
  isCensusConfigured,
  isResendConfigured,
  quickbooksWiringStatus,
  resendWiringStatus,
  seekoutWiringStatus,
  sentryWiringStatus,
} from "../integrations/credentials";
import { drugScreenProviderStatus } from "../drug-screens";
import { getPublicContentPayload } from "../public-content/service";
import { getStorageStatus } from "../storage";
import {
  formatIntegrationSummary,
  healthCheck,
  summarizeIntegrationStatuses,
  type HealthCheck,
  type HealthStatus,
  type IntegrationHonestySummary,
} from "./taxonomy";

async function probe<T>(fn: () => Promise<T>) {
  try {
    return { ok: true as const, value: await fn() };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
  }
}

function openaiStatus(input: {
  liveConfigured: boolean;
  classesConfigured: boolean;
  lastLive: boolean;
}): HealthStatus {
  if (!input.liveConfigured) return "HEURISTIC";
  if (!input.classesConfigured) return "DEGRADED";
  if (!input.lastLive) return "CONFIGURED";
  return "LIVE";
}

function geminiStatus(input: { enabled: boolean; configured: boolean; lastFallback: boolean }): HealthStatus {
  if (!input.enabled) return "DEFERRED";
  if (!input.configured) return "NOT_CONFIGURED";
  if (!input.lastFallback) return "CONFIGURED";
  return "LIVE";
}

export async function getSystemHealth() {
  const env = getServerEnv();
  const database = await probe(async () => {
    const db = createDb();
    await db.execute(sql`select 1 as ok`);
    return true;
  });
  const extensions = await probe(async () => {
    const db = createDb();
    const result = await db.execute<{ extname: string }>(
      sql`select extname from pg_extension where extname in ('vector', 'pg_trgm')`,
    );
    const names = (result.rows ?? []).map((row) => row.extname);
    return { vector: names.includes("vector"), trigram: names.includes("pg_trgm") };
  });
  const migrations = await probe(async () => {
    const db = createDb();
    const result = await db.execute<{ hash: string }>(sql`select hash from drizzle.__drizzle_migrations order by created_at`);
    return (result.rows ?? []).map((row) => row.hash);
  });
  const storage = await getStorageStatus();
  const integrations = await getIntegrationHubStatus();
  const clerkOk = isClerkConfigured();
  const clerkPublishableKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const clerkIsLive = clerkPublishableKey.startsWith("pk_live_");
  const clerkIsTest = clerkPublishableKey.startsWith("pk_test_");
  const productionRuntime = env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  const clerkProductionOk = clerkOk && (!productionRuntime || clerkIsLive);
  const content = await probe(async () => {
    await getPublicContentPayload();
    return true;
  });
  const jobsOk = isInngestConfigured();
  const searchOk = extensions.ok && extensions.value.vector && extensions.value.trigram;
  const aiRuntime = describeAiRuntime(env);
  const classesConfigured = areBusinessCapabilityModelsConfigured(env);
  let lastLive: Awaited<ReturnType<typeof loadLastLiveAiEvidence>> = null;
  let lastFallback: Awaited<ReturnType<typeof loadLastAiFallbackEvidence>> = null;
  try {
    lastLive = await loadLastLiveAiEvidence();
  } catch {
    lastLive = null;
  }
  try {
    lastFallback = await loadLastAiFallbackEvidence();
  } catch {
    lastFallback = null;
  }
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let queueFailures = 0;
  try {
    const db = getDb();
    const failedRuns = await db
      .select()
      .from(agentRuns)
      .where(and(eq(agentRuns.status, "failed"), gte(agentRuns.createdAt, dayAgo)));
    const failedSyncs = await db
      .select()
      .from(integrationEvents)
      .where(and(eq(integrationEvents.status, "failed"), gte(integrationEvents.createdAt, dayAgo)));
    queueFailures = failedRuns.length + failedSyncs.length;
  } catch {
    queueFailures = 0;
  }
  let resendSent = false;
  try {
    const db = getDb();
    const [row] = await db
      .select({ value: count() })
      .from(transactionalEmailEvents)
      .where(and(eq(transactionalEmailEvents.provider, "resend"), eq(transactionalEmailEvents.status, "sent")));
    resendSent = Number(row?.value ?? 0) > 0;
  } catch {
    resendSent = false;
  }

  const calendar = calendarWiringStatus();
  const docusign = docusignWiringStatus();
  const quickbooks = quickbooksWiringStatus();
  const seekout = seekoutWiringStatus();
  const apollo = apolloWiringStatus();
  const checkr = checkrWiringStatus();
  const sentry = sentryWiringStatus();
  const resend = resendWiringStatus();

  const openai = openaiStatus({
    liveConfigured: aiRuntime.providerConfigured,
    classesConfigured,
    lastLive: Boolean(lastLive),
  });
  const gemini = geminiStatus({
    enabled: !aiRuntime.fallbackDeferred,
    configured: aiRuntime.fallbackConfigured,
    lastFallback: Boolean(lastFallback && lastFallback.provider === "gemini"),
  });
  const resendStatus: HealthStatus = !resend.configured ? "NOT_CONFIGURED" : resendSent ? "LIVE" : "CONFIGURED";
  const calendarStatus: HealthStatus = calendar.liveWired
    ? "CONFIGURED"
    : calendar.configured
      ? "CONFIGURED"
      : "MOCK";
  const sentryStatus: HealthStatus = sentry.configured ? "CONFIGURED" : "NOT_CONFIGURED";
  const laborStatus: HealthStatus = isBlsConfigured() || isCensusConfigured() ? "CONFIGURED" : "MOCK";
  const seekoutStatus: HealthStatus = seekout.liveWired ? "LIVE" : seekout.configured ? "CONFIGURED" : "NOT_CONFIGURED";
  const apolloStatus: HealthStatus = apollo.liveWired ? "LIVE" : apollo.configured ? "CONFIGURED" : "NOT_CONFIGURED";
  const docusignStatus: HealthStatus = docusign.liveWired
    ? "CONFIGURED"
    : docusign.configured
      ? "CONFIGURED"
      : "NOT_CONFIGURED";
  const quickbooksStatus: HealthStatus = quickbooks.liveWired
    ? "CONFIGURED"
    : quickbooks.configured
      ? "CONFIGURED"
      : "NOT_CONFIGURED";
  const checkrStatus: HealthStatus = checkr.liveWired ? "CONFIGURED" : "MANUAL";
  const drugStatus: HealthStatus = "MANUAL";
  const embeddingsStatus: HealthStatus = "DEVELOPMENT";

  const integrationSummary: IntegrationHonestySummary = summarizeIntegrationStatuses([
    openai,
    gemini,
    sentryStatus,
    laborStatus,
    seekoutStatus,
    apolloStatus,
    docusignStatus,
    quickbooksStatus,
    calendarStatus,
    checkrStatus,
    drugStatus,
    resendStatus,
    embeddingsStatus,
  ]);

  const hubConfigured = integrations.filter((item) => item.configured).length;
  const hubLive = integrations.filter((item) => item.liveWired).length;

  const checks: HealthCheck[] = [
    healthCheck("App version", "OK", env.APP_VERSION ?? "0.1.0"),
    healthCheck(
      "Deployment environment",
      "OK",
      `${env.NODE_ENV}${process.env.VERCEL_ENV ? ` / ${process.env.VERCEL_ENV}` : ""}${env.NEON_BRANCH ? ` / Neon ${env.NEON_BRANCH}` : ""}`,
    ),
    healthCheck("Database", database.ok ? "LIVE" : "ERROR", database.ok ? "Neon PostgreSQL is connected." : database.error),
    healthCheck(
      "Migrations",
      migrations.ok ? "LIVE" : "ERROR",
      migrations.ok ? `${migrations.value.length} applied schema migrations.` : migrations.error,
    ),
    healthCheck(
      "Extensions",
      searchOk ? "LIVE" : "ERROR",
      searchOk
        ? "Search extensions are available."
        : extensions.ok
          ? "One or more search extensions are missing."
          : extensions.error,
    ),
    healthCheck(
      "Clerk",
      !clerkOk ? "NOT_CONFIGURED" : productionRuntime && clerkIsTest ? "ERROR" : clerkProductionOk ? "LIVE" : "DEGRADED",
      !clerkOk
        ? "Clerk keys are not set."
        : productionRuntime && clerkIsTest
          ? "NOT READY — production is using Clerk test keys. Signed-out /app fails until pk_live / sk_live are set. Live keys stay on Vercel production only."
          : "Sign-in is configured. WorkforceOS roles still control access.",
    ),
    healthCheck(
      "Inngest",
      jobsOk ? "CONFIGURED" : "NOT_CONFIGURED",
      jobsOk ? "Inngest keys are present." : "Inngest is not configured. The app still runs without it.",
    ),
    healthCheck(
      "Storage",
      storage.ready ? "LIVE" : productionRuntime ? "ERROR" : "NOT_CONFIGURED",
      storage.ready
        ? `LIVE — R2/S3 ready (provider=${storage.adapter}, bucket=${storage.bucket ?? "n/a"}, endpoint=${storage.endpointConfigured ? "set" : "unset"}). Resume keys use applications/, military-talent/, and skillbridge/ prefixes.`
        : storage.adapter === "s3"
          ? `NOT READY — STORAGE_PROVIDER=s3 but bucket=${storage.bucket ? "set" : "unset"}, endpoint=${storage.endpointConfigured ? "set" : "unset"}. Credentials are not displayed. Uploads will fail.`
          : "NOT CONFIGURED — production uploads fail until STORAGE_PROVIDER=s3 plus S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.",
    ),
    healthCheck(
      "Integrations",
      integrationSummary.live > 0 ? "LIVE" : integrationSummary.configured > 0 ? "CONFIGURED" : "NOT_CONFIGURED",
      `${formatIntegrationSummary(integrationSummary)} Hub adapters: ${hubLive} live / ${hubConfigured} configured of ${integrations.length}. Mock providers are not counted as live.`,
    ),
    healthCheck(
      "AI Runtime",
      openai === "LIVE" ? "LIVE" : openai,
      openai === "LIVE"
        ? `LIVE — primary provider OpenAI. FAST/STANDARD/REASONING class routing is verified in this database. Gemini availability fallback is ${gemini === "DEFERRED" ? "deferred" : gemini.toLowerCase().replaceAll("_", " ")}.`
        : openai === "CONFIGURED"
          ? "CONFIGURED — OpenAI class models are set but no successful live completion is recorded yet."
          : openai === "DEGRADED"
            ? "DEGRADED — an API key is present but FAST/STANDARD/REASONING class ids are unset or heuristic."
            : "HEURISTIC — no live API key is configured (or AI_PROVIDER=internal_heuristic).",
    ),
    healthCheck(
      "OpenAI",
      openai,
      openai === "LIVE"
        ? `LIVE + VERIFIED — OpenAI-compatible completions have succeeded in this database (host ${aiRuntime.primaryHost}). FAST=${aiRuntime.capabilityModels.FAST} · STANDARD=${aiRuntime.capabilityModels.STANDARD} · REASONING=${aiRuntime.capabilityModels.REASONING}. The API key is not displayed.`
        : openai === "CONFIGURED"
          ? `CONFIGURED — OpenAI-compatible key and FAST/STANDARD/REASONING class ids are set (host ${aiRuntime.primaryHost}). No successful live completion is recorded yet. Do not treat this as verified LIVE.`
          : openai === "DEGRADED"
            ? `DEGRADED — an API key is present but FAST/STANDARD/REASONING class ids are unset or heuristic (host ${aiRuntime.primaryHost}). Completions stay heuristic until class models are set.`
            : "HEURISTIC — no live API key is configured (or AI_PROVIDER=internal_heuristic). Agents draft from stored PostgreSQL records.",
    ),
    healthCheck(
      "Fallback",
      gemini,
      gemini === "LIVE"
        ? `LIVE — Gemini availability fallback has completed a recorded hop (host ${aiRuntime.fallbackHost ?? "n/a"}). Failover is timeout / 408 / 429 / 5xx / abort / empty body only.`
        : gemini === "CONFIGURED"
          ? `CONFIGURED — AI_FALLBACK_ENABLED=true with Gemini keys set (host ${aiRuntime.fallbackHost ?? "n/a"}). No successful Gemini fallback is recorded yet. Style/tone never hops.`
          : gemini === "DEFERRED"
            ? "DEFERRED — OpenAI is the production AI provider for launch. Gemini availability fallback remains supported by the architecture but is not enabled. Leftover Gemini secrets are ignored until AI_FALLBACK_ENABLED=true and AI_FALLBACK_PROVIDER=gemini. This is not a production failure."
            : "NOT CONFIGURED — Gemini fallback is enabled but AI_FALLBACK_PROVIDER / GEMINI_API_KEY are unset.",
    ),
    healthCheck(
      "Last AI fallback",
      gemini === "DEFERRED" ? "DEFERRED" : lastFallback ? "LIVE" : "OK",
      gemini === "DEFERRED"
        ? "Not in use. Gemini availability fallback is deferred for launch."
        : formatAiEvidence(
            lastFallback,
            "None recorded. Same-provider model fallback or Gemini has not completed a run in this database.",
          ),
    ),
    healthCheck(
      "Embeddings",
      embeddingsStatus,
      `${aiRuntime.embeddingPath} Not production retrieval. Keep deferred until a model and dimension are chosen together (DEC-SEM-001).`,
    ),
    healthCheck(
      "Sentry",
      sentryStatus,
      sentry.configured
        ? "CONFIGURED — SENTRY_DSN is set. Official SDK can initialize. Events have not been independently verified here. The DSN is not displayed."
        : "NOT CONFIGURED — SENTRY_DSN is unset. Official SDK stays idle.",
    ),
    healthCheck(
      "Labor market (BLS / Census)",
      laborStatus,
      env.BLS_API_KEY || env.CENSUS_API_KEY
        ? `CONFIGURED — keys present: ${[env.BLS_API_KEY ? "BLS" : null, env.CENSUS_API_KEY ? "Census" : null].filter(Boolean).join(", ")}. Unconfigured providers stay labeled fixtures. Values are not displayed.`
        : "MOCK — BLS_API_KEY and CENSUS_API_KEY are unset. Labor-market adapters stay labeled fixtures.",
    ),
    healthCheck(
      "SeekOut",
      seekoutStatus,
      `${seekout.liveLabel} — ${seekout.detail}`,
    ),
    healthCheck(
      "Apollo",
      apolloStatus,
      `${apollo.liveLabel} — ${apollo.detail}`,
    ),
    healthCheck(
      "DocuSign",
      docusignStatus,
      `${docusign.liveLabel} — ${docusign.detail}`,
    ),
    healthCheck(
      "QuickBooks",
      quickbooksStatus,
      `${quickbooks.liveLabel} — ${quickbooks.detail}`,
    ),
    healthCheck(
      "Scout",
      "LIVE",
      "LIVE — closed command registry. The model never generates SQL. Chat completions are not used on this path. External send still requires scout.external_actions, a confirmation token, and Resend.",
    ),
    healthCheck(
      "Last successful live AI call",
      lastLive ? "LIVE" : "OK",
      formatAiEvidence(
        lastLive,
        "None recorded. Either this environment is heuristic, or no live completion has succeeded yet.",
      ),
    ),
    healthCheck(
      "Queue failures (24h)",
      queueFailures === 0 ? "LIVE" : "DEGRADED",
      queueFailures === 0 ? "No failed agent runs or integration events in the last 24 hours." : `${queueFailures} failures.`,
    ),
    healthCheck(
      "Resend",
      productionRuntime && !isResendConfigured() ? "ERROR" : resendStatus,
      resendStatus === "LIVE"
        ? `${resend.liveLabel} — transactional send is wired${resendSent ? " and at least one sent event is stored" : ""}. Scout send still requires scout.external_actions and human confirmation.`
        : `${resend.liveLabel} — ${resend.detail}`,
    ),
    healthCheck(
      "Google / Microsoft Calendar",
      calendarStatus,
      calendar.liveWired
        ? "CONFIGURED — OAuth refresh tokens are present. Calendar is not LIVE until attendees are invited, freeBusy/schedule is real, and create/read/update/cancel is verified. Token values are not displayed."
        : `${calendar.liveLabel} — ${calendarProviderStatus().detail}`,
    ),
    healthCheck(
      "Background checks",
      checkrStatus,
      `${checkr.liveLabel} — ${checkr.detail}`,
    ),
    healthCheck(
      "Drug screens",
      drugStatus,
      drugScreenProviderStatus().detail,
    ),
    healthCheck(
      "Public Jobs API",
      database.ok ? "LIVE" : "ERROR",
      database.ok
        ? "LIVE — GET /api/public/v1/jobs and /jobs/[slug]. Published jobs only. Confidential client identity is redacted."
        : "Public jobs cannot be served until the database is connected.",
    ),
    healthCheck(
      "Public Content API",
      content.ok ? "LIVE" : "ERROR",
      content.ok
        ? "LIVE — GET /api/public/v1/content. Active-window items only. Closed jobs drop from featured payloads without a website deploy. Cached 60s."
        : content.error.includes("public_content_items") || /does not exist|relation/i.test(content.error)
          ? "NOT READY — public_content_items is missing or unreadable. Apply migration 0012_wise_scourge on this database."
          : `NOT READY — GET /api/public/v1/content failed. ${content.error.slice(0, 180)}`,
    ),
    healthCheck(
      "Public site HMAC",
      env.PUBLIC_SITE_INTEGRATION_SECRET ? "LIVE" : productionRuntime ? "ERROR" : "NOT_CONFIGURED",
      env.PUBLIC_SITE_INTEGRATION_SECRET
        ? "LIVE — PUBLIC_SITE_INTEGRATION_SECRET is set. Unauthenticated public writes require a valid HMAC. Origin/Referer cannot skip signing. The secret is not displayed."
        : env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production"
          ? "NOT CONFIGURED — production public writes are rejected until PUBLIC_SITE_INTEGRATION_SECRET is set."
          : "NOT CONFIGURED — development public writes may omit HMAC. Production requires the secret.",
    ),
    healthCheck(
      "Public Applications API",
      database.ok && storage.ready && (productionRuntime ? Boolean(env.PUBLIC_SITE_INTEGRATION_SECRET) : true)
        ? "LIVE"
        : productionRuntime
          ? "ERROR"
          : "NOT_CONFIGURED",
      !database.ok
        ? "Applications cannot be stored until the database is connected."
        : !storage.ready
          ? "NOT READY — resume upload requires STORAGE_PROVIDER=s3 plus S3 credentials in production."
          : env.NODE_ENV === "production" && !env.PUBLIC_SITE_INTEGRATION_SECRET
            ? "NOT READY — production applications require HMAC signing."
            : "LIVE — POST /api/public/v1/applications. HMAC required in production. Resume binaries go to StorageProvider.",
    ),
    healthCheck(
      "Public Inquiry API",
      database.ok && (productionRuntime ? Boolean(env.PUBLIC_SITE_INTEGRATION_SECRET) : true)
        ? "LIVE"
        : productionRuntime
          ? "ERROR"
          : "NOT_CONFIGURED",
      !database.ok
        ? "Inquiries cannot be stored until the database is connected."
        : env.NODE_ENV === "production" && !env.PUBLIC_SITE_INTEGRATION_SECRET
          ? "NOT READY — production inquiries require HMAC signing."
          : "LIVE — POST /api/public/v1/inquiries creates website_inquiries intake records. Opportunities are not auto-created.",
    ),
    healthCheck(
      "Military Talent Intake API",
      database.ok && (productionRuntime ? Boolean(env.PUBLIC_SITE_INTEGRATION_SECRET) : true)
        ? "LIVE"
        : productionRuntime
          ? "ERROR"
          : "NOT_CONFIGURED",
      !database.ok
        ? "Military talent intake cannot be stored until the database is connected."
        : env.NODE_ENV === "production" && !env.PUBLIC_SITE_INTEGRATION_SECRET
          ? "NOT READY — production military-talent intake requires HMAC signing."
          : "LIVE — POST /api/public/v1/military-talent reuses Candidate + Transition Talent Profile records. A public job is not required.",
    ),
    healthCheck(
      "Public careers URL",
      env.PUBLIC_CAREERS_URL ? "LIVE" : productionRuntime ? "NOT_CONFIGURED" : "NOT_CONFIGURED",
      env.PUBLIC_CAREERS_URL
        ? `LIVE — Public careers URL: ${env.PUBLIC_CAREERS_URL}`
        : env.NODE_ENV === "production"
          ? "NOT CONFIGURED — set PUBLIC_CAREERS_URL to https://pieronepartners.com/careers when the public site is live."
          : "Set PUBLIC_CAREERS_URL when pieronepartners.com/careers is live.",
    ),
    healthCheck(
      "Backup / checkpoint",
      "CONFIGURED",
      "CONFIGURED — Neon PITR and branch checkpoints are managed in the Neon console. See the operating playbook. No backup secrets are shown here.",
    ),
  ];

  return {
    seedVersion: SEED_VERSION,
    environment: env.NODE_ENV,
    version: env.APP_VERSION ?? "0.1.0",
    integrationSummary,
    checks,
  };
}
