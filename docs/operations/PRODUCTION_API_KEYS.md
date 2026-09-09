# Production API keys

Operator checklist for configuring WorkforceOS environment variables. **Never write actual secret values in git, tickets, System Health, Scout, or this file.** Never put secrets in `NEXT_PUBLIC_*`.

Canonical env schema: `lib/env.ts`. Presence (not values) is inventoried with `vercel env ls`. System Health at `/app/admin/system-health` labels configured vs not. Remaining-work row: Phase M in `MASTER_COMPLETION_LEDGER.md`.

Set keys in the Vercel project for the environment that needs them. Production is `app.pieronepartners.com`. Preview is Git preview deployments. Development is local `.env.local` / Neon development.

| Where | Use |
| --- | --- |
| Vercel **Production** | Live Clerk, Neon `production-launch`, R2, Resend, HMAC, optional live AI |
| Vercel **Preview** | Clerk test keys, preview Neon, optional mocks |
| Vercel **Development** / local `.env.local` | Local `npm run dev` only |

Do not rotate DNS or overwrite a live Encrypted Vercel variable without a defect. Do not run `db:seed:dev` against production.

## Required vs optional

**Required for production to operate as designed:** `DATABASE_URL`, Clerk live keys, `STORAGE_PROVIDER=s3` plus R2/S3 credentials, `PUBLIC_SITE_INTEGRATION_SECRET`, `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (transactional email), `NEXT_PUBLIC_APP_URL` / `APP_URL` (invite links).

**Optional until the named Phase I vendor is ready:** calendar OAuth, Checkr, DocuSign, QuickBooks, SeekOut/Apollo, Sentry SDK, BLS/Census, Inngest, live AI key. Missing optional keys must stay honestly unlabeled / mock / heuristic — never silently invented.

`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is public by design (browser). It is not a secret. `CLERK_SECRET_KEY` is a secret.

## Checklist (names only)

