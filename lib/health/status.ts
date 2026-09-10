import { and, desc, eq, gt, gte, ne, or, sql } from "drizzle-orm";

import { createDb, getDb } from "../../db";
import { agentRuns, integrationEvents } from "../../db/schema";
import { describeAiRuntime } from "../ai/capabilities";
import { SEED_VERSION } from "../../db/seed/constants";
import { getServerEnv, isClerkConfigured, isInngestConfigured } from "../env";
import { getIntegrationHubStatus } from "../integrations/hub";
import { calendarProviderStatus } from "../calendar";
import {
  apolloWiringStatus,
  calendarWiringStatus,
  checkrWiringStatus,
  docusignWiringStatus,
  isResendConfigured,
  quickbooksWiringStatus,
  resendWiringStatus,
  seekoutWiringStatus,
  sentryWiringStatus,
} from "../integrations/credentials";
import { drugScreenProviderStatus } from "../drug-screens";
import { getPublicContentPayload } from "../public-content/service";
import { getStorageStatus } from "../storage";

export type HealthCheck = {
  title: string;
  ok: boolean;
  detail: string;
};

async function probe<T>(fn: () => Promise<T>) {
  try {
    return { ok: true as const, value: await fn() };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
  }
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
  let lastLiveAiCompletedAt: Date | null = null;
  try {
    const db = getDb();
    const [lastLive] = await db
      .select({ completedAt: agentRuns.completedAt })
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.status, "completed"),
          ne(agentRuns.provider, "internal_heuristic"),
        ),
      )
      .orderBy(desc(agentRuns.completedAt))
      .limit(1);
    lastLiveAiCompletedAt = lastLive?.completedAt ?? null;
  } catch {
    lastLiveAiCompletedAt = null;
  }
  let lastAiFallbackAt: Date | null = null;
  try {
    const db = getDb();
    const [lastFallback] = await db
      .select({ completedAt: agentRuns.completedAt })
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.status, "completed"),
          or(eq(agentRuns.provider, "gemini"), gt(agentRuns.retryCount, 0)),
        ),
      )
      .orderBy(desc(agentRuns.completedAt))
      .limit(1);
    lastAiFallbackAt = lastFallback?.completedAt ?? null;
  } catch {
    lastAiFallbackAt = null;
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

  const checks: HealthCheck[] = [
    {
      title: "App version",
      ok: true,
      detail: env.APP_VERSION ?? "0.1.0",
    },
    {
      title: "Deployment environment",
      ok: true,
      detail: `${env.NODE_ENV}${process.env.VERCEL_ENV ? ` / ${process.env.VERCEL_ENV}` : ""}${env.NEON_BRANCH ? ` / Neon ${env.NEON_BRANCH}` : ""}`,
    },
    {
      title: "Database",
      ok: database.ok,
      detail: database.ok ? "Database is connected." : database.error,
    },
    {
      title: "Migrations",
      ok: migrations.ok,
      detail: migrations.ok ? `${migrations.value.length} applied schema migrations.` : migrations.error,
    },
    {
      title: "Extensions",
      ok: searchOk,
      detail: searchOk
        ? "Search extensions are available."
        : extensions.ok
          ? "One or more search extensions are missing."
          : extensions.error,
    },
    {
      title: "Clerk",
      ok: clerkProductionOk,
      detail: !clerkOk
        ? "Clerk keys are not set."
        : productionRuntime && clerkIsTest
          ? "NOT READY — production is using Clerk test keys. Signed-out /app fails until pk_live / sk_live are set. Live keys stay on Vercel production only."
          : "Sign-in is configured. WorkforceOS roles still control access.",
    },
    {
      title: "Inngest",
      ok: jobsOk,
      detail: jobsOk ? "Inngest keys are present." : "Inngest is not configured. The app still runs without it.",
    },
    {
      title: "Storage",
      ok: storage.ready,
      detail: storage.ready
        ? `Ready (provider=${storage.adapter}, bucket=${storage.bucket ?? "n/a"}, endpoint=${storage.endpointConfigured ? "set" : "unset"}). Resume keys use applications/, military-talent/, and skillbridge/ prefixes.`
        : storage.adapter === "s3"
          ? `NOT READY — STORAGE_PROVIDER=s3 but bucket=${storage.bucket ? "set" : "unset"}, endpoint=${storage.endpointConfigured ? "set" : "unset"}. Credentials are not displayed. Uploads will fail.`
          : "NOT CONFIGURED — production uploads fail until STORAGE_PROVIDER=s3 plus S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.",
    },
    {
      title: "Integrations",
      ok: true,
      detail: `${integrations.filter((item) => item.configured).length} of ${integrations.length} providers configured. Others stay disconnected until credentials are set.`,
    },
    {
      title: "AI runtime",
      ok: true,
      detail: aiRuntime.mode === "live"
        ? `LIVE — provider ${aiRuntime.providerName} is configured. Completions use capability-class models (FAST / STANDARD / REASONING), not hard-coded model brands.`
        : "HEURISTIC — no live API key is configured (or AI_PROVIDER=internal_heuristic). Agents draft from stored PostgreSQL records. This is not a silent live-model fallback.",
    },
    {
      title: "AI provider configured",
      ok: aiRuntime.providerConfigured,
      detail: aiRuntime.providerConfigured
        ? `Yes — ${aiRuntime.providerName}. API key is set. The key is not displayed.`
        : "No — AI_API_KEY / OPENAI_API_KEY is unset. Runtime is internal_heuristic.",
    },
    {
      title: "AI fallback configured",
      ok: true,
      detail: aiRuntime.fallbackConfigured
        ? "Yes — gemini via OpenAI-compatible HTTP. GEMINI_API_KEY is set. The key is not displayed. Failover is availability-only (timeout, 408/429/5xx, abort, empty body)."
        : "No — AI_FALLBACK_PROVIDER / GEMINI_API_KEY unset. Gemini availability fallback is BLOCKED until those keys are set. Do not treat this as LIVE.",
    },
    {
      title: "Last AI fallback",
      ok: true,
      detail: lastAiFallbackAt
        ? lastAiFallbackAt.toISOString()
        : "None recorded. Same-provider model fallback or Gemini has not completed a run in this database.",
    },
    {
      title: "Embeddings",
      ok: true,
      detail: aiRuntime.embeddingPath,
    },
    {
      title: "Sentry",
      ok: true,
      detail: `${sentryWiringStatus().liveLabel} — ${sentryWiringStatus().detail}`,
    },
    {
      title: "Labor market (BLS / Census)",
      ok: true,
      detail: env.BLS_API_KEY || env.CENSUS_API_KEY
        ? `Keys present: ${[env.BLS_API_KEY ? "BLS" : null, env.CENSUS_API_KEY ? "Census" : null].filter(Boolean).join(", ")}. Unconfigured providers stay labeled fixtures. Values are not displayed.`
        : "NOT CONFIGURED — BLS_API_KEY and CENSUS_API_KEY are unset. Labor-market adapters stay labeled fixtures.",
    },
    {
      title: "Talent sourcing (SeekOut / Apollo)",
      ok: true,
      detail: `${seekoutWiringStatus().liveLabel} SeekOut — ${seekoutWiringStatus().detail} ${apolloWiringStatus().liveLabel} Apollo — ${apolloWiringStatus().detail}`,
    },
    {
      title: "DocuSign / QuickBooks",
      ok: true,
      detail: `${docusignWiringStatus().liveLabel} DocuSign — ${docusignWiringStatus().detail} ${quickbooksWiringStatus().liveLabel} QuickBooks — ${quickbooksWiringStatus().detail}`,
    },
    {
      title: "Scout",
      ok: true,
      detail: aiRuntime.scoutLiveCompletions
        ? "Scout is configured. Closed command registry only; the model never generates SQL. External send requires scout.external_actions, a confirmation token, and Resend. Live completions are available for agent tasks that use Scout's capability class."
        : "Scout is configured. Closed command registry only; the model never generates SQL. External send requires scout.external_actions, a confirmation token, and Resend. Completions are heuristic until a live AI key is set.",
    },
    {
      title: "Last successful live AI call",
      ok: true,
      detail: lastLiveAiCompletedAt
        ? lastLiveAiCompletedAt.toISOString()
        : "None recorded. Either this environment is heuristic, or no live completion has succeeded yet.",
    },
    {
      title: "Queue failures (24h)",
      ok: queueFailures === 0,
      detail: queueFailures === 0 ? "No failed agent runs or integration events in the last 24 hours." : `${queueFailures} failures.`,
    },
    {
      title: "Resend",
      ok: env.NODE_ENV === "production" ? isResendConfigured() : true,
      detail: `${resendWiringStatus().liveLabel} — ${resendWiringStatus().detail}`,
    },
    {
      title: "Calendar provider",
      ok: true,
      detail: `${calendarWiringStatus().liveLabel} — ${calendarProviderStatus().detail}`,
    },
    {
      title: "Background checks",
      ok: true,
      detail: `${checkrWiringStatus().liveLabel} — ${checkrWiringStatus().detail}`,
    },
    {
      title: "Drug screens",
      ok: true,
      detail: drugScreenProviderStatus().detail,
    },
    {
      title: "Public Jobs API",
      ok: database.ok,
      detail: database.ok
        ? "GET /api/public/v1/jobs and /jobs/[slug]. Published jobs only. Confidential client identity is redacted."
        : "Public jobs cannot be served until the database is connected.",
    },
    {
      title: "Public Content API",
      ok: content.ok,
      detail: content.ok
        ? "GET /api/public/v1/content. Active-window items only. Closed jobs drop from featured payloads without a website deploy. Cached 60s."
        : content.error.includes("public_content_items") || /does not exist|relation/i.test(content.error)
          ? "NOT READY — public_content_items is missing or unreadable. Apply migration 0012_wise_scourge on this database."
          : `NOT READY — GET /api/public/v1/content failed. ${content.error.slice(0, 180)}`,
    },
    {
      title: "Public site HMAC",
      ok: env.NODE_ENV === "production" ? Boolean(env.PUBLIC_SITE_INTEGRATION_SECRET) : true,
      detail: env.PUBLIC_SITE_INTEGRATION_SECRET
        ? "PUBLIC_SITE_INTEGRATION_SECRET is set. Unauthenticated public writes require a valid HMAC. Origin/Referer cannot skip signing. The secret is not displayed."
        : env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production"
          ? "NOT CONFIGURED — production public writes are rejected until PUBLIC_SITE_INTEGRATION_SECRET is set."
          : "NOT CONFIGURED — development public writes may omit HMAC. Production requires the secret.",
    },
    {
      title: "Public Applications API",
      ok:
        database.ok &&
        storage.ready &&
        (env.NODE_ENV === "production" ? Boolean(env.PUBLIC_SITE_INTEGRATION_SECRET) : true),
      detail: !database.ok
        ? "Applications cannot be stored until the database is connected."
        : !storage.ready
          ? "NOT READY — resume upload requires STORAGE_PROVIDER=s3 plus S3 credentials in production."
          : env.NODE_ENV === "production" && !env.PUBLIC_SITE_INTEGRATION_SECRET
            ? "NOT READY — production applications require HMAC signing."
            : "POST /api/public/v1/applications. HMAC required in production. WorkforceOS /careers posts via /api/careers/applications. Resume binaries go to StorageProvider.",
    },
    {
      title: "Public Inquiry API",
      ok: database.ok && (env.NODE_ENV === "production" ? Boolean(env.PUBLIC_SITE_INTEGRATION_SECRET) : true),
      detail: !database.ok
        ? "Inquiries cannot be stored until the database is connected."
        : env.NODE_ENV === "production" && !env.PUBLIC_SITE_INTEGRATION_SECRET
          ? "NOT READY — production inquiries require HMAC signing."
          : "POST /api/public/v1/inquiries creates website_inquiries intake records. Opportunities are not auto-created.",
    },
    {
      title: "Military Talent Intake API",
      ok: database.ok && (env.NODE_ENV === "production" ? Boolean(env.PUBLIC_SITE_INTEGRATION_SECRET) : true),
      detail: !database.ok
        ? "Military talent intake cannot be stored until the database is connected."
        : env.NODE_ENV === "production" && !env.PUBLIC_SITE_INTEGRATION_SECRET
          ? "NOT READY — production military-talent intake requires HMAC signing."
          : "POST /api/public/v1/military-talent reuses Candidate + Transition Talent Profile (skillbridge_profiles) records. A public job is not required.",
    },
    {
      title: "Public careers URL",
      ok: env.NODE_ENV === "production" ? Boolean(env.PUBLIC_CAREERS_URL) : true,
      detail: env.PUBLIC_CAREERS_URL
        ? `Public careers URL: ${env.PUBLIC_CAREERS_URL}`
        : env.NODE_ENV === "production"
          ? "NOT CONFIGURED — set PUBLIC_CAREERS_URL to https://pieronepartners.com/careers when the public site is live."
          : "Set PUBLIC_CAREERS_URL when pieronepartners.com/careers is live.",
    },
    {
      title: "Backup / checkpoint",
      ok: true,
      detail: "Neon PITR and branch checkpoints are managed in the Neon console. See the operating playbook. No backup secrets are shown here.",
    },
  ];

  return {
    seedVersion: SEED_VERSION,
    environment: env.NODE_ENV,
    version: env.APP_VERSION ?? "0.1.0",
    checks,
  };
}
