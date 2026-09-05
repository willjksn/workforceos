# Incident response

Lightweight process for WorkforceOS production incidents. Do not expand this into a public status page or a second ticketing product.

## Severity

| Level | Examples | First action |
| --- | --- | --- |
| 1 | Auth outage, database unreachable, suspected data exposure | Stop changes. Preserve logs. Page Managing Partner + Strategy & Technology Administrator. |
| 2 | Integration failure blocking billing or e-sign, AI provider down, failed production deploy | Disable the failing path if a kill switch exists. Continue other modules. |
| 3 | Single failed agent run, one stale sync, preview-only breakage | Fix in the module. No all-hands. |

Never paste `DATABASE_URL`, Clerk secret keys, storage keys, or candidate emails/phones into chat transcripts.

## Auth outage (Clerk)

1. Confirm https://status.clerk.com and Vercel deployment health.
2. Users with valid Clerk sessions still fail if the local `users` row is disabled — check `/app/admin/users` when the app can load.
3. If Clerk is down, do not bypass middleware. Wait or roll back a bad Clerk env change (live keys mixed into preview, wrong domain).
4. After recovery: one sign-in, one authorized `/app` load, confirm `last_login_at` updated.

## Database outage (Neon)

1. Check Neon console status and compute. Do not run ad-hoc SQL “fixes” on production.
2. If data corruption or a bad migration: PITR / restore a branch per `docs/operations/WORKFORCEOS_OPERATING_PLAYBOOK.md`. Then `npm run db:check`.
3. Application rollback does not undo a migration. Restore the database if schema changed.
4. After recovery: Command Center loads, `npm run test:smoke` against a restored preview branch if time allows.

## Integration failure

1. Open `/app/alerts` and `/app/admin/integrations`. Identify provider and last `integration_events` status.
2. Unconfigured providers are mocks — do not treat mock success as production health.
3. Rotate keys in Vercel if credentials leaked or expired. Retry the failed event from the Integration Hub when a retry action exists.
4. QuickBooks remains the accounting ledger. Do not invent invoices in WorkforceOS to “catch up.”

## AI failure

1. `/app/ai-operations/failures` and circuit breaker state. Heuristic fallback may still draft; it must not auto-approve.
2. If the provider is over quota or keys are wrong, unset is safer than leaving a broken key that retries.
3. Pending reviews stay pending. Humans decide. Do not SQL-approve `approvals`.

## Data exposure concern

1. Treat as Severity 1. Disable implicated API keys (Clerk, storage, AI, integrations) if an export or log may have leaked them.
2. Identify whether Restricted PII left the system (CSV with `reports.export_pii`, storage signed URL, log). Audit events record export; they must not contain the raw PII in `before`/`after` for privacy deletion.
3. For a candidate: privacy deletion if required; do not use ordinary archive as a substitute.
4. Rotate signed URL / storage credentials if objects were public by mistake. Objects are private; signed URLs expire.

## Deployment regression

1. In Vercel, redeploy the previous production deployment.
2. If the release included migration `0007` or later, restore Neon to before migrate rather than editing applied SQL.
3. Confirm `/app/admin/system-health` version and a smoke path: sign-in, Command Center, one CRM read, one talent read.

## After-action

Record: time detected, time restored, environment, commit/deployment, data restored (yes/no), and follow-up tickets. No candidate contact fields in the write-up.
