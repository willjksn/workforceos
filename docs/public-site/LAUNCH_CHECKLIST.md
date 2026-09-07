# PierOne public website launch checklist

Canonical host: `https://pieronepartners.com`. WorkforceOS: `https://app.pieronepartners.com`.

## P0 — must pass before GO

- [ ] Working tree reviewed; no secrets, resumes, or real PII committed
- [ ] Distinct Neon `development`, `preview`, and protected `production` branches
- [ ] Production `db:check` reports `developmentFixturesDetected: false`
- [ ] Migrations through `0011_keen_korvac` on the intended production branch
- [ ] Production org exists; intake owner role `managing-partner` (or approved equivalent)
- [ ] Private R2/S3 bucket; no public object URLs
- [ ] Fake resume: upload → DB metadata → authorized download → unauthorized denied → delete/archive
- [ ] Resend domain verified in the Resend dashboard (do not invent DNS)
- [ ] Inquiry, application, and military-talent acknowledgement tests to safe inboxes
- [ ] `PUBLIC_SITE_INTEGRATION_SECRET` = `WORKFORCEOS_SITE_SECRET`; production unsigned writes rejected
- [ ] HMAC tests: valid / invalid / wrong secret / stale / tampered body / spoofed Origin / spoofed Referer / unsigned production / multipart field and resume tamper
- [ ] PierOne Website Vercel project: Root Directory `sites/pierone`
- [ ] Existing WorkforceOS Vercel project unchanged at repo root
- [ ] Preview website cannot write to production
- [ ] `PUBLIC_SITE_ALLOWED_ORIGINS` is an explicit allowlist (no `*`)
- [ ] Apex + www + app DNS from actual Vercel instructions
- [ ] Clerk remains on WorkforceOS only
- [ ] Legal: counsel-approved copy **or** intake disabled / preview-only
- [ ] Preview E2E: inquiry, application, confidential job redaction, SkillBridge apply, military join
- [ ] System Health does not show secrets; production public APIs are not false-green
- [ ] `npm run lint`, `typecheck`, `test`, `test:public-site`, `build` (and existing phase tests) pass

## P1 — not launch-blocking unless business requires them

- [ ] Full browser matrix (Safari)
- [ ] Analytics events without PII
- [ ] CAPTCHA
- [ ] Insights content
- [ ] Licensed photography replacing placeholders
- [ ] Checkr / drug-screen vendors / live calendar OAuth

## Tag

`pierone-public-site-v1.0.0` only after production smoke. See `PRODUCTION_SMOKE_TEST.md`.
