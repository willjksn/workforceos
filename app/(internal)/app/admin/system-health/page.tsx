import { sql } from "drizzle-orm";

import { getServerEnv, isClerkConfigured, isInngestConfigured } from "@/lib/env";
import { getIntegrationHubStatus } from "@/lib/integrations/hub";
import { getStorageStatus } from "@/lib/storage";
import { requireCurrentPrincipal } from "@/lib/auth/session";
import { SEED_VERSION } from "@/db/seed/constants";
import { createDb } from "@/db";

async function safe<T>(label: string, fn: () => Promise<T>) {
  try {
    return { label, ok: true as const, value: await fn() };
  } catch (error) {
    return {
      label,
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export default async function SystemHealthPage() {
  const principal = await requireCurrentPrincipal();
  const env = getServerEnv();
  const database = await safe("database", async () => {
    const db = createDb();
    await db.execute(sql`select 1 as ok`);
    return "connected";
  });
  const extensions = await safe("extensions", async () => {
    const db = createDb();
    const result = await db.execute<{ extname: string }>(
      sql`select extname from pg_extension where extname in ('vector', 'pg_trgm')`,
    );
    return result.rows?.map((row) => row.extname) ?? result;
  });
  const migration = await safe("migration", async () => {
    const db = createDb();
    const result = await db.execute(
      sql`select hash, created_at from drizzle.__drizzle_migrations order by created_at desc limit 1`,
    );
    return result;
  });
  const storage = await getStorageStatus();
  const integrations = await getIntegrationHubStatus();

  const rows = [
    ["Environment", env.NODE_ENV],
    ["Build/version", env.APP_VERSION ?? "0.1.0"],
    ["Authenticated Clerk session", "yes"],
    ["Local WorkforceOS user", principal.id],
    ["Current roles", principal.roleSlugs.join(", ") || "none"],
    ["Database", database.ok ? "connected" : database.error],
    [
      "Extensions",
      extensions.ok ? JSON.stringify(extensions.value) : extensions.error,
    ],
    ["Inngest", isInngestConfigured() ? "keys present" : "not configured"],
    ["Storage adapter", `${storage.adapter} (${storage.ready ? "ready" : "not ready"})`],
    ["Seed version", SEED_VERSION],
    ["Migration version", migration.ok ? JSON.stringify(migration.value) : migration.error],
    ["Clerk", isClerkConfigured() ? "configured" : "missing keys"],
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">System health</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Development/admin verification. Secrets are not displayed.
      </p>
      <table className="mt-6 w-full text-left text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b">
              <th className="py-2 pr-4 font-medium">{label}</th>
              <td className="py-2 break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="mt-8 text-lg font-semibold">Integration Hub</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {integrations.map((item) => (
          <li key={item.provider}>
            {item.provider}: {item.configured ? "configured" : "not configured"} /{" "}
            {item.connectionHealth}
          </li>
        ))}
      </ul>
    </main>
  );
}
