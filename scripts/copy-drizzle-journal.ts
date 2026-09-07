import { neon } from "@neondatabase/serverless";

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL?.trim();
  const destUrl = process.env.DEST_DATABASE_URL?.trim();
  if (!sourceUrl || !destUrl) {
    throw new Error("SOURCE_DATABASE_URL and DEST_DATABASE_URL are required.");
  }

  const source = neon(sourceUrl);
  const dest = neon(destUrl);

  const columns = await dest`
    select column_name
    from information_schema.columns
    where table_schema = 'drizzle' and table_name = '__drizzle_migrations'
    order by ordinal_position
  `;
  if (columns.length === 0) {
    throw new Error("Destination is missing drizzle.__drizzle_migrations. Schema-only copy may have failed.");
  }

  const rows = await source`select hash, created_at from drizzle.__drizzle_migrations order by created_at`;
  const existing = await dest`select hash from drizzle.__drizzle_migrations`;
  const have = new Set(existing.map((row) => String(row.hash)));
  let inserted = 0;
  for (const row of rows) {
    if (have.has(String(row.hash))) continue;
    await dest`insert into drizzle.__drizzle_migrations (hash, created_at) values (${row.hash}, ${row.created_at})`;
    inserted += 1;
  }
  console.log(`Migration journal: ${rows.length} source rows, ${inserted} inserted, ${have.size} already present.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
