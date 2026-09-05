# Database migrations

Migrations live in `drizzle/` and are generated from `db/schema/`.

## Commands

```bash
npm run db:generate
npm run db:migrate
npm run db:check
```

## Extensions

The first migration enables:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Do not enable these with ad-hoc production SQL if a migration can do it.

## Preview databases

Neon preview branching should run the same migration set. See `docs/architecture/DEPLOYMENT.md`.
