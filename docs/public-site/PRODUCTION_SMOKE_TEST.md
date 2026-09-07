# Production smoke test

Run only after P0 blockers pass and production domains resolve. Use **clearly fake** data. Do not use real candidate PII. Archive or delete test records afterward.

## Employer inquiry

1. Open `https://pieronepartners.com/contact` (or Work With PierOne).
2. Submit a fake company inquiry to a safe inbox.
3. Confirm website success state.
4. Confirm WorkforceOS `/app/crm/inquiries` shows the intake (not an automatic opportunity).
5. Confirm acknowledgement email and `transactional_email_events`.
6. Scout: “Show me new website inquiries.”

## Candidate application + resume

1. Publish a disposable public test job if needed.
2. Apply from `https://pieronepartners.com/careers` with a generated PDF (not a real resume).
3. Confirm application stored, candidate reused/created, resume in private object storage.
4. Recruiter with `candidate_pii.read` can download via `/api/files/[fileId]`.
5. Anonymous / public URL cannot fetch the object.
6. Internal candidate UUID is not in the public response.
7. Delete/archive the test file and records.

## SkillBridge / military talent

1. Submit a fake join profile from `/skillbridge/join`.
2. Confirm Candidate + SkillBridge profile reuse (no duplicate person).
3. Confirm acknowledgement email.
4. Scout: “Show military talent profiles submitted today.”

## Security spot-checks

- Unsigned or bad HMAC POST to `/api/public/v1/inquiries` → 401
- Spoofed `Origin: https://app.pieronepartners.com` without HMAC → 401
- Tampered multipart resume or form field → 401
- Closed/expired job apply → rejected
- Honeypot field filled → rejected
- Confidential client job: no client legal name in HTML or JobPosting JSON-LD

## Do not tag until this page is checked off

Release tag: `pierone-public-site-v1.0.0`.
