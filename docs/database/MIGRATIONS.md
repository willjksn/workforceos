# Database migrations

Migrations live in `drizzle/` and are generated from `db/schema/`.

## Commands

```bash
npm run db:generate
npm run db:migrate
npm run db:check
```

`npm run build` does not migrate. Vercel must not run migrations as part of the application build.

## Seeds

| Command | Safe for production? | Contents |
| --- | --- | --- |
| `npm run db:seed:dev` | No | Organization plus Harbor/Taylor Ellis/Navy EM/SkillBridge development fixtures |
| `npm run db:seed:prod` | Yes | Organization, roles, launch services, disabled agent registry, locked requirements, decision log |

Do not automatically run development seed data in production.

## Extensions

The first migration enables:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Do not enable these with ad-hoc production SQL if a migration can do it.

## Applied migrations

| File | Purpose |
| --- | --- |
| `drizzle/0000_*` | Phase 1 foundation. Do not rewrite. |
| `drizzle/0001_useful_frog_thor.sql` | Phase 2 CRM/Talent operating columns. Do not rewrite. |
| `drizzle/0002_fancy_pretty_boy.sql` | Phase 3 recruiting operations and military translator. Adds pipeline/job enum values, match component scores, screenings, guarantees, bridge training, translations, occupation import log, and mapping provenance. |
| `drizzle/0003_vengeful_tyger_tiger.sql` | Phase 4 service engines, proposals, contracts, delivery projects, billing triggers, and expansion recommendations. Do not rewrite. |
| `drizzle/0004_melted_stryfe.sql` | Phase 5 workforce development and intelligence. Do not rewrite. |
| `drizzle/0005_unknown_satana.sql` | Phase 6 operational finance and business integrations. Expands `billing_schedules` / `billing_events` and adds invoices, payments, revenue events, enrichment reviews, webhook receipts, and O*NET alternate titles. Do not rewrite `0000`–`0004`. |
| `drizzle/0006_mushy_iron_lad.sql` | Phase 7 AI operations: agent run contract, prompts, knowledge, automation, handoffs, usage, and circuit breakers. Do not rewrite `0000`–`0005`. |
| `drizzle/0007_chemical_quasar.sql` | Phase 8: privacy deletion requests, rate-limit buckets, last login, privacy_deleted_at, file retention, report/alert indexes. Do not rewrite `0000`–`0006`. |
| `drizzle/0008_cooing_blade.sql` | Phase 9: Scout sessions/messages/actions, SkillBridge operating tables, in-app notifications. Do not rewrite `0000`–`0007`. |
| `drizzle/0009_swift_saracen.sql` | Post-Phase-9: unique index so SkillBridge follow-up scans do not duplicate in-app notifications. Do not rewrite `0000`–`0008`. |
| `drizzle/0010_nostalgic_scarecrow.sql` | Phase 10 hiring/ATS/onboarding tables, plus research session/cache tables that were already in the Drizzle schema when this migration was generated. Do not rewrite `0000`–`0009`. |
| `drizzle/0011_keen_korvac.sql` | Public intake settings and website inquiries. Do not rewrite `0000`–`0010`. |
| `drizzle/0012_wise_scourge.sql` | Public content items. Do not rewrite `0000`–`0011`. |
| `drizzle/0013_nervous_maggott.sql` | Phase C: `users.organizational_title`, `user_permission_overrides`, Military Talent Partner role slug and access-bundle display names. Do not rewrite `0000`–`0012`. Already on production-launch before 2026-09-09. |
| `drizzle/0014_rainy_doomsday.sql` | Phase E Academy: `user_training_progress`. Do not rewrite `0000`–`0013`. Applied to production-launch 2026-09-09. |
| `drizzle/0015_dizzy_wrecker.sql` | Phase H staff onboarding: `staff_onboarding`, `staff_onboarding_equipment`, `staff_policy_acknowledgements`, `users.manager_id`. Do not rewrite `0000`–`0014`. Applied to production-launch 2026-09-09. |
| `drizzle/0016_lyrical_giant_girl.sql` | Phase K GTM: `companies.gtm_tier` / `companies.gtm_region`. Do not rewrite `0000`–`0015`. Applied to production-launch 2026-09-09. |
| `drizzle/0017_quiet_scale.sql` | Phase L scale: SkillBridge `ets_date` / `eaos_date`, `public_access_tokens`, `report_export_schedules` / `report_export_jobs`, alert-rule codes `window_starting_soon` / `window_ending_soon`. Org FKs `ON DELETE restrict`. Do not rewrite `0000`–`0016`. Applied to production-launch 2026-09-09. |

Enum values are added in a separate statement from column defaults that use those values. Postgres rejects `ADD VALUE` and `DEFAULT` of that value in the same transaction.

## Preview databases

Neon preview branching should run the same migration set. See `docs/architecture/DATABASE_DEPLOYMENT.md` and `docs/architecture/DEPLOYMENT.md`.
