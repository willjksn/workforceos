# Changelog

## Unreleased

### Military Talent intermediary model

- Locked: PierOne is the intermediary between transitioning service members and employer/host-company opportunities. SkillBridge is a pathway/opportunity type, not a PierOne-owned SkillBridge program.
- Public site copy, CTAs, emails, Scout, and WorkforceOS Military Talent navigation now use Transition Talent Profile / employer opportunity language. `/military-talent/join` is the canonical network intake; `/skillbridge/join` redirects there.
- Public gateway errors map HTML/non-JSON upstream responses to a safe "Service temporarily unavailable." message. Signed-out `/app` redirects to `/sign-in` instead of relying on Clerk `protect()` 404 behavior.

### PierOne public website + WorkforceOS public gateway

- Added a separately deployable public website at `sites/pierone` (Vercel root `sites/pierone`) without relocating WorkforceOS `app/`.
- Extended the public gateway with `POST /api/public/v1/inquiries`, `POST /api/public/v1/military-talent`, and `GET /api/public/v1/health`. Employer inquiries become `website_inquiries` intake records; opportunities are not auto-created.
- Implemented the S3-compatible StorageProvider for private resume storage. Local adapter remains development-only.
- Shared public DTOs in `packages/public-api-contracts`. Production HMAC between the first-party website and WorkforceOS write APIs (`PUBLIC_SITE_INTEGRATION_SECRET` / `WORKFORCEOS_SITE_SECRET`). Development may omit the secret; production rejects unsigned public writes. Origin/Referer cannot skip HMAC. Multipart signatures hash exact body bytes. Request IDs are replay-blocked for 10 minutes.
- Added WorkforceOS Public Content (`public_content_items`, `/app/public-content`, `GET /api/public/v1/content`) so authorized users can feature jobs, SkillBridge roles, banners, notices, announcements, and industry campaigns without redeploying pieronepartners.com. Stable brand copy stays in `sites/pierone`. Schema migration `drizzle/0012_wise_scourge.sql`.
- Internal CRM view at `/app/crm/inquiries`. Scout can search website inquiries and convert them with confirmation.
- Added `npm run test:public-site`. Production HMAC is required; System Health no longer reports public write APIs as ready when storage, Resend, or the site secret are missing in production.

### Phase 10 — Careers, applicant tracking, and onboarding

- Extended WorkforceOS with job requisitions, job-description versions, public job postings, applications, interview plans/scorecards, pre-employment checks, offer versioning, employees, and onboarding templates. One global Candidate remains the person record.
- Public careers: `/careers`, `/jobs/[slug]`, `/api/public/v1/jobs`, `/api/public/v1/applications` (multipart resume upload for PDF/DOC/DOCX through StorageProvider). Rate limiting, magic-byte validation, and confidential-client redaction. Not a public job marketplace.
- Added EmailProvider (Resend + mock + production unconfigured-fail). CalendarProvider is mock-only (`liveScheduling` false). BackgroundCheckProvider is manual; Checkr HTTP API is not wired. DrugScreenProvider is always manual. Humans review; results never auto-reject.
- Scout searches hiring queues; material rejection and external sends still require a human. Command Center hiring metrics read PostgreSQL aggregates only. System Health does not display secrets.
- Internal onboarding at `/app/onboarding` works without a candidate portal. `/onboarding/access` and candidate self-scheduling are documented follow-on.
- Added `npm run test:phase10`. Schema migration `drizzle/0010_nostalgic_scarecrow.sql` (also creates research session/cache tables that were already in the Drizzle schema). Development fixtures are fake applicants only and cannot seed production.
- Parked unfinished AI/research runtime at `1a356d3` (`follow-on/parked-working-tree`) is not part of Phase 10 and must not be merged for this completion.

### Post-Phase-9 stabilization

- Locked Admin Approvals behind platform admin and organization scope. Command Center pending-approval widgets follow the same gate.
- Command Center no longer loads full finance engagement economics or unbounded recruiting/integration lists for dashboard counts.
- Scout SQL rejection no longer blocks natural-language UPDATE; result sets cap at 25; drafts are audited.
- SkillBridge window math uses UTC calendar days; queue windows follow stored alert-rule thresholds; follow-up scan has a daily Inngest cron and a unique notification index (`drizzle/0009_swift_saracen.sql`).
- Production-safe AI seed no longer requires a Managing Partner user row. Storage health is ready only for the working local adapter.
- Added operations docs: migration runbook, performance audit, disaster recovery, pilot plan, and post-launch backlog.

