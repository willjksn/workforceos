# Public careers

WorkforceOS publishes approved jobs for PierOne Partners. This is not a public job marketplace.

## URLs

- Site: WorkforceOS fallback `/careers` and `/jobs/[slug]`; public front door `pieronepartners.com/careers` and `/jobs/[slug]`
- API: `GET /api/public/v1/jobs`, `GET /api/public/v1/jobs/[slug]`, `POST /api/public/v1/applications`, `POST /api/public/v1/inquiries`, `POST /api/public/v1/military-talent`

Authenticated `/app` routes stay private. `lib/auth/public-paths.ts` allows the careers and public API prefixes. Resume download is `/api/files/[fileId]` and requires a signed-in principal with `candidate_pii.read` for Restricted PII files.

## Visibility

`job_postings.visibility`: public, unlisted, internal_only, closed.

`client_visibility`: public, confidential, internal_only. Confidential postings use a display name such as "Confidential client" and omit hiring-manager and compensation internals.

SkillBridge postings include `skillbridgeDisclaimer`. Participation is not guaranteed.

## Applications

`POST /api/public/v1/applications` accepts `multipart/form-data` (resume upload) or JSON (no file). The apply form posts multipart. JSON remains for tests and programmatic submits without a file.

Resume rules:

- PDF, DOC, or DOCX only
- MIME, extension, and magic-byte checks in `lib/hiring/files.ts`
- 10MB limit
- Stored through `StorageProvider` (private object storage). PostgreSQL stores `files` metadata only.
- Linked to the Candidate (`current_resume_file_id`) and the Application (`application_answers.file_id`)
- Confirmation email uses `EmailProvider`
- Recruiters with `candidate_pii.read` open the file from the application page

## Security

- Rate limit: `RATE_LIMITS.publicApplication`
- Honeypot field `company_website`
- Closed, cancelled, filled, and expired jobs reject applications
- Duplicate applications to the same job within 24 hours are rejected
- Public payloads never include database credentials, compensation internals, or confidential client identity
