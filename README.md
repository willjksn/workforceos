# WorkforceOS

Internal operating system for a Workforce & Talent Solutions firm. Phase 1 is the technical foundation. Phase 2 adds operating UI for company CRM, the Talent Network, and Professional Search.

WorkforceOS is not a generic ATS and not a public SaaS product in V1.

## Stack

- Next.js App Router + TypeScript
- Vercel
- Neon PostgreSQL
- Drizzle ORM
- Clerk authentication
- Inngest background jobs
- Cloudflare R2 / S3-compatible storage abstraction
- pgvector and pg_trgm
- Server-side authorization in PostgreSQL

Firebase/Firestore, temp staffing, payroll, public job marketplaces, and cap-table/ownership features are out of scope.

## Architecture

PostgreSQL is the system of record. Clerk authenticates; local `users`, `roles`, and `user_roles` authorize. AI agents draft and recommend with provenance; they do not own data or approve their own material output. External providers connect through the Integration Hub.

Canonical documents:

- `docs/architecture/WORKFORCEOS_MASTER_SPEC.md`
- `docs/architecture/DEPLOYMENT.md`
- `docs/architecture/DATABASE_DEPLOYMENT.md`
- `docs/architecture/VERCEL_DEPLOYMENT_CHECKLIST.md`
- `docs/business/SERVICE_CATALOG.md`
- `docs/database/DATA_DICTIONARY.md`
- `docs/database/SCHEMA_SPEC.md`
- `docs/database/MIGRATIONS.md`
- `docs/decisions/DECISION_LOG.md`
- `docs/integrations/INTEGRATION_PLAN.md`
- `docs/requirements/REQUIREMENTS_REGISTRY.md`
- `docs/workflows/SERVICE_WORKFLOWS.md`

Project rules: `.cursor/rules/`.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `/app` is protected. Signed-in operators can use Companies, Talent, Jobs, and Services.

## Environment variables

Copy `.env.example` to `.env.local`. Never commit `.env`, `.env.local`, or `.env.*.local`.

Required for database commands:

- `DATABASE_URL` (pooled, app/runtime)
- `DATABASE_URL_UNPOOLED` (direct, migrations)

Required to sign in:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

Recommended per environment:

- `NEXT_PUBLIC_APP_URL` (`http://localhost:3000` locally)
- `NEON_BRANCH`

Optional until the feature is enabled:

- `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
- `STORAGE_PROVIDER`, `S3_*`
- `AI_PROVIDER`, `AI_API_KEY`
- `SENTRY_DSN`

`next dev` and `next build` do not require every value. Database scripts fail clearly without `DATABASE_URL`. Never put production Clerk live keys in `.env.local`.

## Neon setup

1. Create a Neon project.
2. Enable the `vector` and `pg_trgm` extensions via migrations, not ad-hoc production SQL.
3. Put the pooled connection string in `DATABASE_URL` and the direct URL in `DATABASE_URL_UNPOOLED`.
4. Run `npm run db:migrate` then `npm run db:seed:dev` on a development branch.
5. Production databases use `npm run db:seed:prod` only. Never run development fixtures against production.

## Clerk setup

1. Create a Clerk application.
2. Disable public sign-ups; use invitations.
3. Add the API keys to `.env.local`.
4. Sign-in lives at `/sign-in`. Local PostgreSQL permissions remain authoritative.

## Drizzle commands

```bash
npm run db:generate
npm run db:migrate
npm run db:check
npm run db:seed:dev
npm run db:seed:prod
npm run db:bootstrap-admin
npm run db:verify-core
npm run db:verify-extensions
```

`db:seed` is an alias of `db:seed:dev` and includes Harbor / Taylor Ellis fixtures. `db:seed:prod` seeds organization, roles, launch services, agent registry, and locked requirements only.

Schema changes: edit `db/schema/`, generate a migration, review SQL, migrate, update the data dictionary. See `docs/architecture/DATABASE_DEPLOYMENT.md`.

## Inngest

```bash
npm run dev
npm run inngest:dev
npx tsx scripts/inngest-health.ts
```

The serve handler is `/api/inngest`. The development function is `workforceos/health-test`.

## Testing

```bash
npm test
npm run test:db-acceptance
npm run lint
npm run typecheck
npm run build
```

`npm test` is deterministic and does not require Neon. `npm run test:db-acceptance` requires `DATABASE_URL` and a migrated, seeded database. It stops on the first failure.

## Security principles

- Server-side authorization on every mutation
- Candidate data is Restricted PII
- No secrets in client bundles
- Append-only audit events for material changes
- No ownership/cap-table data in this application

## Deployment

See `docs/architecture/DEPLOYMENT.md` and `docs/architecture/VERCEL_DEPLOYMENT_CHECKLIST.md`. Verify `npm run build`, set Vercel env vars per environment, use Neon HTTP in serverless, apply migrations explicitly, and send background work through Inngest.
