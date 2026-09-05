import "./load-env";

import { sql } from "drizzle-orm";

import { getDb } from "../db";

async function main() {
  const db = getDb();
  const result = await db.execute<{ extname: string }>(
    sql`select extname from pg_extension where extname in ('vector', 'pg_trgm') order by extname`,
  );
  const names = result.rows.map((row) => row.extname);
  if (!names.includes("vector") || !names.includes("pg_trgm")) {
    throw new Error(`Missing extensions. Found: ${names.join(", ") || "(none)"}`);
  }
  console.log("Extensions confirmed:", names.join(", "));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
