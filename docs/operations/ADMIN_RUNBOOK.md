# Admin runbook

Day-to-day operating tasks for WorkforceOS administrators. Managing Partner, Operations Administrator, and Strategy & Technology Administrator use these screens. Engineering registries (agents, requirements, decisions) are not Admin nav items.

## People and access

- `/app/admin/users` — **Invite person** sends the Clerk email and assigns the local role at the same time. Do not invite only in the Clerk Dashboard; that signs them in with no role (Command Center only). Disable rather than delete when someone leaves. Clerk metadata is not authorization. Access bundles and access review are tabs on this screen, not separate Admin nav items.
- `/app/admin/roles` — Strategy & Technology Administrator and Managing Partner. Open from Team & Access → Access bundles. Operations Administrator cannot open this screen.
- `/app/admin/access-review` — Team & Access → Access review. Last login, account status, sensitive permissions (`candidate_pii.read`, `reports.export_pii`, `privacy.delete`, admin/finance/contract approvals), stale accounts (no login in 30 days).

A disabled local user cannot use the app even with a live Clerk session.

## System status

`/app/admin/system-health` is not on the daily Admin sidebar. Open it from Connected tools. It shows app version, environment, database, migrations, `vector` / `pg_trgm`, Clerk, Inngest, storage, integrations, AI Runtime / OpenAI / Fallback, Resend, calendar, background/drug providers, public careers API, 24h queue failures, and a backup reminder. OpenAI is the production AI provider for launch (LIVE + VERIFIED after a recorded FAST/STANDARD/REASONING completion). Gemini availability fallback is DEFERRED until `AI_FALLBACK_ENABLED=true`. The page has one **AI Runtime Verification** card (`Run AI verification`). **Run fallback test** appears only when fallback is enabled. It never displays secrets or connection strings.

## Data quality vs alerts

- `/app/admin/data-quality` — completeness and freshness only (missing fields, stale contacts, unknown consent). Not performance or quality-of-hire. Not on the daily Admin sidebar; open from Alerts.
- `/app/alerts` — operating exceptions from current records (stale opportunities, overdue invoices, failed syncs, review backlog).

## Reports and exports

- `/app/reports` — live PostgreSQL aggregates with date/client/service/owner filters. Save a named filter; this is not a BI dashboard builder.
- CSV export requires `reports.export`. Candidate email/phone CSV requires `reports.export_pii` and writes `report.exported_pii`.
- There is no Excel/PDF exporter in V1 unless a later engine is added. Do not paste Restricted PII into chat or tickets.

## Privacy

Ordinary archive hides a candidate from operating lists and is reversible.

Privacy deletion (`privacy.delete` on the candidate Privacy tab) anonymizes Restricted PII, sets do-not-contact, records `privacy_deleted_at`, and writes a redacted audit event. It is not the same as archive. Do not re-enter the original email or phone into audit notes.

## Approvals

`/app/ai-operations/review` is the operator Review Queue (Admin sidebar). `/app/admin/approvals` is the platform-admin history of stored approval rows; open it from Review Queue → Approval history. Agents cannot approve their own work.

## Integrations

`/app/integrations` (Connected tools) is the Admin sidebar destination. `/app/admin/integrations` (Integration Hub) is credentials and health — open it from Connected tools. Failed billing syncs and unsigned webhooks are not “fixed” by clicking a mock provider healthy.

## Seeds and fixtures

Never run `npm run db:seed:dev` against production. Harbor, Taylor Ellis, Navy EM, and Cedar Ridge Energy are development fixtures. Production catalog seed is `npm run db:seed:prod`.

## When something looks empty

Reports, Command Center, and alerts show stored rows only. Empty means there is no qualifying record, not that the metric was estimated.
