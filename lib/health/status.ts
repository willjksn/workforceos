import { and, eq, gte, sql } from "drizzle-orm";

import { createDb, getDb } from "../../db";
import { agentRuns, integrationEvents } from "../../db/schema";
import { SEED_VERSION } from "../../db/seed/constants";
import { getServerEnv, isClerkConfigured, isInngestConfigured } from "../env";
import { getIntegrationHubStatus } from "../integrations/hub";
import { calendarProviderStatus } from "../calendar";
import { isCheckrConfigured, isCheckrLiveApiWired, isGoogleConfigured, isMicrosoftConfigured, isResendConfigured } from "../integrations/credentials";
import { drugScreenProviderStatus } from "../drug-screens";
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
  const jobsOk = isInngestConfigured();
  const searchOk = extensions.ok && extensions.value.vector && extensions.value.trigram;
  const aiConfigured = Boolean(env.AI_API_KEY);
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
      ok: clerkOk,
      detail: clerkOk
        ? "Sign-in is configured. WorkforceOS roles still control access."
        : "Clerk keys are not set.",
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
        ? `Ready (${storage.adapter === "local" ? "local files" : "S3-compatible"}).`
        : "Storage is not ready. Uploads will fail.",
    },
    {
      title: "Integrations",
      ok: true,
      detail: `${integrations.filter((item) => item.configured).length} of ${integrations.length} providers configured. Others stay disconnected until credentials are set.`,
    },
    {
      title: "AI provider",
      ok: true,
      detail: aiConfigured
        ? `${env.AI_PROVIDER ?? "openai-compatible"} is configured.`
        : "AI is using internal drafts until an API key is set.",
    },
    {
      title: "Queue failures (24h)",
      ok: queueFailures === 0,
      detail: queueFailures === 0 ? "No failed agent runs or integration events in the last 24 hours." : `${queueFailures} failures.`,
    },
    {
      title: "Resend",
      ok: true,
      detail: isResendConfigured()
        ? "RESEND_API_KEY and RESEND_FROM_EMAIL are set. Sending still requires a verified Resend domain; DNS is not assumed complete."
        : env.NODE_ENV === "production"
          ? "NOT CONFIGURED — production transactional email fails clearly until RESEND_API_KEY and RESEND_FROM_EMAIL are set."
          : "NOT CONFIGURED — MockEmailProvider is used in development/test until RESEND_API_KEY and RESEND_FROM_EMAIL are set.",
    },
    {
      title: "Calendar provider",
      ok: true,
      detail: (() => {
        const calendar = calendarProviderStatus();
        const workspace = isMicrosoftConfigured() || isGoogleConfigured()
          ? " Microsoft/Google workspace credentials are present as Integration Hub references only."
          : "";
        return `${calendar.detail}${workspace}`;
      })(),
    },
    {
      title: "Background checks",
      ok: true,
      detail: isCheckrLiveApiWired()
        ? "Checkr live API is wired. Human review is still required. Results never auto-reject."
        : isCheckrConfigured()
          ? "CHECKR_API_KEY is set, but the Checkr HTTP API is not wired. Manual background-check workflow only. Results never auto-reject."
          : "NOT CONFIGURED — ManualBackgroundCheckProvider only. Checkr is not sandbox-ready. Results never auto-reject.",
    },
    {
      title: "Drug screens",
      ok: true,
      detail: drugScreenProviderStatus().detail,
    },
    {
      title: "Public careers API",
      ok: true,
      detail: env.PUBLIC_CAREERS_URL
        ? `Public careers URL: ${env.PUBLIC_CAREERS_URL}`
        : "Public jobs API is /api/public/v1/jobs. Set PUBLIC_CAREERS_URL when the PierOne site is live.",
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
