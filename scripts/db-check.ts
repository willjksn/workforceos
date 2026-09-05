import "./load-env";

import { eq, sql } from "drizzle-orm";

import { getDb } from "../db";
import { companies } from "../db/schema";
import { COMPANY_ID } from "../db/seed/constants";

const EXPECTED_MIGRATIONS = [
  "0000_flippant_mauler",
  "0001_useful_frog_thor",
  "0002_fancy_pretty_boy",
  "0003_vengeful_tyger_tiger",
];

const KEY_TABLES = [
  "organizations",
  "users",
  "roles",
  "permissions",
  "companies",
  "candidates",
  "jobs",
  "military_occupations",
  "services",
  "audit_events",
];

function redact(value: string) {
  return value.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://[redacted]");
}

async function main() {
  const db = getDb();

  await db.execute(sql`select 1 as ok`);

  const extensionResult = await db.execute<{ extname: string }>(
    sql`select extname from pg_extension where extname in ('vector', 'pg_trgm') order by extname`,
  );
  const extensionNames = extensionResult.rows.map((row) => row.extname);
  const extensions = {
    vector: extensionNames.includes("vector"),
    pg_trgm: extensionNames.includes("pg_trgm"),
  };

  const tablesResult = await db.execute<{ table_name: string }>(
    sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`,
  );
  const presentTables = new Set(tablesResult.rows.map((row) => row.table_name));
  const tables = Object.fromEntries(KEY_TABLES.map((name) => [name, presentTables.has(name)]));

  let appliedMigrations: string[] = [];
  let migrationTableFound = false;
  try {
    const migrationResult = await db.execute<{ hash: string; created_at: unknown }>(
      sql`select hash, created_at from drizzle.__drizzle_migrations order by created_at`,
    );
    migrationTableFound = true;
    appliedMigrations = migrationResult.rows.map((row) => String(row.hash));
  } catch {
    migrationTableFound = false;
  }

  let developmentFixturesDetected = false;
  try {
    const [fixture] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, COMPANY_ID))
      .limit(1);
    developmentFixturesDetected = Boolean(fixture);
  } catch {
    developmentFixturesDetected = false;
  }

  const missingExtensions = Object.entries(extensions)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  const missingTables = Object.entries(tables)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  const report = {
    connected: true,
    extensions,
    tables,
    migrations: {
      tableFound: migrationTableFound,
      expectedCount: EXPECTED_MIGRATIONS.length,
      appliedCount: appliedMigrations.length,
      expectedTags: EXPECTED_MIGRATIONS,
    },
    developmentFixturesDetected,
  };

  console.log(JSON.stringify(report, null, 2));

  if (developmentFixturesDetected) {
    console.warn(
      "Development fixtures were detected. Do not treat this database as production. Use `npm run db:seed:prod` on a clean production branch.",
    );
  }

  if (missingExtensions.length > 0) {
    throw new Error(`Missing PostgreSQL extensions: ${missingExtensions.join(", ")}`);
  }
  if (missingTables.length > 0) {
    throw new Error(`Missing expected tables: ${missingTables.join(", ")}. Run npm run db:migrate.`);
  }
  if (!migrationTableFound) {
    throw new Error("Drizzle migration table not found. Run npm run db:migrate against this database.");
  }
  if (appliedMigrations.length < EXPECTED_MIGRATIONS.length) {
    throw new Error(
      `Expected ${EXPECTED_MIGRATIONS.length} applied migrations, found ${appliedMigrations.length}. Run npm run db:migrate.`,
    );
  }

  console.log("Database check OK");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(redact(message));
  process.exit(1);
});
