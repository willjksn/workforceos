if (typeof window !== "undefined") {
  throw new Error("db/index.ts is server-only and must not be imported in client components.");
}

import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import { requireDatabaseUrl } from "../lib/env";
import * as schema from "./schema";

export type Database = NeonHttpDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __workforceosDb?: Database;
};

export function createDb(databaseUrl = requireDatabaseUrl()): Database {
  const sql = neon(databaseUrl);
  return drizzle({ client: sql, schema });
}

export function getDb(): Database {
  if (!globalForDb.__workforceosDb) {
    globalForDb.__workforceosDb = createDb();
  }
  return globalForDb.__workforceosDb;
}

export async function checkDatabaseConnection(databaseUrl?: string) {
  const db = databaseUrl ? createDb(databaseUrl) : getDb();
  const result = await db.execute(sql`select 1 as ok`);
  return result;
}
