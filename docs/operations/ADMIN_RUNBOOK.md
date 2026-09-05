# Admin runbook

Day-to-day operating tasks for WorkforceOS administrators. Managing Partner, Operations Administrator, and Strategy & Technology Administrator use these screens. Engineering registries (agents, requirements, decisions) are not Admin nav items.

## People and access

- `/app/admin/users` — invite mapping is Clerk; roles are local. Disable rather than delete when someone leaves.
- `/app/admin/roles` — Strategy & Technology Administrator and Managing Partner. Operations Administrator cannot open this screen.
- `/app/admin/access-review` — last login, account status, sensitive permissions (`candidate_pii.read`, `reports.export_pii`, `privacy.delete`, admin/finance/contract approvals), stale accounts (no login in 30 days).

A disabled local user cannot use the app even with a live Clerk session.

## System status

`/app/admin/system-health` shows app version, environment, database, migrations, `vector` / `pg_trgm`, Clerk, Inngest, storage, integrations, AI provider, 24h queue failures, and a backup reminder. It never displays secrets or connection strings.

## Data quality vs alerts

- `/app/admin/data-quality` — completeness and freshness only (missing fields, stale contacts, unknown consent). Not performance or quality-of-hire.
- `/app/alerts` — operating exceptions from current records (stale opportunities, overdue invoices, failed syncs, review backlog).

## Reports and exports

- `/app/reports` — live PostgreSQL aggregates with date/client/service/owner filters. Save a named filter; this is not a BI dashboard builder.
- CSV export requires `reports.export`. Candidate email/phone CSV requires `reports.export_pii` and writes `report.exported_pii`.
- There is no Excel/PDF exporter in V1 unless a later engine is added. Do not paste Restricted PII into chat or tickets.

## Privacy

Ordinary archive hides a candidate from operating lists and is reversible.

Privacy deletion (`privacy.delete` on the candidate Privacy tab) anonymizes Restricted PII, sets do-not-contact, records `privacy_deleted_at`, and writes a redacted audit event. It is not the same as archive. Do not re-enter the original email or phone into audit notes.

## Approvals

`/app/admin/approvals` and `/app/ai-operations/review` are the human gates for material AI output, workforce recommendations, and similar reviews.

## Integrations

`/app/admin/integrations` — reconnect credentials via environment variables. Failed billing syncs and unsigned webhooks are not “fixed” by clicking a mock provider healthy.

## Seeds and fixtures

Never run `npm run db:seed:dev` against production. Harbor, Taylor Ellis, Navy EM, and Cedar Ridge Energy are development fixtures. Production catalog seed is `npm run db:seed:prod`.

## When something looks empty

Reports, Command Center, and alerts show stored rows only. Empty means there is no qualifying record, not that the metric was estimated.
