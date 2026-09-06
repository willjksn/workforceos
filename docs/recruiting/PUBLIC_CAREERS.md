# Public careers

WorkforceOS publishes approved jobs for PierOne Partners. This is not a public job marketplace.

## URLs

- Site: `/careers` and `/jobs/[slug]`
- API: `GET /api/public/v1/jobs`, `GET /api/public/v1/jobs/[slug]`, `POST /api/public/v1/applications`

Authenticated `/app` routes stay private. `lib/auth/public-paths.ts` allows the careers and public API prefixes.

## Visibility

`job_postings.visibility`: public, unlisted, internal_only, closed.

`client_visibility`: public, confidential, internal_only. Confidential postings use a display name such as "Confidential client" and omit hiring-manager and compensation internals.

SkillBridge postings include `skillbridgeDisclaimer`. Participation is not guaranteed.

## Security

- Rate limit: `RATE_LIMITS.publicApplication`
- Honeypot field `company_website`
- Resume validation in `lib/hiring/files.ts` (size, extension, magic bytes)
- Closed, cancelled, filled, and expired jobs reject applications
- Duplicate applications to the same job within 24 hours are rejected
