# Disaster recovery

WorkforceOS recovery uses Neon backups/PITR plus Vercel redeploy. The application does not store backup credentials. Canonical environment rules: `docs/architecture/DATABASE_DEPLOYMENT.md` and `docs/operations/WORKFORCEOS_OPERATING_PLAYBOOK.md`.

## What Neon provides

Paid Neon projects include point-in-time restore (PITR) and branch checkpoints. Confirm retention in the Neon console for the **protected production branch** before go-live. Record the retention window in the incident log (no secrets).

The current Neon default branch may be named `production` while still holding Harbor / Taylor Ellis fixtures. Treat that branch as **development data** until a clean protected production branch exists and Vercel production `DATABASE_URL` points at it.

## Branch / checkpoint strategy

| Environment | Neon | Restore target |
| --- | --- | --- |
| Local | `development` (or the fixture-filled default) | Recreate from parent or re-migrate + `db:seed:dev` |
| Preview | Preview branch or durable `preview` | Recreate preview branch; optional `db:seed:dev` |
| Production | Protected clean branch | PITR or child branch taken before the incident |

Before every production migration: create a child branch or checkpoint.

## Restore process (PITR)

1. Stop applying new production migrations.
2. In Neon, restore the production branch to a timestamp before the incident, **or** create a new branch from that timestamp.
3. Point Vercel production `DATABASE_URL` and `DATABASE_URL_UNPOOLED` at the restored compute (or promote/rename per Neon’s restore flow).
4. `npm run db:check`. Confirm extensions (`vector`, `pg_trgm`), expected tables, and migration count for the application commit.
5. Sign in, open Command Center, confirm a known company / candidate / job still exists.
6. Record the incident in `docs/operations/INCIDENT_RESPONSE.md` (no PII, no connection strings).

## Application rollback

1. In Vercel, redeploy the last known-good production deployment.
2. If that release applied a new Drizzle migration, restore the database to before the migration. Do not edit applied SQL. Do not `drizzle-kit push`.

## Migration rollback vs forward-fix

Prefer a new forward migration (`0010_*` or later) when the schema can be corrected in place. If data is already wrong or the SQL cannot be undone safely, PITR first.

## Recovery test procedure

Perform this on a **throwaway** branch. Never PITR production as a drill.

1. Fork or restore a non-production Neon branch (from development if production is not clean yet).
2. Point a local or preview `DATABASE_URL` at that branch only.
3. Run `npm run db:check` and `npm run test:smoke`.
4. Confirm sign-in still works against Clerk **test** keys.
5. Record date, operator, branch name (not URLs), and pass/fail.

A production-like recovery test is still required before treating Vercel production as live: create a clean production branch, `db:migrate` + `db:seed:prod`, fork it, restore, and re-check.

## Post-Phase-9 simulation status

The development database used for this validation still contains development fixtures (`db:check` reports fixtures present). A throwaway restore of that branch is safe and does not touch a clean production database. A clean-production PITR drill remains an **external configuration** item until the protected production branch exists.
