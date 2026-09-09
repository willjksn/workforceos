# Deployment

WorkforceOS deploys to Vercel as a Next.js App Router application from the existing GitHub repository `willjksn/workforceos`.

See also:

- `docs/architecture/DATABASE_DEPLOYMENT.md`
- `docs/architecture/VERCEL_DEPLOYMENT_CHECKLIST.md`

## Required environment variables

Production and preview deployments need:

- `DATABASE_URL` — Neon pooled connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- After sign-in, users go to `/app` (set in the app; optional Vercel Config vars `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/app` and `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/app`)
- `NEXT_PUBLIC_APP_URL` — origin for that environment (preview Vercel URL or `https://app.pieronepartners.com`)

Recommended for migrations (run locally or in a controlled job, not during `next build`):

- `DATABASE_URL_UNPOOLED` — Neon direct connection string
- `NEON_BRANCH` — branch name for operator awareness (`development`, preview name, or `production`)

Enable as features are connected:

- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `STORAGE_PROVIDER=s3` plus `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. The S3-compatible adapter is implemented. Candidate resumes stay private (no public bucket URL).
- `AI_PROVIDER`, `AI_API_KEY` (or `OPENAI_API_KEY` as an OpenAI-compatible alias). Do not put AI keys in `NEXT_PUBLIC_*`.
- Capability-class models (DEC-AI-011): `AI_MODEL_FAST`, `AI_MODEL_STANDARD`, `AI_MODEL_REASONING`, `AI_MODEL_EMBEDDING`. Aliases: `OPENAI_MODEL_FAST`, `OPENAI_MODEL_BALANCED` / `AI_MODEL`, `OPENAI_MODEL_PRIMARY`, `OPENAI_EMBEDDING_MODEL`. `AI_FALLBACK_MODEL` remains. `AI_BASE_URL` is optional (default `https://api.openai.com/v1`).
- Development / Preview / Production should use separate AI keys where Vercel already has env per environment. When the key is unset, System Health labels the runtime **HEURISTIC**, not live.
- `SENTRY_DSN` when Sentry is wired
- `APP_VERSION`

Optional Integration Hub credentials (unconfigured providers stay labeled mocks):

- `QUICKBOOKS_CLIENT_ID` / `QUICKBOOKS_CLIENT_SECRET`
- `DOCUSIGN_INTEGRATION_KEY` / `DOCUSIGN_USER_ID` / `DOCUSIGN_SECRET_KEY`
- `APOLLO_API_KEY`
- `ONET_API_KEY`
- `SEEKOUT_API_KEY`
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `INTEGRATION_WEBHOOK_SECRET`

Do not put secrets in client bundles. Only `NEXT_PUBLIC_*` values are public. `CLERK_SECRET_KEY`, `DATABASE_URL`, Inngest signing keys, `AI_API_KEY`, `OPENAI_API_KEY`, and `S3_SECRET_ACCESS_KEY` are server-only.

`STORAGE_PROVIDER=local` is development-only. Production and Vercel builds fall back to an unconfigured storage adapter until S3-compatible credentials are set. Read-only deploys can go live without storage; uploads will fail until R2/S3 is configured.

## Environment mapping

| Variable | Development | Preview | Production |
| --- | --- | --- | --- |
| `DATABASE_URL` | Neon `development` pooled URL | Preview branch pooled URL | Production branch pooled URL |
| `DATABASE_URL_UNPOOLED` | Neon `development` direct URL | Preview branch direct URL | Production branch direct URL |
| Clerk keys | Test (`pk_test_` / `sk_test_`) | Test unless a separate Clerk instance is required | Live (`pk_live_` / `sk_live_`) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://<preview>.vercel.app` | `https://app.pieronepartners.com` |
| Inngest | Optional / Inngest Dev Server | Optional until jobs are needed | Inngest Cloud when jobs are needed |
| Storage | `local` | R2/S3 test bucket recommended | R2/S3 production bucket |
| AI keys | Development key or unset (heuristic) | Preview key or unset (heuristic) | Production key; System Health must say LIVE vs HEURISTIC |
| `AI_MODEL_FAST` / `STANDARD` / `REASONING` / `EMBEDDING` | Capability-class names for this environment | Same, preview-specific if needed | Production capability-class models |

