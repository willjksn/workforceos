# Vercel deployment checklist

WorkforceOS deploys the existing GitHub repository `willjksn/workforceos` to Vercel. Do not create a second application or reinitialize Git.

## Platform setup

- [ ] GitHub repository connected (`https://github.com/willjksn/workforceos`)
- [ ] Vercel project created by importing that existing repo (Production branch: `main`)
- [ ] Neon project connected (`quiet-hall-55763722`)
- [ ] Development DB identified (recommended Neon branch: `development`)
- [ ] Preview DB identified (Neon preview branches or a dedicated `preview` branch)
- [ ] Production DB identified (clean, protected Neon branch with no Harbor/Taylor Ellis fixtures)
- [ ] `DATABASE_URL` configured per Vercel environment (pooled)
- [ ] `DATABASE_URL_UNPOOLED` available for migrate commands (not required in the Vercel runtime)

## Clerk

- [ ] Clerk development keys configured (local)
- [ ] Clerk preview keys configured (Clerk test/development instance)
- [ ] Clerk production keys configured (Clerk live instance; do not put these in local `.env.local`)
- [ ] Clerk production domain configured (`app.pieronepartners.com` when ready, plus the Vercel URL)
- [ ] Public sign-up disabled; invitations only
- [ ] Allowed origins / redirect URLs include `/sign-in` and `/sign-up`

## Optional services

- [ ] Inngest variables configured (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`) when background jobs are needed
- [ ] Inngest app serve path registered as `/api/inngest`
- [ ] Storage variables configured if file uploads are required (`STORAGE_PROVIDER=s3` plus `S3_*`)
- [ ] `NEXT_PUBLIC_APP_URL` set per environment (preview Vercel URL; production `https://app.pieronepartners.com`)
- [ ] `SENTRY_DSN` set when error monitoring is required (optional; logs still redact secrets/PII)
- [ ] Resend: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` after domain verification (`careers@` / `noreply@pieronepartners.com`). DNS is not assumed complete. Production without these keys fails clearly.
- [ ] `PUBLIC_CAREERS_URL` when pieronepartners.com/careers is live
- [ ] Do not treat `CHECKR_API_KEY` as a live integration. Checkr HTTP API is not wired. Manual background-check workflow only.
- [ ] Do not set unused `DRUG_SCREEN_*` until a vendor is selected

## Data

- [ ] Production migration applied (`DATABASE_URL_UNPOOLED` + `npm run db:migrate`)
- [ ] Required production seed applied (`npm run db:seed:prod` only)
- [ ] First Clerk user synced, then Managing Partner granted (`npm run db:bootstrap-admin -- --email …`)
- [ ] `npm run db:check` on production reports no development fixtures

## Local quality gates

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] Phase tests pass (`npm run test:db-acceptance`, `npm run test:phase2` through `npm run test:phase10`, `npm run test:smoke`)
- [ ] `npm run build` passes

## Preview smoke

- [ ] Preview deployment successful
- [ ] Clerk login successful
- [ ] Unauthenticated protected route blocked (`/app`, `/app/jobs`, `/app/military`, `/app/admin/system-health`)
- [ ] Authenticated `/app` loads Command Center with stored aggregates
- [ ] `/app/reports`, `/app/alerts`, `/app/admin/data-quality`, `/app/admin/access-review` load for authorized roles
- [ ] Local WorkforceOS user sync verified
- [ ] Local WorkforceOS user sync verified
- [ ] Role/permission verified
- [ ] Database read verified (company / candidate / job)
- [ ] Database write verified (one safe test write)
- [ ] Audit event verified
- [ ] Inngest health verified (if keys are set)
- [ ] System health page verified (`/app/admin/system-health`)

## Production go-live

- [ ] Production deployment approved
- [ ] Production Clerk live keys only on the Vercel Production environment
- [ ] Clerk production domain includes `app.pieronepartners.com` (when cut over) plus the Vercel URL
- [ ] Public sign-up disabled; invitations only
- [ ] Local development still uses Clerk test keys
- [ ] Production database is a clean branch (no Harbor/Taylor Ellis fixtures); `npm run db:check` reports fixtures absent
- [ ] `npm run test:smoke` against production or a restored production-like branch
- [ ] Neon PITR retention confirmed; recovery procedure in the operating playbook
