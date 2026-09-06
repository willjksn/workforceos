# Application workflow

A Candidate is a person. An Application is that person applying to a Job.

## Identity

Before insert, `matchExistingCandidate` uses normalized email and phone. Name-only matches never merge. Ambiguous matches set `duplicate_review_required` and insert `candidate_dedupe_flags`.

## Pipelines

Configurable by `jobs.job_context_type`:

- Internal: Applied → … → Hired
- Client: Applied → Recruiter Review → … → Placement / Started (reuses submissions/placements concepts)
- SkillBridge: Applied → Military Profile Review → … → Hired (reuses `skillbridge_profiles` / opportunities)

Stage changes append `application_stage_history`.

## Review

`/app/recruiting/applications` and `/app/recruiting/applications/[applicationId]`. Material dispositions require `applications.reject` and an allowlisted reason. Scout cannot reject with `source=scout`.

## Matching

Reuse `scoreCandidateJobMatch`. Scores are explainable and never auto-reject.
