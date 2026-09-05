# Database deployment

PostgreSQL on Neon is the system of record. Schema changes go through versioned Drizzle migrations in `drizzle/`. Do not rewrite already-applied migrations. Do not use `drizzle-kit push` against any shared or production database.

`npm run build` does **not** run migrations or seeds. Vercel must not apply schema changes as a side effect of deploying application code.

## Connection strings

| Variable | Use |
| --- | --- |
| `DATABASE_URL` | Pooled Neon URL (`-pooler`). Application runtime and `neon-http` queries. |
| `DATABASE_URL_UNPOOLED` | Direct Neon URL. Drizzle migrations, dumps, and session-level SQL. |

The app uses `drizzle-orm/neon-http` with `@neondatabase/serverless`. That is compatible with Vercel serverless. Do not switch drivers unless a documented constraint requires it.

## Local development

1. Change schema in `db/schema/`.
2. Generate a migration: `npm run db:generate`.
3. Inspect the SQL in `drizzle/` before applying it.
4. Apply it to the **development** Neon branch: `npm run db:migrate` (requires `DATABASE_URL_UNPOOLED`).
5. Run `npm run db:check`, `npm test`, and `npm run test:db-acceptance` when the change touches data behavior.
6. Update `docs/database/DATA_DICTIONARY.md` and `docs/database/MIGRATIONS.md`.

Development seed (includes Harbor / Taylor Ellis fixtures):

```bash
npm run db:seed:dev
```

`npm run db:seed` is an alias of `db:seed:dev`. It refuses to run when `NODE_ENV=production` unless `ALLOW_DEV_SEED=true`.

## Preview

1. Deploy application code against a Neon **preview** branch (Vercel preview env `DATABASE_URL`).
2. Apply the same migration set to that preview branch using the preview **direct** URL:

```bash
$env:DATABASE_URL_UNPOOLED="<preview-direct-connection-string>"
npm run db:migrate
npm run db:check
```

3. Seed only if the preview needs operating fixtures. First preview smoke tests may use `npm run db:seed:dev` against the preview branch, never against production.
4. Run smoke tests from `docs/architecture/VERCEL_DEPLOYMENT_CHECKLIST.md`.

If the Neon–Vercel integration creates a branch per preview deployment, run migrate against that branch's unpooled URL after the branch exists.

## Production

1. Create a backup, child branch, or Neon checkpoint of production before applying schema changes.
2. Review the new migration SQL. Do not edit already-applied files `0000_*`, `0001_*`, or `0002_*`.
3. Apply the migration explicitly with the production **direct** URL:

```bash
$env:DATABASE_URL_UNPOOLED="<production-direct-connection-string>"
npm run db:migrate
npm run db:check
```

4. Verify extensions (`vector`, `pg_trgm`), expected tables, and migration count.
5. Deploy or promote the application on Vercel.
6. Run post-deployment checks: sign-in, `/app`, `/app/admin/system-health`, one authorized read, one authorized write, audit event.

Production-safe seed (organization, roles, launch services, agent registry, locked requirements, decision log only):

```bash
$env:DATABASE_URL="<production-pooled-connection-string>"
npm run db:seed:prod
```

Do **not** run `db:seed:dev` against production. That command inserts fake companies, candidates, jobs, placements, local users, and military development mappings.

After the first Clerk user signs in, grant Managing Partner (the app does not assign roles from Clerk metadata):

```bash
npx tsx scripts/grant-managing-partner.ts --email you@company.com
```

## Commands

| Script | Purpose |
| --- | --- |
| `npm run db:generate` | Create a new SQL migration from `db/schema/` |
| `npm run db:migrate` | Apply versioned migrations (`drizzle-kit migrate`) |
| `npm run db:check` | Connectivity, extensions, key tables, migration status, fixture detection |
| `npm run db:seed:dev` | Development fixtures. Unsafe for production. |
| `npm run db:seed:prod` | Production-safe catalog only |
| `npm run db:bootstrap-admin` | Grant Managing Partner to an already-synced Clerk user |
| `npm run db:verify-core` | Confirm organization and eight roles |
| `npm run db:verify-extensions` | Confirm `vector` and `pg_trgm` |

`drizzle-kit push` is not used and must not be used against production.

## Forward migrations only

Future schema changes get a new `0009_*.sql` (or later) file. Never modify `0000`–`0008` after they have been applied. `0008_cooing_blade.sql` is the Phase 9 Scout and SkillBridge migration.

## Neon branch layout

Do not point development, preview, and production at one database.

| Environment | Neon branch | Seed |
| --- | --- | --- |
| Local development | `development` | `db:seed:dev` |
| Vercel preview | ephemeral preview branch, or a durable `preview` branch | optional `db:seed:dev` |
| Vercel production | protected `production` branch | `db:seed:prod` only |

The current Neon default branch is named `production` and already contains development fixtures. Treat that branch as **development data** until a clean production branch is created and Vercel production `DATABASE_URL` is switched to it.

## Backup, PITR, rollback, and disaster recovery

Neon manages backups and point-in-time restore (PITR) in the console. The application does not store backup credentials.

**Production branch:** protected Neon branch with `db:seed:prod` only. Preview strategy: Vercel preview deployments use a Neon preview branch (or a durable `preview` branch), never the protected production branch.

**Before a production migration:** create a child branch or checkpoint.

**PITR recovery:** restore the production branch (or a new branch) to a timestamp before the incident, point Vercel `DATABASE_URL` / `DATABASE_URL_UNPOOLED` at the restored compute, run `npm run db:check`, then smoke-test sign-in and Command Center.

**Application rollback:** redeploy the last good Vercel production deployment. If that release applied a new Drizzle migration, restore the database to before the migration. Do not edit applied SQL. Do not use `drizzle-kit push`.

**Disaster recovery test:** at least once before go-live, fork or restore a throwaway branch, run `npm run db:check` and `npm run test:smoke`, and record the date. See `docs/operations/WORKFORCEOS_OPERATING_PLAYBOOK.md`.
