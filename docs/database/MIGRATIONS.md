# Database migrations

Migrations live in `drizzle/` and are generated from `db/schema/`.

## Commands

```bash
npm run db:generate
npm run db:migrate
npm run db:check
```

`npm run build` does not migrate. Vercel must not run migrations as part of the application build.

## Seeds

| Command | Safe for production? | Contents |
| --- | --- | --- |
| `npm run db:seed:dev` | No | Organization plus Harbor/Taylor Ellis/Navy EM development fixtures |
| `npm run db:seed:prod` | Yes | Organization, roles, launch services, disabled agent registry, locked requirements, decision log |

Do not automatically run development seed data in production.

## Extensions

The first migration enables:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Do not enable these with ad-hoc production SQL if a migration can do it.

## Applied migrations

| File | Purpose |
| --- | --- |
| `drizzle/0000_*` | Phase 1 foundation. Do not rewrite. |
| `drizzle/0001_useful_frog_thor.sql` | Phase 2 CRM/Talent operating columns. Do not rewrite. |
| `drizzle/0002_fancy_pretty_boy.sql` | Phase 3 recruiting operations and military translator. Adds pipeline/job enum values, match component scores, screenings, guarantees, bridge training, translations, occupation import log, and mapping provenance. |
| `drizzle/0003_vengeful_tyger_tiger.sql` | Phase 4 service engines, proposals, contracts, delivery projects, billing triggers, and expansion recommendations. Do not rewrite. |

Enum values are added in a separate statement from column defaults that use those values. Postgres rejects `ADD VALUE` and `DEFAULT` of that value in the same transaction.

## Preview databases

Neon preview branching should run the same migration set. See `docs/architecture/DATABASE_DEPLOYMENT.md` and `docs/architecture/DEPLOYMENT.md`.
