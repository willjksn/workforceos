# Careers flow

Jobs are authored in WorkforceOS. The public website renders them.

1. Recruiter publishes a `job_postings` row with `visibility=public`, `public_status=published`, `application_open=true`.
2. `GET /api/public/v1/jobs` lists those rows. Confidential `client_visibility` hides client identity.
3. `pieronepartners.com/careers` and `/jobs/[slug]` fetch that API on the website server.
4. Apply posts to the website `/api/apply`, which calls `POST /api/public/v1/applications` with the resume file.
5. WorkforceOS dedupes Candidate by email/phone, stores the resume through `StorageProvider`, and creates an Application.
6. Closed, cancelled, filled, and expired jobs reject applications without a website deploy. Featured Public Content rows that link those jobs also stop rendering at query time (`GET /api/public/v1/content`).

Homepage, Careers, and SkillBridge can render WorkforceOS-published banners, featured jobs, SkillBridge features, notices, announcements, and industry campaigns. Empty groups omit the section. See `docs/public-site/PUBLIC_CONTENT_PUBLISHING.md`.


Production resume upload requires a working S3-compatible adapter (`STORAGE_PROVIDER=s3` plus credentials). Local adapter is development-only.
