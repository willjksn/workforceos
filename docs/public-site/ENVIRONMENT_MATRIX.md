# Environment variable matrix

Do not put secrets in `NEXT_PUBLIC_*` variables or client bundles. This table lists **names only**. Status is as of the 2026-09-06 preflight unless updated after cutover.

Legend: D = development, Pv = preview, Pd = production. Status: `unset` means not present in local `.env.local`; live Vercel values were not readable (CLI not logged in).

| VARIABLE | PUBLIC SITE? | WORKFORCEOS? | D | Pv | Pd | SECRET? | REQUIRED? | STATUS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | yes | no | `http://localhost:3001` | preview origin | `https://pieronepartners.com` | no | yes (site) | example only locally |
| `WORKFORCEOS_PUBLIC_API_URL` | yes | no | `http://localhost:3000/api/public/v1` | preview gateway | `https://app.pieronepartners.com/api/public/v1` | no | yes (site) | example only locally |
| `WORKFORCEOS_SITE_SECRET` | yes | no | optional | yes if writes enabled | **required** | yes | production writes | unset locally |
| `NEXT_PUBLIC_APP_URL` | no | yes | `http://localhost:3000` | preview URL | `https://app.pieronepartners.com` | no | yes | unset locally (defaults) |
| `APP_URL` | no | yes | same as app URL | preview URL | `https://app.pieronepartners.com` | no | recommended | unset locally |
| `PUBLIC_CAREERS_URL` | no | yes | optional | optional | `https://pieronepartners.com/careers` | no | production | unset locally |
| `PUBLIC_SITE_INTEGRATION_SECRET` | no | yes | optional | yes if writes enabled | **required** (same value as site secret) | yes | production writes | unset locally |
| `PUBLIC_SITE_ALLOWED_ORIGINS` | no | yes | `http://localhost:3001` | preview site origin(s) | `https://pieronepartners.com,https://www.pieronepartners.com` | no | production writes | example lists public hosts |
| `PUBLIC_INTAKE_ORGANIZATION_ID` | no | yes | optional | optional | set if more than one org | no | if not default slug | unset; resolver uses `workforceos` slug |
| `DATABASE_URL` | no | yes | development branch pooled | preview pooled | production pooled | yes | yes | set locally (currently the sole Neon branch named production) |
| `DATABASE_URL_UNPOOLED` | no | yes | development direct | preview direct | production direct | yes | migrations | set locally |
| `NEON_BRANCH` | no | yes | `development` (target) | `preview` | `production` | no | recommended | local value is `production` — **do not treat as clean prod** |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | no | yes | test | test | live | no | sign-in | set locally (test) |
| `CLERK_SECRET_KEY` | no | yes | test | test | live | yes | sign-in | set locally |
| `INNGEST_EVENT_KEY` | no | yes | optional | as needed | as needed | yes | background jobs | unset locally |
| `INNGEST_SIGNING_KEY` | no | yes | optional | as needed | as needed | yes | background jobs | unset locally |
| `STORAGE_PROVIDER` | no | yes | `local` | `s3` | `s3` | no | production resumes | local=`local` |
| `LOCAL_STORAGE_DIR` | no | yes | `.data/storage` | unused | unused | no | local only | default |
| `S3_BUCKET` | no | yes | unused | preview bucket | production private bucket | no | when `s3` | unset |
| `S3_REGION` | no | yes | unused | R2 `auto` typical | R2 `auto` typical | no | when `s3` | unset |
| `S3_ENDPOINT` | no | yes | unused | R2 endpoint | R2 endpoint | no | R2 | unset |
| `S3_ACCESS_KEY_ID` | no | yes | unused | preview | production | yes | when `s3` | unset |
| `S3_SECRET_ACCESS_KEY` | no | yes | unused | preview | production | yes | when `s3` | unset |
| `RESEND_API_KEY` | no | yes | optional (mock if unset) | test key or unset | **required** | yes | production mail | unset |
| `RESEND_FROM_EMAIL` | no | yes | optional | verified test sender | verified sender | no | with API key | unset |
| `RESEND_REPLY_TO_EMAIL` | no | yes | optional | optional | recommended | no | recommended | unset |
| `SENTRY_DSN` | no | yes | optional | optional | optional | yes | no (P1) | unset; Sentry not wired |
| `SITE_DEV_PORT` | yes | no | `3001` | n/a | n/a | no | no | docs only |

Public-site analytics variables: **none configured**. Do not block launch on analytics.

Preview must not submit writes into production Neon/storage. If a preview website must read production jobs, disable apply / inquiry / SkillBridge join on that preview.
