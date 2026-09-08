# Military Talent Network intake

PierOne is the intermediary between transitioning service members and employer/host-company opportunities. SkillBridge is a possible pathway, not a PierOne-owned program.

## Job application

A SkillBridge-eligible public job uses the same application API. WorkforceOS attaches or creates a `skillbridge_profiles` (Transition Talent Profile) row for the Candidate as Phase 10 defines. The public job must identify the employer/host company; it must not imply PierOne is automatically the host.

## Join without a job

`/military-talent/join` is the canonical intake (alias `/skillbridge/join` redirects there). It posts to `POST /api/public/v1/military-talent`.

Flow:

1. Validate and rate-limit.
2. Dedupe Candidate by email/phone. Never create a second person for the same email.
3. Create or update `skillbridge_profiles` (1:1 with Candidate). UI language: Transition Talent Profile.
4. If a resume is uploaded, store it via `StorageProvider`, set `candidates.current_resume_file_id`, and link `skillbridge_documents` (`document_type=resume`). Resume status becomes `needs_review`. Empty Talent Network fields (phone, LinkedIn, location, title, company, years, experience, catalog skills) are filled from PDF/DOCX text; existing recruiter-entered values are not overwritten. Recruiters with `candidate_pii.read` review PDFs and DOCX resumes on the Transition Talent Profile or candidate profile and can re-run fill from the stored file. Conversion stays in WorkforceOS; external document viewers are not used. Legacy `.doc` files download via `/api/files/[fileId]`.
5. Record a candidate engagement. Notify the configured military talent owner role.
6. Send acknowledgement email. No guarantee of matching, SkillBridge approval, interview, or employment.

A public job posting is not required before a transitioning service member can join the Military Talent Network.

Copy on public pages must not promise SkillBridge approval, placement, or conversion, and must not describe a "PierOne SkillBridge program."
