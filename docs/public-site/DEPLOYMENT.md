# PierOne public website deployment

## Vercel projects

| Project | Git repo | Root directory | Production branch | Production origin |
| --- | --- | --- | --- | --- |
| WorkforceOS | `willjksn/workforceos` | repository root | `main` (when cut over) | `https://app.pieronepartners.com` |
| PierOne Website | `willjksn/workforceos` | `sites/pierone` | same Git; independent Vercel project | `https://pieronepartners.com` |

Do not point both Vercel projects at the same Root Directory. Do not relocate the WorkforceOS `app/` directory to create this split.

## Public website environment

Set on the PierOne Website Vercel project only:

| Variable | Purpose |
| --- | --- |
| `WORKFORCEOS_PUBLIC_API_URL` | Origin + path, e.g. `https://app.pieronepartners.com/api/public/v1` |
| `WORKFORCEOS_SITE_SECRET` | Server-only HMAC shared with WorkforceOS. Never `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | Canonical public origin, e.g. `https://pieronepartners.com` |
| `SITE_DEV_PORT` | Local only; default `3001` |

Local WorkforceOS continues on port 3000. Public site: `npm run dev --prefix sites/pierone` (port 3001).

## WorkforceOS environment additions

| Variable | Purpose |
| --- | --- |
| `PUBLIC_SITE_INTEGRATION_SECRET` | Same value as `WORKFORCEOS_SITE_SECRET`. Required in production. Cross-origin public **write** endpoints require a valid HMAC. Unsigned production writes are rejected. |
| `PUBLIC_SITE_ALLOWED_ORIGINS` | Comma-separated origins (e.g. `https://pieronepartners.com,https://www.pieronepartners.com`). Used for origin checks. |
| `PUBLIC_CAREERS_URL` | Canonical public careers URL when the marketing site is live (`https://pieronepartners.com/careers`). |
| `STORAGE_PROVIDER=s3` plus `S3_*` | Required before production resume upload. |

## Builds

WorkforceOS: `npm run lint && npm run typecheck && npm test && npm run build` from repo root.

Public website: `npm run lint && npm run typecheck && npm test && npm run build` from `sites/pierone`.

Root `npm run test:public-site` delegates to the website suite.

## Caching

Public job **GET** responses may use short `Cache-Control` (`s-maxage=60`). POST inquiry, application, and military-talent responses must not be cached.
