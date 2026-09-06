# Onboarding architecture

Phase 10 onboarding is new-hire tasking, not an HRIS.

## Tables

- `onboarding_templates` / `onboarding_template_tasks`
- `onboarding_instances` / `onboarding_tasks`
- `employees` linked to `candidate_id`

Default template slug: `general-employee` (forms, handbook, email, WorkforceOS access, manager meeting, 30-day check-in).

## Internal operating path (required)

Recruiters/operations start onboarding from the application page (`onboarding.manage`). Tasks appear on `/app/onboarding`. Staff complete tasks with `onboarding.complete`. Internal onboarding works without a candidate portal.

## Automation

Inngest: interview reminders, onboarding reminder cron, offer expiration cron. Do not run large scans on the request path.

## New-hire access (follow-on, not required for Phase 10)

Do not expose `/app` to new hires. `/onboarding/access` is a reserved public path for a later signed-token portal. Tokens are not issued in Phase 10. Until that portal exists, recruiters complete tasks internally.

Candidate self-scheduling of interviews is also follow-on. See [INTERVIEW_SCHEDULING.md](../recruiting/INTERVIEW_SCHEDULING.md).

## Out of scope

Payroll, benefits enrollment, tax filing, PTO, LMS, employee relations cases.
