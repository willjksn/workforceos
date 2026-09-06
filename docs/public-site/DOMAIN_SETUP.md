# Domain setup

Do not hardcode these hosts in application logic. Use `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, and `WORKFORCEOS_PUBLIC_API_URL`.

## DNS (production)

| Host | Record | Target |
| --- | --- | --- |
| `pieronepartners.com` | A / ALIAS / CNAME per Vercel | PierOne Website project |
| `www.pieronepartners.com` | CNAME or redirect | apex `pieronepartners.com` |
| `app.pieronepartners.com` | CNAME | WorkforceOS Vercel project |

Canonical host: **`pieronepartners.com`**. Redirect `www.pieronepartners.com` → `https://pieronepartners.com`. Set `NEXT_PUBLIC_SITE_URL=https://pieronepartners.com` so sitemap, canonical, and Open Graph URLs match.

## Clerk

Clerk production domains stay on WorkforceOS (`app.pieronepartners.com` plus the Vercel URL). Do not add Clerk to the public website. Anonymous candidates and employers do not sign in.

## CORS

Preferred: no browser CORS to WorkforceOS. The public website server calls the gateway. If a browser call is ever required, allow only `PUBLIC_SITE_ALLOWED_ORIGINS`.

## TLS

Terminate TLS on Vercel for both projects. Do not mix environments (preview WorkforceOS must not be the production website's API target).