| Group | Variable | Purpose | Required | System Health signal | Set on |
| --- | --- | --- | --- | --- | --- |
| Runtime | `NODE_ENV` | Node environment | Platform-set | Deployment environment | Vercel all |
| Runtime | `APP_VERSION` | Displayed app version | Optional | App version | Production / preview |
| Database | `DATABASE_URL` | Neon pooled app connection | **Required** | Database | Production / preview / development |
| Database | `DATABASE_URL_UNPOOLED` | Neon direct URL for migrations | Required for migrate | — (ops) | Production / preview / development |
| Database | `NEON_BRANCH` | Branch label for health | Recommended | Deployment environment | Production (`production-launch`) / development |
| Clerk | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Browser publishable key | **Required** | Clerk (`pk_live_` in production) | Production live / preview test |
| Clerk | `CLERK_SECRET_KEY` | Server secret | **Required** | Clerk | Same as publishable |
| Clerk | `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Sign-in path | Recommended | — | All |
| Clerk | `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Sign-up path (invite) | Recommended | — | All |
| Clerk | `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Post sign-in redirect | Optional | — | All |
| Clerk | `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Post sign-up redirect | Optional | — | All |
| Inngest | `INNGEST_EVENT_KEY` | Background jobs | Optional | Inngest | Production / preview when jobs are live |
| Inngest | `INNGEST_SIGNING_KEY` | Job signing | Optional (pair) | Inngest | Same |
| Storage | `STORAGE_PROVIDER` | `local` or `s3` | **Required** (`s3` in prod) | Storage | Production `s3` / development `local` |
| Storage | `LOCAL_STORAGE_DIR` | Local disk adapter | Dev only | Storage | Development |
| Storage | `S3_BUCKET` | R2/S3 bucket | **Required** if `s3` | Storage | Production / preview |
| Storage | `S3_REGION` | Region hint | Optional | Storage | Production / preview |
| Storage | `S3_ENDPOINT` | R2/S3 endpoint | **Required** if `s3` | Storage | Production / preview |
| Storage | `S3_ACCESS_KEY_ID` | Object storage access | **Required** if `s3` | Storage (presence only) | Production / preview |
| Storage | `S3_SECRET_ACCESS_KEY` | Object storage secret | **Required** if `s3` | Storage (presence only) | Production / preview |
| AI | `AI_PROVIDER` | Provider name (`openai_compatible` / `internal_heuristic`) | Optional | AI runtime LIVE vs HEURISTIC | Production when going live |
| AI | `AI_API_KEY` | Live completions | Optional | AI provider configured | Production / preview |
| AI | `OPENAI_API_KEY` | Alias for `AI_API_KEY` | Optional | Same | Same |
| AI | `AI_BASE_URL` | OpenAI-compatible base URL | Optional | AI runtime | Production / preview |
| AI | `AI_MODEL` | Legacy single-model alias | Optional | — | Any |
| AI | `AI_MODEL_FAST` | FAST capability class | Optional | — | Production / preview |
| AI | `AI_MODEL_STANDARD` | STANDARD capability class | Optional | — | Production / preview |
| AI | `AI_MODEL_REASONING` | REASONING capability class | Optional | — | Production / preview |
| AI | `AI_MODEL_EMBEDDING` | Named embedding model | Optional | Embeddings | Any |
| AI | `AI_FALLBACK_MODEL` | Fallback model name | Optional | — | Any |
| AI | `OPENAI_MODEL_PRIMARY` | Alias → REASONING | Optional | — | Any |
| AI | `OPENAI_MODEL_BALANCED` | Alias → STANDARD | Optional | — | Any |
| AI | `OPENAI_MODEL_FAST` | Alias → FAST | Optional | — | Any |
| AI | `OPENAI_EMBEDDING_MODEL` | Alias → EMBEDDING | Optional | Embeddings | Any |
| Search | `WEB_SEARCH_PRIMARY` | Web search provider name | Optional | — | Any |
| Search | `WEB_SEARCH_FALLBACK` | Fallback search provider | Optional | — | Any |
| Search | `TAVILY_API_KEY` | Tavily | Optional | — | Any |
| Labor | `BLS_API_KEY` | BLS labor stats | Optional | Labor market (BLS / Census) | Production when live |
| Labor | `CENSUS_API_KEY` | Census flows | Optional | Labor market (BLS / Census) | Production when live |
| Sourcing | `TALENT_SOURCING_PROVIDER` | Named sourcing provider | Optional | Talent sourcing | Phase I |
| Sourcing | `HIRE_EZ_API_KEY` | HireEZ | Optional | Talent sourcing | Phase I |
| Sourcing | `SEEKOUT_API_KEY` | SeekOut | Optional | Talent sourcing | Phase I live lookup after internal search |
| Sourcing | `APOLLO_API_KEY` | Apollo enrichment | Optional | Talent sourcing | Phase I review-gated enrich |
| Observability | `SENTRY_DSN` | Error DSN | Optional | Sentry | Production / preview |
| URLs | `NEXT_PUBLIC_APP_URL` | Public app origin | **Required** in prod | — | Production `https://app.pieronepartners.com` |
| URLs | `APP_URL` | Server alias for app origin | Optional | — | Same |
| URLs | `PUBLIC_CAREERS_URL` | Public careers site | Recommended in prod | Public careers URL | Production |
| URLs | `PUBLIC_APP_URL` | Public site origin | Optional | — | Production |
| Finance | `QUICKBOOKS_CLIENT_ID` | QB OAuth | Optional | DocuSign / QuickBooks | Phase I |
| Finance | `QUICKBOOKS_CLIENT_SECRET` | QB OAuth secret | Optional | DocuSign / QuickBooks | Phase I |
| Finance | `QUICKBOOKS_REFRESH_TOKEN` | QB OAuth refresh token | Optional | DocuSign / QuickBooks | Required for LIVE posting |
| Finance | `QUICKBOOKS_REALM_ID` | QB company realm | Optional | DocuSign / QuickBooks | Required for LIVE posting |
| Finance | `QUICKBOOKS_ENVIRONMENT` | `sandbox` or `production` | Optional | DocuSign / QuickBooks | Defaults to sandbox |
| Legal | `DOCUSIGN_INTEGRATION_KEY` | DocuSign | Optional | DocuSign / QuickBooks | Phase I |
| Legal | `DOCUSIGN_USER_ID` | DocuSign user | Optional | DocuSign / QuickBooks | Phase I |
| Legal | `DOCUSIGN_SECRET_KEY` | DocuSign secret | Optional | DocuSign / QuickBooks | Required for LIVE envelopes |
| Legal | `DOCUSIGN_ACCOUNT_ID` | DocuSign account | Optional | DocuSign / QuickBooks | Required for LIVE envelopes |
| Legal | `DOCUSIGN_BASE_URL` | DocuSign host | Optional | DocuSign / QuickBooks | Defaults to demo |
| Calendar | `MICROSOFT_CLIENT_ID` | Microsoft OAuth | Optional | Calendar provider | Phase I |
| Calendar | `MICROSOFT_CLIENT_SECRET` | Microsoft secret | Optional | Calendar provider | Phase I |
| Calendar | `MICROSOFT_REFRESH_TOKEN` | Microsoft OAuth refresh token | Optional | Calendar provider | Required for LIVE scheduling |
| Calendar | `MICROSOFT_TENANT_ID` | Entra tenant | Optional | Calendar provider | Defaults to `common` |
| Calendar | `GOOGLE_CLIENT_ID` | Google OAuth | Optional | Calendar provider | Phase I |
| Calendar | `GOOGLE_CLIENT_SECRET` | Google secret | Optional | Calendar provider | Phase I |
| Calendar | `GOOGLE_REFRESH_TOKEN` | Google OAuth refresh token | Optional | Calendar provider | Required for LIVE scheduling |
| Integrations | `INTEGRATION_WEBHOOK_SECRET` | Shared webhook HMAC | Optional | Integrations | Production when webhooks live |
| Email | `RESEND_API_KEY` | Transactional email | **Required** in prod | Resend | Production |
| Email | `RESEND_FROM_EMAIL` | From address | **Required** with key | Resend | Production |
| Email | `RESEND_REPLY_TO_EMAIL` | Reply-to | Optional | Resend | Production |
| Checks | `CHECKR_API_KEY` | Background checks | Optional | Background checks | Phase I + counsel |
| Checks | `CHECKR_WEBHOOK_SECRET` | Checkr webhooks | Optional | Background checks | Phase I |
| Checks | `DRUG_SCREEN_PROVIDER` | Drug-screen vendor | Optional | Drug screens | Not used (manual) |
| Checks | `DRUG_SCREEN_API_KEY` | Drug-screen key | Optional | Drug screens | Not used (manual) |
| Occupations | `ONET_API_KEY` | O\*NET reference | Optional | Integrations | Any |
| Public HMAC | `PUBLIC_SITE_INTEGRATION_SECRET` | HMAC for public writes | **Required** in prod | Public site HMAC | Production / preview if testing signed writes |
| Public | `PUBLIC_SITE_ALLOWED_ORIGINS` | Extra allowed origins | Optional | — | Production |
| Public | `PUBLIC_INTAKE_ORGANIZATION_ID` | Intake org UUID | Optional | — | Production if more than one org |

