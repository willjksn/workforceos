# Onboarding architecture

Phase 10 onboarding is new-hire tasking, not an HRIS.

## Tables

- `onboarding_templates` / `onboarding_template_tasks`
- `onboarding_instances` / `onboarding_tasks`
- `employees` linked to `candidate_id`

Default template slug: `general-employee` (forms, handbook, email, WorkforceOS access, manager meeting, 30-day check-in).

## Automation

Inngest: interview reminders, onboarding reminder cron, offer expiration cron. Do not run large scans on the request path.

## New-hire access

Do not expose `/app`. A signed token / external portal can be added on `onboarding/access` (public path reserved). Until tokens are issued, recruiters complete tasks internally.

## Out of scope

Payroll, benefits enrollment, tax filing, PTO, LMS, employee relations cases.
