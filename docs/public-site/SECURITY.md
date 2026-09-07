# Public website security

- The public website has no database credentials and does not import Drizzle.
- Browser → website server → WorkforceOS public gateway for writes.
- Zod validation, length limits, HTML tag stripping, honeypot fields, IP rate limits.
- HMAC (`PUBLIC_SITE_INTEGRATION_SECRET` / `WORKFORCEOS_SITE_SECRET`) is required for unauthenticated public writes in production. Development may omit the secret for local testing. Origin/Referer cannot skip HMAC. WorkforceOS `/careers` apply uses `/api/careers/applications`, which CSRF-checks the app origin and then server-signs the request.
- Origin allowlist via `PUBLIC_SITE_ALLOWED_ORIGINS`.
- Resumes: PDF/DOC/DOCX, magic-byte checks, 10MB, private object storage, `files.privacy_class = restricted_pii`.
- Recruiter download remains authenticated `/api/files/[fileId]` with `candidate_pii.read`.
- Public job payloads omit confidential client identity, compensation internals, hiring-manager names, and recruiter notes.
- Public write responses do not return internal application UUIDs to the marketing site.
- CAPTCHA is an optional later hook; it is not required for launch.
- Legal pages are placeholders until counsel approves language.