## Operator steps

1. Open this checklist and Vercel → Project → Settings → Environment Variables (or `vercel env ls`).
2. Confirm each **Required** Production name exists as Encrypted (or Plain for non-secrets such as `NEON_BRANCH`, `STORAGE_PROVIDER`, URLs).
3. Add a missing name only when the value already exists in an operator secret store. Do not overwrite an Encrypted variable. Do not echo values.
4. Confirm `/app/admin/system-health` after deploy: Clerk live, storage ready, HMAC set, AI LIVE vs HEURISTIC, Resend, integrations count.
5. Leave Phase I vendor keys unset until the named app is ready. Do not pretend they are live.

Decrypt limitation: `vercel env pull` / decrypt may return empty strings for Encrypted values in this environment. That is not proof the key is blank. Inventory is by **name and Encrypted/missing**, not by printed value.

## Production inventory (2026-09-08)

`vercel env ls production` on Vercel project `workforceos`. Names only. Values were not printed or pulled.

**Present (Encrypted) on Production:** `NEON_BRANCH`, `DATABASE_URL`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO_EMAIL`, `S3_REGION`, `S3_ENDPOINT`, `S3_BUCKET`, `STORAGE_PROVIDER`, `PUBLIC_CAREERS_URL`, `PUBLIC_SITE_ALLOWED_ORIGINS`, `PUBLIC_SITE_INTEGRATION_SECRET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NODE_ENV`, `APP_VERSION`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `LOCAL_STORAGE_DIR`, `AI_PROVIDER`, `AI_API_KEY`, `SENTRY_DSN`.

Also Encrypted on Preview: `PUBLIC_CAREERS_URL`, `PUBLIC_SITE_INTEGRATION_SECRET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, Clerk keys, `NODE_ENV`, `APP_VERSION`, Inngest keys, `LOCAL_STORAGE_DIR`, `AI_PROVIDER`, `AI_API_KEY`, `SENTRY_DSN`.