### Phase 9 — Scout + SkillBridge operations

- Added Scout, the persistent WorkforceOS intelligence assistant (tooltip: Open Scout). Right-side drawer on authenticated screens. Closed command registry; no model-generated SQL; chat is not the system of record.
- Scout uses route page context, RBAC/PII stripping before model context, confirmation cards for material writes, and Draft → Human Review → Send/Copy (never auto-send).
- Added SkillBridge operations as a first-class Military Talent workflow. SkillBridge people are existing Talent Network candidates (`skillbridge_profiles` 1:1). Employer opportunities, configurable alert rules, Inngest scans, and in-app notifications.
- Command Center and military reports include live SkillBridge counts. My SkillBridge Queue is owner-scoped (managers with `skillbridge.manage` can view global).
- Added schema migration `drizzle/0008_cooing_blade.sql` and `npm run test:phase9` (25 acceptance tests).
- Development fixtures include ≥12 labeled SkillBridge candidates. Production seed loads alert-rule defaults only, not those people.

### Phase 8 — Executive reporting + Command Center + production hardening

- Finalized the Executive Command Center with live PostgreSQL aggregates (business, sales, recruiting, talent, workforce, projects, AI, integrations). Empty values stay empty.
- Added a Reports module (date/client/service/owner filters, saved views, CSV export). PII CSV requires `reports.export_pii` and an audit event. Not a BI dashboard builder.
- Added Data Quality (completeness/freshness only), operational alerts, Admin access review, and a System status page that never shows secrets.
- Hardened privacy deletion (distinct from archive), rate limits, IDOR scoping, storage upload limits/checksum, seed guards, and optional Sentry via `SENTRY_DSN`.
- Added schema migration `drizzle/0007_chemical_quasar.sql`, `npm run test:phase2`, `npm run test:phase8`, `npm run test:smoke`, and operating playbooks under `docs/operations/`.

### Phase 7 — AI Operations + Automation

- Activated the approved agent registry (plus optional Finance, Compliance, and Candidate Engagement assistants) on top of PostgreSQL, approved workflows, RBAC, audit, approvals, and provenance.
- Added prompt versioning, provider abstraction with heuristic fallback, a reusable context builder, Review Queue, named automation rules, autonomy levels 0–4, knowledge records with ACL-filtered retrieval, cost limits, circuit breakers, and recorded agent handoffs.
- Agents cannot self-approve, submit candidates, send proposals, or execute contracts. Internal Talent Network search, project creation after contract execution, and billing events remain workflow-gated.
- Added schema migration `drizzle/0006_mushy_iron_lad.sql` and `npm run test:phase7`.

### Phase 6 — Finance + Billing + Business Integrations

- Expanded Phase 4 `billing_schedules` / `billing_events` into operational finance: invoices, payments, AR aging, revenue events, and engagement economics. QuickBooks remains the accounting ledger.
- Placement fees come from stored search-agreement terms (salary × percent, negotiated amount, minimum fee). Overrides require reason, user, date, `finance.approve`, and an audit event.
- Integration Hub adapters for QuickBooks, DocuSign, Apollo, O\*NET, SeekOut (preferred sourcing), LinkedIn (no scrape), and Microsoft/Google workspace references. Unconfigured providers are labeled mocks — never fake production connections.
- DocuSign keeps manual execution when credentials are missing. Unsigned webhooks cannot mark a contract executed. Apollo enrichment is review-gated and does not silently overwrite approved CRM fields.
- Added schema migration `drizzle/0005_unknown_satana.sql` and `npm run test:phase6`.
- Harbor, Taylor Ellis, Navy EM, and Cedar Ridge Energy remain development fixtures. Do not run `db:seed:dev` against real production.

### Phase 5 — Workforce Development + Workforce Intelligence