Do not put production Clerk live keys in `.env.local`.

## Serverless constraints

- Database access uses Neon HTTP (`drizzle-orm/neon-http`) for ordinary queries.
- Do not assume a local filesystem in production. The local storage adapter is development-only.
- Background work must go through Inngest, not long-running request handlers.
- Protected `/app` routes are dynamic.
- `next build` does not migrate or seed the database.

## Neon preview branching

Use a different Neon database per environment. The current Neon default branch is named `production` and already contains development fixtures; do not treat it as a clean production database.

Recommended:

1. Create a `development` branch for local work (or keep using the current fixture-filled branch only as development).
2. Create a clean, protected production branch: migrate, then `npm run db:seed:prod` only.
3. For Vercel preview deployments, enable the Neon integration so each preview gets a database branch, **or** point Preview `DATABASE_URL` at a dedicated `preview` branch.
4. Run the same Drizzle migrations on every branch (`npm run db:migrate` with that branch's `DATABASE_URL_UNPOOLED`).
5. Seed development fixtures only on development/preview. Never seed production from `db:seed:dev`.

## Clerk

Disable public sign-ups. Issue invitations for internal users. Local PostgreSQL roles remain the authorization source of truth.

Development and Preview: Clerk development/test instance.

Production: Clerk production/live instance. Add these domains in the Clerk Dashboard before switching live keys:

- Vercel production URL
- Custom domain `app.pieronepartners.com` (when DNS is ready)
- Sign-in/sign-up paths `/sign-in` and `/sign-up`

Do not hard-code `app.pieronepartners.com` in application logic. Set `NEXT_PUBLIC_APP_URL`.

## Inngest

Set the serve path to `/api/inngest`. Production uses Inngest Cloud; local development uses `npm run inngest:dev`.

Inngest is optional for the first read-only/preview smoke deploy. Existing job functions stay in the repo and stay idle until keys are set.

Vercel: add `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`.

Inngest Dashboard: create the app, register `https://<deployment>/api/inngest`.

## First preview procedure

1. Import `willjksn/workforceos` into Vercel (root directory `.`, framework Next.js, production branch `main`).
2. In Vercel → Project → Settings → Environment Variables, add Preview values: `DATABASE_URL` (preview or current development Neon pooled URL), Clerk **test** keys, `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`, `NEXT_PUBLIC_APP_URL=https://<preview-host>`.
3. Apply migrations to that Neon branch with `DATABASE_URL_UNPOOLED`, then `npm run db:check`.
4. If the preview should show companies/candidates/jobs, run `npm run db:seed:dev` against that branch only.
5. Deploy the Preview. Confirm:
   - Vercel build succeeds
   - `/sign-in` loads
   - Clerk test login works
   - `/app` loads after sign-in
   - `/app/admin/system-health` loads for a Managing Partner
   - Neon connectivity is OK on the health page
   - A local `users` row exists for the Clerk identity
   - RBAC hides Admin from non-admins
   - Company/candidate/job reads work
   - One safe test write works and an audit event is stored
   - `/api/inngest` is reachable if Inngest keys are set
6. After the first sign-in, if the user has no role: `npx tsx scripts/grant-managing-partner.ts --email you@company.com`

Do not use real client or candidate data for this validation.

## Vercel dashboard steps

1. vercel.com → Add New → Project → Import Git Repository → `willjksn/workforceos`.
2. Framework Preset: Next.js. Root Directory: `.`. Build Command: default `next build`.
3. Do not add a migrate command to the Vercel build.
4. Settings → Environment Variables: set Development, Preview, and Production separately. Never share one `DATABASE_URL` across all three.
5. Settings → Domains: add `app.pieronepartners.com` only when DNS and production Clerk are ready.

## Neon dashboard steps

1. Open project `quiet-hall-55763722`.
2. Keep the current fixture-filled default branch for development, or create `development` from it and point local `.env.local` at that branch.
3. Create a **new** production branch that does not contain Harbor/Taylor Ellis data (schema-only child, or migrate + `db:seed:prod` on a clean branch). Enable branch protection on real production.
4. Optional: Neon → Vercel integration for per-preview database branches.
5. Copy pooled URLs into Vercel `DATABASE_URL`. Keep direct URLs for `npm run db:migrate`.
