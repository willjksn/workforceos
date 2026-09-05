import { sql } from "drizzle-orm";

import { requirePlatformAdmin } from "@/lib/auth/guard";
import { createDb } from "@/db";
import { SEED_VERSION } from "@/db/seed/constants";
import { getServerEnv, isClerkConfigured, isInngestConfigured } from "@/lib/env";
import { getIntegrationHubStatus } from "@/lib/integrations/hub";
import { getStorageStatus } from "@/lib/storage";
import { Card, PageHeader, PageShell, StatusBadge } from "../../_components/ui";

async function probe<T>(fn: () => Promise<T>) {
  try {
    return { ok: true as const, value: await fn() };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function tone(ok: boolean): "success" | "danger" {
  return ok ? "success" : "danger";
}

function label(ok: boolean, good: string, bad: string) {
  return ok ? good : bad;
}

export default async function SystemHealthPage() {
  await requirePlatformAdmin();
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
    return {
      vector: names.includes("vector"),
      trigram: names.includes("pg_trgm"),
    };
  });
  const storage = await getStorageStatus();
  const integrations = await getIntegrationHubStatus();
  const connectedTools = integrations.filter((item) => item.configured).length;
  const clerkOk = isClerkConfigured();
  const jobsOk = isInngestConfigured();
  const searchOk = extensions.ok && extensions.value.vector && extensions.value.trigram;

  const checks = [
    {
      title: "Database",
      detail: database.ok
        ? "PostgreSQL is connected and is the system of record."
        : database.error,
      ok: database.ok,
    },
    {
      title: "Search",
      detail: searchOk
        ? "Vector and fuzzy search extensions are available."
        : extensions.ok
          ? "One or more search extensions are missing."
          : extensions.error,
      ok: searchOk,
    },
    {
      title: "Sign-in",
      detail: clerkOk
        ? "Clerk is configured. Local roles still authorize every screen."
        : "Clerk keys are not set. Invite-only sign-in will not work.",
      ok: clerkOk,
    },
    {
      title: "Background jobs",
      detail: jobsOk
        ? "Inngest keys are present for later agent and workflow runs."
        : "Inngest is not configured. The app still runs without it.",
      ok: jobsOk,
    },
    {
      title: "File storage",
      detail: storage.ready
        ? `Ready (${storage.adapter === "local" ? "local files" : "S3-compatible"}).`
        : "Storage is not ready. Uploads will fail.",
      ok: storage.ready,
    },
    {
      title: "Connected tools",
      detail:
        connectedTools > 0
          ? `${connectedTools} of ${integrations.length} tools are connected.`
          : "No external tools are connected yet. That is expected in this phase.",
      ok: true,
    },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="System status"
        description="Whether WorkforceOS can sign people in, reach PostgreSQL, and talk to connected tools. Secrets are never shown."
      />
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {checks.map((check) => (
          <Card key={check.title}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-navy">{check.title}</p>
              <StatusBadge tone={check.title === "Connected tools" && connectedTools === 0 ? "neutral" : tone(check.ok)}>
                {check.title === "Connected tools" && connectedTools === 0
                  ? "None yet"
                  : label(check.ok, "Healthy", "Needs attention")}
              </StatusBadge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{check.detail}</p>
          </Card>
        ))}
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        {env.NODE_ENV === "production" ? "Production" : "Development"} · app {env.APP_VERSION ?? "0.1.0"} · seed{" "}
        {SEED_VERSION}
      </p>
    </PageShell>
  );
}
