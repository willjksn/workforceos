# WorkforceOS public gateway

Base path: `/api/public/v1`

| Method | Path | Auth | Cache |
| --- | --- | --- | --- |
| GET | `/content` | none | `s-maxage=60, stale-while-revalidate=120` |
| GET | `/health` | none | no-store |
| GET | `/jobs` | none, rate-friendly | `s-maxage=60` |
| GET | `/jobs/[slug]` | none | short |
| POST | `/applications` | public write + rate limit + honeypot + HMAC in production | no-store |
| POST | `/inquiries` | public write + rate limit + honeypot + HMAC in production | no-store |
| POST | `/military-talent` | public write + rate limit + honeypot + HMAC in production | no-store |

Public DTOs live in `packages/public-api-contracts`. They are not Drizzle rows.

When `PUBLIC_SITE_INTEGRATION_SECRET` is set, write requests from other origins must send HMAC headers. In production the secret is required; unsigned cross-origin writes are rejected even if the secret was forgotten. Development may omit the secret.

Write requests from other origins must send:

- `X-PierOne-Site-Timestamp`
- `X-PierOne-Site-Signature` = HMAC-SHA256(secret, `METHOD\nPATH\nTIMESTAMP\nBODYHASH`)

JSON body hash is SHA-256 of the raw UTF-8 body. Multipart body hash is SHA-256 of `METHOD\nPATH\nTIMESTAMP` so first-party FormData submissions remain practical. Same-origin WorkforceOS `/careers` posts still work without HMAC.

The PierOne website should call these endpoints from its server (`sites/pierone/app/api/*`), not from the browser.
