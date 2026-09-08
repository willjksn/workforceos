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

## Military Talent / SkillBridge

1. Submit a fake transition profile from `/military-talent/join` (not framed as a PierOne SkillBridge program).
2. Confirm Candidate + Transition Talent Profile reuse (no duplicate person). Matching can begin without a preexisting job.
3. Confirm acknowledgement email (no placement/interview/approval promise).
4. Recruiter with `candidate_pii.read` can open the resume from `/app/military/skillbridge/[id]` or `/app/talent/[id]` via `/api/files/[fileId]`.
5. Scout: “Show transitioning service members submitted today.”
6. Create or use a fake SkillBridge-eligible employer opportunity with an explicit host company. Confirm PierOne is not implied as the host.

## Security spot-checks

- Unsigned or bad HMAC POST to `/api/public/v1/inquiries` → 401
- Spoofed `Origin: https://app.pieronepartners.com` without HMAC → 401
- Tampered multipart resume or form field → 401
- Closed/expired job apply → rejected
- Honeypot field filled → rejected
- Confidential client job: no client legal name in HTML or JobPosting JSON-LD

## Do not tag until this page is checked off

Release tag: `pierone-public-site-v1.0.0`.
