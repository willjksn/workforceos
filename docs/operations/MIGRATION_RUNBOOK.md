# Migration runbook

Canonical schema rules remain `docs/database/SCHEMA_SPEC.md` and `docs/architecture/DATABASE_DEPLOYMENT.md`. This runbook is the operator path for applying Drizzle migrations. Do not use `drizzle-kit push`. Do not edit already-applied SQL.

Current versioned files: `drizzle/0000_flippant_mauler.sql` through `drizzle/0011_keen_korvac.sql`.

## Connection strings

| Variable | Use |
| --- | --- |
| `DATABASE_URL` | Pooled Neon URL. App runtime and `npm run db:check`. |
| `DATABASE_URL_UNPOOLED` | Direct Neon URL. `npm run db:migrate` only. |

Never print or commit connection strings. Use a development branch locally. Do not point local tools at a live production database.

## Development

1. Change schema in `db/schema/`.
2. `npm run db:generate`. Inspect the new `drizzle/000N_*.sql` file.
3. Apply to the development Neon branch:

```powershell
npm run db:migrate
npm run db:check
```

4. Update `docs/database/MIGRATIONS.md` and `docs/database/DATA_DICTIONARY.md` when columns or tables change.
5. Run `npm test` and, when data behavior changed, `npm run test:db-acceptance`.

Development fixtures: `npm run db:seed:dev` only. That command refuses `NODE_ENV=production` and `VERCEL_ENV=production`.

## Preview

1. Point `DATABASE_URL` / `DATABASE_URL_UNPOOLED` at the preview Neon branch (or the branch created by the Neon–Vercel integration).
2. Apply the same migration set with the preview **direct** URL.
3. `npm run db:check`. Fixture detection is expected if the preview was seeded with `db:seed:dev`.
4. Do not run `db:seed:dev` against a database that will later be promoted to production.

## Production

1. Confirm the production Neon branch is the **clean** protected branch (no Harbor / Taylor Ellis fixtures). `npm run db:check` must report `developmentFixturesDetected: false`.
2. Create a Neon child branch or checkpoint before applying schema.
3. Review the new SQL. Do not rewrite `0000`–`0010` after they have been applied.
4. Apply with the production **direct** URL:

```powershell
$env:DATABASE_URL_UNPOOLED="<production-direct-connection-string>"
npm run db:migrate
npm run db:check
```

5. Deploy or promote the matching Vercel production deployment. `next build` does not migrate.
6. Smoke: sign-in, `/app`, `/app/admin/system-health`, one authorized read, one authorized write, audit event.

Production catalog seed is `npm run db:seed:prod` only.

## Rollback / forward-fix

Do not recommend a destructive production reset.

- **Application-only defect:** redeploy the last good Vercel production deployment.
- **Bad migration already applied:** restore the Neon branch to a timestamp before the migration (PITR) or promote a child branch taken before migrate. Then point Vercel `DATABASE_URL` at the restored compute. Do not edit applied SQL.
- **Forward-fix:** add `0012_*.sql` (or later) that corrects data or schema. Apply it the same way as any other migration. Do not edit `0011_keen_korvac.sql` after it has been applied.

## Migration `0010_nostalgic_scarecrow.sql`

Phase 10 hiring/ATS/onboarding tables live in this file. The same generated migration also creates research tables because those tables were already registered in `db/schema` when `db:generate` ran:

- Hiring: requisitions, job description versions, job postings, applications, answers, stage history, interview plans/scorecards, background checks, drug screens, employees, onboarding templates/instances/tasks, transactional email events, interview calendar events, candidate dedupe flags, plus columns on `jobs`, `interviews`, and `offers`.
- Research (schema only, not a Phase 10 product module): `research_sessions`, `research_cache`, `external_research_results`.
- Additive columns on `ai_usage_events`: `model_tier`, `web_search_calls`, `tavily_requests`.

Organizations use `ON DELETE restrict`. Foreign keys are indexed. No forward-fix is required for Phase 10 go-live. The unfinished research/AI runtime that would consume those research tables is parked at commit `1a356d3` on `follow-on/parked-working-tree` and must not be merged as part of Phase 10.

## Repeatability

A clean database should apply `0000`–`0011` in journal order, then `db:seed:prod` (catalog) or `db:seed:dev` (fixtures). Migrations must not insert Harbor, Taylor Ellis, SkillBridge people, fake applicants, or other development fixtures. `seedPhase10Fixtures` runs only from development seed.

The Neon project currently has a single unprotected branch named `production` that contains development fixtures and already has `0011_keen_korvac` applied. Do not treat that branch as launch production. Create distinct `development` / `preview` branches and a **protected, fixture-free** production branch before cutover. See `docs/operations/PRODUCTION_ACTIVATION.md`.