- Expanded Workforce Pipeline Assessment into planning-level workforce roles, baselines, versioned 12/24/36-month forecasts, supply, structured gaps, pipelines, education/training, career pathways, skills-gap analysis, and scenario modeling.
- Forecasts, gaps, and scenarios store provenance, assumptions, confidence, version, and reviewer. They are never presented as certain. Delivered assessments are not overwritten.
- Military overlay reuses Phase 3 mappings. Talent Network overlay uses aggregate counts (no unnecessary PII). BLS/Census/O\*NET stay behind the Integration Hub as unconfigured adapters plus labeled fixtures.
- Client-facing Workforce Pipeline Plans and AI drafts require human approval. Approved roadmaps create `project_tasks` on existing delivery projects.
- Added schema migration `drizzle/0004_melted_stryfe.sql` and `npm run test:phase5`.
- Development fixture: Cedar Ridge Energy. Harbor, Taylor Ellis, and Navy EM remain development fixtures. Do not run `db:seed:dev` against real production.

### Phase 4 — Service Engines + Proposals + Contracts + Project Delivery

- Added a reusable service workflow engine for the five launch services. Approved versions and workflows are loaded from PostgreSQL.
- Added discovery, solution plans, proposals (with versioning and HTML export), legal templates, contract packages, manual e-sign, delivery projects, deliverables, billing triggers, closeout, and expansion suggestions.
- Search projects remain recruiting containers. Delivery projects require an executed contract unless a Managing Partner override is audited.
- Added schema migration `drizzle/0003_vengeful_tyger_tiger.sql`.
- Added `npm run test:phase4`.
- Installation interactive map remains deferred to Phase 3.5. QuickBooks invoicing is not implemented.

### Deployment readiness

- Split production-safe seed (`db:seed:prod`) from development fixtures (`db:seed:dev`). Harbor, Taylor Ellis, and Navy EM test mappings are excluded from production seed.
- Hardened Vercel storage fallback so the local disk adapter is not used in production.
- Added `NEXT_PUBLIC_APP_URL` / `APP_URL`, `db:check` migration/extension/table validation, and first-admin bootstrap (`db:bootstrap-admin`).
- Documented Neon/Vercel/Clerk environment separation in `docs/architecture/DATABASE_DEPLOYMENT.md` and `docs/architecture/VERCEL_DEPLOYMENT_CHECKLIST.md`.

### Phase 3 — Recruiting Operations + Military Talent Translator

- Added recruiting operations: job intake, canonical job skills, internal-first search, job-specific match components, pipeline, screening, submissions, interviews, offers, placements, and agreement-based guarantees.
- Added recruiting analytics from live PostgreSQL counts. External sourcing remains Integration Hub hooks and stays blocked until internal search is complete.
- Added military occupation library, skills translator, reverse search, installation targeting, bridge training, military candidate filter, and mapping review with provenance.
- Added schema migration `drizzle/0002_fancy_pretty_boy.sql` for recruiting and military operating columns/tables.
- Installation interactive map is deferred to Phase 3.5; list/geo and `coordinate_source` are the Phase 3 foundation.
- Inngest jobs cover internal talent search and stalled recruiting alerts (in-app only).

### Phase 2 — CRM Command Center

- Added Command Center aggregates from live PostgreSQL counts.
- Recast internal navigation around CRM, Talent Network, Recruiting, Military, and later-phase placeholders.
- Added first-class Contacts, Opportunities, and Signals routes with scoring, review, conversion, and activity logging.
- Expanded CRM/Talent schema for scoring, signals review, designations, and activities (`drizzle/0001_useful_frog_thor.sql`).
- Seeded additional demo companies and candidates without changing Harbor graph acceptance counts.

### Phase 2 — operating UI

- Added company CRM screens for companies, locations, contacts, signals, and opportunities.
- Added Talent Network screens for candidates and pools, with Restricted PII redaction.
- Added Professional Search jobs UI that always creates an internal Talent Network search project and scores job-specific matches.
- Seeded versioned workflow steps for all five launch services.
- Added Military Talent Opportunity Assessment UI: occupation translation, reverse civilian search, human-approved solution plans, and delivery projects.

### Phase 1 — technical foundation

- Stabilized the existing Next.js App Router application.
- Added architecture, business, database, decision, integration, requirements, and workflow documentation.
- Added Cursor project rules.
- Added typed environment validation.
- Added Neon/Drizzle foundation, pgvector, and pg_trgm.
- Added Clerk authentication with local user synchronization.
- Added RBAC, audit logging, approvals, agent registry, Inngest, storage abstraction, and Integration Hub foundations.
- Added initial CRM, talent, recruiting, military, service, project, and search schemas.
- Added tests, database acceptance script, system health page, and deployment notes.

Later phases add additional operating modules on this foundation; they are not an architecture replacement.
