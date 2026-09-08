# PierOne public website architecture

Status: accepted  
This is not Phase 11 of WorkforceOS. It is the public business front door for PierOne Partners.

## Surfaces

| Surface | Origin | Role |
| --- | --- | --- |
| Public website | `pieronepartners.com` / `www.pieronepartners.com` | Marketing, employer inquiry, careers rendering, Military Talent Network intake, SkillBridge-eligible employer opportunities |
| WorkforceOS | `app.pieronepartners.com` | Private operating system; system of record |

## Request path

```
Browser
  → PierOne public website (Next.js, separately deployable)
    → WorkforceOS Public Gateway `/api/public/v1/*`
      → WorkforceOS service layer
        → Neon PostgreSQL
```

The browser never receives database credentials. The public website must not import Drizzle or call Neon. Public DTOs are not database rows.

Sensitive writes (inquiry, application, military talent) go **server-to-server**: website route/action → WorkforceOS gateway. Job listing reads are also fetched on the website server, with short revalidation.

## Repository layout

Same Git repository (`willjksn/workforceos`), two applications:

- **WorkforceOS** remains at the repository root (`app/`, `lib/`, `db/`). Do not relocate it.
- **Public website** lives at `sites/pierone` with its own `package.json`, Next.js app, and Vercel project (`Root Directory = sites/pierone`).

Shared **public contracts**: `packages/public-api-contracts` for WorkforceOS. The public website vendors a copy at `sites/pierone/lib/contracts.ts` so Vercel `Root Directory = sites/pierone` does not import files outside that app. Keep the two files in sync.

## Sources of truth

| Content | Owner |
| --- | --- |
| Homepage, services, about, insights, brand | Public website code/content |
| Featured jobs, banners, announcements, campaigns | WorkforceOS `public_content_items` (DEC-WEB-007) |
| Jobs, applications, candidates, SkillBridge profiles, CRM inquiries | WorkforceOS |

Closing a job in WorkforceOS must stop public applications and featured placement without a website deploy.

Frequently changing operational public content is published from WorkforceOS and consumed by `GET /api/public/v1/content`. See `docs/public-site/PUBLIC_CONTENT_PUBLISHING.md`. Stable brand copy stays in `sites/pierone`.


## Existing careers on WorkforceOS

Phase 10 already publishes `/careers`, `/jobs/[slug]`, `GET /api/public/v1/jobs`, `GET /api/public/v1/jobs/[slug]`, and `POST /api/public/v1/applications` on the WorkforceOS app. Those routes remain as the gateway and as a fallback on `app.pieronepartners.com`. `pieronepartners.com` is the public front door.

## Inquiry model

Website employer inquiries become `website_inquiries` intake records, then safely linked Company / Contact / Activity. Opportunities are **not** created automatically. Humans qualify, then convert.

## Independent deploy

Marketing copy can ship without a WorkforceOS release. Gateway contract changes require a WorkforceOS release. Production resume upload requires a working S3-compatible `StorageProvider`.
