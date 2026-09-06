# PierOne public website + WorkforceOS production activation

Status: in progress — **NO-GO** until P0 blockers below are cleared.  
This is not Phase 11. Do not recreate Neon, Clerk, or the existing WorkforceOS Vercel project.

## Target architecture

| Surface | Deploy from | Production origin |
| --- | --- | --- |
| Public website | `sites/pierone` (separate Vercel project) | `https://pieronepartners.com` (canonical). `www` redirects to apex. |
| WorkforceOS | repository root (existing Vercel project) | `https://app.pieronepartners.com` |

Browser → PierOne website server → signed request → `https://app.pieronepartners.com/api/public/v1/...` → service layer → Neon.

The browser must not receive Neon credentials, `PUBLIC_SITE_INTEGRATION_SECRET` / `WORKFORCEOS_SITE_SECRET`, or privileged internal routes.

## Current environment facts (2026-09-06)

- Git branch: `pierone-public-website` (from Phase 10 `b146803`). Public-site work was uncommitted at preflight.
- Neon project: `workforceos` / `quiet-hall-55763722` (aws-us-east-2).
- Neon branches:
  - `production` (`br-tiny-waterfall-axrq9vud`) — default, **unprotected**, contains development fixtures. Do not treat as launch production.
  - `development` (`br-plain-hill-axlz0ekz`) — created 2026-09-06 as a child of the current default. Local `.env.local` now points here.
  - `preview` (`br-young-snow-axxdqtxi`) — created 2026-09-06 as a child of the current default. Also contains fixtures; do not promote.
- `npm run db:check` against that branch: connected, `vector` + `pg_trgm` present, migrations through `0012_wise_scourge` after Public Content, **`developmentFixturesDetected: true`**.
- Local `.env.local`: `NEON_BRANCH=development` after activation preflight retarget. `STORAGE_PROVIDER=local`. Resend/S3/HMAC secrets unset.
- Vercel CLI: not authenticated in this agent environment.
- Legal pages: placeholders. Forms already link to `/privacy` and `/candidate-privacy`.

Treat the current Neon `production` branch as the **development database**. Do not collect real candidate data on it.

## P0 launch blockers

1. Private production R2/S3 (`STORAGE_PROVIDER=s3` plus `S3_*`).
2. Resend sending domain verified (SPF/DKIM/DMARC as Resend reports).
3. Two Vercel projects: PierOne Website (`Root Directory = sites/pierone`) and existing WorkforceOS (root).
4. `pieronepartners.com` DNS on the website project.
5. `app.pieronepartners.com` DNS on WorkforceOS.
6. Clean production Neon (no Harbor / Taylor Ellis fixtures). Create `development` and `preview` branches; cut production over to a protected branch seeded only with `db:seed:prod`.
7. `PUBLIC_SITE_INTEGRATION_SECRET` / `WORKFORCEOS_SITE_SECRET` set to the same value; production rejects unsigned cross-origin writes.
8. Counsel-approved Privacy Policy, Candidate Privacy Notice, and Website Terms — or keep application/SkillBridge/employer intake disabled / preview-only.
9. Production resume round-trip with a fake PDF.
10. Production public gateway E2E (inquiry, application, military talent).
11. Apply `0012_wise_scourge` (`public_content_items`) on the eventual production Neon branch. Local development already has it.

Public Content / Careers Publishing is implemented in WorkforceOS. Changing an active `public_content_items` row updates `GET /api/public/v1/content` without a website code deploy (60s cache + optional `/api/revalidate`).

## Soft-launch rule

If legal copy is not counsel-approved, marketing pages may publish but **must not** collect real applications, SkillBridge profiles, or employer PII. Placeholder legal pages must remain labeled as placeholders.

## Operator sequence

Follow Stages 1–14 in the activation request. Do not skip a critical earlier stage. Do not run `db:seed:dev` against a database that will be production. Do not force-push protected branches. Tag `pierone-public-site-v1.0.0` only after production smoke passes.

See also: `docs/public-site/LAUNCH_CHECKLIST.md`, `docs/public-site/ENVIRONMENT_MATRIX.md`, `docs/public-site/PRODUCTION_SMOKE_TEST.md`.
