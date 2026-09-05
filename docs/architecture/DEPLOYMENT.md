# Deployment

WorkforceOS deploys to Vercel as a Next.js App Router application.

## Required environment variables

Production and preview deployments need:

- `DATABASE_URL` — Neon connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`

Enable as features are connected:

- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `STORAGE_PROVIDER=s3` plus `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `AI_PROVIDER`, `AI_API_KEY`
- `SENTRY_DSN` when Sentry is wired
- `APP_VERSION`

Do not put secrets in client bundles. Only `NEXT_PUBLIC_*` values are public.

## Serverless constraints

- Database access uses Neon HTTP (`drizzle-orm/neon-http`) for ordinary queries.
- Do not assume a local filesystem in production. The local storage adapter is development-only.
- Background work must go through Inngest, not long-running request handlers.
- Protected `/app` routes are dynamic.

## Neon preview branching

Future preview deployments should use Neon database branches:

1. Create a branch from the parent environment database.
2. Set `DATABASE_URL` on the Vercel preview to the branch connection string.
3. Run the same Drizzle migrations.
4. Seed only if the preview needs fixture data; never seed production from development fixtures.

This is the intended strategy. It is not automatically provisioned until Neon and Vercel projects are connected.

## Clerk

Disable public sign-ups. Issue invitations for internal users. Local PostgreSQL roles remain the authorization source of truth.

## Inngest

Set the serve path to `/api/inngest`. Production uses Inngest Cloud; local development uses `npm run inngest:dev`.
