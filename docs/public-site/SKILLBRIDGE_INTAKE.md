# SkillBridge and Military Talent Network intake

## Job application

A SkillBridge-tagged public job uses the same application API. WorkforceOS attaches or creates a `skillbridge_profiles` row for the Candidate as Phase 10 defines.

## Join without a job

`/skillbridge/join` (alias `/military-talent/join`) posts to `POST /api/public/v1/military-talent`.

Flow:

1. Validate and rate-limit.
2. Dedupe Candidate by email/phone. Never create a second person for the same email.
3. Create or update `skillbridge_profiles` (1:1 with Candidate).
4. If a resume is uploaded, store it via `StorageProvider`, set `candidates.current_resume_file_id`, and link `skillbridge_documents` (`document_type=resume`). Resume status becomes `needs_review`. Recruiters with `candidate_pii.read` open it from the SkillBridge profile or candidate profile via `/api/files/[fileId]`.
5. Record a candidate engagement. Notify the configured SkillBridge/military talent owner role.
6. Send acknowledgement email. No guarantee of matching, approval, or employment.

Copy on public pages must not promise SkillBridge approval, placement, or conversion.