**Missing on Production** (from `lib/env.ts`; optional unless noted): `DATABASE_URL_UNPOOLED` (needed for operator migrate, not the app runtime), Clerk fallback redirect URLs, `AI_BASE_URL` / `AI_MODEL*` / `OPENAI_*` aliases (live vs heuristic still depends on `AI_API_KEY`, which is Encrypted but not decryptable here), `WEB_SEARCH_*`, `TAVILY_API_KEY`, `BLS_API_KEY`, `CENSUS_API_KEY`, `TALENT_SOURCING_PROVIDER`, `HIRE_EZ_API_KEY`, `SEEKOUT_API_KEY`, `APOLLO_API_KEY`, `ONET_API_KEY`, `QUICKBOOKS_*` (including `QUICKBOOKS_REFRESH_TOKEN` / `QUICKBOOKS_REALM_ID` for LIVE posting), `DOCUSIGN_*` (including `DOCUSIGN_ACCOUNT_ID` for LIVE envelopes), `MICROSOFT_*` / `GOOGLE_*` (including refresh tokens for LIVE scheduling), `INTEGRATION_WEBHOOK_SECRET`, `CHECKR_*`, `DRUG_SCREEN_*`, `PUBLIC_APP_URL`, `PUBLIC_INTAKE_ORGANIZATION_ID`.

Phase I live paths (names only; values stay in Vercel Encrypted / operator store):

| Live path | Vars required for LIVE (not merely CONFIGURED) |
| --- | --- |
| Calendar | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `GOOGLE_REFRESH_TOKEN` **or** `MICROSOFT_CLIENT_ID` + `MICROSOFT_CLIENT_SECRET` + `MICROSOFT_REFRESH_TOKEN` |
| Scout / transactional send | `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (present Encrypted). Send still needs `scout.external_actions` + confirmation |
| DocuSign | `DOCUSIGN_INTEGRATION_KEY` + `DOCUSIGN_USER_ID` + `DOCUSIGN_SECRET_KEY` + `DOCUSIGN_ACCOUNT_ID` |
| QuickBooks | `QUICKBOOKS_CLIENT_ID` + `QUICKBOOKS_CLIENT_SECRET` + `QUICKBOOKS_REFRESH_TOKEN` + `QUICKBOOKS_REALM_ID` |
| Checkr | `CHECKR_API_KEY` (+ `CHECKR_WEBHOOK_SECRET` for signed webhooks) |
| SeekOut | `SEEKOUT_API_KEY` |
| Apollo | `APOLLO_API_KEY` |
| Sentry | `SENTRY_DSN` (present Encrypted; official SDK) |

No Encrypted Production variable was overwritten. No missing optional Phase I key was invented or uploaded.
